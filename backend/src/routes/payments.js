const express = require("express");
const {
    initiatePayment,
    processPaymentCallback,
    getPaymentById,
    getPaymentByBookingId,
} = require("../services/paymentService");

const router = express.Router();

const validId = (id) =>
    (typeof id === "number" && Number.isSafeInteger(id) && id > 0) ||
    (typeof id === "string" && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)));

// POST /api/payments - Initiate payment for an existing pending booking
router.post("/", async (req, res) => {
    try {
        const { bookingId, simulationOutcome, paymentMethod } = req.body || {};
        const idempotencyKey =
            req.body?.idempotencyKey ||
            req.headers["idempotency-key"] ||
            req.headers["x-idempotency-key"];

        if (!validId(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Provide a valid bookingId",
            });
        }

        if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
            return res.status(400).json({
                success: false,
                message: "A non-empty idempotencyKey is required",
            });
        }

        const result = await initiatePayment({
            bookingId,
            idempotencyKey: idempotencyKey.trim(),
            simulationOutcome,
            paymentMethod,
        });

        if (result.isIdempotentHit) {
            return res.status(200).json({
                success: true,
                idempotent: true,
                message: "Payment retrieved using idempotency key",
                payment: result.payment,
                booking: result.booking,
            });
        }

        if (result.status === "succeeded") {
            return res.status(201).json({
                success: true,
                message: "Payment processed and booking confirmed successfully",
                payment: result.payment,
                booking: result.booking,
            });
        }

        if (result.status === "failed") {
            return res.status(402).json({
                success: false,
                message: `Payment failed: ${result.failureReason || "Declined"}`,
                payment: result.payment,
                booking: result.booking,
            });
        }

        // Pending / timedOut outcome
        return res.status(202).json({
            success: true,
            status: "pending",
            message: result.timedOut
                ? "Payment provider timed out; payment remains pending verification"
                : "Payment initiated and is pending asynchronous completion",
            payment: result.payment,
            booking: result.booking,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }

        console.error("Payment initiation failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error while processing payment",
        });
    }
});

// GET /api/payments/:id - Fetch payment by ID
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment ID",
            });
        }

        const payment = await getPaymentById(id);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found",
            });
        }

        return res.json({
            success: true,
            payment,
        });
    } catch (error) {
        console.error("Failed to fetch payment:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

// GET /api/payments/booking/:bookingId - Fetch latest payment for a booking
router.get("/booking/:bookingId", async (req, res) => {
    try {
        const { bookingId } = req.params;
        if (!validId(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID",
            });
        }

        const payment = await getPaymentByBookingId(bookingId);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "No payment found for this booking",
            });
        }

        return res.json({
            success: true,
            payment,
        });
    } catch (error) {
        console.error("Failed to fetch booking payment:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

// POST /api/payments/webhook - Process simulated provider callback
router.post("/webhook", async (req, res) => {
    try {
        const { providerRef, paymentId, outcome, failureReason } = req.body || {};

        if (!outcome || !["succeeded", "failed"].includes(outcome)) {
            return res.status(400).json({
                success: false,
                message: "A valid outcome ('succeeded' or 'failed') is required",
            });
        }

        const result = await processPaymentCallback({
            providerRef,
            paymentId,
            outcome,
            failureReason,
        });

        return res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }

        console.error("Webhook callback processing failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error processing webhook",
        });
    }
});

module.exports = router;
