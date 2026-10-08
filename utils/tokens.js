const jwt = require("jsonwebtoken");

const signAccessToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRE || "7d",
    }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    }
  );

module.exports = {
  signAccessToken,
  signRefreshToken,
};
