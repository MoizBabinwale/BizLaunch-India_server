const Business = require("../models/Business");
const Product = require("../models/Product");
const Service = require("../models/Service");
const Enquiry = require("../models/Enquiry");
const Review = require("../models/Review");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");

const indianPhone = /^[6-9]\d{9}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateBusinessPayload = (payload, { publishing = false } = {}) => {
  const name = String(payload.name || "").trim();
  if (name.length < 2 || name.length > 120) throw new ApiError(400, "Business name must be between 2 and 120 characters");
  if (String(payload.tagline || "").trim().length > 140) throw new ApiError(400, "Tagline cannot exceed 140 characters");
  if (String(payload.description || "").trim().length > 3000) throw new ApiError(400, "Description cannot exceed 3,000 characters");

  ["phone", "whatsapp"].forEach((field) => {
    const number = String(payload[field] || "").replace(/\D/g, "");
    if (number && !indianPhone.test(number)) throw new ApiError(400, `Enter a valid 10-digit Indian ${field === "phone" ? "phone" : "WhatsApp"} number`);
  });
  if (payload.email && !emailPattern.test(String(payload.email).trim())) throw new ApiError(400, "Enter a valid business email address");

  if (publishing) {
    if (!String(payload.description || "").trim() || String(payload.description).trim().length < 20) throw new ApiError(400, "Add an about section of at least 20 characters before publishing");
    if (!String(payload.phone || "").replace(/\D/g, "") && !String(payload.whatsapp || "").replace(/\D/g, "")) throw new ApiError(400, "Add a phone or WhatsApp number before publishing");
    if (!String(payload.city || "").trim() || !String(payload.state || "").trim()) throw new ApiError(400, "Add your city and state before publishing");
  }
};

const buildBusinessResponse = async (business) => {
  const [products, services, enquiries, reviews] = await Promise.all([
    Product.find({ business: business._id, isActive: true }).sort({ createdAt: -1 }),
    Service.find({ business: business._id, isActive: true }).sort({ createdAt: -1 }),
    Enquiry.find({ business: business._id }).sort({ createdAt: -1 }).limit(10),
    Review.find({ business: business._id, status: "published" })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("user", "name avatar"),
  ]);

  return {
    ...business.toObject(),
    products,
    services,
    enquiries,
    reviews,
  };
};

const createBusiness = asyncHandler(async (req, res) => {
  const payload = {
    owner: req.user._id,
    name: req.body.name,
    tagline: req.body.tagline || "",
    description: req.body.description || "",
    category: req.body.category || "General",
    phone: req.body.phone || "",
    whatsapp: req.body.whatsapp || "",
    email: req.body.email || req.user.email,
    address: req.body.address || "",
    city: req.body.city || "",
    state: req.body.state || "",
    googleMapsUrl: req.body.googleMapsUrl || "",
    published: Boolean(req.body.published),
  };

  if (!payload.name) {
    throw new ApiError(400, "Business name is required");
  }

  validateBusinessPayload(payload, { publishing: Boolean(req.body.published) });

  const existing = await Business.findOne({ owner: req.user._id });
  if (existing) {
    throw new ApiError(400, "You already have a business profile");
  }

  const business = await Business.create(payload);

  if (req.user.role === "user") {
    req.user.role = "business_owner";
    await req.user.save({ validateBeforeSave: false });
  }

  res.status(201).json({
    success: true,
    business,
  });
});

const updateBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.id);

  if (!business) {
    throw new ApiError(404, "Business not found");
  }

  const isOwner = business.owner.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You cannot edit this business");
  }

  const fields = [
    "name",
    "tagline",
    "description",
    "category",
    "logo",
    "coverImage",
    "gallery",
    "phone",
    "whatsapp",
    "email",
    "address",
    "city",
    "state",
    "area",
    "established",
    "hours",
    "googleMapsUrl",
    "customDomain",
    "published",
    "featured",
    "plan",
  ];

  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      business[field] = req.body[field];
    }
  });

  validateBusinessPayload(business, { publishing: Boolean(business.published) });

  if (req.body.socialLinks) {
    business.socialLinks = { ...business.socialLinks, ...req.body.socialLinks };
  }

  if (req.body.seo) {
    business.seo = { ...business.seo, ...req.body.seo };
  }

  if (req.body.theme) {
    business.theme = { ...business.theme, ...req.body.theme };
  }

  await business.save();

  res.status(200).json({
    success: true,
    business,
  });
});

const getMyBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findOne({ owner: req.user._id });

  if (!business) {
    throw new ApiError(404, "Business profile not found");
  }

  const response = await buildBusinessResponse(business);

  res.status(200).json({
    success: true,
    business: response,
  });
});

const getBusinessBySlug = asyncHandler(async (req, res) => {
  const business = await Business.findOne({
    slug: req.params.slug,
    published: true,
  }).populate("owner", "name avatar");

  if (!business) {
    throw new ApiError(404, "Business page not found");
  }

  business.stats.views += 1;
  await business.save({ validateBeforeSave: false });

  const response = await buildBusinessResponse(business);

  res.status(200).json({
    success: true,
    business: response,
  });
});

const SORTS = {
  relevance: { featured: -1, rating: -1, createdAt: -1 },
  rating: { rating: -1, reviewCount: -1 },
  newest: { createdAt: -1 },
  popular: { "stats.views": -1, featured: -1 },
};

const listPublicBusinesses = asyncHandler(async (req, res) => {
  const query = String(req.query.q || "").trim();
  const category = String(req.query.category || "").trim();
  const city = String(req.query.city || "").trim();
  const area = String(req.query.area || "").trim();
  const minRating = Number(req.query.minRating || 0);
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(48, Math.max(1, Number(req.query.limit || 12)));
  const sortKey = SORTS[req.query.sort] ? req.query.sort : "relevance";

  const filter = { published: true };

  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
  if (city) filter.city = new RegExp(escapeRegex(city), "i");
  if (area) filter.area = new RegExp(escapeRegex(area), "i");
  if (minRating > 0) filter.rating = { $gte: minRating };

  if (query) {
    const matcher = new RegExp(escapeRegex(query), "i");
    filter.$or = [
      { name: matcher },
      { category: matcher },
      { city: matcher },
      { area: matcher },
      { state: matcher },
      { description: matcher },
      { tagline: matcher },
    ];
  }

  const [businesses, total] = await Promise.all([
    Business.find(filter)
      .sort(SORTS[sortKey])
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("owner", "name avatar"),
    Business.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    businesses,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

const getPublicStats = asyncHandler(async (_req, res) => {
  const [businesses, categories, listings, products, services, totals] = await Promise.all([
    Business.countDocuments({ published: true }),
    Business.distinct("category", { published: true }),
    Business.distinct("city", { published: true }),
    Product.countDocuments({ isActive: true }),
    Service.countDocuments({ isActive: true }),
    Business.aggregate([
      { $match: { published: true } },
      { $group: { _id: null, views: { $sum: "$stats.views" }, enquiries: { $sum: "$stats.enquiries" } } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      businesses,
      categories: categories.filter(Boolean).length,
      cities: listings.filter(Boolean).length,
      products,
      services,
      catalogue: products + services,
      views: totals[0]?.views || 0,
      enquiries: totals[0]?.enquiries || 0,
    },
  });
});

const createProduct = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.businessId);

  if (!business) {
    throw new ApiError(404, "Business not found");
  }

  const isOwner = business.owner.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You cannot manage products for this business");
  }

  const product = await Product.create({
    business: business._id,
    name: req.body.name,
    description: req.body.description || "",
    price: req.body.price || 0,
    compareAtPrice: req.body.compareAtPrice || 0,
    images: req.body.images || [],
    stock: req.body.stock || 0,
  });

  res.status(201).json({
    success: true,
    product,
  });
});

const listProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ business: req.params.businessId }).sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    products,
  });
});

const createService = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.businessId);

  if (!business) {
    throw new ApiError(404, "Business not found");
  }

  const isOwner = business.owner.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You cannot manage services for this business");
  }

  const service = await Service.create({
    business: business._id,
    name: req.body.name,
    description: req.body.description || "",
    price: req.body.price || 0,
    durationMinutes: req.body.durationMinutes || 0,
  });

  res.status(201).json({
    success: true,
    service,
  });
});

const listServices = asyncHandler(async (req, res) => {
  const services = await Service.find({ business: req.params.businessId }).sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    services,
  });
});

const submitEnquiry = asyncHandler(async (req, res) => {
  const business = await Business.findOne({
    slug: req.params.slug,
    published: true,
  });

  if (!business) {
    throw new ApiError(404, "Business page not found");
  }

  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || "").replace(/\D/g, "");
  const message = String(req.body.message || "").trim();
  if (name.length < 2 || name.length > 80) throw new ApiError(400, "Enter your name (2–80 characters)");
  if (!email && !phone) throw new ApiError(400, "Enter an email address or phone number so the business can reply");
  if (email && !emailPattern.test(email)) throw new ApiError(400, "Enter a valid email address");
  if (phone && !indianPhone.test(phone)) throw new ApiError(400, "Enter a valid 10-digit Indian phone number");
  if (message.length < 5 || message.length > 1500) throw new ApiError(400, "Your enquiry must be between 5 and 1,500 characters");

  const enquiry = await Enquiry.create({
    business: business._id,
    name,
    email,
    phone,
    message,
    source: req.body.source || "website",
  });

  business.stats.enquiries += 1;
  await business.save({ validateBeforeSave: false });

  res.status(201).json({
    success: true,
    enquiry,
  });
});

const listMyEnquiries = asyncHandler(async (req, res) => {
  const business = await Business.findOne({ owner: req.user._id });
  if (!business) throw new ApiError(404, "Create your business profile before viewing enquiries");
  const enquiries = await Enquiry.find({ business: business._id }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, enquiries });
});

const updateMyEnquiry = asyncHandler(async (req, res) => {
  const business = await Business.findOne({ owner: req.user._id });
  if (!business) throw new ApiError(404, "Business profile not found");
  const status = String(req.body.status || "");
  if (!["new", "in_progress", "closed"].includes(status)) throw new ApiError(400, "Invalid enquiry status");
  const enquiry = await Enquiry.findOneAndUpdate(
    { _id: req.params.id, business: business._id },
    { status },
    { new: true, runValidators: true },
  );
  if (!enquiry) throw new ApiError(404, "Enquiry not found");
  res.status(200).json({ success: true, enquiry });
});

const dashboardStats = asyncHandler(async (req, res) => {
  const [users, businesses, products, services, enquiries] = await Promise.all([
    User.countDocuments(),
    Business.countDocuments(),
    Product.countDocuments(),
    Service.countDocuments(),
    Enquiry.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      users,
      businesses,
      products,
      services,
      enquiries,
    },
  });
});

module.exports = {
  createBusiness,
  updateBusiness,
  getMyBusiness,
  getBusinessBySlug,
  listPublicBusinesses,
  getPublicStats,
  createProduct,
  listProducts,
  createService,
  listServices,
  submitEnquiry,
  listMyEnquiries,
  updateMyEnquiry,
  dashboardStats,
};
