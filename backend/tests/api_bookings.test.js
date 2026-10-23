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

describe("POST /api/bookings - API and Database State", () => {
    let testShow;
    let seatIds;

    beforeAll(async () => {
        testShow = await createTestShow();
        seatIds = await createTestShowSeats(testShow.id, 6, "150.00");
    });

    afterAll(async () => {
        await cleanupTestShow(testShow.id);
        await pool.end();
    });

    describe("Input Validation", () => {
        test("rejects request missing userId", async () => {
            const res = await request(app)
                .post("/api/bookings")
                .send({
                    showId: testShow.id,
                    seatIds: [seatIds[0]],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/valid userId/i);
        });

        test("rejects request with negative or invalid userId", async () => {
            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: -1,
                    showId: testShow.id,
                    seatIds: [seatIds[0]],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test("rejects request missing showId", async () => {
            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    seatIds: [seatIds[0]],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/valid userId, showId/i);
        });

        test("rejects empty seat array", async () => {
            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: testShow.id,
                    seatIds: [],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test("rejects duplicate seat IDs in the request", async () => {
            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: testShow.id,
                    seatIds: [seatIds[0], seatIds[0]],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/unique seatIds/i);
        });

        test("rejects seatIds with invalid types or non-positive values", async () => {
            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: testShow.id,
                    seatIds: ["invalid_seat"],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe("Nonexistent Entities", () => {
        test("rejects booking for nonexistent user", async () => {
            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 999999999,
                    showId: testShow.id,
                    seatIds: [seatIds[0]],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/User or show does not exist/i);

            // Verify seat was NOT reserved
            const seat = await getShowSeat(testShow.id, seatIds[0]);
            expect(seat.status).toBe("available");
            expect(seat.booking_id).toBeNull();
        });

        test("rejects booking for nonexistent show", async () => {
            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: 999999999,
                    seatIds: [seatIds[0]],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/do not belong to this show/i);
        });

        test("rejects booking for nonexistent seat ID", async () => {
            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: testShow.id,
                    seatIds: [999999999],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/do not belong to this show/i);
        });
    });

    describe("Successful Booking & Actual Database State", () => {
        let createdBookingId;

        test("successfully reserves selected seats and returns booking payload", async () => {
            const requestedSeats = [seatIds[0], seatIds[1]];

            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: testShow.id,
                    seatIds: requestedSeats,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.booking).toBeDefined();
            expect(res.body.booking.status).toBe("pending");
            expect(res.body.booking.total_amount).toBe("300.00");
            expect(res.body.booking.expires_at).toBeDefined();
            expect(res.body.seats).toHaveLength(2);

            createdBookingId = res.body.booking.id;

            // Direct PostgreSQL State Assertions
            const bookingRow = await getBooking(createdBookingId);
            expect(bookingRow).toBeDefined();
            expect(bookingRow.status).toBe("pending");
            expect(bookingRow.show_id).toBe(String(testShow.id));
            expect(bookingRow.user_id).toBe("1");
            expect(bookingRow.total_amount).toBe("300.00");
            expect(new Date(bookingRow.expires_at).getTime()).toBeGreaterThan(
                new Date(bookingRow.created_at).getTime()
            );

            // Assert booking_seats associations
            const bookingSeats = await getBookingSeats(createdBookingId);
            expect(bookingSeats).toHaveLength(2);
            expect(bookingSeats.map((s) => s.seat_id)).toEqual(
                expect.arrayContaining([String(seatIds[0]), String(seatIds[1])])
            );
            expect(bookingSeats[0].price).toBe("150.00");

            // Assert show_seats ownership and status
            const seat1 = await getShowSeat(testShow.id, seatIds[0]);
            expect(seat1.status).toBe("reserved");
            expect(seat1.booking_id).toBe(String(createdBookingId));

            const seat2 = await getShowSeat(testShow.id, seatIds[1]);
            expect(seat2.status).toBe("reserved");
            expect(seat2.booking_id).toBe(String(createdBookingId));
        });

        test("rejects attempt to book already reserved seats (HTTP 409 Conflict)", async () => {
            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: testShow.id,
                    seatIds: [seatIds[0]], // already reserved in previous test
                });

            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/no longer available/i);
        });
    });

    describe("Multi-Seat Atomicity (Task 5)", () => {
        test("rejects request if at least one seat is unavailable, leaving other seats available", async () => {
            // seatIds[0] is already reserved.
            // seatIds[2] is currently available.
            const seat2Before = await getShowSeat(testShow.id, seatIds[2]);
            expect(seat2Before.status).toBe("available");
            expect(seat2Before.booking_id).toBeNull();

            const res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: testShow.id,
                    seatIds: [seatIds[0], seatIds[2]], // mix of reserved and available
                });

            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/no longer available/i);

            // Verify atomicity in database:
            // seatIds[2] MUST still be available, NOT reserved
            const seat2After = await getShowSeat(testShow.id, seatIds[2]);
            expect(seat2After.status).toBe("available");
            expect(seat2After.booking_id).toBeNull();

            // Verify seatIds[0] was not corrupted
            const seat0 = await getShowSeat(testShow.id, seatIds[0]);
            expect(seat0.status).toBe("reserved");

            // Verify no dangling booking was created for seatIds[2]
            const seats = await getShowSeats(testShow.id);
            const reservedCount = seats.filter((s) => s.status === "reserved").length;
            // Only seatIds[0] and seatIds[1] from the earlier test should be reserved
            expect(reservedCount).toBe(2);
        });
    });
});
