const router = require("express").Router();
const { protect } = require("../middleware/auth");
const c = require("../controllers/aiController");

router.post("/generate-description", protect, c.generateDescription);
router.post("/suggest-price",        protect, c.suggestPrice);
router.post("/generate-tags",        protect, c.generateTags);
router.post("/detect-spam",          protect, c.detectSpam);
router.post("/assistant",            protect, c.assistant);
router.post("/negotiation-tips",     protect, c.negotiationTips);

module.exports = router;
