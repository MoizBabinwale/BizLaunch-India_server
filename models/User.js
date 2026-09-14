const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      default: null,
      select: false,
      validate: {
        validator: (value) => !value || value.length >= 8,
        message: "Password must be at least 8 characters",
      },
    },
    role: {
      type: String,
      enum: ["user", "business_owner", "admin"],
      default: "user",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    authProviders: {
      type: [String],
      enum: ["password", "google", "otp"],
      default: ["password"],
    },
    googleSubject: {
      type: String,
      default: null,
      unique: true,
      select: false,
      sparse: true,
    },
    otpHash: {
      type: String,
      default: "",
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    otpLastSentAt: {
      type: Date,
      default: null,
      select: false,
    },
    refreshTokenHash: {
      type: String,
      default: "",
      select: false,
    },
    verificationTokenHash: {
      type: String,
      default: "",
      select: false,
    },
    verificationTokenExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    resetPasswordTokenHash: {
      type: String,
      default: "",
      select: false,
    },
    resetPasswordExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);
UserSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
