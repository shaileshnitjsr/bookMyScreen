
const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /api/shows/:movieId
router.get("/:movieId", async (req, res) => {
    const { movieId } = req.params;

    // Validate the movie ID.
    if (!/^\d+$/.test(movieId) || BigInt(movieId) <= 0n) {
        return res.status(400).json({
            success: false,
            message: "Invalid movie ID",
        });
    }

    try {
        const result = await pool.query(
            `SELECT
                sh.id AS show_id,
                sh.movie_id,
                sh.starts_at,
                sh.ends_at,
                t.id AS theatre_id,
                t.name AS theatre_name,
                t.city,
                sc.id AS screen_id,
                sc.name AS screen_name,
                COUNT(ss.seat_id) FILTER (
                    WHERE ss.status = 'available'
                )::int AS available_seats,
                MIN(ss.price) FILTER (
                    WHERE ss.status = 'available'
                ) AS min_price
            FROM shows sh
            JOIN screens sc ON sc.id = sh.screen_id
            JOIN theatres t ON t.id = sc.theatre_id
            LEFT JOIN show_seats ss ON ss.show_id = sh.id
            WHERE sh.movie_id = $1
              AND sh.starts_at > NOW()
            GROUP BY
                sh.id,
                sh.movie_id,
                sh.starts_at,
                sh.ends_at,
                t.id,
                t.name,
                t.city,
                sc.id,
                sc.name
            ORDER BY sh.starts_at`,
            [movieId]
        );

        res.json({
            success: true,
            count: result.rows.length,
            shows: result.rows,
        });
    } catch (error) {
        console.error("Failed to fetch shows:", error.message);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

module.exports = router;

router.get("/:showId/seats", async (req, res) => {
    const { showId } = req.params;

    if (!/^\d+$/.test(showId) || BigInt(showId) <= 0n) {
        return res.status(400).json({
            success: false,
            message: "Invalid show ID",
        });
    }

    try {
        const result = await pool.query(
            `SELECT
                s.id AS seat_id,
                s.row_label,
                s.seat_number,
                ss.price,
                ss.status
            FROM show_seats ss
            JOIN seats s ON s.id = ss.seat_id
            WHERE ss.show_id = $1
            ORDER BY s.row_label, s.seat_number`,
            [showId]
        );

        res.json({
            success: true,
            show_id: showId,
            count: result.rows.length,
            seats: result.rows,
        });
    } catch (error) {
        console.error("Failed to fetch seats:", error.message);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

