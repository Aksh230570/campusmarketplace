// routes/auth.js
const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { googleLogin, getMe, logout } = require("../controllers/authController");

router.post("/google", googleLogin);
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);

module.exports = router;
