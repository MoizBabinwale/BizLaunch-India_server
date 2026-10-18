const mongoose = require("mongoose");
const slugify = require("slugify");

const ServiceSchema = new mongoose.Schema(
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
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "",
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    price: {
      type: Number,
      default: 0,
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    homeServiceAvailable: {
      type: Boolean,
      default: false,
    },
    shopAvailable: {
      type: Boolean,
      default: true,
    },
    homeServiceCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

ServiceSchema.pre("save", function () {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model("Service", ServiceSchema);
