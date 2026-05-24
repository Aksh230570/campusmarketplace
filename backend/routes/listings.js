const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { upload } = require("../config/cloudinary");
const c = require("../controllers/listingController");

router.get("/",              protect, c.getListings);
router.get("/:id",           protect, c.getListing);
router.post("/",             protect, upload.array("images", 6), c.createListing);
router.put("/:id",           protect, upload.array("images", 6), c.updateListing);
router.delete("/:id",        protect, c.deleteListing);
router.patch("/:id/sold",    protect, c.toggleSold);
router.post("/:id/wishlist", protect, c.toggleWishlist);
router.delete("/:id/images/:publicId", protect, c.removeImage);

module.exports = router;
