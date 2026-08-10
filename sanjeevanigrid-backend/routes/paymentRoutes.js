const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const asyncHandler = require("express-async-handler");

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ---------------------------------------------------------
   POST /api/payments/create-order
   Body: { amount }  <- amount in RUPEES (e.g. 5 for the ₹5 OPD fee)
   Returns a Razorpay order — frontend opens Razorpay Checkout with this.
--------------------------------------------------------- */
router.post(
  "/create-order",
  asyncHandler(async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      res.status(400);
      throw new Error("A valid amount is required");
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // safe to expose — it's the public key
    });
  })
);

/* ---------------------------------------------------------
   POST /api/payments/verify
   Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   Verifies the payment signature using HMAC-SHA256. NEVER trust the frontend's
   "payment succeeded" claim without this check — it's the only place the
   payment is provably real.
--------------------------------------------------------- */
router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400);
      throw new Error("Missing payment verification fields");
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      res.status(400);
      throw new Error("Payment verification failed — signature mismatch");
    }

    res.json({ verified: true, razorpay_order_id, razorpay_payment_id });
  })
);

module.exports = router;
