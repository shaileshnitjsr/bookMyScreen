
const pool = require("../db");

async function expirePendingBookings() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT id
             FROM bookings
             WHERE status = 'pending'
               AND expires_at IS NOT NULL
               AND expires_at <= NOW()
             ORDER BY expires_at, id
             LIMIT 100
             FOR UPDATE SKIP LOCKED`
        );

        let expiredCount = 0;

        for (const booking of result.rows) {
            // Lock only seats owned by this booking.
            const seatsResult = await client.query(
                `SELECT show_id, seat_id
                 FROM show_seats
                 WHERE booking_id = $1
                   AND status = 'reserved'
                 ORDER BY show_id, seat_id
                 FOR UPDATE`,
                [booking.id]
            );

            // Expire only if the booking is still pending and overdue.
            const updateResult = await client.query(
                `UPDATE bookings
                 SET status = 'expired'
                 WHERE id = $1
                   AND status = 'pending'
                   AND expires_at <= NOW()
                 RETURNING id`,
                [booking.id]
            );

            if (updateResult.rowCount === 0) {
                continue;
            }

            // Release seats only if they still belong to this booking.
            await client.query(
                `UPDATE show_seats
                 SET status = 'available',
                     booking_id = NULL
                 WHERE booking_id = $1
                   AND status = 'reserved'`,
                [booking.id]
            );

            expiredCount++;
        }

        await client.query("COMMIT");

        return expiredCount;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { expirePendingBookings };
