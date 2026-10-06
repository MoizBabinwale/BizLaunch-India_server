const Business = require("../models/Business");
const Review = require("../models/Review");
const { CATEGORIES } = require("../config/categories");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every category on the site, with the number of published listings in each.
 * Categories with zero listings are kept so the browse pages never look empty.
 */
const listCategories = asyncHandler(async (req, res) => {
  const city = String(req.query.city || "").trim();
  const match = { published: true };
  if (city) match.city = new RegExp(escapeRegex(city), "i");

  const counts = await Business.aggregate([
    { $match: match },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  const countMap = new Map(counts.map((row) => [row._id, row.count]));

  res.status(200).json({
    success: true,
    categories: CATEGORIES.map((category) => ({
      ...category,
      count: countMap.get(category.name) || 0,
    })).sort((a, b) => b.count - a.count),
  });
});

/** Cities that currently have listings, with their listing counts. */
const listCities = asyncHandler(async (req, res) => {
  const cities = await Business.aggregate([
    { $match: { published: true, city: { $nin: ["", null] } } },
    { $group: { _id: "$city", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    success: true,
    cities: cities.map((row) => ({ name: row._id, count: row.count })),
  });
});

/** Other businesses in the same category, used on the business detail page. */
const getSimilarBusinesses = asyncHandler(async (req, res) => {
  const business = await Business.findOne({
    slug: req.params.slug,
    published: true,
  }).select("category city name tagline logo rating reviewCount");

  if (!business) {
    throw new ApiError(404, "Business page not found");
  }

  const similar = await Business.find({
    _id: { $ne: business._id },
    published: true,
    category: business.category,
  })
    .sort({ rating: -1, reviewCount: -1 })
    .limit(8)
    .select("name slug tagline category city area logo rating reviewCount");

  res.status(200).json({ success: true, similar });
});

const listReviews = asyncHandler(async (req, res) => {
  const business = await Business.findOne({
    slug: req.params.slug,
    published: true,
  });

  if (!business) {
    throw new ApiError(404, "Business page not found");
  }

  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));

  const [reviews, total] = await Promise.all([
    Review.find({ business: business._id, status: "published" })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name avatar"),
    Review.countDocuments({ business: business._id, status: "published" }),
  ]);

  res.status(200).json({
    success: true,
    reviews,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    rating: business.rating,
    reviewCount: business.reviewCount,
  });
});

/** Recalculates the denormalised rating / reviewCount on the business. */
const syncBusinessRating = async (businessId) => {
  const [summary] = await Review.aggregate([
    { $match: { business: businessId, status: "published" } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  await Business.findByIdAndUpdate(businessId, {
    rating: summary ? Math.round(summary.average * 10) / 10 : 0,
    reviewCount: summary ? summary.count : 0,
  });
};

const submitReview = asyncHandler(async (req, res) => {
  const business = await Business.findOne({
    slug: req.params.slug,
    published: true,
  });

  if (!business) {
    throw new ApiError(404, "Business page not found");
  }

  const name = String(req.body.name || "").trim();
  const comment = String(req.body.comment || "").trim();
  const rating = Number(req.body.rating);

  if (name.length < 2 || name.length > 80) {
    throw new ApiError(400, "Enter your name (2-80 characters)");
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, "Select a rating between 1 and 5 stars");
  }
  if (comment.length < 10 || comment.length > 1500) {
    throw new ApiError(400, "Your review must be between 10 and 1,500 characters");
  }

  const review = await Review.create({
    business: business._id,
    user: req.user ? req.user._id : null,
    name,
    rating: Math.round(rating),
    comment,
  });

  await syncBusinessRating(business._id);

  res.status(201).json({ success: true, review });
});

module.exports = {
  listCategories,
  listCities,
  getSimilarBusinesses,
  listReviews,
  submitReview,
};