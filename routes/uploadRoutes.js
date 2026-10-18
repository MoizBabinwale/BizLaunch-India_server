const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { protect } = require("../middlewares/authMiddleware");
const ApiError = require("../utils/apiError");
const { uploadImage } = require("../controllers/uploadController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) {
      callback(new ApiError(400, "Use a JPEG, PNG, WebP, or GIF image."));
      return;
    }
    callback(null, true);
  },
});

router.post(
  "/images",
  protect,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many photo uploads. Please try again later." },
  }),
  upload.single("image"),
  uploadImage
);

module.exports = router;
