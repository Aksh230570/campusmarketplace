const jwt = require("jsonwebtoken");

const onlineUsers = new Map(); // userId → socketId

module.exports = (io) => {
  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.userId);
      socket.college = String(decoded.college);
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { userId } = socket;
    onlineUsers.set(userId, socket.id);

    // Join personal room for notifications
    socket.join(`user_${userId}`);
    io.emit("user_online", { userId });

    socket.on("join_chat", ({ chatId }) => socket.join(`chat_${chatId}`));
    socket.on("leave_chat", ({ chatId }) => socket.leave(`chat_${chatId}`));

    socket.on("typing_start", ({ chatId }) => {
      socket.to(`chat_${chatId}`).emit("typing_start", { chatId, userId });
    });
    socket.on("typing_stop", ({ chatId }) => {
      socket.to(`chat_${chatId}`).emit("typing_stop", { chatId, userId });
    });
    socket.on("mark_read", ({ chatId }) => {
      socket.to(`chat_${chatId}`).emit("messages_read", { chatId, userId });
    });
    socket.on("get_online_users", () => {
      socket.emit("online_users", [...onlineUsers.keys()]);
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("user_offline", { userId });
    });
  });
};
