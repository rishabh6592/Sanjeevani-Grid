// const mongoose = require("mongoose");

// const userSchema = new mongoose.Schema(
//   {
//     name: { type: String, required: true, trim: true },
//     email: { type: String, required: true, unique: true, lowercase: true, trim: true },
//     password: { type: String, select: false }, // not required — Google users won't have one
//     googleId: { type: String, unique: true, sparse: true },
//     avatar: { type: String },
//     contact: { type: String, trim: true },
//     role: { type: String, enum: ["admin", "user"], default: "user" },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("User", userSchema);


const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      select: false,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    avatar: {
      type: String,
    },

    contact: {
      type: String,
      trim: true,
    },

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },

    // Forgot Password
    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpire: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);