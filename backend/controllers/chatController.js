const Chat = require("../models/Chat");
const Listing = require("../models/Listing");
const User = require("../models/User");

// GET /api/chats — my conversations
exports.getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id,
      college: req.user.college, // college-scoped
    })
      .sort({ "lastMessage.timestamp": -1 })
      .populate("participants", "name profilePic")
      .populate("listing", "title images price status")
      .lean();

    // Count unread messages for current user
    const enriched = chats.map((c) => ({
      ...c,
      unreadCount: c.messages.filter(
        (m) => !m.read && String(m.sender) !== String(req.user._id)
      ).length,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/chats/:id
exports.getChat = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id,
      college: req.user.college,
    })
      .populate("participants", "name profilePic trustScore rating")
      .populate("listing", "title images price status condition");

    if (!chat) return res.status(404).json({ error: "Chat not found" });

    // Mark messages as read
    await Chat.updateOne(
      { _id: chat._id },
      { $set: { "messages.$[elem].read": true } },
      { arrayFilters: [{ "elem.sender": { $ne: req.user._id } }] }
    );

    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/chats — start or retrieve existing chat
exports.startChat = async (req, res) => {
  try {
    const { listingId } = req.body;

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (String(listing.seller) === String(req.user._id)) {
      return res.status(400).json({ error: "You cannot chat with yourself" });
    }

    // Return existing chat if one exists
    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, listing.seller] },
      listing: listingId,
    })
      .populate("participants", "name profilePic")
      .populate("listing", "title images price status");

    if (chat) return res.json(chat);

    // Create new chat
    chat = await Chat.create({
      participants: [req.user._id, listing.seller],
      listing: listingId,
      college: req.user.college,
      messages: [],
    });

    await chat.populate("participants", "name profilePic");
    await chat.populate("listing", "title images price status");

    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/chats/:id/messages
exports.sendMessage = async (req, res) => {
  try {
    const { text, type = "text", offerAmount } = req.body;

    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id,
      college: req.user.college,
    });

    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const message = {
      sender: req.user._id,
      text,
      type,
      offerAmount,
      read: false,
      createdAt: new Date(),
    };

    chat.messages.push(message);
    chat.lastMessage = { text, sender: req.user._id, timestamp: new Date() };
    await chat.save();

    const newMsg = chat.messages[chat.messages.length - 1];

    // Socket.io emit is handled in the route/socket layer
    req.app.get("io")?.to(`chat_${chat._id}`).emit("new_message", {
      chatId: chat._id,
      message: { ...newMsg.toObject(), senderName: req.user.name },
    });

    // Notify the other participant
    const otherId = chat.participants.find((p) => String(p) !== String(req.user._id));
    req.app.get("io")?.to(`user_${otherId}`).emit("chat_notification", {
      chatId: chat._id,
      sender: req.user.name,
      text,
    });

    res.status(201).json(newMsg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
