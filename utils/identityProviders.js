const crypto = require("crypto");

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

const verifyGoogleCredential = async (credential) => {
  if (String(process.env.GOOGLE_OAUTH_ENABLED).toLowerCase() !== "true") {
    const error = new Error("Google sign-in is not enabled");
    error.statusCode = 503;
    throw error;
  }
  if (!process.env.GOOGLE_CLIENT_ID || !credential) {
    const error = new Error("Google OAuth is not configured");
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
  );
  if (!response.ok) {
    const error = new Error("Google credential is invalid or expired");
    error.statusCode = 401;
    throw error;
  }
  const profile = await response.json();
  if (
    profile.aud !== process.env.GOOGLE_CLIENT_ID ||
    profile.iss !== "https://accounts.google.com" ||
    profile.email_verified !== "true"
  ) {
    const error = new Error("Google account could not be verified");
    error.statusCode = 401;
    throw error;
  }
  return {
    subject: profile.sub,
    email: String(profile.email).toLowerCase(),
    name: profile.name || profile.email.split("@")[0],
    avatar: profile.picture || "",
  };
};

const sendOtp = async ({ phone, code }) => {
  const provider = String(process.env.OTP_PROVIDER || "").toLowerCase();
  if (provider === "webhook") {
    if (!process.env.OTP_WEBHOOK_URL) throw new Error("OTP webhook is not configured");
    const response = await fetch(process.env.OTP_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OTP_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.OTP_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ phone, code }),
    });
    if (!response.ok) throw new Error("OTP provider rejected the request");
    return { delivered: true };
  }
  if (provider === "twilio") {
    let twilio;
    try {
      twilio = require("twilio");
    } catch {
      throw new Error("OTP_PROVIDER=twilio requires the optional twilio package");
    }
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM) {
      throw new Error("Twilio OTP configuration is incomplete");
    }
    await twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      .messages.create({
        body: `Your BizLaunch India verification code is ${code}`,
        from: process.env.TWILIO_FROM,
        to: phone,
      });
    return { delivered: true };
  }
  if (String(process.env.OTP_DEV_MODE).toLowerCase() === "true" && process.env.NODE_ENV !== "production") {
    return { delivered: false, devCode: code };
  }
  throw new Error("Mobile OTP is not configured. Set OTP_PROVIDER and its credentials.");
};

module.exports = { hash, verifyGoogleCredential, sendOtp };
