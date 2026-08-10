const express = require("express");
const asyncHandler = require("express-async-handler");
const Hospital = require("../models/Hospital");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/hospitals — public, anyone can browse (find-a-hospital screen)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const hospitals = await Hospital.find().sort({ name: 1 });
    res.json(hospitals);
  })
);

// GET /api/hospitals/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) { res.status(404); throw new Error("Hospital not found"); }
    res.json(hospital);
  })
);

// POST /api/hospitals — admin only
router.post(
  "/",
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { name, type, district, contact, totalBeds, totalDoctors } = req.body;
    if (!name || !type || !district || !contact) {
      res.status(400);
      throw new Error("Name, type, district and contact are required");
    }
    const hospital = await Hospital.create({
      name, type, district, contact,
      address: `${name}, ${district}, Bihar`,
      totalBeds: totalBeds || 0,
      availableBeds: totalBeds || 0,
      totalDoctors: totalDoctors || 0,
      doctorsOnDuty: totalDoctors || 0,
    });
    res.status(201).json(hospital);
  })
);

// PATCH /api/hospitals/:id/adjust — admin only. Body: { field: "availableBeds"|"doctorsOnDuty", delta: 1 | -1 }
router.patch(
  "/:id/adjust",
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { field, delta } = req.body;
    if (!["availableBeds", "doctorsOnDuty"].includes(field)) {
      res.status(400);
      throw new Error("Invalid field to adjust");
    }
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) { res.status(404); throw new Error("Hospital not found"); }

    const cap = field === "availableBeds" ? hospital.totalBeds : hospital.totalDoctors;
    hospital[field] = Math.max(0, Math.min(cap, hospital[field] + delta));
    await hospital.save();
    res.json(hospital);
  })
);

module.exports = router;
