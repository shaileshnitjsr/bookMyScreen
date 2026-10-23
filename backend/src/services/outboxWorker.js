const pool = require("../db");

/**
 * Event handlers registry for processing outbox events.
 * Pluggable simulated handlers for notifications, external sync, and simulated refunds.
 */
const eventHandlers = {
    BOOKING_CONFIRMED: async (event) => {
        // Simulated ticket issuance and email notification
        return { delivered: true, timestamp: new Date().toISOString() };
    },
    PAYMENT_FAILED: async (event) => {
        // Simulated failure notification
        return { notified: true };
    },
    PAYMENT_REFUND_REQUIRED: async (event) => {
        // Simulated payment refund initiation
        return { refundQueued: true, amount: event.payload.amount };
    },
    PAYMENT_PENDING_TIMEOUT: async (event) => {
        // Simulated provider poll enqueue
        return { pollScheduled: true };
    },
};

/**
 * Register a custom event handler (useful for testing simulated failures)
 */
function registerHandler(eventType, handler) {
    eventHandlers[eventType] = handler;
}

/**
 * Process a batch of pending or failed outbox events using PostgreSQL row locking with SKIP LOCKED.
 *
 * @param {Object} [options]
 * @param {number} [options.batchSize=10]
 * @param {Function} [options.customHandler] - Optional handler override for testing
 * @returns {Promise<Object>} Results of processing
 */
async function processOutboxEvents({ batchSize = 10, customHandler } = {}) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Lock pending or retriable events, skipping rows locked by other workers
        const eventsRes = await client.query(
            `SELECT id, event_type, aggregate_type, aggregate_id, payload,
                    status, retry_count, max_retries, created_at
             FROM outbox_events
             WHERE status IN ('pending', 'failed')
               AND retry_count < max_retries
             ORDER BY created_at, id
             LIMIT $1
             FOR UPDATE SKIP LOCKED`,
            [batchSize]
        );

        const events = eventsRes.rows;
        let processedCount = 0;
        let failedCount = 0;
        let deadLetterCount = 0;

        for (const event of events) {
            try {
                // Execute handler
                const handler =
                    customHandler ||
                    eventHandlers[event.event_type] ||
                    (async () => ({ ignored: true }));

                await handler(event);

                // Success: mark completed
                await client.query(
                    `UPDATE outbox_events
                     SET status = 'completed',
                         processed_at = NOW(),
                         updated_at = NOW()
                     WHERE id = $1`,
                    [event.id]
                );

                processedCount++;
            } catch (err) {
                const newRetryCount = event.retry_count + 1;
                const isDeadLetter = newRetryCount >= event.max_retries;
                const nextStatus = isDeadLetter ? "dead_letter" : "failed";

                await client.query(
                    `UPDATE outbox_events
                     SET status = $1,
                         retry_count = $2,
                         last_error = $3,
                         updated_at = NOW()
                     WHERE id = $4`,
                    [nextStatus, newRetryCount, err.message, event.id]
                );

                if (isDeadLetter) {
                    deadLetterCount++;
                } else {
                    failedCount++;
                }
            }
        }

        await client.query("COMMIT");

        return {
            totalSelected: events.length,
            processedCount,
            failedCount,
            deadLetterCount,
        };
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Reprocess dead-letter events back to pending
 */
async function reprocessDeadLetterEvents(eventIds = []) {
    let query = `
        UPDATE outbox_events
        SET status = 'pending',
            retry_count = 0,
            last_error = NULL,
            updated_at = NOW()
        WHERE status = 'dead_letter'
    `;
    const params = [];

    if (eventIds.length > 0) {
        query += ` AND id = ANY($1::bigint[])`;
        params.push(eventIds);
    }

    query += ` RETURNING id`;

    const res = await pool.query(query, params);
    return res.rows.map((r) => r.id);
}

module.exports = {
    processOutboxEvents,
    reprocessDeadLetterEvents,
    registerHandler,
};
