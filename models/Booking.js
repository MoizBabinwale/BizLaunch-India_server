const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    serviceName: { type: String, required: true, trim: true },
    bookingType: { type: String, enum: ["SHOP", "HOME"], required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    timeSlot: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    customerAddress: { type: String, default: "", trim: true, maxlength: 500 },
    servicePrice: { type: Number, required: true, min: 0 },
    homeServiceCharge: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 1 },
    notes: { type: String, default: "", trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW", "IN_PROGRESS"],
      default: "PENDING",
      index: true,
    },
    slotClaimed: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

BookingSchema.index({ customer: 1, date: 1, timeSlot: 1 });
BookingSchema.index({ business: 1, date: 1, timeSlot: 1, status: 1 });

module.exports = mongoose.model("Booking", BookingSchema);
