
require("dotenv").config();

const app = require("./app");
const pool = require("./db");
const { expirePendingBookings } = require("./services/bookingExpiry");

async function startServer() {
    try {
        await pool.query("SELECT 1");

        const port = process.env.PORT || 3000;

        app.listen(port, () => {
            console.log(`FlashSale running on port ${port}`);
        });

        // Check for expired bookings every 30 seconds.
        const runExpiryCheck = async () => {
            try {
                const count = await expirePendingBookings();

                if (count > 0) {
                    console.log(`Expired ${count} pending booking(s)`);
                }
            } catch (error) {
                console.error("Booking expiry check failed:", error.message);
            }
        };

        // Run once at startup, then periodically.
        runExpiryCheck();

        setInterval(runExpiryCheck, 30_000);
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
}

startServer();
