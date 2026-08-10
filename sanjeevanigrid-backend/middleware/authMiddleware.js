const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");

// Verifies JWT from "Authorization: Bearer <token>" header (or httpOnly cookie "token")
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized — no token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      res.status(401);
      throw new Error("Not authorized — user no longer exists");
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized — invalid or expired token");
  }
});

// Restricts a route to admin-role users only. Use after `protect`.
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403);
    throw new Error("Admin access required");
  }
};

module.exports = { protect, adminOnly };
