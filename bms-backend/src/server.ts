import { Server } from "socket.io";
import app from "./app";
import { config } from "./config/config";
import connectDB from "./config/db";
import "./config/redis";
import http from "http";
import { registerSocketHandlers } from "./socket/sockethandlers";

const startServer = async () => {
  const port = config.port;

  // Connet to database
  await connectDB();

  // Create HTTP server from Express app
  const httpServer = http.createServer(app);

  // Create socket.io server
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ User connected: ", socket.id);
    registerSocketHandlers(socket, io);

    socket.on("disconnect", (reason) => {
      console.log("❌ User disconnected: ", socket.id, "Reason", reason);
    });

  });

  httpServer.listen(port, () => {
    console.log(`Listening on port: ${port}`);
  });
};

startServer();