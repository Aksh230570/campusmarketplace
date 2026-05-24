const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  listing:      { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  college:      { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true },
  messages: [{
    sender:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text:        String,
    type:        { type: String, enum: ["text","offer","image"], default: "text" },
    offerAmount: Number,
    imageUrl:    String,
    read:        { type: Boolean, default: false },
    createdAt:   { type: Date, default: Date.now },
  }],
  lastMessage: {
    text:      String,
    sender:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    timestamp: Date,
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

chatSchema.index({ participants: 1, listing: 1 });
chatSchema.index({ college: 1, "lastMessage.timestamp": -1 });

module.exports = mongoose.model("Chat", chatSchema);
