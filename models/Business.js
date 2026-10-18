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

const AppointmentSettingsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    workingDays: {
      type: [String],
      enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      default: ["mon", "tue", "wed", "thu", "fri", "sat"],
    },
    openingTime: { type: String, default: "09:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    closingTime: { type: String, default: "18:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    slotDurationMinutes: { type: Number, min: 5, max: 240, default: 30 },
    bufferMinutes: { type: Number, min: 0, max: 180, default: 0 },
    maxBookingsPerSlot: { type: Number, min: 1, max: 20, default: 1 },
    advanceBookingDays: { type: Number, min: 1, max: 180, default: 30 },
    cancellationPolicy: { type: String, default: "", trim: true, maxlength: 1000 },
    homeServiceEnabled: { type: Boolean, default: false },
    shopAppointmentEnabled: { type: Boolean, default: true },
    homeServiceCharge: { type: Number, min: 0, default: 0 },
    pricePerKm: { type: Number, min: 0, default: 0 },
    serviceRadiusKm: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const FuelRateSchema = new mongoose.Schema(
  {
    fuelType: { type: String, enum: ["PETROL", "DIESEL", "CNG"], required: true },
    price: { type: Number, min: 0, required: true },
    unit: { type: String, enum: ["LITRE", "KG"], required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EVChargerSchema = new mongoose.Schema(
  {
    connectorType: { type: String, required: true, trim: true, maxlength: 80 },
    powerKw: { type: Number, min: 0, required: true },
    quantity: { type: Number, min: 1, default: 1 },
    available: { type: Boolean, default: true },
  },
  { _id: false }
);

const MarketplaceDetailsSchema = new mongoose.Schema(
  {
    fuelRates: { type: [FuelRateSchema], default: [] },
    evChargers: { type: [EVChargerSchema], default: [] },
    serviceModes: {
      atShop: { type: Boolean, default: false },
      homeVisit: { type: Boolean, default: false },
    },
    serviceRadiusKm: { type: Number, min: 0, default: 0 },
    vehicleType: { type: String, default: "", trim: true, maxlength: 100 },
    instantPickupRequest: { type: Boolean, default: false },
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
    subcategory: {
      type: String,
      default: "",
      trim: true,
      index: true,
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
    postalCode: {
      type: String,
      default: "",
      trim: true,
    },
    area: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      latitude: { type: Number, min: -90, max: 90, default: null },
      longitude: { type: Number, min: -180, max: 180, default: null },
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
    appointmentSettings: {
      type: AppointmentSettingsSchema,
      default: () => ({}),
    },
    marketplaceDetails: {
      type: MarketplaceDetailsSchema,
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
    verified: {
      type: Boolean,
      default: false,
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
