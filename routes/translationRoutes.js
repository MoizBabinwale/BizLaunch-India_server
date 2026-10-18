const express = require("express");
const rateLimit = require("express-rate-limit");
const { translateTexts } = require("../controllers/translationController");

const router = express.Router();

router.post(
  "/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many translation requests. Please try again later." },
  }),
  translateTexts
);

module.exports = router;
