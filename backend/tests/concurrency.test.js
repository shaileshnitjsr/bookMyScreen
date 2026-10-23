const request = require("supertest");
const app = require("../src/app");
const {
    pool,
    createTestShow,
    createTestShowSeats,
    cleanupTestShow,
    getBooking,
    getBookingSeats,
    getShowSeat,
    getShowSeats,
} = require("./testHelper");

describe("Task 3 — Concurrent Booking Requests", () => {
    let testShow;
    let seatIds;

    beforeEach(async () => {
        testShow = await createTestShow();
        seatIds = await createTestShowSeats(testShow.id, 8, "200.00");
    });

    afterEach(async () => {
        await cleanupTestShow(testShow.id);
    });

    afterAll(async () => {
        await pool.end();
    });

    test("competing concurrent requests for the exact same seat: exactly 1 succeeds, others get 409", async () => {
        const targetSeatId = seatIds[0];
        const concurrencyCount = 10;

        // Send 10 genuinely concurrent booking requests for targetSeatId
        const promises = Array.from({ length: concurrencyCount }, (_, i) =>
            request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: testShow.id,
                    seatIds: [targetSeatId],
                })
        );

        const responses = await Promise.all(promises);

        const successes = responses.filter((r) => r.status === 201);
        const conflicts = responses.filter((r) => r.status === 409);
        const others = responses.filter(
            (r) => r.status !== 201 && r.status !== 409
        );

        expect(others).toHaveLength(0);
        expect(successes).toHaveLength(1);
        expect(conflicts).toHaveLength(concurrencyCount - 1);

        for (const conflict of conflicts) {
            expect(conflict.body.success).toBe(false);
            expect(conflict.body.message).toMatch(/no longer available/i);
        }

        const winningBookingId = successes[0].body.booking.id;

        // Verify PostgreSQL Database State
        // 1. Target seat must be reserved by the single winning booking
        const seatRow = await getShowSeat(testShow.id, targetSeatId);
        expect(seatRow.status).toBe("reserved");
        expect(seatRow.booking_id).toBe(String(winningBookingId));

        // 2. Exactly one booking was recorded
        const winningBooking = await getBooking(winningBookingId);
        expect(winningBooking).toBeDefined();
        expect(winningBooking.status).toBe("pending");

        // 3. Exactly one booking_seat record exists for this seat
        const bookingSeats = await getBookingSeats(winningBookingId);
        expect(bookingSeats).toHaveLength(1);
        expect(bookingSeats[0].seat_id).toBe(String(targetSeatId));

        // 4. Verify no other seats were touched
        const otherSeats = await pool.query(
            "SELECT status, booking_id FROM show_seats WHERE show_id = $1 AND seat_id != $2",
            [testShow.id, targetSeatId]
        );
        for (const row of otherSeats.rows) {
            expect(row.status).toBe("available");
            expect(row.booking_id).toBeNull();
        }
    });

    test("competing concurrent requests for overlapping multiple seats: at most one wins, no partial reservations", async () => {
        // Request A wants seats [seatIds[1], seatIds[2]]
        // Request B wants seats [seatIds[2], seatIds[3]]
        // Contested seat is seatIds[2]
        const reqA = request(app)
            .post("/api/bookings")
            .send({
                userId: 1,
                showId: testShow.id,
                seatIds: [seatIds[1], seatIds[2]],
            });

        const reqB = request(app)
            .post("/api/bookings")
            .send({
                userId: 1,
                showId: testShow.id,
                seatIds: [seatIds[2], seatIds[3]],
            });

        const [resA, resB] = await Promise.all([reqA, reqB]);

        const statuses = [resA.status, resB.status].sort();
        expect(statuses).toEqual([201, 409]);

        if (resA.status === 201) {
            // A won
            const bookingA = resA.body.booking;
            const seat1 = await getShowSeat(testShow.id, seatIds[1]);
            const seat2 = await getShowSeat(testShow.id, seatIds[2]);
            const seat3 = await getShowSeat(testShow.id, seatIds[3]);

            expect(seat1.status).toBe("reserved");
            expect(seat1.booking_id).toBe(String(bookingA.id));
            expect(seat2.status).toBe("reserved");
            expect(seat2.booking_id).toBe(String(bookingA.id));

            // Crucial: seat 3 (from losing request B) MUST remain available!
            expect(seat3.status).toBe("available");
            expect(seat3.booking_id).toBeNull();
        } else {
            // B won
            const bookingB = resB.body.booking;
            const seat1 = await getShowSeat(testShow.id, seatIds[1]);
            const seat2 = await getShowSeat(testShow.id, seatIds[2]);
            const seat3 = await getShowSeat(testShow.id, seatIds[3]);

            expect(seat2.status).toBe("reserved");
            expect(seat2.booking_id).toBe(String(bookingB.id));
            expect(seat3.status).toBe("reserved");
            expect(seat3.booking_id).toBe(String(bookingB.id));

            // Crucial: seat 1 (from losing request A) MUST remain available!
            expect(seat1.status).toBe("available");
            expect(seat1.booking_id).toBeNull();
        }
    });

    test("burst of 15 concurrent multi-seat requests competing for a pool of seats", async () => {
        // Pool of 4 seats: seatIds[4], seatIds[5], seatIds[6], seatIds[7]
        const poolSeats = [seatIds[4], seatIds[5], seatIds[6], seatIds[7]];
        const requestCount = 15;

        // Generate various seat pairings
        const requests = Array.from({ length: requestCount }, (_, i) => {
            const s1 = poolSeats[i % poolSeats.length];
            const s2 = poolSeats[(i + 1) % poolSeats.length];
            return request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: testShow.id,
                    seatIds: [s1, s2],
                });
        });

        const responses = await Promise.all(requests);

        const successes = responses.filter((r) => r.status === 201);
        const conflicts = responses.filter((r) => r.status === 409);

        // Every request must either cleanly succeed or be rejected with conflict
        expect(successes.length + conflicts.length).toBe(requestCount);
        expect(successes.length).toBeGreaterThanOrEqual(1);
        expect(successes.length).toBeLessThanOrEqual(2); // Since 4 seats paired, max 2 pairs

        // Assert database state: NO seat can be assigned to multiple bookings
        const dbSeats = await getShowSeats(testShow.id);
        const reservedSeats = dbSeats.filter((s) => s.status === "reserved");

        // Collect all booking_ids from show_seats
        const bookingIds = reservedSeats.map((s) => s.booking_id);
        expect(bookingIds.every((id) => id !== null)).toBe(true);

        // Ensure booking_seats matches exactly
        for (const success of successes) {
            const bId = success.body.booking.id;
            const bSeats = await getBookingSeats(bId);
            expect(bSeats).toHaveLength(2);
            for (const bs of bSeats) {
                const ss = reservedSeats.find(
                    (s) => String(s.seat_id) === String(bs.seat_id)
                );
                expect(ss).toBeDefined();
                expect(String(ss.booking_id)).toBe(String(bId));
            }
        }
    });
});
