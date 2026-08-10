const mongoose = require("mongoose");

const teleconsultSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    contact: { type: String, required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    status: { type: String, enum: ["Waiting", "Connected", "Completed"], default: "Waiting" },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: "time", updatedAt: true } }
);

module.exports = mongoose.model("Teleconsult", teleconsultSchema);
