const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, required: [true, "Customer name is required"], trim: true },
    service: { type: String, required: [true, "Appointment service is required"], trim: true },
    time: { type: Date, required: [true, "Appointment time is required"] },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Completed", "Cancelled", "No-show"],
      default: "Pending",
    },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

AppointmentSchema.index({ business: 1, time: 1 });

module.exports = mongoose.model("Appointment", AppointmentSchema);
