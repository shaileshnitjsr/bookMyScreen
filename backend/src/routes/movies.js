const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, title, description, duration_minutes, language FROM movies ORDER BY id"
        );

        res.json({
            success: true,
            count: result.rows.length,
            movies: result.rows,
        });
    } catch (error) {
        console.error("Failed to fetch movies:", error.message);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

module.exports = router;
