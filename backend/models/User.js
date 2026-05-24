const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  googleId:      { type: String, required: true, unique: true },
  name:          { type: String, required: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  profilePic:    { type: String, default: "" },
  college:       { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true },
  collegeDomain: { type: String, required: true },
  bio:           { type: String, maxlength: 250, default: "" },
  phone:         { type: String, default: "" },
  department:    { type: String, default: "" },
  year:          { type: String, enum: ["1st","2nd","3rd","4th","Alumni","Staff",""], default: "" },
  rating: {
    average: { type: Number, default: 0 },
    count:   { type: Number, default: 0 },
  },
  wishlist:    [{ type: mongoose.Schema.Types.ObjectId, ref: "Listing" }],
  isVerified:  { type: Boolean, default: false },
  trustScore:  { type: Number, default: 60, min: 0, max: 100 },
  notifications: [{
    type:      { type: String },
    message:   String,
    read:      { type: Boolean, default: false },
    relatedId: mongoose.Schema.Types.ObjectId,
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
