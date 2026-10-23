const request = require("supertest");
const app = require("../src/app");
const {
    pool,
    createTestShow,
    createTestShowSeats,
    cleanupTestShow,
    getShowSeat,
    getShowSeats,
} = require("./testHelper");

describe("Task 4 — Verify Transaction Rollback", () => {
    let testShow;
    let seatIds;

    beforeEach(async () => {
        testShow = await createTestShow();
        seatIds = await createTestShowSeats(testShow.id, 4, "180.00");
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await cleanupTestShow(testShow.id);
    });

    afterAll(async () => {
        await pool.end();
    });

    test("rolls back transaction when foreign key constraint fails (nonexistent user)", async () => {
        const targetSeat = seatIds[0];
        const nonexistentUserId = 999999999;

        const res = await request(app)
            .post("/api/bookings")
            .send({
                userId: nonexistentUserId,
                showId: testShow.id,
                seatIds: [targetSeat],
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/User or show does not exist/i);

        // Assert database state after rollback:
        // 1. No booking was created
        const bookingCheck = await pool.query(
            "SELECT * FROM bookings WHERE user_id = $1 AND show_id = $2",
            [nonexistentUserId, testShow.id]
        );
        expect(bookingCheck.rows).toHaveLength(0);

        // 2. Seat remains available and not reserved
        const seat = await getShowSeat(testShow.id, targetSeat);
        expect(seat.status).toBe("available");
        expect(seat.booking_id).toBeNull();

        // 3. No booking_seats associations exist
        const bookingSeatsCheck = await pool.query(
            "SELECT * FROM booking_seats WHERE show_id = $1 AND seat_id = $2",
            [testShow.id, targetSeat]
        );
        expect(bookingSeatsCheck.rows).toHaveLength(0);
    });

    test("rolls back transaction on simulated database error during seat association", async () => {
        const targetSeat = seatIds[1];

        // Intercept pool.connect to simulate failure on INSERT INTO booking_seats
        const originalConnect = pool.connect.bind(pool);
        let clientReleased = false;

        jest.spyOn(pool, "connect").mockImplementation(async () => {
            const client = await originalConnect();
            const originalQuery = client.query.bind(client);
            const originalRelease = client.release.bind(client);

            client.release = (...args) => {
                clientReleased = true;
                return originalRelease(...args);
            };

            client.query = async (...args) => {
                const queryText = typeof args[0] === "string" ? args[0] : args[0]?.text || "";
                if (queryText.includes("INSERT INTO booking_seats")) {
                    throw new Error("Simulated query failure during booking_seats insertion");
                }
                return originalQuery(...args);
            };

            return client;
        });

        const res = await request(app)
            .post("/api/bookings")
            .send({
                userId: 1,
                showId: testShow.id,
                seatIds: [targetSeat],
            });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Internal server error/i);

        // Verify the database connection was properly released
        expect(clientReleased).toBe(true);

        // Restore pool.connect so we can query PostgreSQL cleanly
        jest.restoreAllMocks();

        // Assert database state after rollback:
        // 1. No partial booking remains
        const bookings = await pool.query(
            "SELECT * FROM bookings WHERE show_id = $1",
            [testShow.id]
        );
        expect(bookings.rows).toHaveLength(0);

        // 2. No partial booking-seat associations remain
        const bSeats = await pool.query(
            "SELECT * FROM booking_seats WHERE show_id = $1",
            [testShow.id]
        );
        expect(bSeats.rows).toHaveLength(0);

        // 3. The seat is NOT left reserved
        const seat = await getShowSeat(testShow.id, targetSeat);
        expect(seat.status).toBe("available");
        expect(seat.booking_id).toBeNull();
    });

    test("rolls back transaction when seat reservation update row count is incomplete", async () => {
        const targetSeats = [seatIds[2], seatIds[3]];

        // Simulate an incomplete UPDATE show_seats returning fewer rows than expected
        const originalConnect = pool.connect.bind(pool);
        jest.spyOn(pool, "connect").mockImplementation(async () => {
            const client = await originalConnect();
            const originalQuery = client.query.bind(client);

            client.query = async (...args) => {
                const queryText = typeof args[0] === "string" ? args[0] : args[0]?.text || "";
                if (queryText.includes("UPDATE show_seats") && queryText.includes("RETURNING seat_id")) {
                    // Return only 1 row instead of 2 to trigger the completeness check
                    const realResult = await originalQuery(...args);
                    return {
                        ...realResult,
                        rows: realResult.rows.slice(0, 1),
                        rowCount: 1,
                    };
                }
                return originalQuery(...args);
            };

            return client;
        });

        const res = await request(app)
            .post("/api/bookings")
            .send({
                userId: 1,
                showId: testShow.id,
                seatIds: targetSeats,
            });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);

        jest.restoreAllMocks();

        // Verify that the rollback reverted everything
        const allSeats = await getShowSeats(testShow.id);
        for (const s of allSeats) {
            expect(s.status).toBe("available");
            expect(s.booking_id).toBeNull();
        }

        const allBookings = await pool.query(
            "SELECT * FROM bookings WHERE show_id = $1",
            [testShow.id]
        );
        expect(allBookings.rows).toHaveLength(0);
    });
});
