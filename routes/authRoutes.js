const express = require("express");
const {
  register,
  login,
  googleLogin,
  requestOtp,
  verifyOtp,
  logout,
  refresh,
  me,
  verifyEmail,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/otp/request", requestOtp);
router.post("/otp/verify", verifyOtp);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.get("/me", protect, me);
router.get("/verify-email/:token", verifyEmail);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
