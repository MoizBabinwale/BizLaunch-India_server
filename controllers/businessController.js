const Business = require("../models/Business");
const Product = require("../models/Product");
const Service = require("../models/Service");
const Enquiry = require("../models/Enquiry");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");

const buildBusinessResponse = async (business) => {
  const [products, services, enquiries] = await Promise.all([
    Product.find({ business: business._id, isActive: true }).sort({ createdAt: -1 }),
    Service.find({ business: business._id, isActive: true }).sort({ createdAt: -1 }),
    Enquiry.find({ business: business._id }).sort({ createdAt: -1 }).limit(10),
  ]);

  return {
    ...business.toObject(),
    products,
    services,
    enquiries,
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
  };

  if (!payload.name) {
    throw new ApiError(400, "Business name is required");
  }

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
    "phone",
    "whatsapp",
    "email",
    "address",
    "city",
    "state",
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

const listPublicBusinesses = asyncHandler(async (req, res) => {
  const businesses = await Business.find({ published: true })
    .sort({ featured: -1, createdAt: -1 })
    .populate("owner", "name avatar");

  res.status(200).json({
    success: true,
    businesses,
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

  const enquiry = await Enquiry.create({
    business: business._id,
    name: req.body.name,
    email: req.body.email || "",
    phone: req.body.phone || "",
    message: req.body.message,
    source: req.body.source || "website",
  });

  business.stats.enquiries += 1;
  await business.save({ validateBeforeSave: false });

  res.status(201).json({
    success: true,
    enquiry,
  });
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
  createProduct,
  listProducts,
  createService,
  listServices,
  submitEnquiry,
  dashboardStats,
};
