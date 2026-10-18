const crypto = require("crypto");
const mongoose = require("mongoose");
const Business = require("../models/Business");
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const SlotClaim = require("../models/SlotClaim");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const {
  getIndiaTimeParts,
  getOccupiedIntervals,
  getScheduleForDate,
  getSlotStarts,
  toMinutes,
} = require("../utils/bookingSchedule");

const isOwner = (business, user) =>
  business.owner.toString() === user._id.toString() || user.role === "admin";

const getBookingSchedule = (business, service, date) => {
  const schedule = getScheduleForDate(business, date);
  if (!schedule.available) return schedule;

  const duration = Math.max(1, Number(service.durationMinutes) || Number(schedule.settings.slotDurationMinutes) || 30);
  return { ...schedule, duration };
};

const canBookType = (business, service, type) => {
  const settings = business.appointmentSettings || {};
  if (type === "HOME") {
    return settings.homeServiceEnabled === true && service.homeServiceAvailable === true;
  }
  if (type === "SHOP") {
    return settings.shopAppointmentEnabled !== false && service.shopAvailable !== false;
  }
  return false;
};

const listPublicServices = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.businessId)) {
    throw new ApiError(400, "Invalid business ID");
  }
  const business = await Business.findOne({ _id: req.params.businessId, published: true });
  if (!business) throw new ApiError(404, "Business page not found");

  const services = await Service.find({ business: business._id, isActive: true })
    .sort({ createdAt: -1 })
    .select("name slug description category images price durationMinutes homeServiceAvailable shopAvailable homeServiceCharge");

  res.status(200).json({ success: true, services });
});

const getPublicBookingBusiness = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.businessId)) {
    throw new ApiError(400, "Invalid business ID");
  }
  const business = await Business.findOne({
    _id: req.params.businessId,
    published: true,
  }).select("name slug logo category city area address appointmentSettings");
  if (!business) throw new ApiError(404, "Business page not found");
  res.status(200).json({ success: true, business });
});

const getAvailability = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const { serviceId, date, bookingType = "SHOP" } = req.query;
  if (!mongoose.isValidObjectId(businessId) || !mongoose.isValidObjectId(serviceId)) {
    throw new ApiError(400, "Select a valid business and service");
  }

  const [business, service] = await Promise.all([
    Business.findOne({ _id: businessId, published: true }),
    Service.findOne({ _id: serviceId, business: businessId, isActive: true }),
  ]);
  if (!business) throw new ApiError(404, "Business page not found");
  if (!service) throw new ApiError(404, "This service is not available");
  if (!canBookType(business, service, String(bookingType).toUpperCase())) {
    throw new ApiError(400, "This service is not available for the selected booking type");
  }

  const schedule = getBookingSchedule(business, service, String(date || ""));
  if (!schedule.available) {
    return res.status(200).json({ success: true, slots: [], message: schedule.reason });
  }

  const candidates = getSlotStarts(schedule, schedule.duration);
  const buffer = Number(schedule.settings.bufferMinutes) || 0;
  const requiredIntervals = new Map(
    candidates.map((time) => [
      time,
      getOccupiedIntervals(time, schedule.duration, buffer),
    ])
  );
  const intervals = [...new Set([...requiredIntervals.values()].flat())];
  const claims = await SlotClaim.find({
    business: business._id,
    date,
    intervalStart: { $in: intervals },
  }).select("intervalStart seat");
  const occupied = new Set(claims.map((claim) => `${claim.intervalStart}:${claim.seat}`));
  const capacity = Math.max(1, Number(schedule.settings.maxBookingsPerSlot) || 1);
  const slots = candidates.map((time) => {
    const free = Array.from({ length: capacity }, (_, seat) =>
      requiredIntervals.get(time).every((interval) => !occupied.has(`${interval}:${seat}`))
    ).some(Boolean);
    return { time, available: free };
  });

  const basePrice = Math.max(0, Number(service.price) || 0);
  const homeCharge = String(bookingType).toUpperCase() === "HOME"
    ? Math.max(0, Number(service.homeServiceCharge) || Number(schedule.settings.homeServiceCharge) || 0)
    : 0;
  res.status(200).json({
    success: true,
    slots,
    price: { servicePrice: basePrice, homeServiceCharge: homeCharge, totalAmount: basePrice + homeCharge },
    durationMinutes: schedule.duration,
  });
});

const reserveSlot = async (booking, business, service, date, timeSlot) => {
  await SlotClaim.init();
  const schedule = getBookingSchedule(business, service, date);
  if (!schedule.available) return false;
  if (!getSlotStarts(schedule, schedule.duration).includes(timeSlot)) return false;

  const intervals = getOccupiedIntervals(
    timeSlot,
    schedule.duration,
    Number(schedule.settings.bufferMinutes) || 0
  );
  const capacity = Math.max(1, Number(schedule.settings.maxBookingsPerSlot) || 1);

  for (let seat = 0; seat < capacity; seat += 1) {
    const claims = intervals.map((intervalStart) => ({
      business: business._id,
      date,
      intervalStart,
      seat,
      booking: booking._id,
    }));
    try {
      await SlotClaim.insertMany(claims, { ordered: true });
      booking.date = date;
      booking.timeSlot = timeSlot;
      booking.slotClaimed = true;
      return true;
    } catch (error) {
      await SlotClaim.deleteMany({ booking: booking._id });
      if (error.code !== 11000) throw error;
    }
  }
  return false;
};

const createBooking = asyncHandler(async (req, res) => {
  const { businessId, serviceId, date, timeSlot, bookingType, customerAddress, notes } = req.body;
  if (!mongoose.isValidObjectId(businessId) || !mongoose.isValidObjectId(serviceId)) {
    throw new ApiError(400, "Select a valid business and service");
  }
  if (!["SHOP", "HOME"].includes(bookingType)) {
    throw new ApiError(400, "Select shop visit or home service");
  }
  if (bookingType === "HOME" && String(customerAddress || "").trim().length < 8) {
    throw new ApiError(400, "Enter the address where the home service is needed");
  }
  if (String(notes || "").length > 1000) throw new ApiError(400, "Notes cannot exceed 1,000 characters");

  const [business, service] = await Promise.all([
    Business.findById(businessId),
    Service.findOne({ _id: serviceId, business: businessId }),
  ]);
  if (!business || !business.published) throw new ApiError(404, "Business page not found");
  if (!service || !service.isActive) throw new ApiError(404, "This service is not available");
  if (!business.appointmentSettings?.enabled) throw new ApiError(400, "Online appointments are not enabled");
  if (!canBookType(business, service, bookingType)) {
    throw new ApiError(400, "This service is not available for the selected booking type");
  }

  const schedule = getBookingSchedule(business, service, String(date || ""));
  if (!schedule.available) throw new ApiError(400, schedule.reason);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(timeSlot || ""))) {
    throw new ApiError(400, "Select a valid appointment time");
  }
  if (!getSlotStarts(schedule, schedule.duration).includes(timeSlot)) {
    throw new ApiError(400, "That time is not within the available booking hours");
  }

  const servicePrice = Math.max(0, Number(service.price) || 0);
  const homeServiceCharge = bookingType === "HOME"
    ? Math.max(0, Number(service.homeServiceCharge) || Number(business.appointmentSettings.homeServiceCharge) || 0)
    : 0;
  const booking = await Booking.create({
    bookingId: `BL-${String(date).replace(/-/g, "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    customer: req.user._id,
    business: business._id,
    service: service._id,
    serviceName: service.name,
    bookingType,
    date,
    timeSlot,
    customerAddress: bookingType === "HOME" ? String(customerAddress).trim() : "",
    servicePrice,
    homeServiceCharge,
    totalAmount: servicePrice + homeServiceCharge,
    durationMinutes: schedule.duration,
    notes: String(notes || "").trim(),
  });

  try {
    const reserved = await reserveSlot(booking, business, service, date, timeSlot);
    if (!reserved) {
      await booking.deleteOne();
      throw new ApiError(409, "That appointment time has just been booked. Choose another time.");
    }
    await booking.save();
  } catch (error) {
    await SlotClaim.deleteMany({ booking: booking._id });
    await booking.deleteOne();
    throw error;
  }

  res.status(201).json({
    success: true,
    booking: await Booking.findById(booking._id).populate("business", "name slug logo city area"),
  });
});

const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ customer: req.user._id })
    .sort({ date: 1, timeSlot: 1 })
    .populate("business", "name slug logo city area")
    .select("-customerAddress -notes");
  res.status(200).json({ success: true, bookings });
});

const getBookingById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid booking ID");
  const booking = await Booking.findById(req.params.id)
    .populate("business", "name slug logo phone whatsapp address area city state postalCode googleMapsUrl owner")
    .populate("customer", "name");
  if (!booking) throw new ApiError(404, "Booking not found");

  const customerOwnsBooking = booking.customer._id.toString() === req.user._id.toString();
  const ownerCanManage = isOwner(booking.business, req.user);
  if (!customerOwnsBooking && !ownerCanManage) throw new ApiError(403, "You cannot view this booking");

  res.status(200).json({
    success: true,
    booking: {
      ...booking.toObject(),
      customer: ownerCanManage ? booking.customer : { _id: booking.customer._id },
      customerAddress: customerOwnsBooking || ownerCanManage ? booking.customerAddress : "",
      notes: customerOwnsBooking || ownerCanManage ? booking.notes : "",
    },
  });
});

const cancelMyBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
    throw new ApiError(400, "This booking can no longer be cancelled");
  }
  const now = getIndiaTimeParts();
  if (booking.date < now.date || (booking.date === now.date && toMinutes(booking.timeSlot) <= now.minutes)) {
    throw new ApiError(400, "A booking that has already started cannot be cancelled");
  }

  await SlotClaim.deleteMany({ booking: booking._id });
  booking.slotClaimed = false;
  booking.status = "CANCELLED";
  await booking.save();
  res.status(200).json({ success: true, booking });
});

const listBusinessBookings = asyncHandler(async (req, res) => {
  const business = await Business.findOne({ owner: req.user._id });
  if (!business) throw new ApiError(404, "Business profile not found");
  const bookings = await Booking.find({ business: business._id })
    .sort({ date: 1, timeSlot: 1 })
    .limit(300)
    .populate("customer", "name");
  res.status(200).json({ success: true, bookings });
});

const updateBusinessBooking = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid booking ID");
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found");
  const business = await Business.findById(booking.business);
  if (!business || !isOwner(business, req.user)) throw new ApiError(403, "You cannot manage this booking");

  const action = String(req.body.action || "").toUpperCase();
  if (action === "RESCHEDULE") {
    const service = await Service.findOne({ _id: booking.service, business: business._id, isActive: true });
    if (!service) throw new ApiError(400, "The booked service is no longer available");
    const nextDate = String(req.body.date || "");
    const nextTime = String(req.body.timeSlot || "");
    const schedule = getBookingSchedule(business, service, nextDate);
    if (!schedule.available || !getSlotStarts(schedule, schedule.duration).includes(nextTime)) {
      throw new ApiError(400, schedule.reason || "Select an available appointment time");
    }

    const oldClaims = await SlotClaim.find({ booking: booking._id }).lean();
    await SlotClaim.deleteMany({ booking: booking._id });
    const reserved = await reserveSlot(booking, business, service, nextDate, nextTime);
    if (!reserved) {
      if (oldClaims.length) {
        try {
          await SlotClaim.insertMany(oldClaims.map(({ _id, __v, createdAt, updatedAt, ...claim }) => claim));
        } catch (restoreError) {
          booking.slotClaimed = false;
          await booking.save();
          throw new ApiError(409, "The new time could not be reserved; contact the business to restore the original booking.");
        }
      }
      throw new ApiError(409, "That appointment time has just been booked. Choose another time.");
    }
    await booking.save();
  } else {
    const statuses = {
      CONFIRM: "CONFIRMED",
      REJECT: "REJECTED",
      CANCEL: "CANCELLED",
      IN_PROGRESS: "IN_PROGRESS",
      COMPLETE: "COMPLETED",
      NO_SHOW: "NO_SHOW",
    };
    const nextStatus = statuses[action];
    if (!nextStatus) throw new ApiError(400, "Choose a supported booking action");
    if (!["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(booking.status)) {
      throw new ApiError(400, "This booking cannot be updated");
    }
    booking.status = nextStatus;
    if (["REJECTED", "CANCELLED"].includes(nextStatus)) {
      await SlotClaim.deleteMany({ booking: booking._id });
      booking.slotClaimed = false;
    }
    await booking.save();
  }

  res.status(200).json({
    success: true,
    booking: await Booking.findById(booking._id).populate("customer", "name"),
  });
});

module.exports = {
  getPublicBookingBusiness,
  listPublicServices,
  getAvailability,
  createBooking,
  getMyBookings,
  getBookingById,
  cancelMyBooking,
  listBusinessBookings,
  updateBusinessBooking,
};
