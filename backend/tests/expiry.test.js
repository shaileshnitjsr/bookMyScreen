const { expirePendingBookings } = require("../src/services/bookingExpiry");
const {
    pool,
    createTestShow,
    createTestShowSeats,
    cleanupTestShow,
    getBooking,
    getShowSeat,
    getShowSeats,
} = require("./testHelper");

describe("Task 6 & 7 — Booking Expiry & Competing Workers", () => {
    let testShow;
    let seatIds;

    beforeEach(async () => {
        testShow = await createTestShow();
        seatIds = await createTestShowSeats(testShow.id, 12, "150.00");
    });

    afterEach(async () => {
        await cleanupTestShow(testShow.id);
    });

    afterAll(async () => {
        await pool.end();
    });

    async function createDirectBooking({
        userId = 1,
        showId,
        status = "pending",
        totalAmount = "150.00",
        expiresAt,
        seatIdList,
    }) {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            const bRes = await client.query(
                `INSERT INTO bookings (user_id, show_id, status, total_amount, expires_at)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [userId, showId, status, totalAmount, expiresAt]
            );
            const bookingId = bRes.rows[0].id;

            for (const sId of seatIdList) {
                await client.query(
                    `INSERT INTO booking_seats (booking_id, show_id, seat_id, price)
                     VALUES ($1, $2, $3, $4)`,
                    [bookingId, showId, sId, totalAmount]
                );

                await client.query(
                    `UPDATE show_seats
                     SET status = $1,
                         booking_id = $2
                     WHERE show_id = $3 AND seat_id = $4`,
                    [status === "available" ? "available" : "reserved", bookingId, showId, sId]
                );
            }

            await client.query("COMMIT");
            return bookingId;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }

    test("expires overdue pending booking and releases its reserved seats", async () => {
        const pastDate = new Date(Date.now() - 5 * 60 * 1000); // 5 mins ago
        const targetSeat = seatIds[0];

        const bookingId = await createDirectBooking({
            showId: testShow.id,
            status: "pending",
            expiresAt: pastDate,
            seatIdList: [targetSeat],
        });

        const initialSeat = await getShowSeat(testShow.id, targetSeat);
        expect(initialSeat.status).toBe("reserved");
        expect(initialSeat.booking_id).toBe(String(bookingId));

        const expiredCount = await expirePendingBookings();
        expect(expiredCount).toBeGreaterThanOrEqual(1);

        // Verify PostgreSQL Database State
        const booking = await getBooking(bookingId);
        expect(booking.status).toBe("expired");

        const updatedSeat = await getShowSeat(testShow.id, targetSeat);
        expect(updatedSeat.status).toBe("available");
        expect(updatedSeat.booking_id).toBeNull();
    });

    test("does not expire pending bookings whose deadline is in the future", async () => {
        const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 mins from now
        const targetSeat = seatIds[1];

        const bookingId = await createDirectBooking({
            showId: testShow.id,
            status: "pending",
            expiresAt: futureDate,
            seatIdList: [targetSeat],
        });

        await expirePendingBookings();

        // Booking must remain pending
        const booking = await getBooking(bookingId);
        expect(booking.status).toBe("pending");

        // Seat must remain reserved
        const seat = await getShowSeat(testShow.id, targetSeat);
        expect(seat.status).toBe("reserved");
        expect(seat.booking_id).toBe(String(bookingId));
    });

    test("does not affect confirmed or cancelled bookings even if overdue", async () => {
        const pastDate = new Date(Date.now() - 10 * 60 * 1000);

        const confirmedId = await createDirectBooking({
            showId: testShow.id,
            status: "confirmed",
            expiresAt: pastDate,
            seatIdList: [seatIds[2]],
        });

        const cancelledId = await createDirectBooking({
            showId: testShow.id,
            status: "cancelled",
            expiresAt: pastDate,
            seatIdList: [seatIds[3]],
        });

        await expirePendingBookings();

        const confirmedBooking = await getBooking(confirmedId);
        expect(confirmedBooking.status).toBe("confirmed");

        const cancelledBooking = await getBooking(cancelledId);
        expect(cancelledBooking.status).toBe("cancelled");
    });

    test("releases only seats belonging to the expired booking and does not touch other bookings", async () => {
        const pastDate = new Date(Date.now() - 5 * 60 * 1000);
        const futureDate = new Date(Date.now() + 15 * 60 * 1000);

        // Booking A is expired
        const bookingA = await createDirectBooking({
            showId: testShow.id,
            status: "pending",
            expiresAt: pastDate,
            seatIdList: [seatIds[4]],
        });

        // Booking B is active (future)
        const bookingB = await createDirectBooking({
            showId: testShow.id,
            status: "pending",
            expiresAt: futureDate,
            seatIdList: [seatIds[5]],
        });

        await expirePendingBookings();

        // Booking A seats released
        const seatA = await getShowSeat(testShow.id, seatIds[4]);
        expect(seatA.status).toBe("available");
        expect(seatA.booking_id).toBeNull();

        // Booking B seats NOT released
        const seatB = await getShowSeat(testShow.id, seatIds[5]);
        expect(seatB.status).toBe("reserved");
        expect(seatB.booking_id).toBe(String(bookingB));
    });

    test("Task 7: competing concurrent expiry workers process overlapping expired bookings safely with SKIP LOCKED", async () => {
        const pastDate = new Date(Date.now() - 5 * 60 * 1000);
        const bookingCount = 6;
        const createdIds = [];

        for (let i = 0; i < bookingCount; i++) {
            const bId = await createDirectBooking({
                showId: testShow.id,
                status: "pending",
                expiresAt: pastDate,
                seatIdList: [seatIds[6 + i]],
            });
            createdIds.push(bId);
        }

        // Run two workers simultaneously
        const [count1, count2] = await Promise.all([
            expirePendingBookings(),
            expirePendingBookings(),
        ]);

        // Together, the two workers should have expired all bookings
        expect(count1 + count2).toBeGreaterThanOrEqual(bookingCount);

        // Verify each created booking is expired
        for (const bId of createdIds) {
            const b = await getBooking(bId);
            expect(b.status).toBe("expired");
        }

        // Verify all 6 seats are available with NULL booking_id
        for (let i = 0; i < bookingCount; i++) {
            const seat = await getShowSeat(testShow.id, seatIds[6 + i]);
            expect(seat.status).toBe("available");
            expect(seat.booking_id).toBeNull();
        }
    });
});
