const pool = require("../src/db");

/**
 * Creates an isolated test show with future start/end times.
 */
async function createTestShow(movieId = 1, screenId = 1) {
    const res = await pool.query(
        `INSERT INTO shows (movie_id, screen_id, starts_at, ends_at)
         VALUES ($1, $2, NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days 2 hours')
         RETURNING id, movie_id, screen_id, starts_at, ends_at`,
        [movieId, screenId]
    );
    return res.rows[0];
}

/**
 * Attaches available seats to the test show.
 */
async function createTestShowSeats(showId, seatCount = 10, price = "150.00") {
    // Select existing seat IDs from the screen
    const seatsRes = await pool.query(
        `SELECT id
         FROM seats
         WHERE screen_id = (SELECT screen_id FROM shows WHERE id = $1)
         ORDER BY id
         LIMIT $2`,
        [showId, seatCount]
    );

    const seatIds = seatsRes.rows.map((row) => row.id);

    for (const seatId of seatIds) {
        await pool.query(
            `INSERT INTO show_seats (show_id, seat_id, price, status, booking_id)
             VALUES ($1, $2, $3, 'available', NULL)`,
            [showId, seatId, price]
        );
    }

    return seatIds;
}

/**
 * Clean up all records associated with a test show safely.
 */
async function cleanupTestShow(showId) {
    if (!showId) return;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Delete booking_seats for any booking belonging to this show
        await client.query(
            `DELETE FROM booking_seats
             WHERE booking_id IN (SELECT id FROM bookings WHERE show_id = $1)`,
            [showId]
        );

        // 2. Clear foreign key references from show_seats to bookings
        await client.query(
            `UPDATE show_seats
             SET status = 'available',
                 booking_id = NULL
             WHERE show_id = $1`,
            [showId]
        );

        // 3. Delete outbox events associated with these bookings and payments
        await client.query(
            `DELETE FROM outbox_events
             WHERE (aggregate_type = 'booking' AND aggregate_id IN (SELECT id FROM bookings WHERE show_id = $1))
                OR (aggregate_type = 'payment' AND aggregate_id IN (
                    SELECT id FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE show_id = $1)
                ))`,
            [showId]
        );

        // 4. Delete payments for bookings of this show
        await client.query(
            `DELETE FROM payments
             WHERE booking_id IN (SELECT id FROM bookings WHERE show_id = $1)`,
            [showId]
        );

        // 5. Delete bookings for this show
        await client.query(
            `DELETE FROM bookings
             WHERE show_id = $1`,
            [showId]
        );

        // 4. Delete show_seats
        await client.query(
            `DELETE FROM show_seats
             WHERE show_id = $1`,
            [showId]
        );

        // 5. Delete the show itself
        await client.query(
            `DELETE FROM shows
             WHERE id = $1`,
            [showId]
        );

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("cleanupTestShow failed:", err.message);
    } finally {
        client.release();
    }
}

/**
 * Fetch a booking row by ID.
 */
async function getBooking(bookingId) {
    const res = await pool.query(
        `SELECT id, user_id, show_id, status, total_amount, created_at, expires_at
         FROM bookings
         WHERE id = $1`,
        [bookingId]
    );
    return res.rows[0] || null;
}

/**
 * Fetch booking_seats rows for a booking ID.
 */
async function getBookingSeats(bookingId) {
    const res = await pool.query(
        `SELECT booking_id, show_id, seat_id, price
         FROM booking_seats
         WHERE booking_id = $1
         ORDER BY seat_id`,
        [bookingId]
    );
    return res.rows;
}

/**
 * Fetch a show_seat row.
 */
async function getShowSeat(showId, seatId) {
    const res = await pool.query(
        `SELECT show_id, seat_id, price, status, booking_id
         FROM show_seats
         WHERE show_id = $1 AND seat_id = $2`,
        [showId, seatId]
    );
    return res.rows[0] || null;
}

/**
 * Fetch all show_seats for a show.
 */
async function getShowSeats(showId) {
    const res = await pool.query(
        `SELECT show_id, seat_id, price, status, booking_id
         FROM show_seats
         WHERE show_id = $1
         ORDER BY seat_id`,
        [showId]
    );
    return res.rows;
}

/**
 * Fetch a payment row by ID.
 */
async function getPayment(paymentId) {
    const res = await pool.query(
        `SELECT * FROM payments WHERE id = $1`,
        [paymentId]
    );
    return res.rows[0] || null;
}

/**
 * Fetch all payments for a booking.
 */
async function getPaymentsForBooking(bookingId) {
    const res = await pool.query(
        `SELECT * FROM payments WHERE booking_id = $1 ORDER BY id ASC`,
        [bookingId]
    );
    return res.rows;
}

/**
 * Fetch outbox events for an aggregate.
 */
async function getOutboxEvents(aggregateType, aggregateId) {
    const res = await pool.query(
        `SELECT * FROM outbox_events
         WHERE aggregate_type = $1 AND aggregate_id = $2
         ORDER BY id ASC`,
        [aggregateType, aggregateId]
    );
    return res.rows;
}

module.exports = {
    pool,
    createTestShow,
    createTestShowSeats,
    cleanupTestShow,
    getBooking,
    getBookingSeats,
    getShowSeat,
    getShowSeats,
    getPayment,
    getPaymentsForBooking,
    getOutboxEvents,
};
