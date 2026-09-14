const errorMiddleware = (err, req, res, next) => {
  console.error("========== ERROR ==========");
  console.error(err);
  console.error(err.stack);
  console.error("===========================");

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map((error) => error.message).join(", ");
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    message = "A record with these details already exists";
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorMiddleware;
