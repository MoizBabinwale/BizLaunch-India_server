const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [80, "Name cannot exceed 80 characters"],
    },
    rating: {
      type: Number,
      required: true,
      min: [1, "Rating must be between 1 and 5"],
      max: [5, "Rating must be between 1 and 5"],
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1500, "Review cannot exceed 1,500 characters"],
    },
    status: {
      type: String,
      enum: ["published", "pending", "rejected"],
      default: "published",
    },
  },
  {
    timestamps: true,
  }
);

ReviewSchema.index({ business: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Review", ReviewSchema);