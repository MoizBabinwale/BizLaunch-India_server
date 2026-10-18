const mongoose = require("mongoose");

const SubcategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    icon: { type: String, default: "LayoutGrid", trim: true },
    serviceType: { type: String, enum: ["station", "service", "dispatch", "retail"], required: true },
  },
  { _id: false }
);

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    icon: { type: String, default: "LayoutGrid", trim: true },
    description: { type: String, default: "", trim: true },
    subcategories: { type: [SubcategorySchema], default: [] },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", CategorySchema);
