const User = require("../models/User");
const Listing = require("../models/Listing");

exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "wishlist",
      match: { college: req.user.college }, // college-scoped
      populate: { path: "seller", select: "name profilePic rating" },
    });
    res.json(user.wishlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("notifications");
    res.json(user.notifications.sort((a, b) => b.createdAt - a.createdAt).slice(0, 30));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $set: { "notifications.$[].read": true } }
    );
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowed = ["bio", "phone", "department", "year"];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
      .select("-notifications")
      .populate("college", "name domain");

    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getPublicProfile = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      college: req.user.college, // college-scoped
    }).select("name profilePic rating trustScore bio department year college createdAt");

    if (!user) return res.status(404).json({ error: "User not found" });

    const listings = await Listing.find({
      seller: user._id,
      college: req.user.college,
      status: "available",
    }).select("title price images condition createdAt");

    res.json({ user, listings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.rateSeller = async (req, res) => {
  try {
    const { stars } = req.body;
    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ error: "Rating must be 1–5" });
    }

    const seller = await User.findOne({
      _id: req.params.id,
      college: req.user.college,
    });
    if (!seller) return res.status(404).json({ error: "User not found" });
    if (String(seller._id) === String(req.user._id)) {
      return res.status(400).json({ error: "You cannot rate yourself" });
    }

    // Recalculate rolling average
    const { average, count } = seller.rating;
    const newCount = count + 1;
    const newAverage = ((average * count) + stars) / newCount;

    seller.rating = { average: Math.round(newAverage * 10) / 10, count: newCount };

    // Trust score logic
    if (stars >= 4) seller.trustScore = Math.min(100, seller.trustScore + 2);
    if (stars <= 2) seller.trustScore = Math.max(0, seller.trustScore - 5);

    await seller.save();
    res.json({ rating: seller.rating, trustScore: seller.trustScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
