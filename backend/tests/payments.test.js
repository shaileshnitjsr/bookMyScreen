const request = require("supertest");
const app = require("../src/app");
const {
    pool,
    createTestShow,
    createTestShowSeats,
    cleanupTestShow,
    getBooking,
    getShowSeat,
    getPayment,
    getPaymentsForBooking,
    getOutboxEvents,
} = require("./testHelper");

describe("Phase 3 — Payment API & Idempotency", () => {
    let testShow;
    let seatIds;
    let pendingBookingId;

    beforeEach(async () => {
        testShow = await createTestShow();
        seatIds = await createTestShowSeats(testShow.id, 6, "150.00");

        // Create a pending booking for testing
        const bookRes = await request(app)
            .post("/api/bookings")
            .send({
                userId: 1,
                showId: testShow.id,
                seatIds: [seatIds[0], seatIds[1]],
            });

        expect(bookRes.status).toBe(201);
        pendingBookingId = bookRes.body.booking.id;
    });

    afterEach(async () => {
        await cleanupTestShow(testShow.id);
    });

    afterAll(async () => {
        await pool.end();
    });

    describe("Successful Payment & Booking Confirmation (Task 2 & 4)", () => {
        test("processes successful payment, confirms booking, marks seats as booked and creates outbox event", async () => {
            const idempotencyKey = `key_success_${Date.now()}_${Math.random()}`;

            const res = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "success",
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.payment).toBeDefined();
            expect(res.body.payment.status).toBe("succeeded");
            expect(res.body.payment.amount).toBe("300.00");
            expect(res.body.booking.status).toBe("confirmed");

            const paymentId = res.body.payment.id;

            // Direct PostgreSQL State Assertions
            // 1. Payment row
            const paymentDb = await getPayment(paymentId);
            expect(paymentDb.status).toBe("succeeded");
            expect(paymentDb.amount).toBe("300.00");
            expect(paymentDb.idempotency_key).toBe(idempotencyKey);
            expect(paymentDb.provider_ref).toMatch(/^sim_/);

            // 2. Booking row confirmed
            const bookingDb = await getBooking(pendingBookingId);
            expect(bookingDb.status).toBe("confirmed");

            // 3. Seats marked as booked (not just reserved!)
            const seat1 = await getShowSeat(testShow.id, seatIds[0]);
            const seat2 = await getShowSeat(testShow.id, seatIds[1]);
            expect(seat1.status).toBe("booked");
            expect(seat1.booking_id).toBe(String(pendingBookingId));
            expect(seat2.status).toBe("booked");
            expect(seat2.booking_id).toBe(String(pendingBookingId));

            // 4. Transactional Outbox Event created
            const outbox = await getOutboxEvents("booking", pendingBookingId);
            expect(outbox.length).toBeGreaterThanOrEqual(1);
            const confirmEvent = outbox.find((e) => e.event_type === "BOOKING_CONFIRMED");
            expect(confirmEvent).toBeDefined();
            expect(confirmEvent.status).toBe("pending");
            expect(confirmEvent.payload.bookingId).toBe(pendingBookingId);
            expect(confirmEvent.payload.amount).toBe("300.00");
        });
    });

    describe("Payment Failure (Task 2 & 4)", () => {
        test("records failed payment, keeps booking pending for retry, creates outbox event", async () => {
            const idempotencyKey = `key_fail_${Date.now()}_${Math.random()}`;

            const res = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "failure",
                });

            expect(res.status).toBe(402);
            expect(res.body.success).toBe(false);
            expect(res.body.payment.status).toBe("failed");
            expect(res.body.payment.failure_reason).toBe("SIMULATED_CARD_DECLINED");

            // Assert database state:
            // 1. Payment status in DB is failed
            const paymentDb = await getPayment(res.body.payment.id);
            expect(paymentDb.status).toBe("failed");
            expect(paymentDb.failure_reason).toBe("SIMULATED_CARD_DECLINED");

            // 2. Booking remains pending so customer can retry before expiry
            const bookingDb = await getBooking(pendingBookingId);
            expect(bookingDb.status).toBe("pending");

            // 3. Seats remain reserved
            const seat1 = await getShowSeat(testShow.id, seatIds[0]);
            expect(seat1.status).toBe("reserved");

            // 4. Outbox event PAYMENT_FAILED created
            const outbox = await getOutboxEvents("payment", paymentDb.id);
            expect(outbox).toHaveLength(1);
            expect(outbox[0].event_type).toBe("PAYMENT_FAILED");
        });
    });

    describe("Timeout & Status Recovery (Task 3 & 4)", () => {
        test("handles simulated provider timeout by leaving payment in pending state (202 Accepted)", async () => {
            const idempotencyKey = `key_timeout_${Date.now()}_${Math.random()}`;

            const res = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "timeout",
                });

            expect(res.status).toBe(202);
            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe("pending");
            expect(res.body.payment.status).toBe("pending");

            // Verify in DB
            const paymentDb = await getPayment(res.body.payment.id);
            expect(paymentDb.status).toBe("pending");
            expect(paymentDb.metadata.simulatedTimeout).toBe(true);

            // Fetch payment status endpoint
            const getRes = await request(app).get(`/api/payments/${paymentDb.id}`);
            expect(getRes.status).toBe(200);
            expect(getRes.body.payment.status).toBe("pending");
        });
    });

    describe("Idempotency (Task 5)", () => {
        test("duplicate payment initiation with the same idempotency key returns existing payment", async () => {
            const idempotencyKey = `key_idemp_${Date.now()}_${Math.random()}`;

            // First request
            const firstRes = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "success",
                });

            expect(firstRes.status).toBe(201);
            const originalPaymentId = firstRes.body.payment.id;

            // Second request with EXACT same key and bookingId
            const secondRes = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "success",
                });

            expect(secondRes.status).toBe(200);
            expect(secondRes.body.idempotent).toBe(true);
            expect(secondRes.body.payment.id).toBe(originalPaymentId);

            // Verify in database: exactly ONE payment row exists for this idempotency key
            const payments = await getPaymentsForBooking(pendingBookingId);
            expect(payments).toHaveLength(1);
            expect(payments[0].id).toBe(originalPaymentId);
        });

        test("rejects reuse of the same idempotency key for a different booking with 409 Conflict", async () => {
            const idempotencyKey = `key_shared_${Date.now()}_${Math.random()}`;

            // First booking payment
            const res1 = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "success",
                });
            expect(res1.status).toBe(201);

            // Create second booking
            const book2Res = await request(app)
                .post("/api/bookings")
                .send({
                    userId: 1,
                    showId: testShow.id,
                    seatIds: [seatIds[2]],
                });
            expect(book2Res.status).toBe(201);
            const secondBookingId = book2Res.body.booking.id;

            // Attempt to reuse key for second booking
            const res2 = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: secondBookingId,
                    idempotencyKey,
                    simulationOutcome: "success",
                });

            expect(res2.status).toBe(409);
            expect(res2.body.success).toBe(false);
            expect(res2.body.message).toMatch(/already used for a different booking/i);
        });

        test("concurrent initiation requests with the same idempotency key are safe and create exactly 1 payment", async () => {
            const idempotencyKey = `key_concurrent_${Date.now()}_${Math.random()}`;

            // Fire 5 concurrent requests with identical idempotency key
            const promises = Array.from({ length: 5 }, () =>
                request(app)
                    .post("/api/payments")
                    .send({
                        bookingId: pendingBookingId,
                        idempotencyKey,
                        simulationOutcome: "success",
                    })
            );

            const responses = await Promise.all(promises);

            // Exactly 1 should be 201 Created, and the remaining 4 should be 200 (idempotent hits)
            const created = responses.filter((r) => r.status === 201);
            const idempotentHits = responses.filter((r) => r.status === 200);

            expect(created).toHaveLength(1);
            expect(idempotentHits).toHaveLength(4);

            // Verify in PostgreSQL: exactly 1 payment record exists
            const payments = await getPaymentsForBooking(pendingBookingId);
            expect(payments).toHaveLength(1);
            expect(payments[0].status).toBe("succeeded");
        });
    });

    describe("Payment Status Retrieval (Task 4)", () => {
        test("fetches payment by ID and by booking ID", async () => {
            const idempotencyKey = `key_lookup_${Date.now()}_${Math.random()}`;

            const createRes = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "success",
                });

            const paymentId = createRes.body.payment.id;

            // GET by ID
            const resById = await request(app).get(`/api/payments/${paymentId}`);
            expect(resById.status).toBe(200);
            expect(resById.body.payment.id).toBe(paymentId);
            expect(resById.body.payment.status).toBe("succeeded");

            // GET by booking ID
            const resByBooking = await request(app).get(
                `/api/payments/booking/${pendingBookingId}`
            );
            expect(resByBooking.status).toBe(200);
            expect(resByBooking.body.payment.id).toBe(paymentId);
        });
    });
});
