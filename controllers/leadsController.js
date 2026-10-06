const ContactMessage = require("../models/ContactMessage");
const FreeListingRequest = require("../models/FreeListingRequest");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const indianPhone = /^[6-9]\d{9}$/;

const SUBJECTS = [
  "General enquiry",
  "Business listing support",
  "Report a wrong listing",
  "Advertising enquiry",
  "Feedback or complaint",
  "Partnership",
];

/** Contact form submissions from the /contact page. */
const submitContactMessage = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || "").replace(/\D/g, "");
  const subject = String(req.body.subject || "General enquiry").trim();
  const message = String(req.body.message || "").trim();

  if (name.length < 2 || name.length > 80) {
    throw new ApiError(400, "Enter your name (2-80 characters)");
  }
  if (!emailPattern.test(email)) {
    throw new ApiError(400, "Enter a valid email address");
  }
  if (phone && !indianPhone.test(phone)) {
    throw new ApiError(400, "Enter a valid 10-digit Indian phone number");
  }
  if (!SUBJECTS.includes(subject)) {
    throw new ApiError(400, "Select a valid subject");
  }
  if (message.length < 10 || message.length > 2000) {
    throw new ApiError(400, "Your message must be between 10 and 2,000 characters");
  }

  const contactMessage = await ContactMessage.create({
    name,
    email,
    phone,
    subject,
    message,
  });

  res.status(201).json({
    success: true,
    message: "Thanks for reaching out. Our team will get back to you within 1-2 business days.",
    contactMessage,
  });
});

/** "List my business for free" submissions from the /free-listing page. */
const submitFreeListingRequest = asyncHandler(async (req, res) => {
  const businessName = String(req.body.businessName || "").trim();
  const category = String(req.body.category || "").trim();
  const city = String(req.body.city || "").trim();
  const ownerName = String(req.body.ownerName || "").trim();
  const phone = String(req.body.phone || "").replace(/\D/g, "");
  const email = String(req.body.email || "").trim().toLowerCase();

  if (businessName.length < 2 || businessName.length > 120) {
    throw new ApiError(400, "Enter your business name (2-120 characters)");
  }
  if (!category) {
    throw new ApiError(400, "Select a business category");
  }
  if (!city) {
    throw new ApiError(400, "Enter your city");
  }
  if (ownerName.length < 2 || ownerName.length > 80) {
    throw new ApiError(400, "Enter the owner's name (2-80 characters)");
  }
  if (!indianPhone.test(phone)) {
    throw new ApiError(400, "Enter a valid 10-digit Indian mobile number");
  }
  if (email && !emailPattern.test(email)) {
    throw new ApiError(400, "Enter a valid email address");
  }

  const request = await FreeListingRequest.create({
    businessName,
    category,
    city,
    ownerName,
    phone,
    email,
  });

  res.status(201).json({
    success: true,
    message:
      "Request received. Our onboarding team will contact you to verify and publish your listing.",
    request,
  });
});

module.exports = {
  submitContactMessage,
  submitFreeListingRequest,
  CONTACT_SUBJECTS: SUBJECTS,
};