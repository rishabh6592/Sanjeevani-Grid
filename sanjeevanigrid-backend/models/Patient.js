const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // e.g. SG-482913
    source: { type: String, enum: ["admin", "self"], default: "self" },
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // logged-in user, if any

    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    aadhar: { type: String, required: true, minlength: 12, maxlength: 12 },
    village: { type: String, required: true },
    post: { type: String, required: true },
    ps: { type: String, required: true },
    district: { type: String },
    contact: { type: String, required: true, minlength: 10, maxlength: 10 },
    reason: { type: String },

    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },

    status: { type: String, enum: ["Pending", "Admitted", "Discharged", "Rejected"], default: "Pending" },
    requestStatus: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    rejectReason: { type: String, default: "" },

    paymentStatus: { type: String, enum: ["Paid", "Pending"], default: "Pending" },
    paymentAmount: { type: Number, default: 0 },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },

    editCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "admitDate", updatedAt: true } }
);

module.exports = mongoose.model("Patient", patientSchema);
