require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Business = require("../models/Business");
const Product = require("../models/Product");
const Service = require("../models/Service");
const Review = require("../models/Review");
const Enquiry = require("../models/Enquiry");

// The single demo account the old seed script created.
const DEMO_OWNER_EMAIL = "directory@bizlaunch.in";

/**
 * Removes the demo directory data so the live site only shows real listings
 * added by real business owners. Run with: npm run seed:clean
 */
const run = async () => {
  await connectDB();

  const owner = await User.findOne({ email: DEMO_OWNER_EMAIL });

  if (!owner) {
    console.log("No demo data found. Nothing to remove.");
    await mongoose.connection.close();
    return;
  }

  const businesses = await Business.find({ owner: owner._id }).select("_id");
  const businessIds = businesses.map((business) => business._id);

  const [products, services, reviews, enquiries] = await Promise.all([
    Product.deleteMany({ business: { $in: businessIds } }),
    Service.deleteMany({ business: { $in: businessIds } }),
    Review.deleteMany({ business: { $in: businessIds } }),
    Enquiry.deleteMany({ business: { $in: businessIds } }),
  ]);

  await Business.deleteMany({ _id: { $in: businessIds } });
  await User.deleteOne({ _id: owner._id });

  console.log(`Removed ${businessIds.length} demo businesses.`);
  console.log(
    `Also removed ${products.deletedCount} products, ${services.deletedCount} services, ` +
      `${reviews.deletedCount} reviews and ${enquiries.deletedCount} enquiries.`
  );
  console.log("\nThe directory is now empty. Add real businesses by:");
  console.log("  1. Registering an account at /register");
  console.log("  2. Submitting a listing at /free-listing");

  await mongoose.connection.close();
};

run().catch((error) => {
  console.error("Demo data removal failed:", error);
  process.exit(1);
});
