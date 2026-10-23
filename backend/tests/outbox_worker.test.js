const {
    processOutboxEvents,
    reprocessDeadLetterEvents,
    registerHandler,
} = require("../src/services/outboxWorker");
const { pool } = require("./testHelper");

describe("Phase 3 — Transactional Outbox & Worker (Task 8 & 9)", () => {
    const testEventIds = [];

    async function createTestOutboxEvent({
        eventType = "BOOKING_CONFIRMED",
        aggregateType = "booking",
        aggregateId = 1,
        payload = { test: true },
        maxRetries = 3,
        status = "pending",
        retryCount = 0,
    }) {
        const res = await pool.query(
            `INSERT INTO outbox_events (
                event_type, aggregate_type, aggregate_id, payload,
                max_retries, status, retry_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [eventType, aggregateType, aggregateId, JSON.stringify(payload), maxRetries, status, retryCount]
        );
        testEventIds.push(res.rows[0].id);
        return res.rows[0];
    }

    afterEach(async () => {
        if (testEventIds.length > 0) {
            await pool.query(
                `DELETE FROM outbox_events WHERE id = ANY($1::bigint[])`,
                [testEventIds]
            );
            testEventIds.length = 0;
        }
    });

    afterAll(async () => {
        await pool.end();
    });

    test("worker processes pending outbox event, invokes handler and marks completed", async () => {
        let handlerCalled = false;
        const event = await createTestOutboxEvent({
            eventType: "CUSTOM_NOTIFY",
            payload: { email: "user@cineflow.local" },
        });

        registerHandler("CUSTOM_NOTIFY", async (evt) => {
            expect(evt.id).toBe(event.id);
            expect(evt.payload.email).toBe("user@cineflow.local");
            handlerCalled = true;
        });

        const result = await processOutboxEvents({ batchSize: 5 });
        expect(result.processedCount).toBeGreaterThanOrEqual(1);
        expect(handlerCalled).toBe(true);

        // Verify in PostgreSQL: status is 'completed' and processed_at is set
        const res = await pool.query(
            "SELECT status, processed_at FROM outbox_events WHERE id = $1",
            [event.id]
        );
        expect(res.rows[0].status).toBe("completed");
        expect(res.rows[0].processed_at).not.toBeNull();
    });

    test("two competing workers process overlapping outbox events concurrently using SKIP LOCKED", async () => {
        const totalEvents = 8;
        const processedSet = new Set();

        for (let i = 0; i < totalEvents; i++) {
            await createTestOutboxEvent({
                eventType: "CONCURRENT_TEST_EVENT",
                payload: { index: i },
            });
        }

        const customHandler = async (evt) => {
            // Assert that no event is processed simultaneously by both workers
            expect(processedSet.has(evt.id)).toBe(false);
            processedSet.add(evt.id);
        };

        // Run two workers simultaneously
        const [worker1Result, worker2Result] = await Promise.all([
            processOutboxEvents({ batchSize: 5, customHandler }),
            processOutboxEvents({ batchSize: 5, customHandler }),
        ]);

        const totalProcessed =
            worker1Result.processedCount + worker2Result.processedCount;
        expect(totalProcessed).toBe(totalEvents);
        expect(processedSet.size).toBe(totalEvents);

        // Verify all 8 are marked completed in DB
        const res = await pool.query(
            "SELECT status FROM outbox_events WHERE id = ANY($1::bigint[])",
            [testEventIds]
        );
        expect(res.rows.every((r) => r.status === "completed")).toBe(true);
    });

    test("retries failing events, records error, and transitions to dead_letter upon exhausting max_retries", async () => {
        const event = await createTestOutboxEvent({
            eventType: "FAILING_EVENT",
            maxRetries: 2,
            retryCount: 0,
        });

        registerHandler("FAILING_EVENT", async () => {
            throw new Error("Simulated delivery network failure");
        });

        // First attempt: should fail and increment retry_count to 1
        const run1 = await processOutboxEvents({ batchSize: 1 });
        expect(run1.failedCount).toBe(1);

        const check1 = await pool.query(
            "SELECT status, retry_count, last_error FROM outbox_events WHERE id = $1",
            [event.id]
        );
        expect(check1.rows[0].status).toBe("failed");
        expect(check1.rows[0].retry_count).toBe(1);
        expect(check1.rows[0].last_error).toBe("Simulated delivery network failure");

        // Second attempt: retry_count reaches max_retries (2), should transition to dead_letter
        const run2 = await processOutboxEvents({ batchSize: 1 });
        expect(run2.deadLetterCount).toBe(1);

        const check2 = await pool.query(
            "SELECT status, retry_count FROM outbox_events WHERE id = $1",
            [event.id]
        );
        expect(check2.rows[0].status).toBe("dead_letter");
        expect(check2.rows[0].retry_count).toBe(2);

        // Third attempt: worker must SKIP dead_letter events
        const run3 = await processOutboxEvents({ batchSize: 1 });
        expect(run3.totalSelected).toBe(0);

        // Recovery: reprocessDeadLetterEvents resets it to pending
        const reprocessedIds = await reprocessDeadLetterEvents([event.id]);
        expect(reprocessedIds).toContain(event.id);

        const check3 = await pool.query(
            "SELECT status, retry_count, last_error FROM outbox_events WHERE id = $1",
            [event.id]
        );
        expect(check3.rows[0].status).toBe("pending");
        expect(check3.rows[0].retry_count).toBe(0);
        expect(check3.rows[0].last_error).toBeNull();
    });
});
