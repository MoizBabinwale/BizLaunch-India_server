const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");

const uploadsDirectory = path.join(__dirname, "..", "uploads");
const imageTypes = {
  "image/jpeg": {
    extension: ".jpg",
    matches: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  "image/png": {
    extension: ".png",
    matches: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/webp": {
    extension: ".webp",
    matches: (buffer) => buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP",
  },
  "image/gif": {
    extension: ".gif",
    matches: (buffer) => ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6)),
  },
};

const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Choose an image to upload.");
  }

  const imageType = imageTypes[req.file.mimetype];
  if (!imageType || !imageType.matches(req.file.buffer)) {
    throw new ApiError(400, "The uploaded file is not a supported image.");
  }

  const filename = `${crypto.randomUUID()}${imageType.extension}`;
  try {
    await fs.mkdir(uploadsDirectory, { recursive: true });
    await fs.writeFile(path.join(uploadsDirectory, filename), req.file.buffer, { flag: "wx" });
  } catch (_error) {
    throw new ApiError(500, "The photo could not be saved on the server. Please try again.");
  }

  res.status(201).json({ success: true, url: `/uploads/${filename}` });
});

module.exports = { uploadImage };
