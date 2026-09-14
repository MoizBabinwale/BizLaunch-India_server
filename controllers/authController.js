const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const { signAccessToken, signRefreshToken } = require("../utils/tokens");
const { sendMail } = require("../utils/mailer");
const { hash, verifyGoogleCredential, sendOtp } = require("../utils/identityProviders");

const cookieBaseOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
};

const accessTokenCookieOptions = {
  ...cookieBaseOptions,
  maxAge: 15 * 60 * 1000,
};

const refreshTokenCookieOptions = {
  ...cookieBaseOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const safeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  avatar: user.avatar,
  emailVerified: user.emailVerified,
  phoneVerified: user.phoneVerified,
  authProviders: user.authProviders,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sendAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, accessTokenCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
};

const createVerificationToken = async (user) => {
  const token = crypto.randomBytes(32).toString("hex");
  user.verificationTokenHash = crypto.createHash("sha256").update(token).digest("hex");
  user.verificationTokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
  await user.save({ validateBeforeSave: false });
  return token;
};

const createPasswordResetToken = async (user) => {
  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordTokenHash = crypto.createHash("sha256").update(token).digest("hex");
  user.resetPasswordExpiresAt = Date.now() + 60 * 60 * 1000;
  await user.save({ validateBeforeSave: false });
  return token;
};

const issueAuth = async (res, user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  await user.save({ validateBeforeSave: false });
  sendAuthCookies(res, accessToken, refreshToken);
  return { token: accessToken, refreshToken, user: safeUser(user) };
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email and password are required");
  }

  if (String(password).length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const exists = await User.findOne({ email: String(email).toLowerCase() });

  if (exists) {
    throw new ApiError(400, "Email is already registered");
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role && ["user", "business_owner"].includes(role) ? role : "user",
    phone,
  });
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  await user.save({ validateBeforeSave: false });

  const verificationToken = await createVerificationToken(user);
  await sendMail({
    to: user.email,
    subject: "Verify your BizLaunch India account",
    text: `Verify your email using this token: ${verificationToken}`,
    html: `<p>Welcome to BizLaunch India.</p><p>Your verification token is:</p><h2>${verificationToken}</h2>`,
  });
  sendAuthCookies(res, accessToken, refreshToken);
  res.status(201).json({
    success: true,
    message: "Account created. Check your email to verify the account.",
    token: accessToken,
    refreshToken,
    user: safeUser(user),
    verificationToken: process.env.NODE_ENV !== "production" ? verificationToken : undefined,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: String(email).toLowerCase() }).select("+password +refreshTokenHash");

  if (!user || !(await user.matchPassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  const auth = await issueAuth(res, user);

  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    ...auth,
  });
});

const googleLogin = asyncHandler(async (req, res) => {
    const profile = await verifyGoogleCredential(req.body.idToken || req.body.credential);
    let user = await User.findOne({
      $or: [{ googleSubject: profile.subject }, { email: profile.email }],
    }).select("+refreshTokenHash +googleSubject");

    if (!user) {
      user = await User.create({
        name: profile.name,
        email: profile.email,
        avatar: profile.avatar,
        emailVerified: true,
        googleSubject: profile.subject,
        authProviders: ["google"],
      });
    } else {
      if (user.googleSubject && user.googleSubject !== profile.subject) {
        throw new ApiError(409, "That email is linked to another Google account");
      }
      user.googleSubject = profile.subject;
      user.emailVerified = true;
      user.avatar = user.avatar || profile.avatar;
      if (!user.authProviders.includes("google")) user.authProviders.push("google");
      await user.save({ validateBeforeSave: false });
    }

    const auth = await issueAuth(res, user);
    res.status(200).json({ success: true, message: "Google sign-in successful", ...auth });
});

const requestOtp = asyncHandler(async (req, res) => {
    const phone = String(req.body.phone || "").trim();
    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
      throw new ApiError(400, "A valid phone number in international format is required");
    }

    let user = await User.findOne({ phone }).select("+otpLastSentAt");
    if (user?.otpLastSentAt && Date.now() - user.otpLastSentAt.getTime() < 60 * 1000) {
      throw new ApiError(429, "Please wait before requesting another code");
    }
    const code = String(crypto.randomInt(100000, 1000000));
    await sendOtp({ phone, code }).catch((error) => {
      throw new ApiError(503, error.message);
    });

    if (!user) {
      user = new User({ name: `User ${phone.slice(-4)}`, phone, password: "", authProviders: ["otp"] });
    } else if (!user.authProviders.includes("otp")) {
      user.authProviders.push("otp");
    }
    user.otpHash = hash(code);
    user.otpExpiresAt = Date.now() + 10 * 60 * 1000;
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: "Verification code sent",
      ...(process.env.NODE_ENV !== "production" && process.env.OTP_DEV_MODE === "true"
        ? { devCode: code }
        : {}),
    });
});

const verifyOtp = asyncHandler(async (req, res) => {
    const phone = String(req.body.phone || "").trim();
    const code = String(req.body.code || "").trim();
    if (!phone || !/^\d{6}$/.test(code)) throw new ApiError(400, "Phone and six-digit code are required");
    const user = await User.findOne({ phone }).select("+otpHash +otpExpiresAt +otpAttempts");
    if (!user || !user.otpHash || !user.otpExpiresAt || user.otpExpiresAt < Date.now()) {
      throw new ApiError(401, "Verification code is invalid or expired");
    }
    if (user.otpAttempts >= 5) throw new ApiError(429, "Too many attempts; request a new code");
    user.otpAttempts += 1;
    if (hash(code) !== user.otpHash) {
      await user.save({ validateBeforeSave: false });
      throw new ApiError(401, "Verification code is invalid or expired");
    }
    user.phoneVerified = true;
    user.otpHash = "";
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    await user.save({ validateBeforeSave: false });
    const auth = await issueAuth(res, user);
    res.status(200).json({ success: true, message: "Phone verified successfully", ...auth });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (refreshToken) {
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await User.updateOne({ refreshTokenHash }, { $set: { refreshTokenHash: "" } });
  }

  res.clearCookie("accessToken", cookieBaseOptions);
  res.clearCookie("refreshToken", cookieBaseOptions);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.id).select("+refreshTokenHash");

  if (!user) {
    throw new ApiError(401, "Refresh token invalid");
  }

  const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  if (!user.refreshTokenHash || user.refreshTokenHash !== refreshTokenHash) {
    throw new ApiError(401, "Refresh token invalid");
  }

  const accessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);

  user.refreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
  await user.save({ validateBeforeSave: false });

  sendAuthCookies(res, accessToken, newRefreshToken);

  res.status(200).json({
    success: true,
    token: accessToken,
    user: safeUser(user),
  });
});

const me = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: safeUser(req.user),
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const token = req.params.token || req.body.token;

  if (!token) {
    throw new ApiError(400, "Verification token required");
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    verificationTokenHash: tokenHash,
    verificationTokenExpiresAt: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, "Verification token is invalid or expired");
  }

  user.emailVerified = true;
  user.verificationTokenHash = "";
  user.verificationTokenExpiresAt = null;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Email verified successfully",
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email: String(email).toLowerCase() }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");

  if (!user) {
    throw new ApiError(404, "No account found for that email");
  }

  const resetToken = await createPasswordResetToken(user);

  await sendMail({
    to: user.email,
    subject: "Reset your BizLaunch India password",
    text: `Reset your password with this token: ${resetToken}`,
    html: `<p>Use this password reset token:</p><h2>${resetToken}</h2>`,
  });

  res.status(200).json({
    success: true,
    message: "Password reset instructions sent",
    resetToken: process.env.NODE_ENV !== "production" ? resetToken : undefined,
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    throw new ApiError(400, "Token and new password are required");
  }

  if (String(password).length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpiresAt: { $gt: Date.now() },
  }).select("+password +refreshTokenHash");

  if (!user) {
    throw new ApiError(400, "Reset token is invalid or expired");
  }

  user.password = password;
  user.resetPasswordTokenHash = "";
  user.resetPasswordExpiresAt = null;
  user.refreshTokenHash = "";
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password reset successfully",
  });
});

module.exports = {
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
};
