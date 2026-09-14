const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    item: { type: String, required: [true, "Sale item is required"], trim: true },
    amount: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: 1, min: 1 },
    date: { type: Date, default: Date.now },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

SaleSchema.virtual("profit").get(function () {
  return this.amount - this.cost;
});
SaleSchema.set("toJSON", { virtuals: true });
SaleSchema.index({ business: 1, date: -1 });

module.exports = mongoose.model("Sale", SaleSchema);
