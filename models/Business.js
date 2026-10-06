const mongoose = require("mongoose");
const slugify = require("slugify");

// Operating hours for each day, e.g. { open: "09:00", close: "21:00", closed: false }
const DayHoursSchema = new mongoose.Schema(
  {
    open: { type: String, default: "09:00" },
    close: { type: String, default: "21:00" },
    closed: { type: Boolean, default: false },
  },
  { _id: false }
);

const HoursSchema = new mongoose.Schema(
  {
    mon: { type: DayHoursSchema, default: () => ({}) },
    tue: { type: DayHoursSchema, default: () => ({}) },
    wed: { type: DayHoursSchema, default: () => ({}) },
    thu: { type: DayHoursSchema, default: () => ({}) },
    fri: { type: DayHoursSchema, default: () => ({}) },
    sat: { type: DayHoursSchema, default: () => ({}) },
    sun: { type: DayHoursSchema, default: () => ({}) },
  },
  { _id: false }
);

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
    area: {
      type: String,
      default: "",
      trim: true,
    },
    established: {
      type: String,
      default: "",
      trim: true,
    },
    hours: {
      type: HoursSchema,
      default: () => ({}),
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
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

BusinessSchema.index({ published: 1, category: 1, city: 1 });
BusinessSchema.index({ published: 1, name: "text", tagline: "text", description: "text" });

// Synchronous hook: no `next` callback is used (Mongoose 9 does not pass one
// to a function-style pre hook that ignores async).
BusinessSchema.pre("save", function () {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
    });
  }
});
module.exports = mongoose.model("Business", BusinessSchema);
