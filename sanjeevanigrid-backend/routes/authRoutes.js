const express = require("express");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

/* =========================================================
   EMAIL CONFIGURATION
   ========================================================= */

const transporter =
  process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    : null;


/* =========================================================
   POST /api/auth/register
   ========================================================= */

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const {
      name,
      email,
      password,
      contact,
      adminCode,
    } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error(
        "Name, email and password are required"
      );
    }

    const existing = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existing) {
      res.status(400);
      throw new Error(
        "An account with this email already exists"
      );
    }

    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(
      password,
      salt
    );

    const isAdmin =
      !!process.env.ADMIN_INVITE_CODE &&
      !!adminCode &&
      adminCode === process.env.ADMIN_INVITE_CODE;

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      contact,
      role: isAdmin ? "admin" : "user",
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  })
);


/* =========================================================
   POST /api/auth/login
   ========================================================= */

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const {
      email,
      password,
    } = req.body;

    const user = await User.findOne({
      email: email?.toLowerCase(),
    }).select("+password");

    if (!user || !user.password) {
      res.status(401);

      throw new Error(
        "Invalid email or password"
      );
    }

    const match = await bcrypt.compare(
      password,
      user.password
    );

    if (!match) {
      res.status(401);

      throw new Error(
        "Invalid email or password"
      );
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  })
);


/* =========================================================
   POST /api/auth/forgot-password

   Body:
   {
      "email": "user@gmail.com"
   }

   Sends password reset email
   ========================================================= */

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {

    const email = req.body.email
      ?.trim()
      .toLowerCase();

    if (!email) {
      res.status(400);

      throw new Error(
        "Email is required"
      );
    }

    const genericMessage =
      "If an account exists for this email, a password reset link has been sent.";

    const user = await User.findOne({
      email,
    }).select(
      "+password +resetPasswordToken +resetPasswordExpire"
    );

    /*
      Google-only accounts do not have
      a password to reset.
    */

    if (!user || !user.password) {
      return res.json({
        message: genericMessage,
      });
    }

    /*
      Check email configuration
    */

    if (!transporter) {
      console.error(
        "EMAIL_USER or EMAIL_PASS is missing in .env"
      );

      res.status(500);

      throw new Error(
        "Email service is not configured"
      );
    }

    /*
      Generate secure random token
    */

    const resetToken =
      crypto.randomBytes(32).toString("hex");

    /*
      Store only hashed token in database
    */

    const hashedToken =
      crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    user.resetPasswordToken =
      hashedToken;

    /*
      Token expires after 15 minutes
    */

    user.resetPasswordExpire =
      new Date(
        Date.now() + 15 * 60 * 1000
      );

    await user.save();

    /*
      Frontend URL
    */

    const clientUrl = (
      process.env.CLIENT_URL ||
      "http://localhost:5173"
    ).replace(/\/$/, "");

    /*
      Reset URL
    */

    const resetUrl =
      `${clientUrl}/reset-password?token=${resetToken}`;

    try {

      await transporter.sendMail({

        from:
          `"SanjeevaniGrid" <${process.env.EMAIL_USER}>`,

        to: user.email,

        subject:
          "SanjeevaniGrid - Reset Password",

        text:
          `You requested a password reset.

Click the link below to reset your password:

${resetUrl}

This link will expire in 15 minutes.

If you did not request this password reset, you can safely ignore this email.`,

        html: `
          <div style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 30px;
            color: #0F2438;
          ">

            <h2>
              SanjeevaniGrid
            </h2>

            <h3>
              Password Reset Request
            </h3>

            <p>
              You requested to reset your password.
            </p>

            <p>
              Click the button below to create
              a new password.
            </p>

            <a
              href="${resetUrl}"
              style="
                display: inline-block;
                padding: 12px 20px;
                background: #0E7C7B;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
              "
            >
              Reset Password
            </a>

            <p style="margin-top: 25px;">
              This link will expire in
              <strong>15 minutes</strong>.
            </p>

            <p>
              If you did not request this,
              you can safely ignore this email.
            </p>

          </div>
        `,
      });

    } catch (error) {

      /*
        If email fails, remove reset token
      */

      user.resetPasswordToken =
        undefined;

      user.resetPasswordExpire =
        undefined;

      await user.save();

      console.error(
        "Password reset email error:",
        error
      );

      res.status(500);

      throw new Error(
        "Could not send password reset email"
      );
    }

    res.json({
      message: genericMessage,
    });
  })
);


/* =========================================================
   POST /api/auth/reset-password/:token

   Body:
   {
      "password": "newpassword"
   }
   ========================================================= */

router.post(
  "/reset-password/:token",
  asyncHandler(async (req, res) => {

    const {
      token,
    } = req.params;

    const {
      password,
    } = req.body;

    if (!token || !password) {
      res.status(400);

      throw new Error(
        "Reset token and new password are required"
      );
    }

    if (password.length < 6) {
      res.status(400);

      throw new Error(
        "Password must be at least 6 characters"
      );
    }

    /*
      Hash token received from email
    */

    const hashedToken =
      crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    /*
      Find valid and non-expired token
    */

    const user = await User.findOne({
      resetPasswordToken: hashedToken,

      resetPasswordExpire: {
        $gt: new Date(),
      },

    }).select(
      "+resetPasswordToken +resetPasswordExpire"
    );

    if (!user) {
      res.status(400);

      throw new Error(
        "Reset link is invalid or expired"
      );
    }

    /*
      Hash new password
    */

    const salt =
      await bcrypt.genSalt(10);

    const hashedPassword =
      await bcrypt.hash(
        password,
        salt
      );

    user.password =
      hashedPassword;

    /*
      Token becomes unusable
      after successful reset
    */

    user.resetPasswordToken =
      undefined;

    user.resetPasswordExpire =
      undefined;

    await user.save();

    res.json({
      message:
        "Password reset successful. You can now log in.",
    });
  })
);


/* =========================================================
   POST /api/auth/google
   ========================================================= */

router.post(
  "/google",
  asyncHandler(async (req, res) => {

    const {
      credential,
    } = req.body;

    if (!credential) {
      res.status(400);

      throw new Error(
        "Missing Google credential token"
      );
    }

    const ticket =
      await googleClient.verifyIdToken({
        idToken: credential,

        audience:
          process.env.GOOGLE_CLIENT_ID,
      });

    const payload =
      ticket.getPayload();

    let user =
      await User.findOne({
        googleId: payload.sub,
      });

    if (!user) {

      /*
        Link Google account with
        existing email account
      */

      user =
        await User.findOne({
          email:
            payload.email.toLowerCase(),
        });

      if (user) {

        user.googleId =
          payload.sub;

        user.avatar =
          payload.picture;

        await user.save();

      } else {

        user =
          await User.create({
            name:
              payload.name,

            email:
              payload.email.toLowerCase(),

            googleId:
              payload.sub,

            avatar:
              payload.picture,
          });
      }
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      token: generateToken(user._id),
    });
  })
);


/* =========================================================
   GET /api/auth/me
   ========================================================= */

router.get(
  "/me",
  protect,
  asyncHandler(async (req, res) => {

    res.json(req.user);

  })
);


module.exports = router;