const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "Medical College Hospital",
        "Sadar Hospital",
        "Community Health Centre",
        "Primary Health Centre",
        "Health & Wellness Centre",
      ],
      required: true,
    },
    district: { type: String, required: true },
    address: { type: String },
    contact: { type: String, required: true },
    totalBeds: { type: Number, required: true, default: 0 },
    availableBeds: { type: Number, required: true, default: 0 },
    totalDoctors: { type: Number, required: true, default: 0 },
    doctorsOnDuty: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hospital", hospitalSchema);
