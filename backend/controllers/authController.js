const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const College = require("../models/College");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Parse allowed domains from env: "mgit.ac.in" or "mgit.ac.in,cbit.ac.in"
const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS
  ? process.env.ALLOWED_DOMAINS.split(",").map((d) => d.trim().toLowerCase())
  : null; // null = open to any domain

// Derive a readable college name from the domain
const domainToCollegeName = (domain) => {
  // "mgit.ac.in" → "MGIT" | "vasavi.ac.in" → "Vasavi"
  const parts = domain.split(".");
  const main = parts[0].toUpperCase();
  return `${main} College`;
};

exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "No credential provided" });

    // 1. Verify Google ID token server-side
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;
    const domain = email.split("@")[1].toLowerCase();

    // 2. Domain restriction — the ONLY gatekeeper
    if (ALLOWED_DOMAINS && !ALLOWED_DOMAINS.includes(domain)) {
      return res.status(403).json({
        error: "ACCESS_DENIED",
        message: `Only ${ALLOWED_DOMAINS.join(", ")} accounts are allowed on this platform.`,
      });
    }

    // 3. Auto-register college on first login from this domain
    let college = await College.findOne({ domain });
    if (!college) {
      college = await College.create({
        name: domainToCollegeName(domain),
        domain,
        isVerified: false,
        studentCount: 0,
      });
    }

    // 4. Find or create user
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.create({
        googleId,
        name,
        email,
        profilePic: picture,
        college: college._id,
        collegeDomain: domain,
        trustScore: 60,
      });
      await College.findByIdAndUpdate(college._id, { $inc: { studentCount: 1 } });
    } else {
      // Update profile pic in case it changed
      user.profilePic = picture;
      await user.save();
    }

    // 5. Issue JWT with college info embedded
    const token = jwt.sign(
      {
        userId: user._id,
        college: user.college,
        collegeDomain: domain,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    await user.populate("college");

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        college: user.college,
        collegeDomain: user.collegeDomain,
        trustScore: user.trustScore,
        rating: user.rating,
        department: user.department,
        year: user.year,
        bio: user.bio,
      },
    });
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ error: "Authentication failed", message: err.message });
  }
};

exports.getMe = async (req, res) => {
  await req.user.populate("college");
  res.json(req.user);
};

exports.logout = (req, res) => {
  // JWT is stateless — client drops the token
  res.json({ message: "Logged out" });
};
