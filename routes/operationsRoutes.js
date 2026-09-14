const express = require("express");
const controller = require("../controllers/operationsController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/:businessId/dashboard", controller.dashboardSummary);
router.get("/:businessId/dashboard/summary", controller.dashboardSummary);

router.route("/:businessId/inventory").get(controller.listInventory).post(controller.createInventory);
router.route("/:businessId/inventory/:id").get(controller.getInventory).put(controller.updateInventory).patch(controller.updateInventory).delete(controller.deleteInventory);

router.route("/:businessId/sales").get(controller.listSales).post(controller.createSale);
router.route("/:businessId/sales/:id").get(controller.getSale).put(controller.updateSale).patch(controller.updateSale).delete(controller.deleteSale);

router.route("/:businessId/customers").get(controller.listCustomers).post(controller.createCustomer);
router.route("/:businessId/customers/:id").get(controller.getCustomer).put(controller.updateCustomer).patch(controller.updateCustomer).delete(controller.deleteCustomer);

router.route("/:businessId/appointments").get(controller.listAppointments).post(controller.createAppointment);
router.route("/:businessId/appointments/:id").get(controller.getAppointment).put(controller.updateAppointment).patch(controller.updateAppointment).delete(controller.deleteAppointment);

module.exports = router;
