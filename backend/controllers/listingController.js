const Listing = require("../models/Listing");
const User = require("../models/User");
const { cloudinary } = require("../config/cloudinary");

// GET /api/listings — college-scoped feed
exports.getListings = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, condition, sort = "-createdAt", page = 1, limit = 12 } = req.query;

    // ALWAYS scope by college — this is the isolation guarantee
    const filter = {
      college: req.user.college,
      status: "available",
    };

    if (search) filter.$text = { $search: search };
    if (category) filter.category = category;
    if (condition) filter.condition = condition;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const sortMap = {
      "-createdAt": { createdAt: -1 },
      createdAt: { createdAt: 1 },
      price: { price: 1 },
      "-price": { price: -1 },
      "-views": { views: -1 },
    };

    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .sort(sortMap[sort] || { createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("seller", "name profilePic rating trustScore")
        .lean(),
      Listing.countDocuments(filter),
    ]);

    // Mark wishlist status for current user
    const userWishlist = req.user.wishlist.map(String);
    const enriched = listings.map((l) => ({
      ...l,
      wishlisted: userWishlist.includes(String(l._id)),
    }));

    res.json({ listings: enriched, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/listings/:id
exports.getListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate("seller", "name profilePic rating trustScore college")
      .populate("college", "name domain");

    if (!listing) return res.status(404).json({ error: "Listing not found" });

    // College isolation check — even for direct ID access
    if (String(listing.college._id) !== String(req.user.college)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Increment view count async (fire and forget)
    Listing.findByIdAndUpdate(listing._id, { $inc: { views: 1 } }).exec();

    const wishlisted = req.user.wishlist.map(String).includes(String(listing._id));
    res.json({ ...listing.toObject(), wishlisted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/listings
exports.createListing = async (req, res) => {
  try {
    const { title, description, price, category, condition, location, tags, isUrgent, negotiable } = req.body;

    const images = (req.files || []).map((f) => ({
      url: f.path,
      publicId: f.filename,
    }));

    const listing = await Listing.create({
      title, description,
      price: Number(price),
      category, condition,
      location: location || "",
      tags: tags ? JSON.parse(tags) : [],
      isUrgent: isUrgent === "true",
      negotiable: negotiable !== "false",
      images,
      seller: req.user._id,
      college: req.user.college,
      collegeDomain: req.user.collegeDomain,
    });

    await listing.populate("seller", "name profilePic rating trustScore");
    res.status(201).json(listing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/listings/:id
exports.updateListing = async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.user._id });
    if (!listing) return res.status(404).json({ error: "Listing not found or not yours" });

    const allowed = ["title","description","price","category","condition","location","tags","isUrgent","negotiable","status"];
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) listing[key] = req.body[key];
    });

    // Add new images if uploaded
    if (req.files?.length) {
      const newImgs = req.files.map((f) => ({ url: f.path, publicId: f.filename }));
      listing.images = [...listing.images, ...newImgs].slice(0, 6);
    }

    await listing.save();
    res.json(listing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/listings/:id
exports.deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.user._id });
    if (!listing) return res.status(404).json({ error: "Listing not found or not yours" });

    // Remove images from Cloudinary
    await Promise.all(listing.images.map((img) => cloudinary.uploader.destroy(img.publicId)));

    await listing.deleteOne();
    res.json({ message: "Listing deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/listings/:id/sold
exports.toggleSold = async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.user._id });
    if (!listing) return res.status(404).json({ error: "Not found" });
    listing.status = listing.status === "sold" ? "available" : "sold";
    await listing.save();
    res.json({ status: listing.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/listings/:id/wishlist — toggle
exports.toggleWishlist = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Not found" });

    const userId = req.user._id;
    const alreadyWishlisted = listing.wishlistedBy.includes(userId);

    // Atomic update both collections
    await Promise.all([
      Listing.findByIdAndUpdate(listing._id, alreadyWishlisted
        ? { $pull: { wishlistedBy: userId } }
        : { $addToSet: { wishlistedBy: userId } }),
      User.findByIdAndUpdate(userId, alreadyWishlisted
        ? { $pull: { wishlist: listing._id } }
        : { $addToSet: { wishlist: listing._id } }),
    ]);

    res.json({ wishlisted: !alreadyWishlisted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/listings/:id/images/:publicId
exports.removeImage = async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.user._id });
    if (!listing) return res.status(404).json({ error: "Not found" });

    const publicId = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(publicId);
    listing.images = listing.images.filter((img) => img.publicId !== publicId);
    await listing.save();
    res.json({ images: listing.images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
