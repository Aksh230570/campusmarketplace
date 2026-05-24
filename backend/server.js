require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");
const connectDB = require("./config/database");
const socketHandler = require("./socket/socketHandler");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const server = http.createServer(app);

// ── Database ─────────────────────────────
connectDB();

// ── Socket.io ────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});
socketHandler(io);

// ── Middleware ───────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — 100 req / 15 min per IP
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
}));

// ── Routes ───────────────────────────────
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/listings", require("./routes/listings"));
app.use("/api/chats",    require("./routes/chats"));
app.use("/api/users",    require("./routes/users"));
app.use("/api/ai",       require("./routes/ai"));

app.get("/api/health", (req, res) => res.json({ status: "ok", env: process.env.NODE_ENV }));

// ── Error handler ────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
