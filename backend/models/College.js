const mongoose = require("mongoose");

const collegeSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  domain:       { type: String, required: true, unique: true, lowercase: true },
  logoUrl:      { type: String, default: "" },
  isVerified:   { type: Boolean, default: false },
  studentCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("College", collegeSchema);
