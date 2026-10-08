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
  maxAge: 7 * 24 * 60 * 60 * 1000,
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
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
  const verificationUrl = `${clientUrl}/verify-email?token=${encodeURIComponent(
    verificationToken
  )}`;
  await sendMail({
    to: user.email,
    subject: "Verify your BizLaunch India account",
    text: `Welcome to BizLaunch India!\n\nVerify your email address by opening this link:\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
    html: `
      <div style="margin:0;padding:36px 16px;background-color:#f3f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <div style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #e5edf5;border-radius:16px;overflow:hidden;">
          <div style="padding:30px 32px 20px;text-align:center;background-color:#ffffff;">
            <img src="${clientUrl}/title-logo.png" alt="BizLaunch India" width="220" style="display:block;width:220px;max-width:100%;height:auto;margin:0 auto;" />
          </div>
          <div style="padding:8px 32px 36px;text-align:center;">
            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#14213d;">Welcome to BizLaunch India!</h1>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#536176;">Confirm your email address to finish setting up your account and start growing your business.</p>
            <a href="${verificationUrl}" style="display:inline-block;padding:14px 28px;border-radius:8px;background-color:#2563eb;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">Verify my email</a>
            <p style="margin:26px 0 8px;font-size:13px;line-height:1.6;color:#66758a;">This secure link expires in 24 hours. If the button does not work, copy and paste this address into your browser:</p>
            <p style="margin:0;word-break:break-all;font-size:13px;line-height:1.6;"><a href="${verificationUrl}" style="color:#2563eb;text-decoration:underline;">${verificationUrl}</a></p>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#66758a;">If you did not create a BizLaunch India account, you can safely ignore this email.</p>
          </div>
        </div>
        <p style="margin:18px auto 0;max-width:560px;text-align:center;font-size:12px;color:#8290a3;">© BizLaunch India</p>
      </div>
    `,
  });
  sendAuthCookies(res, accessToken, refreshToken);
  res.status(201).json({
    success: true,
    message: "Account created. Check your email to verify the account.",
    token: accessToken,
    refreshToken,
    user: safeUser(user),
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

  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");

  if (!user) {
    throw new ApiError(404, "No account found for that email");
  }

  const resetToken = await createPasswordResetToken(user);

  // Your React frontend URL
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${encodeURIComponent(
    resetToken
  )}`;

  await sendMail({
    to: user.email,
    subject: "Reset your BizLaunch India password",

    text: `Reset your BizLaunch India password using this link:\n\n${resetUrl}`,

    html: `
      <div>
        <h2>Reset your BizLaunch India password</h2>

        <p>Click the button below to create a new password.</p>

        <p>
          <a
            href="${resetUrl}"
            style="
              display:inline-block;
              padding:12px 20px;
              background:#3BB149;
              color:white;
              text-decoration:none;
              border-radius:6px;
            "
          >
            Reset Password
          </a>
        </p>

        <p>This link will expire shortly.</p>

        <p>If you did not request a password reset, you can ignore this email.</p>
      </div>
    `,
  });

  res.status(200).json({
    success: true,
    message: "Password reset instructions sent",

    // Development only
    resetToken:
      process.env.NODE_ENV !== "production"
        ? resetToken
        : undefined,
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;

  console.log("TOKEN FROM URL:", token);
  console.log("PASSWORD RECEIVED:", !!password);

  if (!token || !password) {
    throw new ApiError(400, "Token and new password are required");
  }

  if (String(password).length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  console.log("CALCULATED TOKEN HASH:", tokenHash);

  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpiresAt: { $gt: Date.now() },
  }).select("+password +refreshTokenHash");

  console.log(
    "USER FOUND:",
    user ? { id: user._id, email: user.email } : null
  );

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
