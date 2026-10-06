require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Business = require("../models/Business");
const Product = require("../models/Product");
const Service = require("../models/Service");
const Review = require("../models/Review");
const Enquiry = require("../models/Enquiry");

const DEMO_EMAIL = "demo@bizlaunch.in";
const DEMO_PASSWORD = "Demo123!";

const businessSeedData = [
  {
    name: "The Green Table",
    category: "Restaurants",
    city: "Bengaluru",
    state: "Karnataka",
    area: "Koramangala",
    address: "12 3rd Block, Koramangala, Bengaluru",
    tagline: "Farm-to-table meals and family dinners",
    description:
      "The Green Table serves fresh, chef-crafted Indian and global comfort food in a warm neighbourhood setting ideal for lunch, dinner, and celebrations.",
    phone: "+91 98765 43210",
    whatsapp: "+91 98765 43210",
    email: "hello@thegreentable.in",
    rating: 4.8,
    reviewCount: 136,
    logo: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=400&q=80",
    coverImage: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
    ],
    published: true,
    featured: true,
    plan: "premium-199",
    hours: {
      mon: { open: "12:00", close: "23:00", closed: false },
      tue: { open: "12:00", close: "23:00", closed: false },
      wed: { open: "12:00", close: "23:00", closed: false },
      thu: { open: "12:00", close: "23:00", closed: false },
      fri: { open: "12:00", close: "23:30", closed: false },
      sat: { open: "12:00", close: "23:30", closed: false },
      sun: { open: "12:00", close: "22:30", closed: false },
    },
    socialLinks: {
      website: "https://thegreentable.in",
      instagram: "https://instagram.com/thegreentable",
      facebook: "https://facebook.com/thegreentable",
      youtube: "",
      linkedin: "",
    },
    seo: {
      title: "The Green Table | Bengaluru Restaurant",
      description: "Farm-to-table restaurant in Koramangala",
      keywords: ["restaurant", "bengaluru", "koramangala", "family dining"],
      canonicalUrl: "https://thegreentable.in",
    },
    stats: { views: 1420, clicks: 360, enquiries: 42 },
    googleMapsUrl: "https://maps.google.com/?q=Koramangala+Bengaluru",
  },
  {
    name: "UrbanNest Interiors",
    category: "Interior Designers",
    city: "Pune",
    state: "Maharashtra",
    area: "Baner",
    address: "8 Baner Road, Pune",
    tagline: "Modern homes, branded workspaces, and cozy interiors",
    description:
      "UrbanNest Interiors designs tailored residential and commercial spaces with practical layouts, premium materials, and end-to-end execution.",
    phone: "+91 99887 66554",
    whatsapp: "+91 99887 66554",
    email: "design@urbannest.in",
    rating: 4.9,
    reviewCount: 94,
    logo: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=400&q=80",
    coverImage: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    ],
    published: true,
    featured: true,
    plan: "premium-499",
    hours: {
      mon: { open: "09:00", close: "19:00", closed: false },
      tue: { open: "09:00", close: "19:00", closed: false },
      wed: { open: "09:00", close: "19:00", closed: false },
      thu: { open: "09:00", close: "19:00", closed: false },
      fri: { open: "09:00", close: "19:00", closed: false },
      sat: { open: "10:00", close: "17:00", closed: false },
      sun: { open: "10:00", close: "14:00", closed: false },
    },
    socialLinks: {
      website: "https://urbannest.in",
      instagram: "https://instagram.com/urbannestdesigns",
      facebook: "https://facebook.com/urbannestdesigns",
      youtube: "",
      linkedin: "",
    },
    seo: {
      title: "UrbanNest Interiors | Home & Office Design Pune",
      description: "Turnkey interior designers in Baner, Pune",
      keywords: ["interior designers", "pune", "baner", "home interiors"],
      canonicalUrl: "https://urbannest.in",
    },
    stats: { views: 980, clicks: 240, enquiries: 30 },
    googleMapsUrl: "https://maps.google.com/?q=Baner+Pune",
  },
  {
    name: "PrimeCare Dental Studio",
    category: "Dentists",
    city: "Hyderabad",
    state: "Telangana",
    area: "Gachibowli",
    address: "72 Knowledge City Road, Gachibowli, Hyderabad",
    tagline: "Smile-focused dental care for the whole family",
    description:
      "PrimeCare Dental Studio offers preventive, cosmetic, and restorative dental care with transparent pricing and a patient-first experience.",
    phone: "+91 97654 12345",
    whatsapp: "+91 97654 12345",
    email: "hello@primecaredental.in",
    rating: 4.7,
    reviewCount: 81,
    logo: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=400&q=80",
    coverImage: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1588776814546-daed7d0dd667?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1606811841689-23dfddce3b95?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80",
    ],
    published: true,
    featured: false,
    plan: "premium-199",
    hours: {
      mon: { open: "09:00", close: "20:00", closed: false },
      tue: { open: "09:00", close: "20:00", closed: false },
      wed: { open: "09:00", close: "20:00", closed: false },
      thu: { open: "09:00", close: "20:00", closed: false },
      fri: { open: "09:00", close: "20:00", closed: false },
      sat: { open: "09:00", close: "16:00", closed: false },
      sun: { open: "10:00", close: "13:00", closed: false },
    },
    socialLinks: {
      website: "https://primecaredental.in",
      instagram: "https://instagram.com/primecaredental",
      facebook: "",
      youtube: "",
      linkedin: "",
    },
    seo: {
      title: "PrimeCare Dental Studio | Gachibowli Dentist",
      description: "Family dentist in Gachibowli, Hyderabad",
      keywords: ["dentist", "hyderabad", "gachibowli", "cosmetic dentistry"],
      canonicalUrl: "https://primecaredental.in",
    },
    stats: { views: 760, clicks: 180, enquiries: 26 },
    googleMapsUrl: "https://maps.google.com/?q=Gachibowli+Hyderabad",
  },
  {
    name: "Sparks Fitness Studio",
    category: "Gyms & Fitness",
    city: "Delhi",
    state: "Delhi",
    area: "Dwarka",
    address: "34 Sector 10, Dwarka, New Delhi",
    tagline: "Strength, coaching, and wellness programs that fit real life",
    description:
      "Sparks Fitness Studio helps members build sustainable fitness habits with expert coaches, live classes, and smart training plans.",
    phone: "+91 98123 44567",
    whatsapp: "+91 98123 44567",
    email: "support@sparksfitness.in",
    rating: 4.6,
    reviewCount: 108,
    logo: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=400&q=80",
    coverImage: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80",
    ],
    published: true,
    featured: true,
    plan: "premium-999",
    hours: {
      mon: { open: "05:30", close: "22:00", closed: false },
      tue: { open: "05:30", close: "22:00", closed: false },
      wed: { open: "05:30", close: "22:00", closed: false },
      thu: { open: "05:30", close: "22:00", closed: false },
      fri: { open: "05:30", close: "22:00", closed: false },
      sat: { open: "06:00", close: "21:00", closed: false },
      sun: { open: "07:00", close: "18:00", closed: false },
    },
    socialLinks: {
      website: "https://sparksfitness.in",
      instagram: "https://instagram.com/sparksfitness",
      facebook: "https://facebook.com/sparksfitness",
      youtube: "",
      linkedin: "",
    },
    seo: {
      title: "Sparks Fitness Studio | Gym in Dwarka, Delhi",
      description: "A modern gym and personal training studio in Dwarka",
      keywords: ["gym", "fitness", "dwarka", "personal training"],
      canonicalUrl: "https://sparksfitness.in",
    },
    stats: { views: 1110, clicks: 310, enquiries: 48 },
    googleMapsUrl: "https://maps.google.com/?q=Dwarka+Delhi",
  },
  {
    name: "BlueStone Travel Co.",
    category: "Travel Agents",
    city: "Mumbai",
    state: "Maharashtra",
    area: "Andheri East",
    address: "12 Link Road, Andheri East, Mumbai",
    tagline: "Trips planned around your goals, timelines, and budget",
    description:
      "BlueStone Travel Co. crafts domestic and international holiday plans with smart itineraries, hotel partnerships, and premium support.",
    phone: "+91 98210 76543",
    whatsapp: "+91 98210 76543",
    email: "travel@bluestonetravel.in",
    rating: 4.5,
    reviewCount: 62,
    logo: "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=400&q=80",
    coverImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80",
    ],
    published: true,
    featured: false,
    plan: "premium-199",
    hours: {
      mon: { open: "10:00", close: "19:00", closed: false },
      tue: { open: "10:00", close: "19:00", closed: false },
      wed: { open: "10:00", close: "19:00", closed: false },
      thu: { open: "10:00", close: "19:00", closed: false },
      fri: { open: "10:00", close: "19:00", closed: false },
      sat: { open: "10:00", close: "17:00", closed: false },
      sun: { open: "11:00", close: "15:00", closed: false },
    },
    socialLinks: {
      website: "https://bluestonetravel.in",
      instagram: "https://instagram.com/bluestonetravel",
      facebook: "https://facebook.com/bluestonetravel",
      youtube: "",
      linkedin: "",
    },
    seo: {
      title: "BlueStone Travel Co. | Travel Agent in Andheri East",
      description: "Travel agent and holiday planner in Mumbai",
      keywords: ["travel agent", "mumbai", "holiday trips", "international travel"],
      canonicalUrl: "https://bluestonetravel.in",
    },
    stats: { views: 690, clicks: 165, enquiries: 21 },
    googleMapsUrl: "https://maps.google.com/?q=Andheri+East+Mumbai",
  },
];

const productSeedData = {
  "The Green Table": [
    { name: "Signature Thali", price: 499, compareAtPrice: 599, stock: 42, description: "Chef's special platter with appetizers, mains, and dessert." },
    { name: "Paneer Tikka Bowl", price: 329, compareAtPrice: 399, stock: 35, description: "Grilled paneer, rice, salad, and house sauce." },
    { name: "Citrus Mocktail", price: 189, compareAtPrice: 229, stock: 50, description: "Fresh mint, lime, and sparkling citrus blend." },
  ],
  "UrbanNest Interiors": [
    { name: "Living Room Styling Package", price: 24999, compareAtPrice: 29999, stock: 12, description: "Custom styling and furnishing consultation package." },
    { name: "Kitchen Modular Quote", price: 38999, compareAtPrice: 44999, stock: 8, description: "Modular kitchen design and installation workflow." },
    { name: "Lighting Upgrade Bundle", price: 18999, compareAtPrice: 22999, stock: 10, description: "Mood lighting plan including fixtures and placement." },
  ],
  "PrimeCare Dental Studio": [
    { name: "Smile Whitening Session", price: 6999, compareAtPrice: 8999, stock: 15, description: "Professional whitening with aftercare guidance." },
    { name: "Dental Hygiene Combo", price: 3499, compareAtPrice: 4299, stock: 22, description: "Cleaning, polishing, and oral health check." },
    { name: "Orthodontic Consultation", price: 599, compareAtPrice: 799, stock: 30, description: "Initial consult for braces and aligners." },
  ],
  "Sparks Fitness Studio": [
    { name: "1-Month Transformation Plan", price: 2999, compareAtPrice: 3999, stock: 20, description: "Coach-led training program with weekly check-ins." },
    { name: "Strength Bootcamp Pass", price: 2499, compareAtPrice: 3199, stock: 30, description: "Unlimited group strength and conditioning sessions." },
    { name: "Nutrition Consultation", price: 1499, compareAtPrice: 1999, stock: 18, description: "Diet review and weekly meal guidance." },
  ],
  "BlueStone Travel Co.": [
    { name: "Weekend Escape Package", price: 14999, compareAtPrice: 17999, stock: 18, description: "2-night getaway with stay, transfers, and guided activities." },
    { name: "Custom International Tour", price: 42999, compareAtPrice: 48999, stock: 10, description: "Personalised holiday bundle based on travel style." },
    { name: "Visa Support Add-On", price: 5999, compareAtPrice: 6999, stock: 22, description: "Documentation guidance and appointment assistance." },
  ],
};

const serviceSeedData = {
  "The Green Table": [
    { name: "Private Dining Booking", price: 2500, durationMinutes: 60, description: "Private room arrangements for family and group dinners." },
    { name: "Catering for Events", price: 5200, durationMinutes: 90, description: "Menu planning and food service for special gatherings." },
  ],
  "UrbanNest Interiors": [
    { name: "Home Interior Consultation", price: 4999, durationMinutes: 90, description: "Space planning and styling guidance for new homes." },
    { name: "Commercial Design Revamp", price: 14999, durationMinutes: 120, description: "Workplace redesign for productivity and brand appeal." },
  ],
  "PrimeCare Dental Studio": [
    { name: "Teeth Whitening", price: 6999, durationMinutes: 60, description: "Whitening and polishing for brighter smiles." },
    { name: "Root Canal Treatment", price: 12999, durationMinutes: 90, description: "Comfort-focused endodontic care and follow-up." },
  ],
  "Sparks Fitness Studio": [
    { name: "Personal Training", price: 1999, durationMinutes: 60, description: "One-on-one coaching for habits and performance." },
    { name: "Group Fitness Membership", price: 3199, durationMinutes: 60, description: "Unlimited group class access." },
  ],
  "BlueStone Travel Co.": [
    { name: "Holiday Itinerary Planning", price: 6999, durationMinutes: 90, description: "Custom trip planning and booking coordination." },
    { name: "Corporate Travel Management", price: 15999, durationMinutes: 120, description: "Business travel planning and updates for teams." },
  ],
};

const reviewSeedData = {
  "The Green Table": [
    { name: "Riya Sharma", rating: 5, comment: "Excellent ambience, warm staff, and the food was fresh and beautifully presented." },
    { name: "Vikram Mehta", rating: 4, comment: "Good family dinner spot. Service was quick and portions were generous." },
  ],
  "UrbanNest Interiors": [
    { name: "Aditi Rao", rating: 5, comment: "Our home looks stunning and the design team listened closely to our needs." },
    { name: "Nitin Kapoor", rating: 5, comment: "Great communication and design execution from beginning to finish." },
  ],
  "PrimeCare Dental Studio": [
    { name: "Sonal Patel", rating: 5, comment: "Very professional care and the clinic felt clean and reassuring." },
    { name: "Karan Verma", rating: 4, comment: "The staff explained everything clearly and I felt comfortable throughout." },
  ],
  "Sparks Fitness Studio": [
    { name: "Mehul Jain", rating: 5, comment: "The trainers are motivating and the classes are well structured." },
    { name: "Pooja Nair", rating: 4, comment: "Great atmosphere and a practical fitness plan that actually works." },
  ],
  "BlueStone Travel Co.": [
    { name: "Ananya Sen", rating: 5, comment: "The itinerary was perfectly designed and every arrangement was smooth." },
    { name: "Rahul Malhotra", rating: 4, comment: "Responsive team and good value for custom holiday planning." },
  ],
};

const enquirySeedData = {
  "The Green Table": [
    { name: "Aarav Joshi", email: "aarav@example.com", phone: "+91 99221 77889", message: "We want to book a private dinner for 18 guests next month." },
    { name: "Sneha Iyer", email: "sneha@example.com", phone: "+91 98765 88221", message: "Can we get a catering quote for a birthday celebration?" },
  ],
  "UrbanNest Interiors": [
    { name: "Nisha Shah", email: "nisha@example.com", phone: "+91 99887 11334", message: "Looking for a complete styling package for a 3BHK in Baner." },
  ],
  "PrimeCare Dental Studio": [
    { name: "Harshita Kulkarni", email: "harshita@example.com", phone: "+91 99001 22334", message: "Can you share availability for a dental cleaning appointment?" },
  ],
  "Sparks Fitness Studio": [
    { name: "Kunal Gupta", email: "kunal@example.com", phone: "+91 98220 01122", message: "I would like details for a personal training plan and membership pricing." },
  ],
  "BlueStone Travel Co.": [
    { name: "Mitali Das", email: "mitali@example.com", phone: "+91 98111 55443", message: "Planning a 5-day international holiday and need itinerary suggestions." },
  ],
};

const createReviewUsers = async () => {
  const reviewEmails = [
    "reviewer1@example.com",
    "reviewer2@example.com",
    "reviewer3@example.com",
    "reviewer4@example.com",
    "reviewer5@example.com",
    "reviewer6@example.com",
    "reviewer7@example.com",
    "reviewer8@example.com",
    "reviewer9@example.com",
    "reviewer10@example.com",
  ];

  const users = await Promise.all(
    reviewEmails.map((email, index) =>
      User.findOneAndUpdate(
        { email },
        {
          name: `Demo Reviewer ${index + 1}`,
          email,
          role: "user",
          emailVerified: true,
          phoneVerified: true,
          authProviders: ["password"],
          password: "Demo123!",
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  return users;
};

const seedDemoData = async () => {
  await connectDB();

  const demoOwner = await User.findOneAndUpdate(
    { email: DEMO_EMAIL },
    {
      name: "BizLaunch Demo Owner",
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      role: "business_owner",
      emailVerified: true,
      phoneVerified: true,
      authProviders: ["password"],
      status: "active",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const reviewUsers = await createReviewUsers();
  const seededBusinesses = [];

  for (const businessData of businessSeedData) {
    const business = await Business.findOneAndUpdate(
      { owner: demoOwner._id, name: businessData.name },
      {
        ...businessData,
        owner: demoOwner._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    seededBusinesses.push(business);

    await Product.deleteMany({ business: business._id });
    await Product.insertMany(
      (productSeedData[businessData.name] || []).map((item) => ({
        ...item,
        business: business._id,
        isActive: true,
      }))
    );

    await Service.deleteMany({ business: business._id });
    await Service.insertMany(
      (serviceSeedData[businessData.name] || []).map((item) => ({
        ...item,
        business: business._id,
        isActive: true,
      }))
    );

    await Review.deleteMany({ business: business._id });
    await Review.insertMany(
      (reviewSeedData[businessData.name] || []).map((review, index) => ({
        business: business._id,
        user: reviewUsers[index % reviewUsers.length]._id,
        name: review.name,
        rating: review.rating,
        comment: review.comment,
        status: "published",
      }))
    );

    await Enquiry.deleteMany({ business: business._id });
    await Enquiry.insertMany(
      (enquirySeedData[businessData.name] || []).map((enquiry) => ({
        ...enquiry,
        business: business._id,
        status: "new",
      }))
    );
  }

  console.log(`Seeded ${seededBusinesses.length} demo businesses for ${DEMO_EMAIL}`);
  console.log("Demo login email:", DEMO_EMAIL);
  console.log("Demo login password:", DEMO_PASSWORD);

  await mongoose.connection.close();
};

seedDemoData().catch((error) => {
  console.error("Demo data seeding failed:", error);
  process.exit(1);
});
