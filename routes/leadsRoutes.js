const express = require("express");
const {
  submitContactMessage,
} = require("../controllers/leadsController");

const router = express.Router();

router.post("/contact", submitContactMessage);

module.exports = router;