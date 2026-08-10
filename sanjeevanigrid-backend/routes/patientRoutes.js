const express = require("express");
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const Patient = require("../models/Patient");
const Hospital = require("../models/Hospital");
const generatePatientCode = require("../utils/generatePatientCode");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();
const MAX_FREE_EDITS = 2;
const REGISTRATION_FEE = 5;

/* ---------------------------------------------------------
   GET /api/patients   (protected)
   Admin sees all; a normal user sees only their own registrations.
--------------------------------------------------------- */
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const filter = req.user.role === "admin" ? {} : { registeredBy: req.user._id };
    const patients = await Patient.find(filter).sort({ admitDate: -1 });
    res.json(patients);
  })
);

/* ---------------------------------------------------------
   POST /api/patients/register-self   (protected — logged-in patient/public user)
   Body: { ...patientForm, razorpay_order_id, razorpay_payment_id, razorpay_signature }
   Verifies the Razorpay payment FIRST, then creates the patient with status
   "Pending" (mirrors the frontend's self-registration flow — no bed deducted
   until an admin approves it).
--------------------------------------------------------- */
router.post(
  "/register-self",
  protect,
  asyncHandler(async (req, res) => {
    const {
      name, age, gender, aadhar, village, post, ps, contact, reason, hospitalId,
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
    } = req.body;

    if (!name || !age || !aadhar || aadhar.length !== 12 || !contact || contact.length !== 10 || !village || !post || !ps || !hospitalId) {
      res.status(400);
      throw new Error("Please provide all required fields correctly");
    }
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(402);
      throw new Error("Payment verification details missing — complete payment first");
    }

    // Re-verify signature here too (defense in depth — don't rely solely on /verify having been called)
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expectedSignature !== razorpay_signature) {
      res.status(402);
      throw new Error("Payment could not be verified");
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      res.status(404);
      throw new Error("Selected hospital not found");
    }

    const code = generatePatientCode(`${Date.now()}-${contact}-${Math.random()}`);

    const patient = await Patient.create({
      code,
      source: "self",
      registeredBy: req.user._id,
      name, age, gender, aadhar, village, post, ps,
      district: hospital.district,
      contact, reason, hospitalId,
      status: "Pending",
      requestStatus: "Pending",
      paymentStatus: "Paid",
      paymentAmount: REGISTRATION_FEE,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    res.status(201).json(patient);
  })
);

/* ---------------------------------------------------------
   POST /api/patients/admit   (protected, admin only)
   Admin directly admits a patient — bed is deducted immediately.
--------------------------------------------------------- */
router.post(
  "/admit",
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { name, age, gender, aadhar, village, post, ps, contact, reason, hospitalId } = req.body;

    if (!name || !age || !aadhar || aadhar.length !== 12 || !contact || contact.length !== 10 || !village || !post || !ps || !hospitalId) {
      res.status(400);
      throw new Error("Please provide all required fields correctly");
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      res.status(404);
      throw new Error("Hospital not found");
    }
    if (hospital.availableBeds <= 0) {
      res.status(400);
      throw new Error("No beds available at this hospital");
    }

    const code = generatePatientCode(`${Date.now()}-${contact}-${Math.random()}`);

    const patient = await Patient.create({
      code,
      source: "admin",
      registeredBy: req.user._id,
      name, age, gender, aadhar, village, post, ps,
      district: hospital.district,
      contact, reason, hospitalId,
      status: "Admitted",
      requestStatus: "Approved",
      paymentStatus: "Paid",
      paymentAmount: 0,
    });

    hospital.availableBeds -= 1;
    await hospital.save();

    res.status(201).json(patient);
  })
);

/* ---------------------------------------------------------
   PATCH /api/patients/:id/approve   (admin only) — allots a bed
--------------------------------------------------------- */
router.patch(
  "/:id/approve",
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const patient = await Patient.findById(req.params.id);
    if (!patient) { res.status(404); throw new Error("Patient not found"); }

    const hospital = await Hospital.findById(patient.hospitalId);
    if (!hospital || hospital.availableBeds <= 0) {
      res.status(400);
      throw new Error("No beds available to approve this request");
    }

    patient.status = "Admitted";
    patient.requestStatus = "Approved";
    await patient.save();

    hospital.availableBeds -= 1;
    await hospital.save();

    res.json(patient);
  })
);

/* ---------------------------------------------------------
   PATCH /api/patients/:id/reject   (admin only)
   Body: { reason }
--------------------------------------------------------- */
router.patch(
  "/:id/reject",
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason?.trim()) { res.status(400); throw new Error("Rejection reason is required"); }

    const patient = await Patient.findById(req.params.id);
    if (!patient) { res.status(404); throw new Error("Patient not found"); }

    patient.status = "Rejected";
    patient.requestStatus = "Rejected";
    patient.rejectReason = reason.trim();
    await patient.save();

    res.json(patient);
  })
);

/* ---------------------------------------------------------
   PATCH /api/patients/:id/discharge   (admin only) — frees a bed
--------------------------------------------------------- */
router.patch(
  "/:id/discharge",
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const patient = await Patient.findById(req.params.id);
    if (!patient) { res.status(404); throw new Error("Patient not found"); }

    patient.status = "Discharged";
    await patient.save();

    const hospital = await Hospital.findById(patient.hospitalId);
    if (hospital) {
      hospital.availableBeds = Math.min(hospital.totalBeds, hospital.availableBeds + 1);
      await hospital.save();
    }

    res.json(patient);
  })
);

/* ---------------------------------------------------------
   PATCH /api/patients/:id/edit   (protected — the patient themself)
   Body: { name, reason } — free corrections, capped at MAX_FREE_EDITS
--------------------------------------------------------- */
router.patch(
  "/:id/edit",
  protect,
  asyncHandler(async (req, res) => {
    const { name, reason } = req.body;
    const patient = await Patient.findById(req.params.id);
    if (!patient) { res.status(404); throw new Error("Patient not found"); }

    if (String(patient.registeredBy) !== String(req.user._id) && req.user.role !== "admin") {
      res.status(403);
      throw new Error("You can only edit your own registration");
    }
    if (patient.editCount >= MAX_FREE_EDITS) {
      res.status(400);
      throw new Error("Free edit limit reached for this registration");
    }

    if (name) patient.name = name;
    if (reason !== undefined) patient.reason = reason;
    patient.editCount += 1;
    await patient.save();

    res.json(patient);
  })
);

/* ---------------------------------------------------------
   GET /api/patients/lookup/:code   (admin only) — doctor verifies by patient code
--------------------------------------------------------- */
router.get(
  "/lookup/:code",
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const patient = await Patient.findOne({ code: req.params.code.toUpperCase() });
    if (!patient) { res.status(404); throw new Error("No patient found with this code"); }
    res.json(patient);
  })
);

module.exports = router;
