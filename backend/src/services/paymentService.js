const pool = require("../db");
const { simulatePayment } = require("./paymentSimulator");

/**
 * Initiates payment for an existing pending booking with idempotency and state protection.
 */
async function initiatePayment({
    bookingId,
    idempotencyKey,
    simulationOutcome,
    paymentMethod = "simulated_card",
}) {
    if (!bookingId || !idempotencyKey) {
        const err = new Error("bookingId and idempotencyKey are required");
        err.statusCode = 400;
        throw err;
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Check idempotency: lock existing payment if key was previously used
        const existingPaymentRes = await client.query(
            `SELECT * FROM payments WHERE idempotency_key = $1 FOR UPDATE`,
            [idempotencyKey]
        );

        if (existingPaymentRes.rows.length > 0) {
            const existing = existingPaymentRes.rows[0];

            // If same key is used for a different booking, reject with conflict
            if (String(existing.booking_id) !== String(bookingId)) {
                const conflictErr = new Error(
                    "Idempotency key already used for a different booking"
                );
                conflictErr.statusCode = 409;
                throw conflictErr;
            }

            // Fetch current booking state
            const bookingRes = await client.query(
                `SELECT * FROM bookings WHERE id = $1`,
                [bookingId]
            );

            await client.query("COMMIT");

            return {
                isIdempotentHit: true,
                payment: existing,
                booking: bookingRes.rows[0],
            };
        }

        // 2. Lock and validate booking
        const bookingRes = await client.query(
            `SELECT id, user_id, show_id, status, total_amount, created_at, expires_at
             FROM bookings
             WHERE id = $1
             FOR UPDATE`,
            [bookingId]
        );

        if (bookingRes.rows.length === 0) {
            const notFoundErr = new Error("Booking not found");
            notFoundErr.statusCode = 404;
            throw notFoundErr;
        }

        const booking = bookingRes.rows[0];

        if (booking.status === "confirmed") {
            const payCheck = await client.query(
                `SELECT * FROM payments WHERE idempotency_key = $1`,
                [idempotencyKey]
            );

            if (payCheck.rows.length > 0) {
                await client.query("COMMIT");
                return {
                    isIdempotentHit: true,
                    payment: payCheck.rows[0],
                    booking,
                };
            }

            const err = new Error("Booking is already confirmed");
            err.statusCode = 400;
            throw err;
        }

        if (booking.status === "cancelled") {
            const err = new Error("Booking has been cancelled");
            err.statusCode = 400;
            throw err;
        }

        if (booking.status === "expired" || new Date(booking.expires_at) <= new Date()) {
            const expiredErr = new Error("Booking reservation has expired");
            expiredErr.statusCode = 409;
            throw expiredErr;
        }

        // 3. Lock and verify seat reservations
        const seatsRes = await client.query(
            `SELECT show_id, seat_id, status, booking_id
             FROM show_seats
             WHERE booking_id = $1
             ORDER BY seat_id
             FOR UPDATE`,
            [bookingId]
        );

        if (
            seatsRes.rows.length === 0 ||
            seatsRes.rows.some((s) => s.status !== "reserved")
        ) {
            const seatErr = new Error(
                "Reserved seats are no longer available for this booking"
            );
            seatErr.statusCode = 409;
            throw seatErr;
        }

        // 4. Create payment record with pending status (always trust backend booking amount!)
        const amount = booking.total_amount;
        const initialPaymentRes = await client.query(
            `INSERT INTO payments (
                booking_id, amount, currency, status, idempotency_key, payment_method, metadata
            ) VALUES (
                $1, $2, 'INR', 'pending', $3, $4, '{}'::jsonb
            ) RETURNING *`,
            [bookingId, amount, idempotencyKey, paymentMethod]
        );
        let payment = initialPaymentRes.rows[0];

        // 5. Execute simulated payment provider
        let simResult;
        let timedOut = false;

        try {
            simResult = await simulatePayment({
                bookingId,
                amount,
                currency: "INR",
                idempotencyKey,
                outcome: simulationOutcome,
            });
        } catch (simErr) {
            if (simErr.code === "PROVIDER_TIMEOUT") {
                timedOut = true;
                simResult = {
                    status: "pending",
                    providerRef: simErr.providerRef,
                    failureReason: null,
                };
            } else {
                throw simErr;
            }
        }

        // 6. Handle simulator outcome transactionally
        if (timedOut) {
            // Leave payment in pending status with timeout metadata
            const updatePayRes = await client.query(
                `UPDATE payments
                 SET provider_ref = $1,
                     metadata = metadata || '{"simulatedTimeout": true}'::jsonb,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [simResult.providerRef, payment.id]
            );
            payment = updatePayRes.rows[0];

            await client.query(
                `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
                 VALUES ('PAYMENT_PENDING_TIMEOUT', 'payment', $1, $2)`,
                [payment.id, JSON.stringify({ paymentId: payment.id, bookingId })]
            );

            await client.query("COMMIT");

            return {
                payment,
                booking,
                status: "pending",
                timedOut: true,
            };
        }

        if (simResult.status === "succeeded") {
            // Transition: Payment Succeeded & Booking Confirmed & Seats Booked
            const updatePayRes = await client.query(
                `UPDATE payments
                 SET status = 'succeeded',
                     provider_ref = $1,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [simResult.providerRef, payment.id]
            );
            payment = updatePayRes.rows[0];

            const updateBookingRes = await client.query(
                `UPDATE bookings
                 SET status = 'confirmed',
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [bookingId]
            );
            const confirmedBooking = updateBookingRes.rows[0];

            // Mark show_seats as booked
            await client.query(
                `UPDATE show_seats
                 SET status = 'booked'
                 WHERE booking_id = $1 AND status = 'reserved'`,
                [bookingId]
            );

            // Record outbox event for booking confirmation
            await client.query(
                `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
                 VALUES ('BOOKING_CONFIRMED', 'booking', $1, $2)`,
                [
                    bookingId,
                    JSON.stringify({
                        bookingId,
                        paymentId: payment.id,
                        userId: booking.user_id,
                        amount: payment.amount,
                        seats: seatsRes.rows.map((s) => s.seat_id),
                    }),
                ]
            );

            await client.query("COMMIT");

            return {
                payment,
                booking: confirmedBooking,
                status: "succeeded",
            };
        }

        if (simResult.status === "failed") {
            // Transition: Payment Failed (booking remains pending until expired/cancelled)
            const updatePayRes = await client.query(
                `UPDATE payments
                 SET status = 'failed',
                     provider_ref = $1,
                     failure_reason = $2,
                     updated_at = NOW()
                 WHERE id = $3
                 RETURNING *`,
                [simResult.providerRef, simResult.failureReason, payment.id]
            );
            payment = updatePayRes.rows[0];

            await client.query(
                `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
                 VALUES ('PAYMENT_FAILED', 'payment', $1, $2)`,
                [
                    payment.id,
                    JSON.stringify({
                        paymentId: payment.id,
                        bookingId,
                        reason: simResult.failureReason,
                    }),
                ]
            );

            await client.query("COMMIT");

            return {
                payment,
                booking,
                status: "failed",
                failureReason: simResult.failureReason,
            };
        }

        // Delayed success outcome: payment stays pending for webhook callback
        const updatePayRes = await client.query(
            `UPDATE payments
             SET provider_ref = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [simResult.providerRef, payment.id]
        );
        payment = updatePayRes.rows[0];

        await client.query("COMMIT");

        return {
            payment,
            booking,
            status: "pending",
        };
    } catch (err) {
        await client.query("ROLLBACK");

        if (err.code === "23505" && err.constraint === "payments_idempotency_key_key") {
            // Concurrent race condition caught by PostgreSQL unique constraint:
            // Fetch the winning committed payment record
            const winningRes = await pool.query(
                `SELECT * FROM payments WHERE idempotency_key = $1`,
                [idempotencyKey]
            );

            if (winningRes.rows.length > 0) {
                const winningPayment = winningRes.rows[0];
                if (String(winningPayment.booking_id) === String(bookingId)) {
                    const bookingRes = await pool.query(
                        `SELECT * FROM bookings WHERE id = $1`,
                        [bookingId]
                    );

                    return {
                        isIdempotentHit: true,
                        payment: winningPayment,
                        booking: bookingRes.rows[0],
                    };
                }
            }
        }

        throw err;
    } finally {
        client.release();
    }
}

/**
 * Transactionally processes a payment callback or webhook.
 * Handles idempotent duplicate deliveries, terminal state protection, and late payments.
 */
async function processPaymentCallback({
    providerRef,
    paymentId,
    outcome,
    failureReason,
}) {
    if (!providerRef && !paymentId) {
        const err = new Error("providerRef or paymentId is required");
        err.statusCode = 400;
        throw err;
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Locate and lock payment row
        const paymentRes = await client.query(
            `SELECT p.*, b.status AS booking_status, b.expires_at AS booking_expires_at
             FROM payments p
             JOIN bookings b ON b.id = p.booking_id
             WHERE (p.provider_ref = $1 OR p.id = $2)
             FOR UPDATE OF p`,
            [providerRef || null, paymentId || null]
        );

        if (paymentRes.rows.length === 0) {
            const notFoundErr = new Error("Payment not found for callback");
            notFoundErr.statusCode = 404;
            throw notFoundErr;
        }

        let payment = paymentRes.rows[0];

        // 2. Terminal state protection: prevent re-processing or conflicting updates
        const terminalStates = [
            "succeeded",
            "failed",
            "refunded",
            "requires_reconciliation",
        ];

        if (terminalStates.includes(payment.status)) {
            await client.query("COMMIT");
            return {
                isDuplicate: true,
                payment,
                message: `Callback ignored: payment is already in terminal state '${payment.status}'`,
            };
        }

        // 3. Process outcome
        if (outcome === "succeeded") {
            // Task 7: Check for Late Payment after reservation expiry or seat release
            const bookingExpired =
                payment.booking_status === "expired" ||
                new Date(payment.booking_expires_at) <= new Date();

            const seatsRes = await client.query(
                `SELECT show_id, seat_id, status, booking_id
                 FROM show_seats
                 WHERE booking_id = $1
                 ORDER BY seat_id
                 FOR UPDATE`,
                [payment.booking_id]
            );

            const seatsReleased =
                seatsRes.rows.length === 0 ||
                seatsRes.rows.some((s) => s.status !== "reserved");

            if (bookingExpired || seatsReleased) {
                // LATE PAYMENT: Never confirm an expired booking or steal seats!
                // Safely flag for reconciliation and record refund requirement outbox event
                const updateRes = await client.query(
                    `UPDATE payments
                     SET status = 'requires_reconciliation',
                         metadata = metadata || $1::jsonb,
                         updated_at = NOW()
                     WHERE id = $2
                     RETURNING *`,
                    [
                        JSON.stringify({
                            latePayment: true,
                            refundRequired: true,
                            originalBookingStatus: payment.booking_status,
                            reconciliationReason:
                                "Payment succeeded after booking expiry or seat release",
                        }),
                        payment.id,
                    ]
                );
                payment = updateRes.rows[0];

                await client.query(
                    `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
                     VALUES ('PAYMENT_REFUND_REQUIRED', 'payment', $1, $2)`,
                    [
                        payment.id,
                        JSON.stringify({
                            paymentId: payment.id,
                            bookingId: payment.booking_id,
                            amount: payment.amount,
                            reason: "Booking expired before payment confirmation",
                        }),
                    ]
                );

                await client.query("COMMIT");

                return {
                    payment,
                    bookingConfirmed: false,
                    requiresReconciliation: true,
                    refundRequired: true,
                };
            }

            // Normal successful transition: Confirm booking & Book seats
            const updatePayRes = await client.query(
                `UPDATE payments
                 SET status = 'succeeded',
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [payment.id]
            );
            payment = updatePayRes.rows[0];

            await client.query(
                `UPDATE bookings
                 SET status = 'confirmed',
                     updated_at = NOW()
                 WHERE id = $1`,
                [payment.booking_id]
            );

            await client.query(
                `UPDATE show_seats
                 SET status = 'booked'
                 WHERE booking_id = $1 AND status = 'reserved'`,
                [payment.booking_id]
            );

            await client.query(
                `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
                 VALUES ('BOOKING_CONFIRMED', 'booking', $1, $2)`,
                [
                    payment.booking_id,
                    JSON.stringify({
                        bookingId: payment.booking_id,
                        paymentId: payment.id,
                        amount: payment.amount,
                    }),
                ]
            );

            await client.query("COMMIT");

            return {
                payment,
                bookingConfirmed: true,
            };
        }

        if (outcome === "failed") {
            const updatePayRes = await client.query(
                `UPDATE payments
                 SET status = 'failed',
                     failure_reason = $1,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [failureReason || "CALLBACK_REPORTED_FAILURE", payment.id]
            );
            payment = updatePayRes.rows[0];

            await client.query(
                `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
                 VALUES ('PAYMENT_FAILED', 'payment', $1, $2)`,
                [
                    payment.id,
                    JSON.stringify({
                        paymentId: payment.id,
                        bookingId: payment.booking_id,
                        reason: failureReason,
                    }),
                ]
            );

            await client.query("COMMIT");

            return {
                payment,
                bookingConfirmed: false,
            };
        }

        await client.query("COMMIT");
        return { payment, bookingConfirmed: false };
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Fetch payment by ID
 */
async function getPaymentById(id) {
    const res = await pool.query(`SELECT * FROM payments WHERE id = $1`, [id]);
    return res.rows[0] || null;
}

/**
 * Fetch latest payment for a booking ID
 */
async function getPaymentByBookingId(bookingId) {
    const res = await pool.query(
        `SELECT * FROM payments WHERE booking_id = $1 ORDER BY id DESC LIMIT 1`,
        [bookingId]
    );
    return res.rows[0] || null;
}

module.exports = {
    initiatePayment,
    processPaymentCallback,
    getPaymentById,
    getPaymentByBookingId,
};
