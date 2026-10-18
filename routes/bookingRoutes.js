const express = require("express");
const {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelMyBooking,
  listBusinessBookings,
  updateBusinessBooking,
} = require("../controllers/bookingController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/bookings/my", getMyBookings);
router.post("/bookings", createBooking);
router.get("/bookings/:id", getBookingById);
router.patch("/bookings/:id/cancel", cancelMyBooking);
router.get("/business/bookings", listBusinessBookings);
router.patch("/business/bookings/:id/status", updateBusinessBooking);

module.exports = router;
