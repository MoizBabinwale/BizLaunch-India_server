const Business = require("../models/Business");
const Product = require("../models/Product");
const Service = require("../models/Service");
const Enquiry = require("../models/Enquiry");
const Review = require("../models/Review");
const User = require("../models/User");
const SlotClaim = require("../models/SlotClaim");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const { getIndiaTimeParts, getOccupiedIntervals, getScheduleForDate, getSlotStarts, toMinutes } = require("../utils/bookingSchedule");
const { CATEGORIES } = require("../config/categories");

const indianPhone = /^[6-9]\d{9}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateImageUrls = (images) => {
  if (!Array.isArray(images)) throw new ApiError(400, "Photos must be provided as a list of image URLs");
  images.forEach((image) => {
    let url;
    try {
      url = new URL(String(image));
    } catch (_error) {
      throw new ApiError(400, "Enter valid HTTP or HTTPS photo URLs");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new ApiError(400, "Enter valid HTTP or HTTPS photo URLs");
    }
  });
};

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
  if (payload.subcategory) {
    const sector = CATEGORIES.find((item) => item.name === String(payload.category || "").trim());
    if (!sector || !sector.subcategories.some((item) => item.name === String(payload.subcategory).trim())) {
      throw new ApiError(400, "Choose a valid subcategory for the selected sector");
    }
  }
  if (payload.postalCode && !/^\d{6}$/.test(String(payload.postalCode).trim())) {
    throw new ApiError(400, "Enter a valid 6-digit Indian PIN code");
  }
  if (payload.googleMapsUrl) {
    let mapUrl;
    try {
      mapUrl = new URL(String(payload.googleMapsUrl));
    } catch (_error) {
      throw new ApiError(400, "Enter a valid Google Maps link");
    }
    const host = mapUrl.hostname.toLowerCase();
    const isGoogleMapsHost =
      host === "maps.app.goo.gl" ||
      (host === "goo.gl" && mapUrl.pathname.startsWith("/maps")) ||
      ((host === "google.com" || host.endsWith(".google.com") || host === "google.co.in") &&
        mapUrl.pathname.startsWith("/maps"));
    if (mapUrl.protocol !== "https:" || !isGoogleMapsHost) {
      throw new ApiError(400, "Use a secure Google Maps link");
    }
  }

  if (publishing) {
    if (!String(payload.description || "").trim() || String(payload.description).trim().length < 20) throw new ApiError(400, "Add an about section of at least 20 characters before publishing");
    if (!String(payload.phone || "").replace(/\D/g, "") && !String(payload.whatsapp || "").replace(/\D/g, "")) throw new ApiError(400, "Add a phone or WhatsApp number before publishing");
    if (!String(payload.city || "").trim() || !String(payload.state || "").trim()) throw new ApiError(400, "Add your city and state before publishing");
  }
};

const buildBusinessResponse = async (business, { includeEnquiries = false } = {}) => {
  const [products, services, enquiries, reviews] = await Promise.all([
    Product.find({ business: business._id, isActive: true }).sort({ createdAt: -1 }),
    Service.find({ business: business._id, isActive: true }).sort({ createdAt: -1 }),
    includeEnquiries
      ? Enquiry.find({ business: business._id }).sort({ createdAt: -1 }).limit(10)
      : Promise.resolve([]),
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
    subcategory: req.body.subcategory || "",
    logo: req.body.logo || "",
    coverImage: req.body.coverImage || "",
    gallery: req.body.gallery || [],
    phone: req.body.phone || "",
    whatsapp: req.body.whatsapp || "",
    email: req.body.email || req.user.email,
    address: req.body.address || "",
    city: req.body.city || "",
    state: req.body.state || "",
    postalCode: req.body.postalCode || "",
    area: req.body.area || "",
    hours: req.body.hours || {},
    location: req.body.location || {},
    appointmentSettings: req.body.appointmentSettings || {},
    marketplaceDetails: req.body.marketplaceDetails || {},
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

  if (
    req.body.category !== undefined &&
    req.body.category !== business.category &&
    req.body.subcategory === undefined
  ) {
    business.subcategory = "";
  }

  const fields = [
    "name",
    "tagline",
    "description",
    "category",
    "subcategory",
    "logo",
    "coverImage",
    "gallery",
    "phone",
    "whatsapp",
    "email",
    "address",
    "city",
    "state",
    "postalCode",
    "area",
    "location",
    "established",
    "hours",
    "appointmentSettings",
    "marketplaceDetails",
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

  const response = await buildBusinessResponse(business, { includeEnquiries: true });

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

const isBusinessOpenNow = (business, current) => {
  const hours = business.hours || {};
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const index = order.indexOf(current.dayKey);
  const today = hours[current.dayKey];
  const previous = hours[order[(index + 6) % 7]];

  if (previous && previous.closed === false) {
    const opening = toMinutes(previous.open);
    const closing = toMinutes(previous.close);
    if (Number.isFinite(opening) && Number.isFinite(closing) && closing <= opening && current.minutes < closing) {
      return true;
    }
  }
  if (!today || today.closed) return false;
  const opening = toMinutes(today.open);
  const closing = toMinutes(today.close);
  return Number.isFinite(opening) && Number.isFinite(closing)
    ? (closing > opening
      ? current.minutes >= opening && current.minutes < closing
      : current.minutes >= opening || current.minutes < closing)
    : false;
};

const distanceInKm = (fromLat, fromLng, toLat, toLng) => {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(toLat - fromLat);
  const longitudeDelta = radians(toLng - fromLng);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(fromLat)) * Math.cos(radians(toLat)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const hasBookingToday = async (business, services, today) => {
  const settings = business.appointmentSettings || {};
  if (!settings.enabled || !settings.workingDays?.includes(today.dayKey)) return false;
  const relevantServices = services.filter((service) =>
    (settings.shopAppointmentEnabled !== false && service.shopAvailable !== false) ||
    (settings.homeServiceEnabled && service.homeServiceAvailable)
  );
  for (const service of relevantServices) {
    const schedule = getScheduleForDate(business, today.date);
    if (!schedule.available) continue;
    const duration = Math.max(1, Number(service.durationMinutes) || Number(settings.slotDurationMinutes) || 30);
    const starts = getSlotStarts(schedule, duration);
    if (!starts.length) continue;
    const intervals = [...new Set(starts.flatMap((start) =>
      getOccupiedIntervals(start, duration, Number(settings.bufferMinutes) || 0)
    ))];
    const claims = await SlotClaim.find({
      business: business._id,
      date: today.date,
      intervalStart: { $in: intervals },
    }).select("intervalStart seat");
    const occupied = new Set(claims.map((claim) => `${claim.intervalStart}:${claim.seat}`));
    const capacity = Math.max(1, Number(settings.maxBookingsPerSlot) || 1);
    if (starts.some((start) => {
      const required = getOccupiedIntervals(start, duration, Number(settings.bufferMinutes) || 0);
      return Array.from({ length: capacity }, (_, seat) =>
        required.every((interval) => !occupied.has(`${interval}:${seat}`))
      ).some(Boolean);
    })) return true;
  }
  return false;
};

const listPublicBusinesses = asyncHandler(async (req, res) => {
  const query = String(req.query.q || "").trim();
  const category = String(req.query.category || "").trim();
  const city = String(req.query.city || "").trim();
  const area = String(req.query.area || "").trim();
  const minRating = Number(req.query.minRating || 0);
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(48, Math.max(1, Number(req.query.limit || 12)));
  const sortKey = ["nearest", "price"].includes(req.query.sort)
    ? req.query.sort
    : SORTS[req.query.sort] ? req.query.sort : "relevance";
  const minPrice = req.query.minPrice === undefined ? null : Number(req.query.minPrice);
  const maxPrice = req.query.maxPrice === undefined ? null : Number(req.query.maxPrice);
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const hasCoordinates = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  const maxDistance = Math.min(500, Math.max(0, Number(req.query.maxDistance) || 0));
  const wantsAvailableNow = req.query.availableNow === "true";
  const wantsHomeService = req.query.homeService === "true";
  const wantsShopAppointment = req.query.shopAppointment === "true";
  const wantsOpenNow = req.query.openNow === "true";
  const wantsVerified = req.query.verified === "true";

  const filter = { published: true };

  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
  if (city) filter.city = new RegExp(escapeRegex(city), "i");
  if (area) filter.area = new RegExp(escapeRegex(area), "i");
  if (req.query.postalCode) filter.postalCode = new RegExp(`^${escapeRegex(req.query.postalCode)}$`, "i");
  if (minRating > 0) filter.rating = { $gte: minRating };
  if (wantsVerified) filter.verified = true;
  if (wantsHomeService) filter["appointmentSettings.homeServiceEnabled"] = true;
  if (wantsShopAppointment) {
    filter["appointmentSettings.enabled"] = true;
    filter["appointmentSettings.shopAppointmentEnabled"] = { $ne: false };
  }

  const serviceConditions = [];
  if (query) {
    const matcher = new RegExp(escapeRegex(query), "i");
    serviceConditions.push({ $or: [{ name: matcher }, { category: matcher }, { description: matcher }] });
  }
  if (wantsHomeService) serviceConditions.push({ homeServiceAvailable: true });
  if (wantsShopAppointment) serviceConditions.push({ shopAvailable: true });
  if (Number.isFinite(minPrice) && minPrice >= 0) serviceConditions.push({ price: { $gte: minPrice } });
  if (Number.isFinite(maxPrice) && maxPrice >= 0) {
    serviceConditions.push({ price: { ...(Number.isFinite(minPrice) && minPrice >= 0 ? { $gte: minPrice } : {}), $lte: maxPrice } });
  }
  const serviceQuery = { isActive: true, ...(serviceConditions.length ? { $and: serviceConditions } : {}) };
  const productConditions = [];
  if (query) {
    const matcher = new RegExp(escapeRegex(query), "i");
    productConditions.push({ $or: [{ name: matcher }, { category: matcher }, { description: matcher }] });
  }
  if (Number.isFinite(minPrice) && minPrice >= 0) productConditions.push({ price: { $gte: minPrice } });
  if (Number.isFinite(maxPrice) && maxPrice >= 0) {
    productConditions.push({ price: { ...(Number.isFinite(minPrice) && minPrice >= 0 ? { $gte: minPrice } : {}), $lte: maxPrice } });
  }
  const productQuery = { isActive: true, ...(productConditions.length ? { $and: productConditions } : {}) };
  const [matchedServices, matchedProducts] = await Promise.all([
    Service.find(serviceQuery).select("business"),
    Product.find(productQuery).select("business"),
  ]);
  const catalogueIds = [...new Set([...matchedServices, ...matchedProducts].map((item) => String(item.business)))];

  if (query) {
    const matcher = new RegExp(escapeRegex(query), "i");
    filter.$or = [
      { name: matcher },
      { category: matcher },
      { subcategory: matcher },
      { city: matcher },
      { area: matcher },
      { state: matcher },
      { description: matcher },
      { tagline: matcher },
      ...(catalogueIds.length ? [{ _id: { $in: catalogueIds } }] : []),
    ];
  }
  if ((Number.isFinite(minPrice) && minPrice >= 0) || (Number.isFinite(maxPrice) && maxPrice >= 0)) {
    filter._id = { $in: catalogueIds };
  }
  if (wantsHomeService || wantsShopAppointment) {
    const eligibleIds = [...new Set(matchedServices.map((item) => String(item.business)))];
    filter._id = filter._id
      ? { $in: filter._id.$in.filter((id) => eligibleIds.includes(String(id))) }
      : { $in: eligibleIds };
  }

  let businesses = await Business.find(filter).populate("owner", "name avatar");
  const now = getIndiaTimeParts();
  const servicesByBusiness = new Map();
  const productsByBusiness = new Map();
  const matchingServiceIds = new Set(matchedServices.map((item) => String(item._id)));
  const matchingProductIds = new Set(matchedProducts.map((item) => String(item._id)));

  if (businesses.length) {
    const ids = businesses.map((business) => business._id);
    const [services, products] = await Promise.all([
      Service.find({ business: { $in: ids }, isActive: true }),
      Product.find({ business: { $in: ids }, isActive: true }),
    ]);
    services.forEach((service) => {
      const key = String(service.business);
      servicesByBusiness.set(key, [...(servicesByBusiness.get(key) || []), service]);
    });
    products.forEach((product) => {
      const key = String(product.business);
      productsByBusiness.set(key, [...(productsByBusiness.get(key) || []), product]);
    });

    businesses = await Promise.all(businesses.map(async (business) => {
      const key = String(business._id);
      const allServices = servicesByBusiness.get(key) || [];
      const allProducts = productsByBusiness.get(key) || [];
      const coords = business.location || {};
      const distanceKm = hasCoordinates && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)
        ? distanceInKm(latitude, longitude, coords.latitude, coords.longitude)
        : null;
      const openNow = isBusinessOpenNow(business, now);
      const availableNow = wantsAvailableNow
        ? await hasBookingToday(business, allServices, now)
        : false;
      return {
        ...business.toObject(),
        distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
        openNow,
        availableNow,
        minPrice: [...allServices, ...allProducts].reduce(
          (min, item) => min === null || item.price < min ? item.price : min,
          null
        ),
        matchedServices: allServices.filter((item) =>
          (!query || matchingServiceIds.has(String(item._id))) &&
          (minPrice === null || item.price >= minPrice) &&
          (maxPrice === null || item.price <= maxPrice) &&
          (!wantsHomeService || item.homeServiceAvailable) &&
          (!wantsShopAppointment || item.shopAvailable)
        ),
        matchedProducts: allProducts.filter((item) =>
          (!query || matchingProductIds.has(String(item._id))) &&
          (minPrice === null || item.price >= minPrice) &&
          (maxPrice === null || item.price <= maxPrice)
        ),
      };
    }));
  }

  if (hasCoordinates && maxDistance > 0) {
    businesses = businesses.filter((business) => business.distanceKm !== null && business.distanceKm <= maxDistance);
  }
  if (wantsOpenNow) businesses = businesses.filter((business) => business.openNow);
  if (wantsAvailableNow) businesses = businesses.filter((business) => business.availableNow);
  if (wantsHomeService) businesses = businesses.filter((business) => business.appointmentSettings?.homeServiceEnabled && business.matchedServices.some((service) => service.homeServiceAvailable));
  if (wantsShopAppointment) businesses = businesses.filter((business) => business.appointmentSettings?.enabled && business.matchedServices.some((service) => service.shopAvailable));

  if (sortKey === "nearest" && hasCoordinates) {
    businesses.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else if (sortKey === "price") {
    businesses.sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity));
  } else if (SORTS[sortKey]) {
    const sort = SORTS[sortKey];
    businesses.sort((a, b) => {
      for (const [field, direction] of Object.entries(sort)) {
        const left = field === "stats.views" ? a.stats?.views : a[field];
        const right = field === "stats.views" ? b.stats?.views : b[field];
        if (left !== right) return (left > right ? 1 : -1) * direction;
      }
      return 0;
    });
  }

  const total = businesses.length;
  businesses = businesses.slice((page - 1) * limit, page * limit);

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
  validateImageUrls(req.body.images || []);

  const product = await Product.create({
    business: business._id,
    name: req.body.name,
    description: req.body.description || "",
    category: req.body.category || "",
    price: req.body.price || 0,
    compareAtPrice: req.body.compareAtPrice || 0,
    images: req.body.images || [],
    stock: req.body.stock || 0,
    isActive: req.body.isActive !== false,
  });

  res.status(201).json({
    success: true,
    product,
  });
});

const listProducts = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.businessId);
  if (!business) throw new ApiError(404, "Business not found");
  if (business.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError(403, "You cannot view products for this business");
  }
  const products = await Product.find({ business: req.params.businessId }).sort({
    createdAt: -1,
  });
  res.status(200).json({
    success: true,
    products,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.businessId);
  if (!business) throw new ApiError(404, "Business not found");
  if (business.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError(403, "You cannot manage products for this business");
  }
  const product = await Product.findOne({ _id: req.params.productId, business: business._id });
  if (!product) throw new ApiError(404, "Product not found");
  if (req.body.images !== undefined) validateImageUrls(req.body.images);
  ["name", "description", "category", "price", "compareAtPrice", "images", "stock", "isActive"].forEach((field) => {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  });
  await product.save();
  res.status(200).json({ success: true, product });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.businessId);
  if (!business) throw new ApiError(404, "Business not found");
  if (business.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError(403, "You cannot manage products for this business");
  }
  const product = await Product.findOneAndDelete({ _id: req.params.productId, business: business._id });
  if (!product) throw new ApiError(404, "Product not found");
  res.status(200).json({ success: true, message: "Product deleted" });
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
  validateImageUrls(req.body.images || []);

  const service = await Service.create({
    business: business._id,
    name: req.body.name,
    description: req.body.description || "",
    category: req.body.category || "",
    price: req.body.price || 0,
    durationMinutes: req.body.durationMinutes || 0,
    images: req.body.images || [],
    homeServiceAvailable: req.body.homeServiceAvailable === true,
    shopAvailable: req.body.shopAvailable !== false,
    homeServiceCharge: req.body.homeServiceCharge || 0,
    isActive: req.body.isActive !== false,
  });

  res.status(201).json({
    success: true,
    service,
  });
});

const listServices = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.businessId);
  if (!business) throw new ApiError(404, "Business not found");
  if (business.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError(403, "You cannot view services for this business");
  }
  const services = await Service.find({ business: req.params.businessId }).sort({
    createdAt: -1,
  });
  res.status(200).json({
    success: true,
    services,
  });
});

const updateService = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.businessId);
  if (!business) throw new ApiError(404, "Business not found");
  if (business.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError(403, "You cannot manage services for this business");
  }
  const service = await Service.findOne({ _id: req.params.serviceId, business: business._id });
  if (!service) throw new ApiError(404, "Service not found");
  if (req.body.images !== undefined) validateImageUrls(req.body.images);
  ["name", "description", "category", "price", "durationMinutes", "images", "homeServiceAvailable", "shopAvailable", "homeServiceCharge", "isActive"].forEach((field) => {
    if (req.body[field] !== undefined) service[field] = req.body[field];
  });
  await service.save();
  res.status(200).json({ success: true, service });
});

const deleteService = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.businessId);
  if (!business) throw new ApiError(404, "Business not found");
  if (business.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError(403, "You cannot manage services for this business");
  }
  const service = await Service.findOneAndDelete({ _id: req.params.serviceId, business: business._id });
  if (!service) throw new ApiError(404, "Service not found");
  res.status(200).json({ success: true, message: "Service deleted" });
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
  updateProduct,
  deleteProduct,
  createService,
  listServices,
  updateService,
  deleteService,
  submitEnquiry,
  listMyEnquiries,
  updateMyEnquiry,
  dashboardStats,
};
