const mongoose = require("mongoose");

const InventoryItemSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    name: { type: String, required: [true, "Inventory item name is required"], trim: true },
    category: { type: String, default: "General", trim: true },
    description: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InventoryItemSchema.index({ business: 1, name: 1 });

module.exports = mongoose.model("InventoryItem", InventoryItemSchema);
