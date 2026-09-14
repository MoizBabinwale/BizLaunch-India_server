const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: [true, "Customer name is required"], trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    notes: { type: String, default: "", trim: true },
    visits: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

CustomerSchema.index({ business: 1, phone: 1 });

module.exports = mongoose.model("Customer", CustomerSchema);
