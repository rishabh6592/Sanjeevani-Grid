require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const authRoutes = require("./routes/authRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const patientRoutes = require("./routes/patientRoutes");
const teleconsultRoutes = require("./routes/teleconsultRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

connectDB();

const app = express();

// ==============================
// CORS CONFIGURATION
// ==============================
const allowedOrigins = [
  "http://localhost:5173",
  "https://sanjeevani-grid-iota.vercel.app",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without origin (Postman, server-to-server, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ==============================
// MIDDLEWARE
// ==============================
app.use(express.json());
app.use(cookieParser());

// ==============================
// ROOT
// ==============================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "SanjeevaniGrid API running",
  });
});

// ==============================
// API ROUTES
// ==============================
app.use("/api/auth", authRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/teleconsults", teleconsultRoutes);
app.use("/api/payments", paymentRoutes);

// ==============================
// ERROR HANDLING
// ==============================
app.use(notFound);
app.use(errorHandler);

// ==============================
// SERVER
// ==============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});