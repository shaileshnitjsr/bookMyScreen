const request = require("supertest");
const app = require("../src/app");
const { expirePendingBookings } = require("../src/services/bookingExpiry");
const {
    pool,
    createTestShow,
    createTestShowSeats,
    cleanupTestShow,
    getBooking,
    getShowSeat,
    getPayment,
    getOutboxEvents,
} = require("./testHelper");

describe("Phase 3 — Safe Callback Processing & Late Payment Handling (Task 6 & 7)", () => {
    let testShow;
    let seatIds;
    let pendingBookingId;

    beforeEach(async () => {
        testShow = await createTestShow();
        seatIds = await createTestShowSeats(testShow.id, 6, "200.00");

        const bookRes = await request(app)
            .post("/api/bookings")
            .send({
                userId: 1,
                showId: testShow.id,
                seatIds: [seatIds[0]],
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

    describe("Safe Callback Processing (Task 6)", () => {
        test("delayed callback transitions pending payment to succeeded and confirms booking", async () => {
            const idempotencyKey = `key_delayed_${Date.now()}_${Math.random()}`;

            // Initiate with delayed_success (leaves payment in pending state)
            const initRes = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "delayed_success",
                });

            expect(initRes.status).toBe(202);
            expect(initRes.body.payment.status).toBe("pending");
            const providerRef = initRes.body.payment.provider_ref;
            const paymentId = initRes.body.payment.id;

            // Deliver successful webhook callback
            const callbackRes = await request(app)
                .post("/api/payments/webhook")
                .send({
                    providerRef,
                    outcome: "succeeded",
                });

            expect(callbackRes.status).toBe(200);
            expect(callbackRes.body.success).toBe(true);
            expect(callbackRes.body.bookingConfirmed).toBe(true);

            // Assert database state:
            // 1. Payment status succeeded
            const payDb = await getPayment(paymentId);
            expect(payDb.status).toBe("succeeded");

            // 2. Booking status confirmed
            const bookDb = await getBooking(pendingBookingId);
            expect(bookDb.status).toBe("confirmed");

            // 3. Seat booked
            const seat = await getShowSeat(testShow.id, seatIds[0]);
            expect(seat.status).toBe("booked");
            expect(seat.booking_id).toBe(String(pendingBookingId));
        });

        test("duplicate callback delivery is safe, idempotent and does not confirm twice", async () => {
            const idempotencyKey = `key_dup_cb_${Date.now()}_${Math.random()}`;

            const initRes = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "delayed_success",
                });

            const providerRef = initRes.body.payment.provider_ref;

            // First delivery
            const cb1 = await request(app)
                .post("/api/payments/webhook")
                .send({
                    providerRef,
                    outcome: "succeeded",
                });
            expect(cb1.status).toBe(200);
            expect(cb1.body.bookingConfirmed).toBe(true);

            // Second (duplicate) delivery of identical callback
            const cb2 = await request(app)
                .post("/api/payments/webhook")
                .send({
                    providerRef,
                    outcome: "succeeded",
                });

            expect(cb2.status).toBe(200);
            expect(cb2.body.isDuplicate).toBe(true);

            // Verify in DB: booking is still confirmed and exactly 1 confirmation outbox event exists
            const bookDb = await getBooking(pendingBookingId);
            expect(bookDb.status).toBe("confirmed");

            const outbox = await getOutboxEvents("booking", pendingBookingId);
            const confirmEvents = outbox.filter((e) => e.event_type === "BOOKING_CONFIRMED");
            expect(confirmEvents).toHaveLength(1);
        });

        test("conflicting callback outcome (failure after success) is ignored and cannot overwrite terminal state", async () => {
            const idempotencyKey = `key_conflict_cb_${Date.now()}_${Math.random()}`;

            // Create already succeeded payment
            const initRes = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "success",
                });

            const providerRef = initRes.body.payment.provider_ref;
            const paymentId = initRes.body.payment.id;

            // Send conflicting 'failed' callback to an already succeeded payment
            const cbConflict = await request(app)
                .post("/api/payments/webhook")
                .send({
                    providerRef,
                    outcome: "failed",
                    failureReason: "LATE_DISPUTE_OR_FAILURE",
                });

            expect(cbConflict.status).toBe(200);
            expect(cbConflict.body.isDuplicate).toBe(true);

            // Assert database state: payment status MUST remain 'succeeded'
            const payDb = await getPayment(paymentId);
            expect(payDb.status).toBe("succeeded");

            // Booking remains 'confirmed'
            const bookDb = await getBooking(pendingBookingId);
            expect(bookDb.status).toBe("confirmed");
        });
    });

    describe("Late Payment Handling (Task 7)", () => {
        test("handles payment success arriving after booking expiry: never confirms booking, flags refund requirement", async () => {
            const idempotencyKey = `key_late_${Date.now()}_${Math.random()}`;

            // Initiate payment with delayed_success
            const initRes = await request(app)
                .post("/api/payments")
                .send({
                    bookingId: pendingBookingId,
                    idempotencyKey,
                    simulationOutcome: "delayed_success",
                });

            const providerRef = initRes.body.payment.provider_ref;
            const paymentId = initRes.body.payment.id;

            // Simulate booking expiry: manually update expires_at into the past and run expiry worker
            await pool.query(
                `UPDATE bookings
                 SET expires_at = NOW() - INTERVAL '5 minutes'
                 WHERE id = $1`,
                [pendingBookingId]
            );

            // Run expiry worker to release seats and mark booking expired
            await expirePendingBookings();

            // Verify booking is indeed expired and seats released
            const bookExpired = await getBooking(pendingBookingId);
            expect(bookExpired.status).toBe("expired");

            const seatReleased = await getShowSeat(testShow.id, seatIds[0]);
            expect(seatReleased.status).toBe("available");
            expect(seatReleased.booking_id).toBeNull();

            // NOW: Delayed payment success arrives via webhook!
            const callbackRes = await request(app)
                .post("/api/payments/webhook")
                .send({
                    providerRef,
                    outcome: "succeeded",
                });

            expect(callbackRes.status).toBe(200);
            expect(callbackRes.body.bookingConfirmed).toBe(false);
            expect(callbackRes.body.requiresReconciliation).toBe(true);
            expect(callbackRes.body.refundRequired).toBe(true);

            // Assert PostgreSQL Database State:
            // 1. Payment status must NOT be 'succeeded'; it must be 'requires_reconciliation'
            const payDb = await getPayment(paymentId);
            expect(payDb.status).toBe("requires_reconciliation");
            expect(payDb.metadata.refundRequired).toBe(true);
            expect(payDb.metadata.latePayment).toBe(true);

            // 2. Booking MUST REMAIN 'expired' (Never confirmed!)
            const bookDb = await getBooking(pendingBookingId);
            expect(bookDb.status).toBe("expired");

            // 3. Seats MUST REMAIN 'available' with NULL booking_id (Not stolen!)
            const seatDb = await getShowSeat(testShow.id, seatIds[0]);
            expect(seatDb.status).toBe("available");
            expect(seatDb.booking_id).toBeNull();

            // 4. Outbox event PAYMENT_REFUND_REQUIRED recorded with refund amount
            const outbox = await getOutboxEvents("payment", paymentId);
            const refundEvent = outbox.find((e) => e.event_type === "PAYMENT_REFUND_REQUIRED");
            expect(refundEvent).toBeDefined();
            expect(refundEvent.payload.amount).toBe(payDb.amount);
            expect(refundEvent.payload.bookingId).toBe(pendingBookingId);
        });
    });
});
