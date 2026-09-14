const express = require("express");
const {
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
} = require("../controllers/businessController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/public", listPublicBusinesses);
router.get("/slug/:slug", getBusinessBySlug);
router.post("/slug/:slug/enquiries", submitEnquiry);

router.use(protect);

router.get("/me", getMyBusiness);
router.post("/", createBusiness);
router.put("/:id", updateBusiness);

router.post("/:businessId/products", createProduct);
router.get("/:businessId/products", listProducts);

router.post("/:businessId/services", createService);
router.get("/:businessId/services", listServices);

router.get("/admin/stats", authorizeRoles("admin"), dashboardStats);

module.exports = router;
