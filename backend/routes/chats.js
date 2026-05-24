const router = require("express").Router();
const { protect } = require("../middleware/auth");
const c = require("../controllers/chatController");

router.get("/",              protect, c.getChats);
router.get("/:id",           protect, c.getChat);
router.post("/",             protect, c.startChat);
router.post("/:id/messages", protect, c.sendMessage);

module.exports = router;
