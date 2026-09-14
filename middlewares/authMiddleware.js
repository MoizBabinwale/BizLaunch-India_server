const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const User = require("../models/User");

const readTokenFromRequest = (req) => {
  const bearer = req.headers.authorization;

  if (bearer && bearer.startsWith("Bearer ")) {
    return bearer.slice(7);
  }

  return req.cookies?.accessToken || "";
};

const protect = asyncHandler(async (req, res, next) => {
  const token = readTokenFromRequest(req);

  if (!token) {
    throw new ApiError(401, "Not authorized, token missing");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new ApiError(401, "Not authorized, user not found");
  }

  if (user.status === "suspended") {
    throw new ApiError(403, "Account suspended");
  }

  req.user = user;
  next();
});

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Not authorized"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Forbidden: insufficient role"));
    }

    next();
  };
};

module.exports = {
  protect,
  authorizeRoles,
};
