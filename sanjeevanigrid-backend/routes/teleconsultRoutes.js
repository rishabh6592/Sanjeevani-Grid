const express = require("express");
const asyncHandler = require("express-async-handler");
const Teleconsult = require("../models/Teleconsult");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/teleconsults — admin sees all, user sees their own
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const filter = req.user.role === "admin" ? {} : { requestedBy: req.user._id };
    const list = await Teleconsult.find(filter).sort({ time: -1 });
    res.json(list);
  })
);

// POST /api/teleconsults — book a call
router.post(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const { name, contact, hospitalId } = req.body;
    if (!name || !contact || !hospitalId) {
      res.status(400);
      throw new Error("Name, contact and hospital are required");
    }
    const entry = await Teleconsult.create({
      name, contact, hospitalId, requestedBy: req.user._id, status: "Waiting",
    });
    res.status(201).json(entry);
  })
);

// PATCH /api/teleconsults/:id/connect — admin only
router.patch(
  "/:id/connect",
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const entry = await Teleconsult.findByIdAndUpdate(req.params.id, { status: "Connected" }, { new: true });
    if (!entry) { res.status(404); throw new Error("Teleconsult entry not found"); }
    res.json(entry);
  })
);

// PATCH /api/teleconsults/:id/complete
router.patch(
  "/:id/complete",
  protect,
  asyncHandler(async (req, res) => {
    const entry = await Teleconsult.findByIdAndUpdate(req.params.id, { status: "Completed" }, { new: true });
    if (!entry) { res.status(404); throw new Error("Teleconsult entry not found"); }
    res.json(entry);
  })
);

module.exports = router;
