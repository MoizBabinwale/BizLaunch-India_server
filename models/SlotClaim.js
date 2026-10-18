const mongoose = require("mongoose");

const SlotClaimSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    date: { type: String, required: true },
    intervalStart: { type: Number, required: true },
    seat: { type: Number, required: true, min: 0 },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  },
  { timestamps: true }
);

SlotClaimSchema.index(
  { business: 1, date: 1, intervalStart: 1, seat: 1 },
  { unique: true }
);
SlotClaimSchema.index({ booking: 1 });

module.exports = mongoose.model("SlotClaim", SlotClaimSchema);
