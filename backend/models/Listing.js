const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema({
  title:       { type: String, required: true, maxlength: 100, trim: true },
  description: { type: String, required: true, maxlength: 2000 },
  price:       { type: Number, required: true, min: 0 },
  category: {
    type: String,
    required: true,
    enum: ["Electronics","Books & Notes","Clothing","Furniture","Sports & Fitness",
           "Stationery","Food & Beverages","Instruments","Vehicles","Services",
           "Hostel Essentials","Other"],
  },
  images: [{ url: String, publicId: String }],
  seller:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  college:       { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true },
  collegeDomain: { type: String, required: true },
  status:    { type: String, enum: ["available","sold","reserved"], default: "available" },
  condition: { type: String, enum: ["New","Like New","Good","Fair","Poor"], required: true },
  location:  { type: String, default: "" },
  tags:      [String],
  isUrgent:    { type: Boolean, default: false },
  negotiable:  { type: Boolean, default: true },
  views:       { type: Number, default: 0 },
  wishlistedBy:[{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  aiGenerated: {
    description:    { type: Boolean, default: false },
    tags:           [String],
    suggestedPrice: Number,
    spamScore:      Number,
  },
}, { timestamps: true });

// Indexes for fast querying
listingSchema.index({ title: "text", description: "text", tags: "text" });
listingSchema.index({ college: 1, status: 1, createdAt: -1 });
listingSchema.index({ seller: 1, status: 1 });
listingSchema.index({ category: 1, status: 1, price: 1 });

module.exports = mongoose.model("Listing", listingSchema);
