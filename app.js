const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const notFoundMiddleware = require("./middlewares/notFoundMiddleware");
const errorMiddleware = require("./middlewares/errorMiddleware");
const ApiError = require("./utils/apiError");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const businessRoutes = require("./routes/businessRoutes");
const operationsRoutes = require("./routes/operationsRoutes");
const leadsRoutes = require("./routes/leadsRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const translationRoutes = require("./routes/translationRoutes");

const app = express();
const uploadsDirectory = path.join(__dirname, "uploads");

const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin = (origin, callback) => {
  if (!origin || (!allowedOrigins.length && process.env.NODE_ENV !== "production")) {
    return callback(null, true);
  }

  return callback(null, allowedOrigins.includes(origin));
};

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

morgan.token("safe-url", (req) => {
  const url = req.originalUrl || req.url;
  return url
    .replace(/(\/auth\/(?:reset-password|verify-email)\/)[^/?]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:token|access_token|refresh_token|id_token)=)[^&]*/gi, "$1[REDACTED]");
});

const requestLogFormat =
  process.env.NODE_ENV === "production"
    ? ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":user-agent"'
    : ":method :safe-url :status :response-time ms";
app.use(morgan(requestLogFormat));
app.use(
  "/uploads",
  express.static(uploadsDirectory, {
    dotfiles: "deny",
    fallthrough: false,
    index: false,
    immutable: true,
    maxAge: "1y",
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/translate", translationRoutes);

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(new ApiError(503, "Database unavailable; request could not be processed"));
  }
});

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BizLaunch India API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api", bookingRoutes);
app.use("/api/businesses", operationsRoutes);
app.use("/api/operations", operationsRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to BizLaunch India API",
  });
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
