const mongoose = require("mongoose");
const Business = require("../models/Business");
const InventoryItem = require("../models/InventoryItem");
const Sale = require("../models/Sale");
const Customer = require("../models/Customer");
const Appointment = require("../models/Appointment");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");

const assertBusinessAccess = async (req, businessId) => {
  if (!mongoose.isValidObjectId(businessId)) throw new ApiError(400, "Invalid business id");
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");
  if (business.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError(403, "You cannot manage this business");
  }
  return business;
};

const assertId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label} id`);
};

const updateFields = (document, body, fields) => {
  fields.forEach((field) => {
    if (body[field] !== undefined) document[field] = body[field];
  });
};

const send = (res, key, value, status = 200) => res.status(status).json({ success: true, [key]: value });

const listInventory = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  const items = await InventoryItem.find({ business: req.params.businessId }).sort({ createdAt: -1 });
  send(res, "items", items);
});

const createInventory = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  if (!req.body.name || req.body.price === undefined) throw new ApiError(400, "Name and price are required");
  const item = await InventoryItem.create({ ...req.body, business: req.params.businessId });
  send(res, "item", item, 201);
});

const getInventory = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "inventory item");
  const item = await InventoryItem.findOne({ _id: req.params.id, business: req.params.businessId });
  if (!item) throw new ApiError(404, "Inventory item not found");
  send(res, "item", item);
});

const updateInventory = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "inventory item");
  const item = await InventoryItem.findOne({ _id: req.params.id, business: req.params.businessId });
  if (!item) throw new ApiError(404, "Inventory item not found");
  updateFields(item, req.body, ["name", "category", "description", "price", "cost", "stock", "lowStockThreshold", "isActive", "product"]);
  await item.save();
  send(res, "item", item);
});

const deleteInventory = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "inventory item");
  const item = await InventoryItem.findOneAndDelete({ _id: req.params.id, business: req.params.businessId });
  if (!item) throw new ApiError(404, "Inventory item not found");
  send(res, "message", "Inventory item deleted");
});

const listSales = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  const sales = await Sale.find({ business: req.params.businessId }).sort({ date: -1 }).populate("customer", "name phone").populate("product", "name");
  send(res, "sales", sales);
});

const createSale = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  if (!req.body.item || req.body.amount === undefined) throw new ApiError(400, "Item and amount are required");
  let customer = null;
  if (req.body.customerId) {
    assertId(req.body.customerId, "customer");
    customer = await Customer.findOne({ _id: req.body.customerId, business: req.params.businessId });
    if (!customer) throw new ApiError(404, "Customer not found");
  }
  const productId = req.body.productId || req.body.product || null;
  if (productId) {
    assertId(productId, "product");
    const Product = require("../models/Product");
    const product = await Product.findOne({ _id: productId, business: req.params.businessId });
    if (!product) throw new ApiError(404, "Product not found");
  }
  const sale = await Sale.create({
    ...req.body,
    business: req.params.businessId,
    customer: customer ? customer._id : null,
    product: productId,
  });
  if (customer) await Customer.findByIdAndUpdate(customer._id, { $inc: { visits: 1, totalSpent: sale.amount } });
  if (sale.product) {
    const Product = require("../models/Product");
    await Product.findOneAndUpdate({ _id: sale.product, business: req.params.businessId }, { $inc: { stock: -(sale.quantity || 1) } });
  }
  send(res, "sale", sale, 201);
});

const getSale = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "sale");
  const sale = await Sale.findOne({ _id: req.params.id, business: req.params.businessId }).populate("customer", "name phone");
  if (!sale) throw new ApiError(404, "Sale not found");
  send(res, "sale", sale);
});

const updateSale = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "sale");
  const sale = await Sale.findOne({ _id: req.params.id, business: req.params.businessId });
  if (!sale) throw new ApiError(404, "Sale not found");
  updateFields(sale, req.body, ["item", "amount", "cost", "quantity", "date", "notes"]);
  await sale.save();
  send(res, "sale", sale);
});

const deleteSale = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "sale");
  const sale = await Sale.findOneAndDelete({ _id: req.params.id, business: req.params.businessId });
  if (!sale) throw new ApiError(404, "Sale not found");
  if (sale.product) {
    const Product = require("../models/Product");
    await Product.findOneAndUpdate({ _id: sale.product, business: req.params.businessId }, { $inc: { stock: sale.quantity || 1 } });
  }
  if (sale.customer) {
    await Customer.findOneAndUpdate(
      { _id: sale.customer, business: req.params.businessId },
      { $inc: { visits: -1, totalSpent: -sale.amount } }
    );
  }
  send(res, "message", "Sale deleted");
});

const listCustomers = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  const customers = await Customer.find({ business: req.params.businessId }).sort({ updatedAt: -1 });
  send(res, "customers", customers);
});

const createCustomer = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  if (!req.body.name) throw new ApiError(400, "Customer name is required");
  const customer = await Customer.create({ ...req.body, business: req.params.businessId });
  send(res, "customer", customer, 201);
});

const updateCustomer = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "customer");
  const customer = await Customer.findOne({ _id: req.params.id, business: req.params.businessId });
  if (!customer) throw new ApiError(404, "Customer not found");
  updateFields(customer, req.body, ["name", "phone", "email", "notes"]);
  await customer.save();
  send(res, "customer", customer);
});

const getCustomer = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "customer");
  const customer = await Customer.findOne({ _id: req.params.id, business: req.params.businessId });
  if (!customer) throw new ApiError(404, "Customer not found");
  send(res, "customer", customer);
});

const deleteCustomer = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "customer");
  const customer = await Customer.findOneAndDelete({ _id: req.params.id, business: req.params.businessId });
  if (!customer) throw new ApiError(404, "Customer not found");
  send(res, "message", "Customer deleted");
});

const listAppointments = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  const appointments = await Appointment.find({ business: req.params.businessId }).sort({ time: 1 }).populate("customer", "name phone");
  send(res, "appointments", appointments);
});

const createAppointment = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  if (!req.body.customerName && !req.body.customer) throw new ApiError(400, "Customer name is required");
  if (!req.body.service || !req.body.time) throw new ApiError(400, "Service and time are required");
  const appointment = await Appointment.create({
    ...req.body,
    business: req.params.businessId,
    customerName: req.body.customerName || req.body.customer,
    customer: mongoose.isValidObjectId(req.body.customerId) ? req.body.customerId : null,
  });
  send(res, "appointment", appointment, 201);
});

const updateAppointment = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "appointment");
  const appointment = await Appointment.findOne({ _id: req.params.id, business: req.params.businessId });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  updateFields(appointment, req.body, ["customerName", "service", "time", "status", "notes", "customer"]);
  await appointment.save();
  send(res, "appointment", appointment);
});

const getAppointment = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "appointment");
  const appointment = await Appointment.findOne({ _id: req.params.id, business: req.params.businessId }).populate("customer", "name phone");
  if (!appointment) throw new ApiError(404, "Appointment not found");
  send(res, "appointment", appointment);
});

const deleteAppointment = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  assertId(req.params.id, "appointment");
  const appointment = await Appointment.findOneAndDelete({ _id: req.params.id, business: req.params.businessId });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  send(res, "message", "Appointment deleted");
});

const dashboardSummary = asyncHandler(async (req, res) => {
  await assertBusinessAccess(req, req.params.businessId);
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const filter = { business: new mongoose.Types.ObjectId(req.params.businessId) };
  const monthFilter = { ...filter, date: { $gte: start } };
  const [sales, products, customers, appointments, lowStock] = await Promise.all([
    Sale.aggregate([{ $match: monthFilter }, { $group: { _id: null, revenue: { $sum: "$amount" }, cost: { $sum: "$cost" }, count: { $sum: 1 } } }]),
    InventoryItem.countDocuments(filter),
    Customer.countDocuments(filter),
    Appointment.countDocuments({ ...filter, time: { $gte: new Date() }, status: { $nin: ["Cancelled"] } }),
    InventoryItem.countDocuments({ ...filter, $expr: { $lte: ["$stock", "$lowStockThreshold"] }, isActive: true }),
  ]);
  const totals = sales[0] || { revenue: 0, cost: 0, count: 0 };
  send(res, "summary", { revenue: totals.revenue, cost: totals.cost, profit: totals.revenue - totals.cost, sales: totals.count, products, customers, upcomingAppointments: appointments, lowStock });
});

module.exports = {
  listInventory, createInventory, getInventory, updateInventory, deleteInventory,
  listSales, createSale, getSale, updateSale, deleteSale,
  listCustomers, createCustomer, getCustomer, updateCustomer, deleteCustomer,
  listAppointments, createAppointment, getAppointment, updateAppointment, deleteAppointment,
  dashboardSummary,
};
