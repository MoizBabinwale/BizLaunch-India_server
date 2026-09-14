const mongoose = require("mongoose");

const EnquirySchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      default: "website",
    },
    status: {
      type: String,
      enum: ["new", "in_progress", "closed"],
      default: "new",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Enquiry", EnquirySchema);
