const express = require("express");
const {
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
} = require("../controllers/businessController");
const {
  listCategories,
  listCities,
  getSimilarBusinesses,
  listReviews,
  submitReview,
} = require("../controllers/directoryController");
const {
  getPublicBookingBusiness,
  listPublicServices,
  getAvailability,
} = require("../controllers/bookingController");
const {
  submitContactMessage,
  submitFreeListingRequest,
} = require("../controllers/leadsController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/public/stats", getPublicStats);
router.get("/public", listPublicBusinesses);
router.get("/public/categories", listCategories);
router.get("/public/cities", listCities);
router.get("/public/:businessId/services", listPublicServices);
router.get("/public/:businessId/availability", getAvailability);
router.get("/public/:businessId", getPublicBookingBusiness);
router.get("/slug/:slug", getBusinessBySlug);
router.get("/slug/:slug/similar", getSimilarBusinesses);
router.get("/slug/:slug/reviews", listReviews);
router.post("/slug/:slug/enquiries", submitEnquiry);
router.post("/slug/:slug/reviews", submitReview);

router.post("/free-listing-requests", submitFreeListingRequest);

router.use(protect);

router.get("/me/enquiries", listMyEnquiries);
router.patch("/me/enquiries/:id", updateMyEnquiry);
router.get("/me", getMyBusiness);
router.post("/", createBusiness);
router.put("/:id", updateBusiness);

router.post("/:businessId/products", createProduct);
router.get("/:businessId/products", listProducts);
router.put("/:businessId/products/:productId", updateProduct);
router.delete("/:businessId/products/:productId", deleteProduct);

router.post("/:businessId/services", createService);
router.get("/:businessId/services", listServices);
router.put("/:businessId/services/:serviceId", updateService);
router.delete("/:businessId/services/:serviceId", deleteService);

router.get("/admin/stats", authorizeRoles("admin"), dashboardStats);

module.exports = router;
