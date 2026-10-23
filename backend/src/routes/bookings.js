
const express = require("express");
const pool = require("../db");

const router = express.Router();

const validId = (id) =>
    (typeof id === "number" &&
        Number.isSafeInteger(id) &&
        id > 0) ||
    (typeof id === "string" &&
        /^[1-9]\d*$/.test(id) &&
        Number.isSafeInteger(Number(id)));

router.post("/", async (req, res) => {
    const { userId, showId, seatIds } = req.body;

    if (
        !validId(userId) ||
        !validId(showId) ||
        !Array.isArray(seatIds) ||
        seatIds.length === 0 ||
        !seatIds.every(validId) ||
        new Set(seatIds.map(String)).size !== seatIds.length
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide valid userId, showId, and unique seatIds",
        });
    }

    let client;

    try {
        client = await pool.connect();

        await client.query("BEGIN");

        // Lock requested seats in a consistent order.
        const seatResult = await client.query(
            `SELECT seat_id, price, status, booking_id
             FROM show_seats
             WHERE show_id = $1
               AND seat_id = ANY($2::bigint[])
             ORDER BY seat_id
             FOR UPDATE`,
            [showId, seatIds]
        );

        if (seatResult.rows.length !== seatIds.length) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "One or more seats do not belong to this show",
            });
        }

        if (seatResult.rows.some((seat) => seat.status !== "available")) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                message: "One or more seats are no longer available",
            });
        }

        const totalAmount = seatResult.rows
            .reduce((total, seat) => total + Number(seat.price), 0)
            .toFixed(2);

        const bookingResult = await client.query(
            `INSERT INTO bookings
                (user_id, show_id, status, total_amount, expires_at)
             VALUES
                ($1, $2, 'pending', $3, NOW() + INTERVAL '10 minutes')
             RETURNING id, user_id, show_id, status,
                       total_amount, created_at, expires_at`,
            [userId, showId, totalAmount]
        );

        const booking = bookingResult.rows[0];

        for (const seat of seatResult.rows) {
            await client.query(
                `INSERT INTO booking_seats
                    (booking_id, show_id, seat_id, price)
                 VALUES ($1, $2, $3, $4)`,
                [booking.id, showId, seat.seat_id, seat.price]
            );
        }

        // Assign ownership of each reserved seat to this booking.
        const reserveResult = await client.query(
            `UPDATE show_seats
             SET status = 'reserved',
                 booking_id = $3
             WHERE show_id = $1
               AND seat_id = ANY($2::bigint[])
               AND status = 'available'
             RETURNING seat_id`,
            [showId, seatIds, booking.id]
        );

        if (reserveResult.rows.length !== seatIds.length) {
            throw new Error("Seat reservation update was incomplete");
        }

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Seats reserved successfully",
            booking,
            seats: seatResult.rows.map((seat) => ({
                seat_id: seat.seat_id,
                price: seat.price,
            })),
        });
    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Booking rollback failed:", rollbackError.message);
            }
        }

        console.error("Failed to create booking:", error.message);

        if (error.code === "23503") {
            return res.status(400).json({
                success: false,
                message: "User or show does not exist",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// GET /api/bookings/user/:userId - Retrieve booking history for a user
router.get("/user/:userId", async (req, res) => {
    const { userId } = req.params;

    if (!validId(userId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid user ID",
        });
    }

    try {
        const result = await pool.query(
            `SELECT
                b.id,
                b.user_id,
                b.show_id,
                b.status,
                b.total_amount,
                b.created_at,
                b.expires_at,
                m.title AS movie_title,
                m.duration_minutes,
                m.language,
                t.name AS theatre_name,
                t.city,
                sc.name AS screen_name,
                sh.starts_at,
                sh.ends_at,
                p.status AS payment_status,
                p.provider_ref,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'seat_id', s.id,
                            'row_label', s.row_label,
                            'seat_number', s.seat_number,
                            'price', bs.price
                        )
                    ) FILTER (WHERE s.id IS NOT NULL),
                    '[]'::json
                ) AS seats
            FROM bookings b
            JOIN shows sh ON sh.id = b.show_id
            JOIN movies m ON m.id = sh.movie_id
            JOIN screens sc ON sc.id = sh.screen_id
            JOIN theatres t ON t.id = sc.theatre_id
            LEFT JOIN booking_seats bs ON bs.booking_id = b.id
            LEFT JOIN seats s ON s.id = bs.seat_id
            LEFT JOIN payments p ON p.id = (
                SELECT id FROM payments WHERE booking_id = b.id ORDER BY id DESC LIMIT 1
            )
            WHERE b.user_id = $1
            GROUP BY b.id, m.title, m.duration_minutes, m.language, t.name, t.city, sc.name, sh.starts_at, sh.ends_at, p.status, p.provider_ref
            ORDER BY b.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            count: result.rows.length,
            bookings: result.rows,
        });
    } catch (error) {
        console.error("Failed to fetch user bookings:", error.message);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

module.exports = router;
