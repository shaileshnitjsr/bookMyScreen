const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const moviesRouter = require("./routes/movies");
const showsRouter = require("./routes/shows");
const bookingsRouter = require("./routes/bookings");
const paymentsRouter = require("./routes/payments");

const app = express();


app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/api/bookings", bookingsRouter);
app.use("/api/payments", paymentsRouter);

app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "flash-sale" });
});

app.use("/api/movies", moviesRouter);
app.use("/api/shows", showsRouter);

module.exports = app;
