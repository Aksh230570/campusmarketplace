const router = require("express").Router();
const { protect } = require("../middleware/auth");
const c = require("../controllers/userController");

router.get("/me/wishlist",             protect, c.getWishlist);
router.get("/me/notifications",        protect, c.getNotifications);
router.put("/me/notifications/read-all", protect, c.markAllNotificationsRead);
router.put("/me",                      protect, c.updateProfile);
router.get("/:id",                     protect, c.getPublicProfile);
router.post("/:id/rate",               protect, c.rateSeller);

module.exports = router;
