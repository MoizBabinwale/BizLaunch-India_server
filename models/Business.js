const mongoose = require("mongoose");
const slugify = require("slugify");

const BusinessSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    tagline: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "General",
      trim: true,
    },
    logo: {
      type: String,
      default: "",
    },
    coverImage: {
      type: String,
      default: "",
    },
    gallery: {
      type: [String],
      default: [],
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    whatsapp: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    googleMapsUrl: {
      type: String,
      default: "",
      trim: true,
    },
    socialLinks: {
      website: { type: String, default: "" },
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      youtube: { type: String, default: "" },
      linkedin: { type: String, default: "" },
    },
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      keywords: { type: [String], default: [] },
      canonicalUrl: { type: String, default: "" },
      ogImage: { type: String, default: "" },
    },
    theme: {
      primaryColor: { type: String, default: "#1f6f5b" },
      accentColor: { type: String, default: "#f4a261" },
      backgroundColor: { type: String, default: "#f7f4ef" },
    },
    plan: {
      type: String,
      enum: ["free", "premium-199", "premium-499", "premium-999"],
      default: "free",
    },
    published: {
      type: Boolean,
      default: false,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    stats: {
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      enquiries: { type: Number, default: 0 },
    },
    customDomain: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

BusinessSchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
    });
  }
  next();
});
module.exports = mongoose.model("Business", BusinessSchema);
