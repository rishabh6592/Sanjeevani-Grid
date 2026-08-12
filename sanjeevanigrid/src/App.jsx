import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Bed, Stethoscope, Users, AlertTriangle, Phone, Video, Search, MapPin,
  Plus, Minus, X, LogOut, Shield, User, ChevronRight, CheckCircle2, Clock,
  Siren, Building2, ClipboardList, TrendingUp, BarChart3, UserPlus, Edit3,
  Trash2, Fingerprint, Landmark, Home, Mic, MicOff, VideoOff, PhoneOff,
  Menu, Bell, Activity, RadioTower, ChevronLeft, Lock, ArrowRight, KeyRound,
  XCircle, IndianRupee, CreditCard, HelpCircle, Mail,
} from "lucide-react";

/* ============================= APP CONFIG ============================= */
const APP_VERSION = "v1.0.0"; // Easily change your version here!

/* ============================= DESIGN TOKENS =============================
   Palette: clinical teal + navy, built for a public-health "ops room" feel —
   not the generic dark/neon or cream/terracotta AI defaults.
   ink       #0B2545  (navy - sidebar / headers)
   teal      #0E7C7B  (primary actions / brand)
   tealLight #E6F5F4
   bg        #F2F7F8  (app background)
   available #16A34A   moderate #D97706   critical #DC2626   info #2563EB
============================================================================ */

const C = {
  ink: "#0B2545",
  inkSoft: "#13315C",
  teal: "#0E7C7B",
  tealDark: "#0A5F5E",
  tealLight: "#E6F5F4",
  bg: "#F2F7F8",
  card: "#FFFFFF",
  line: "#E2E9EA",
  available: "#16A34A",
  moderate: "#D97706",
  critical: "#DC2626",
  info: "#2563EB",
  text: "#0F2438",
  textSoft: "#5C7080",
};

/* ==================== REGISTRATION FEE (Bihar Govt OPD) ==================== */
const REGISTRATION_FEE = 5; // ₹5 flat OPD registration receipt, per Bihar govt norms
const MAX_FREE_EDITS = 2;   // patient can correct spelling / reason up to 2x, no re-payment

/* ==================== BACKEND API HELPERS ====================
   Talks to the Node/Express + MongoDB backend (see sanjeevanigrid-backend).
   The JWT auth token lives in sessionStorage (per-browser-tab, not shared
   across tabs — so logging into two accounts in two tabs, e.g. admin in one
   and a patient in another, can't overwrite each other's session, and a
   refresh always reloads the same tab's own login instead of "randomly"
   switching identity). Google Sign-In posts a Google ID token to
   /api/auth/google; Razorpay payments are verified server-side before a
   self-registration is ever accepted (see AdmitInline below) — never trust
   a "payment succeeded" claim from the frontend alone.
================================================================= */
const API_BASE = "https://sanjeevani-grid.onrender.com/api";
// Public value — safe to keep in frontend code (unlike the Client Secret).
const GOOGLE_CLIENT_ID = "728074068769-2nah5gcbtnt28mvnaq18nn7vlk50hrj2.apps.googleusercontent.com";
const TOKEN_KEY = "sg_token";
const TAB_KEY = "sg_last_tab"; // remembers which page was open, per tab, per role

function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t); }
function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

// MongoDB documents use "_id" — normalize to ".id" so the rest of this file
// (originally written against window.storage's plain-object shape) doesn't
// need to change.
function withId(doc) { return doc ? { ...doc, id: doc._id || doc.id } : doc; }
function withIds(list) { return (list || []).map(withId); }

async function fetchHospitals() {
  return withIds(await apiFetch("/hospitals"));
}
async function fetchPatients() {
  return withIds(await apiFetch("/patients")).map((p) => ({ ...p, admitDate: new Date(p.admitDate) }));
}
async function fetchTeleconsults() {
  return withIds(await apiFetch("/teleconsults")).map((t) => ({ ...t, time: new Date(t.time) }));
}

/* ============================== SEED DATA ================================= */
// (Only the district list survives — everything else now comes from the DB.)

const DISTRICTS = [
  "Patna", "Nalanda", "Bhojpur", "Buxar", "Rohtas", "Kaimur", "Gaya", "Jehanabad",
  "Arwal", "Aurangabad", "Nawada", "Vaishali", "Saran", "Siwan", "Gopalganj",
  "Muzaffarpur", "Sitamarhi", "Sheohar", "East Champaran", "West Champaran",
  "Darbhanga", "Madhubani", "Samastipur", "Begusarai", "Munger", "Lakhisarai",
  "Sheikhpura", "Jamui", "Khagaria", "Bhagalpur", "Banka", "Purnia", "Katihar",
  "Araria", "Kishanganj", "Saharsa", "Supaul", "Madhepura",
];

function seededRand(seed) {
  const x = Math.sin(seed * 999.7 + 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Turns a Mongo ObjectId (or anything) into a stable small number, so the
// AI-forecast chart's "random but consistent per hospital" trend still works
// now that hospital ids are ObjectIds instead of "H1", "H2"...
function hashSeed(str) {
  let h = 0;
  const s = String(str || "1");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) + 1;
}

function genTrend(seed) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let base = 40 + seededRand(seed) * 30;
  const data = days.map((d, i) => {
    base += (seededRand(seed + i * 3) - 0.45) * 10;
    base = Math.max(15, Math.min(97, base));
    return { day: d, occupancy: Math.round(base) };
  });
  const delta = (data[6].occupancy - data[4].occupancy) / 2;
  const predicted = Math.max(10, Math.min(99, Math.round(data[6].occupancy + delta)));
  data.push({ day: "Tomorrow", occupancy: null, predicted });
  data[6].predicted = data[6].occupancy;
  return { data, predicted };
}

/* ============================== HELPERS ================================= */

function getStatus(h) {
  const occ = h.totalBeds === 0 ? 0 : 1 - h.availableBeds / h.totalBeds;
  if (occ >= 0.85) return "critical";
  if (occ >= 0.6) return "moderate";
  return "available";
}
const STATUS_COLOR = { critical: C.critical, moderate: C.moderate, available: C.available };
const STATUS_LABEL = { critical: "Critical", moderate: "Moderate", available: "Available" };

const REQ_COLOR = { Pending: C.moderate, Approved: C.available, Rejected: C.critical };

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function maskAadhar(a) {
  if (!a || a.length < 12) return a;
  return `XXXX XXXX ${a.slice(-4)}`;
}

// Vibrates the device (Android Chrome/Edge only — iOS Safari has no
// Vibration API support) when a new admin-facing alert shows up while the
// tab is open. Silently does nothing on unsupported browsers/desktops.
function vibrateAlert(pattern = [200, 100, 200]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// Auto-capitalizes the first letter of every word as the person types —
// used on name / place / reason fields so "ravi kumar" becomes "Ravi Kumar".
function capitalizeWords(str) {
  return str.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/* ============================== ATOMIC UI ================================= */

function Badge({ status }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: `${color}1A`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function ReqBadge({ status }) {
  const color = REQ_COLOR[status] || C.textSoft;
  const label = status === "Pending" ? "Awaiting Approval" : status === "Approved" ? "Approved" : status === "Rejected" ? "Rejected" : status;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: `${color}1A`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// Brand mark: a heartbeat/pulse line running through four grid nodes —
// pairs the "Sanjeevani" (life/health) pulse with the "Grid" (network)
// concept, instead of the generic lucide Activity icon. Single-color so it
// reads clearly at small sizes on both the navy sidebar and the login hero.
function LogoMark({ size = 18, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="4.5" r="1.6" fill={color} opacity="0.55" />
      <circle cx="12" cy="19.5" r="1.6" fill={color} opacity="0.55" />
      <circle cx="3.5" cy="12" r="1.6" fill={color} />
      <circle cx="20.5" cy="12" r="1.6" fill={color} />
      <path d="M3.5 12H8l1.7-4.5L13.3 16.5L15 12H20.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Shows the patient's actual bed/admission status (Admitted / Discharged /
// Pending / Rejected) — distinct from ReqBadge, which only shows the
// approval-request outcome. Added so admins can see at a glance in the
// Patients Registry whether someone is still in a bed or has been
// discharged, without opening each patient's modal.
function PatientStatusBadge({ status }) {
  const map = {
    Admitted: { color: C.available, label: "Admitted" },
    Discharged: { color: C.textSoft, label: "Discharged" },
    Pending: { color: C.moderate, label: "Not Yet Admitted" },
    Rejected: { color: C.critical, label: "Rejected" },
  };
  const cfg = map[status] || { color: C.textSoft, label: status || "—" };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: `${cfg.color}1A`, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function PayBadge({ status, amount }) {
  const paid = status === "Paid";
  const color = paid ? C.available : C.moderate;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${color}1A`, color }}>
      <IndianRupee size={10} /> {paid ? `${amount} Paid` : "Payment Pending"}
    </span>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 animate-[fadein_.2s_ease]"
      style={{ background: C.ink, color: "#fff" }}
    >
      <CheckCircle2 size={16} style={{ color: C.available }} />
      {toast}
    </div>
  );
}

function Modal({ onClose, children, width = "max-w-2xl" }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(11,37,69,0.55)" }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block mb-3.5">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.textSoft }}>
        {label}
      </span>
      <div className="mt-1.5 flex items-center gap-2 border rounded-xl px-3 py-2.5 focus-within:ring-2" style={{ borderColor: C.line }}>
        {Icon && <Icon size={16} style={{ color: C.teal }} />}
        {children}
      </div>
    </label>
  );
}

function Input(props) {
  return <input {...props} className="w-full outline-none text-sm bg-transparent" style={{ color: C.text }} />;
}
function Select(props) {
  return <select {...props} className="w-full outline-none text-sm bg-transparent" style={{ color: C.text }} />;
}

/* ============================== LOGIN / REGISTER / GOOGLE ================================= */

function LoginScreen({ onLogin }) {
  const [role, setRole] = useState("admin");
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgotPassword"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false); // New state for forgot password success
  // Mobile-number-based reset — kept fully separate from the email flow above.
  // OTP flow: user enters mobile -> gets OTP -> enters OTP + new password -> done.
  const [forgotMethod, setForgotMethod] = useState("email"); // "email" | "mobile"
  const [resetContact, setResetContact] = useState("");
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [mobileResetDone, setMobileResetDone] = useState(false);
  const googleBtnRef = useRef(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // Load Google Identity Services once, then (re)render the button whenever
  // we're on the Patient/Public tab (Google sign-in isn't offered for Admin).
  useEffect(() => {
    function renderGoogleButton() {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      googleBtnRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline", size: "large", width: 280,
      });
    }

    if (role !== "user") return;

    if (window.google) {
      renderGoogleButton();
      return;
    }
    if (document.getElementById("google-identity-script")) return;
    const script = document.createElement("script");
    script.id = "google-identity-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);
  }, [role]);

  async function handleGoogleResponse(response) {
    setError("");
    setBusy(true);
    try {
      const data = await apiFetch("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: response.credential }),
      });
      setToken(data.token);
      onLogin({ role: data.role, name: data.name, email: data.email, contact: data.contact || "" });
    } catch (e) {
      setError(e.message || "Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAuth(e) {
    e.preventDefault();
    setError("");

    if (mode === "forgotPassword") {
      if (forgotMethod === "email") {
        if (!email.trim()) {
          return setError("Please enter your email address.");
        }
        setBusy(true);
        try {
          const data = await apiFetch("/auth/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email: email.trim() }),
          });

          console.log("Forgot password response:", data);
          setResetEmailSent(true);
        } catch (e) {
          setError(e.message || "Failed to send password reset email. Please try again.");
        } finally {
          setBusy(false);
        }
        return; // Exit after handling email-based forgot password
      }

      // Mobile-number-based reset — OTP flow (two steps: send OTP, then verify + set password)
      if (!mobileOtpSent) {
        if (resetContact.trim().length !== 10) {
          return setError("Please enter a valid 10-digit mobile number.");
        }
        setError("Forgot password is only available via Email right now. Mobile OTP is a paid service — use only in production.😁");
        return;
      }

      // Step 2: verify OTP + set new password
      if (otp.trim().length !== 6) {
        return setError("Please enter the 6-digit OTP.");
      }
      if (newPassword.length < 6) {
        return setError("New password should be at least 6 characters.");
      }
      if (newPassword !== confirmNewPassword) {
        return setError("Passwords do not match.");
      }
      setBusy(true);
      try {
        await apiFetch("/auth/reset-password-mobile", {
          method: "POST",
          body: JSON.stringify({ contact: resetContact.trim(), otp: otp.trim(), password: newPassword }),
        });
        setMobileResetDone(true);
      } catch (e) {
        setError(e.message || "Invalid or expired OTP. Please try again.");
      } finally {
        setBusy(false);
      }
      return; // Exit after handling mobile-based forgot password
    }

    if (mode === "register" && !name.trim()) return setError("Enter your full name.");
    if (!email.trim() || !password.trim()) return setError("Enter your email and password.");
    if (mode === "register" && password.length < 6) return setError("Password should be at least 6 characters.");

    setBusy(true);
    try {
      const path = mode === "register" ? "/auth/register" : "/auth/login";
      const body = mode === "register"
        ? { name: name.trim(), email: email.trim(), password, contact: contact.trim(), adminCode: adminCode.trim() }
        : { email: email.trim(), password };

      const data = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });

      if (role === "admin" && data.role !== "admin") {
        setError('This account isn\'t set up as an admin. Ask your system administrator to grant admin access, or switch to "Patient / Public Login".');
        setBusy(false);
        return;
      }

      setToken(data.token);
      onLogin({ role: data.role, name: data.name, email: data.email, contact: data.contact || contact.trim() });
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function resetForgotState() {
    setError("");
    setEmail("");
    setResetEmailSent(false);
    setForgotMethod("email");
    setResetContact("");
    setMobileOtpSent(false);
    setOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setMobileResetDone(false);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: `linear-gradient(160deg, ${C.ink}, ${C.tealDark})`, fontFamily: "Inter, sans-serif" }}>
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)",
        backgroundSize: "26px 26px",
      }} />
      <div className="relative w-full max-w-4xl grid md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl">
        <div className="hidden md:flex flex-col justify-between p-10 text-white" style={{ background: `linear-gradient(160deg, ${C.tealDark}, ${C.ink})` }}>
          <div>
            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
                <LogoMark size={20} />
              </div>
              <span className="font-bold text-lg" style={{ fontFamily: "Poppins, sans-serif" }}>SanjeevaniGrid</span>
            </div>
            <h1 className="text-3xl leading-tight font-bold mb-4" style={{ fontFamily: "Poppins, sans-serif" }}>
              Bihar's live health<br />resource network.
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: "#BBD8D6" }}>
              AI-tracked beds and doctor availability across PMCH, medical colleges,
              Sadar hospitals and Health &amp; Wellness Centres — with landline / IT-phone
              video teleconsultation built in.
            </p>
          </div>
          <div className="space-y-3 text-sm">
            {[
              [Bed, "Real-time bed & doctor tracking"],
              [Video, "Landline / IT-phone video teleconsultation"],
              [TrendingUp, "AI occupancy forecasting"],
            ].map(([Icon, t], i) => (
              <div key={i} className="flex items-center gap-2.5" style={{ color: "#D9ECEB" }}>
                <Icon size={16} /> {t}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 sm:p-10">
          <div className="flex rounded-xl p-1 mb-5" style={{ background: C.bg }}>
            {["admin", "user"].map((r) => (
              <button
                key={r}
                onClick={() => { setRole(r); setMode("login"); resetForgotState(); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={role === r ? { background: C.ink, color: "#fff" } : { color: C.textSoft }}
              >
                {r === "admin" ? "Admin Login" : "Patient / Public Login"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 mb-5 border-b" style={{ borderColor: C.line }}>
            {mode !== "forgotPassword" ? (
              ["login", "register"].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); resetForgotState(); }}
                  className="pb-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors"
                  style={mode === m ? { borderColor: C.teal, color: C.teal } : { borderColor: "transparent", color: C.textSoft }}
                >
                  {m === "login" ? "Login" : "Create Account"}
                </button>
              ))
            ) : (
              <button
                key="forgot"
                className="pb-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors"
                style={{ borderColor: C.teal, color: C.teal }}
              >
                Forgot Password
              </button>
            )}
          </div>

          <form onSubmit={submitAuth}>
            <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "Poppins, sans-serif", color: C.text }}>
              {mode === "forgotPassword" ? "Reset your password" : (role === "admin" ? "Admin sign-in" : mode === "register" ? "Create your account" : "Patient / public sign-in")}
            </h2>
            <p className="text-xs mb-4" style={{ color: C.textSoft }}>
              {mode === "forgotPassword"
                ? (forgotMethod === "email"
                    ? "Enter your email to receive a password reset link."
                    : "Enter your registered mobile number to receive an OTP.")
                : (role === "admin" ? "For health department & hospital staff." : "Find beds, register as a patient, or book a video call.")}
            </p>

            {mode === "forgotPassword" && (
              <div className="flex rounded-xl p-1 mb-4" style={{ background: C.bg }}>
                {["email", "mobile"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setForgotMethod(m); setError(""); }}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={forgotMethod === m ? { background: C.teal, color: "#fff" } : { color: C.textSoft }}
                  >
                    {m === "email" ? "Via Email" : "Via Mobile No."}
                  </button>
                ))}
              </div>
            )}

            {mode === "forgotPassword" ? (
              forgotMethod === "email" ? (
                resetEmailSent ? (
                  <div className="rounded-xl p-4 mb-4 text-sm font-medium" style={{ background: C.tealLight, color: C.tealDark }}>
                    <CheckCircle2 size={20} className="inline-block mr-2 align-middle" />
                    A password reset link has been sent to your email address. Please check your inbox.
                  </div>
                ) : (
                  <Field label="Email" icon={Mail}>
                    <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                )
              ) : (
                mobileResetDone ? (
                  <div className="rounded-xl p-4 mb-4 text-sm font-medium" style={{ background: C.tealLight, color: C.tealDark }}>
                    <CheckCircle2 size={20} className="inline-block mr-2 align-middle" />
                    Your password has been reset successfully. Please login with your new password.
                  </div>
                ) : !mobileOtpSent ? (
                  <Field label="Mobile Number" icon={Phone}>
                    <Input
                      placeholder="10-digit mobile number"
                      value={resetContact}
                      maxLength={10}
                      onChange={(e) => setResetContact(e.target.value.replace(/\D/g, ""))}
                    />
                  </Field>
                ) : (
                  <>
                    <p className="text-xs mb-3 font-medium" style={{ color: C.teal }}>
                      OTP sent to {resetContact}.
                    </p>
                    <Field label="Enter OTP" icon={KeyRound}>
                      <Input
                        placeholder="6-digit OTP"
                        value={otp}
                        maxLength={6}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      />
                    </Field>
                    <Field label="New Password" icon={Lock}>
                      <input
                        type="password" placeholder="••••••••" value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full outline-none text-sm bg-transparent" style={{ color: C.text }}
                      />
                    </Field>
                    <Field label="Confirm New Password" icon={Lock}>
                      <input
                        type="password" placeholder="••••••••" value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full outline-none text-sm bg-transparent" style={{ color: C.text }}
                      />
                    </Field>
                  </>
                )
              )
            ) : (
              <>
                {mode === "register" && (
                  <Field label="Full Name" icon={User}>
                    <Input placeholder="e.g. Ravi Kumar" value={name} onChange={(e) => setName(capitalizeWords(e.target.value))} />
                  </Field>
                )}
                <Field label="Email" icon={Mail}>
                  <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Password" icon={Lock}>
                  <input
                    type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full outline-none text-sm bg-transparent" style={{ color: C.text }}
                  />
                </Field>
                {mode === "register" && role === "user" && (
                  <Field label="Mobile Number" icon={Phone}>
                    <Input placeholder="10-digit mobile number" value={contact} maxLength={10}
                      onChange={(e) => setContact(e.target.value.replace(/\D/g, ""))} />
                  </Field>
                )}
                {mode === "register" && role === "admin" && (
                  <Field label="Secret Code for Admin" icon={KeyRound}>
                    <Input type="password" placeholder="Enter the admin invite code" value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)} />
                  </Field>
                )}
              </>
            )}

            {error && <p className="text-xs mb-3 font-medium" style={{ color: C.critical }}>{error}</p>}

            {mode === "forgotPassword" ? (
              <>
                {!((forgotMethod === "email" && resetEmailSent) || (forgotMethod === "mobile" && mobileResetDone)) && (
                  <button
                    type="submit" disabled={busy}
                    className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-white transition-transform active:scale-[0.98] disabled:opacity-60"
                    style={{ background: C.teal }}
                  >
                    {busy
                      ? (forgotMethod === "email" ? "Sending link…" : !mobileOtpSent ? "Sending OTP…" : "Resetting…")
                      : forgotMethod === "email" ? "Send Reset Link" : !mobileOtpSent ? "Send OTP" : "Reset Password"}
                    {" "}<ArrowRight size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMode("login"); resetForgotState(); }}
                  className="w-full mt-3 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border"
                  style={{ borderColor: C.line, color: C.textSoft }}
                >
                  Back to Login
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit" disabled={busy}
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-white transition-transform active:scale-[0.98] disabled:opacity-60"
                  style={{ background: role === "admin" ? C.ink : C.teal }}
                >
                  {busy ? "Please wait…" : mode === "register" ? "Create Account" : "Continue"} <ArrowRight size={16} />
                </button>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => { setMode("forgotPassword"); resetForgotState(); }}
                    className="w-full mt-3 text-xs font-medium text-center"
                    style={{ color: C.textSoft }}
                  >
                    Forgot password?
                  </button>
                )}
              </>
            )}
          </form>

          {role === "user" && mode !== "forgotPassword" && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1" style={{ background: C.line }} />
                <span className="text-[11px] font-semibold" style={{ color: C.textSoft }}>OR</span>
                <div className="h-px flex-1" style={{ background: C.line }} />
              </div>
              <div className="flex justify-center" ref={googleBtnRef} />
            </>
          )}

          {role === "admin" && (
            <p className="text-[11px] mt-4 text-center" style={{ color: C.textSoft }}>
              New admin accounts default to a regular user role — ask a system administrator to
              upgrade your account to admin in the database.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== SHARED: SIDEBAR / TOPBAR ================================= */

function SidebarClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
        <Clock size={14} color="#9FB7CB" />
      </div>
      <div className="leading-tight min-w-0">
        <div className="text-white text-xs font-bold tabular-nums">{timeStr}</div>
        <div className="text-[10px] truncate" style={{ color: "#7FA7A5" }}>{dateStr}</div>
      </div>
    </div>
  );
}

function Sidebar({ role, tab, setTab, onLogout, name, open, setOpen, alertCount = 0 }) {
  const adminNav = [
    ["overview", "Overview", BarChart3],
    ["grid", "Hospital Grid", Building2],
    ["patients", "Patients Registry", ClipboardList],
    ["teleconsult", "Teleconsultation Log", Video],
    ["alerts", "Alerts", AlertTriangle],
  ];
  const userNav = [
    ["find", "Find a Hospital", Search],
    ["register", "Register as Patient", UserPlus],
    ["calls", "My Teleconsultations", Video],
    ["myregistration", "My Registration", ClipboardList],
    ["contacts", "Helpline Directory", Phone],
  ];
  const nav = role === "admin" ? adminNav : userNav;

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setOpen(false)} />}
      <div
        className={`fixed md:static z-40 top-0 left-0 h-full w-64 flex flex-col justify-between transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        style={{ background: C.ink }}
      >
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between gap-2.5 px-5 py-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                <LogoMark size={18} color="#fff" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-bold text-sm leading-none truncate" style={{ fontFamily: "Poppins, sans-serif" }}>SanjeevaniGrid</div>
                <div className="text-[10px] mt-1 truncate" style={{ color: "#7FA7A5" }}>Bihar Health Network</div>
              </div>
            </div>
            {/* Mobile-only close button */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="md:hidden shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <X size={16} color="#fff" />
            </button>
          </div>

          <div className="md:hidden px-3 mb-2">
            <SidebarClock />
          </div>

          <nav className="px-3 mt-2 space-y-1 pb-4">
            {nav.map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={tab === key ? { background: C.teal, color: "#fff" } : { color: "#9FB7CB" }}
              >
                <Icon size={16} /> {label}
                {key === "alerts" && alertCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: C.critical }}>
                    {alertCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        
        {/* FOOTER SECTION: User info, Logout, and Version Tag */}
        <div className="p-4 border-t mt-auto" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2.5 px-2 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: C.teal }}>
              {name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{name}</div>
              <div className="text-[10px] capitalize" style={{ color: "#7FA7A5" }}>{role}</div>
            </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 active:scale-[0.98]" style={{ color: "#F4A6A6", background: "rgba(220,38,38,0.12)" }}>
            <LogOut size={14} /> Logout
          </button>

          {/* === Premium Version Indicator === */}
          <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: C.available }}></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: C.available }}></span>
              </span>
              <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: "#7FA7A5" }}>System Live</span>
            </div>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md tracking-wide" style={{ background: "rgba(255,255,255,0.05)", color: "#B9D6D4" }}>
              {APP_VERSION}
            </span>
          </div>
          {/* ================================= */}
        </div>
      </div>
    </>
  );
}

function Topbar({ title, subtitle, onMenu, right }) {
  return (
    <div className="flex items-center justify-between px-5 sm:px-8 py-5 border-b bg-white/70 backdrop-blur sticky top-0 z-20" style={{ borderColor: C.line }}>
      <div className="flex items-center gap-3 min-w-0">
        <button className="md:hidden shrink-0" onClick={onMenu}><Menu size={20} style={{ color: C.ink }} /></button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold truncate" style={{ fontFamily: "Poppins, sans-serif", color: C.text }}>{title}</h1>
          {subtitle && <p className="text-xs mt-0.5 truncate" style={{ color: C.textSoft }}>{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ============================== KPI CARD ================================= */
function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border min-w-0" style={{ borderColor: C.line }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-extrabold truncate" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>{value}</div>
      <div className="text-xs font-medium mt-1" style={{ color: C.textSoft }}>{label}</div>
      {sub && <div className="text-[11px] mt-1.5 font-semibold" style={{ color }}>{sub}</div>}
    </div>
  );
}

/* ============================== HOSPITAL DETAIL MODAL ================================= */

function HospitalModal({ hospital, patients, onClose, onAdjust, onOpenAdmit, isAdmin }) {
  const [patientQ, setPatientQ] = useState("");
  if (!hospital) return null;
  const status = getStatus(hospital);
  const allHp = patients.filter((p) => p.hospitalId === hospital.id && p.status === "Admitted");
  const hp = patientQ.trim()
    ? allHp.filter((p) => (p.name + " " + (p.code || "")).toLowerCase().includes(patientQ.trim().toLowerCase()))
    : allHp;
  return (
    <Modal onClose={onClose} width="max-w-3xl">
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between mb-1 gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.teal }}>{hospital.type}</span>
            <h2 className="text-lg sm:text-xl font-bold break-words" style={{ fontFamily: "Poppins, sans-serif", color: C.text }}>{hospital.name}</h2>
            <p className="text-xs flex items-center gap-1 mt-1" style={{ color: C.textSoft }}><MapPin size={12} className="shrink-0" /> {hospital.address}</p>
          </div>
          <button onClick={onClose} className="shrink-0"><X size={20} style={{ color: C.textSoft }} /></button>
        </div>

        <div className="flex items-center gap-3 mt-3 mb-5 flex-wrap">
          <Badge status={status} />
          <span className="text-xs flex items-center gap-1" style={{ color: C.textSoft }}><Phone size={12} /> {hospital.contact}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl p-4" style={{ background: C.bg }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: C.textSoft }}><Bed size={14} /> Beds</span>
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onAdjust(hospital.id, "availableBeds", -1)} className="w-6 h-6 rounded-md flex items-center justify-center bg-white border" style={{ borderColor: C.line }}><Minus size={12} /></button>
                  <button onClick={() => onAdjust(hospital.id, "availableBeds", 1)} className="w-6 h-6 rounded-md flex items-center justify-center bg-white border" style={{ borderColor: C.line }}><Plus size={12} /></button>
                </div>
              )}
            </div>
            <div className="text-2xl font-extrabold" style={{ color: C.text }}>{hospital.availableBeds}<span className="text-sm font-medium" style={{ color: C.textSoft }}> / {hospital.totalBeds}</span></div>
            <div className="text-[11px] mt-1" style={{ color: C.textSoft }}>available beds</div>
          </div>
          <div className="rounded-xl p-4" style={{ background: C.bg }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: C.textSoft }}><Stethoscope size={14} /> Doctors</span>
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onAdjust(hospital.id, "doctorsOnDuty", -1)} className="w-6 h-6 rounded-md flex items-center justify-center bg-white border" style={{ borderColor: C.line }}><Minus size={12} /></button>
                  <button onClick={() => onAdjust(hospital.id, "doctorsOnDuty", 1)} className="w-6 h-6 rounded-md flex items-center justify-center bg-white border" style={{ borderColor: C.line }}><Plus size={12} /></button>
                </div>
              )}
            </div>
            <div className="text-2xl font-extrabold" style={{ color: C.text }}>{hospital.doctorsOnDuty}<span className="text-sm font-medium" style={{ color: C.textSoft }}> / {hospital.totalDoctors}</span></div>
            <div className="text-[11px] mt-1" style={{ color: C.textSoft }}>on duty today</div>
          </div>
        </div>

        <div className="mb-5 rounded-xl overflow-hidden border" style={{ borderColor: C.line }}>
          <iframe
            title={`${hospital.name}-location`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(`${hospital.name}, ${hospital.address || `${hospital.district}, Bihar`}`)}&output=embed`}
            className="w-full h-28 border-0 block"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${hospital.name}, ${hospital.address || `${hospital.district}, Bihar`}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3.5 py-2"
            style={{ background: C.teal, color: "#fff" }}
          >
            <MapPin size={13} /> Get Directions
          </a>
        </div>

        {!isAdmin && (
          <button onClick={() => onOpenAdmit(hospital)} className="w-full mb-5 py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ background: C.teal }}>
            <UserPlus size={16} /> Register as Patient Here
          </button>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: C.text }}><Users size={14} /> Currently admitted ({allHp.length})</h3>
          </div>
          {isAdmin && allHp.length > 0 && (
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 mb-3" style={{ borderColor: C.line }}>
              <Search size={13} style={{ color: C.textSoft }} />
              <input
                value={patientQ}
                onChange={(e) => setPatientQ(e.target.value)}
                placeholder="Find patient in this hospital by name or code…"
                className="text-xs outline-none w-full bg-transparent"
                style={{ color: C.text }}
              />
            </div>
          )}
          {allHp.length === 0 ? (
            <p className="text-xs italic" style={{ color: C.textSoft }}>No patients currently admitted at this facility.</p>
          ) : hp.length === 0 ? (
            <p className="text-xs italic" style={{ color: C.textSoft }}>No patient matches "{patientQ}".</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {hp.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs" style={{ borderColor: C.line }}>
                  <div className="min-w-0">
                    <span className="font-semibold" style={{ color: C.text }}>{p.name}</span>
                    <span style={{ color: C.textSoft }}> · {p.age}{p.gender[0]} · {p.village}</span>
                    {p.source === "self" && (
                      <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${C.teal}1A`, color: C.teal }}>SELF</span>
                    )}
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: C.teal }}>{p.code}</div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap" style={{ color: C.textSoft }}>{timeAgo(p.admitDate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin && (
          <button onClick={() => onOpenAdmit(hospital)} className="w-full mt-5 py-2.5 rounded-xl font-semibold text-sm border-2" style={{ borderColor: C.teal, color: C.teal }}>
            + Admit New Patient Here
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ============================== ADMIT PATIENT FORM (ADMIN) ================================= */

function AdmitForm({ hospitals, presetHospitalId, onClose, onSubmit, prefill }) {
  const [form, setForm] = useState({
    name: prefill?.name || "", age: "", gender: "Male", aadhar: "",
    village: "", post: "", ps: "", contact: prefill?.contact || "",
    reason: "", hospitalId: presetHospitalId || hospitals[0]?.id || "",
  });
  const [err, setErr] = useState("");

  const NO_CAPS = ["age", "aadhar", "contact", "hospitalId", "gender"];
  function set(k, v) { setForm((f) => ({ ...f, [k]: NO_CAPS.includes(k) ? v : capitalizeWords(v) })); }

  function submit(e) {
    e.preventDefault();
    if (!form.name || !form.age || form.aadhar.length !== 12 || form.contact.length !== 10 || !form.village || !form.post || !form.ps) {
      setErr("Please fill all fields correctly — Aadhaar must be 12 digits, Contact 10 digits.");
      return;
    }
    onSubmit(form);
  }

  return (
    <Modal onClose={onClose} width="max-w-xl">
      <form onSubmit={submit} className="p-5 sm:p-7">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold" style={{ fontFamily: "Poppins, sans-serif", color: C.text }}>Patient Registration</h2>
          <button type="button" onClick={onClose}><X size={20} style={{ color: C.textSoft }} /></button>
        </div>
        <p className="text-xs mb-5" style={{ color: C.textSoft }}>Admin-side admission — bed is allotted immediately, no approval step.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Full Name" icon={User}><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" /></Field>
          <Field label="Age" icon={Clock}><Input type="number" min="0" value={form.age} onChange={(e) => set("age", e.target.value)} placeholder="Age" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Gender" icon={User}>
            <Select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option>Male</option><option>Female</option><option>Other</option>
            </Select>
          </Field>
          <Field label="Aadhaar No." icon={Fingerprint}>
            <Input value={form.aadhar} maxLength={12} onChange={(e) => set("aadhar", e.target.value.replace(/\D/g, ""))} placeholder="12-digit Aadhaar" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Village" icon={Home}><Input value={form.village} onChange={(e) => set("village", e.target.value)} placeholder="Village" /></Field>
          <Field label="Post" icon={Landmark}><Input value={form.post} onChange={(e) => set("post", e.target.value)} placeholder="Post office" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Police Station (PS)" icon={Shield}><Input value={form.ps} onChange={(e) => set("ps", e.target.value)} placeholder="PS" /></Field>
          <Field label="Contact No." icon={Phone}><Input value={form.contact} maxLength={10} onChange={(e) => set("contact", e.target.value.replace(/\D/g, ""))} placeholder="10-digit mobile" /></Field>
        </div>
        <Field label="Hospital / Health Centre" icon={Building2}>
          <Select value={form.hospitalId} onChange={(e) => set("hospitalId", e.target.value)}>
            {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.availableBeds} beds free)</option>)}
          </Select>
        </Field>
        <Field label="Reason / Symptoms" icon={Stethoscope}>
          <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Fever, fracture, antenatal check" />
        </Field>

        {err && <p className="text-xs mb-2 font-medium" style={{ color: C.critical }}>{err}</p>}
        <button type="submit" className="w-full mt-3 py-3 rounded-xl font-semibold text-sm text-white" style={{ background: C.teal }}>
          Admit &amp; Allot Bed
        </button>
      </form>
    </Modal>
  );
}

/* ============================== ADD HOSPITAL FORM ================================= */

function AddHospitalForm({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", type: "Sadar Hospital", district: DISTRICTS[0], totalBeds: 50, totalDoctors: 10, contact: "" });
  const NO_CAPS_HOSPITAL = ["type", "district", "totalBeds", "totalDoctors", "contact"];
  function set(k, v) { setForm((f) => ({ ...f, [k]: NO_CAPS_HOSPITAL.includes(k) ? v : capitalizeWords(v) })); }
  function submit(e) {
    e.preventDefault();
    if (!form.name || !form.contact) return;
    onSubmit(form);
  }
  return (
    <Modal onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="p-5 sm:p-7">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold" style={{ fontFamily: "Poppins, sans-serif", color: C.text }}>Add New Institution</h2>
          <button type="button" onClick={onClose}><X size={20} style={{ color: C.textSoft }} /></button>
        </div>
        <Field label="Institution Name" icon={Building2}><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. PHC Bakhtiarpur" /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Type" icon={ClipboardList}>
            <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option>Medical College Hospital</option><option>Sadar Hospital</option>
              <option>Community Health Centre</option><option>Primary Health Centre</option>
              <option>Health & Wellness Centre</option>
            </Select>
          </Field>
          <Field label="District" icon={MapPin}>
            <Select value={form.district} onChange={(e) => set("district", e.target.value)}>
              {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Total Beds" icon={Bed}><Input type="number" value={form.totalBeds} onChange={(e) => set("totalBeds", +e.target.value)} /></Field>
          <Field label="Total Doctors" icon={Stethoscope}><Input type="number" value={form.totalDoctors} onChange={(e) => set("totalDoctors", +e.target.value)} /></Field>
        </div>
        <Field label="Contact Number" icon={Phone}><Input value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="0612-XXXXXX" /></Field>
        <button type="submit" className="w-full mt-3 py-3 rounded-xl font-semibold text-sm text-white" style={{ background: C.ink }}>Add Institution</button>
      </form>
    </Modal>
  );
}

/* ============================== VIDEO CALL MODAL ================================= */

function VideoCallModal({ entry, hospital, onClose, onComplete }) {
  const [phase, setPhase] = useState("connecting");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("connected"), 2200);
    return () => clearTimeout(t1);
  }, []);
  useEffect(() => {
    if (phase !== "connected") return;
    const iv = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <Modal onClose={onClose} width="max-w-md">
      <div className="p-0 overflow-hidden rounded-2xl">
        <div className="h-72 relative flex items-center justify-center" style={{ background: `linear-gradient(160deg, ${C.ink}, ${C.tealDark})` }}>
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white" style={{ background: "rgba(255,255,255,0.15)" }}>
            <RadioTower size={11} /> IT Phone / Video Link
          </div>
          {phase === "connecting" ? (
            <div className="text-center text-white">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3 animate-pulse" style={{ background: "rgba(255,255,255,0.15)" }}>
                <Video size={26} />
              </div>
              <p className="text-sm font-semibold">Connecting to {hospital?.name}…</p>
              <p className="text-[11px] mt-1" style={{ color: "#B9D6D4" }}>Routing over landline / IT-phone network</p>
            </div>
          ) : (
            <div className="text-center text-white">
              {videoOff ? (
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-3 text-2xl font-bold" style={{ background: C.teal }}>
                  {(hospital?.name || "D")[0]}
                </div>
              ) : (
                <div className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <Stethoscope size={34} />
                </div>
              )}
              <p className="text-sm font-semibold">Duty Doctor · {hospital?.name}</p>
              <p className="text-[11px] mt-1 font-mono" style={{ color: "#B9D6D4" }}>{mm}:{ss}</p>
            </div>
          )}
        </div>
        <div className="p-5 flex items-center justify-center gap-3" style={{ background: C.ink }}>
          <button onClick={() => setMuted((m) => !m)} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: muted ? C.critical : "rgba(255,255,255,0.12)" }}>
            {muted ? <MicOff size={18} color="#fff" /> : <Mic size={18} color="#fff" />}
          </button>
          <button onClick={() => setVideoOff((v) => !v)} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: videoOff ? C.critical : "rgba(255,255,255,0.12)" }}>
            {videoOff ? <VideoOff size={18} color="#fff" /> : <Video size={18} color="#fff" />}
          </button>
          <button
            onClick={() => { onComplete(entry.id, seconds); onClose(); }}
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: C.critical }}
          >
            <PhoneOff size={18} color="#fff" />
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================== ADMIN: OVERVIEW ================================= */

function AdminOverview({ hospitals, patients, teleconsults, activity, onOpenHospital }) {
  const [forecastId, setForecastId] = useState(hospitals[0]?.id);
  const forecastHospital = hospitals.find((h) => h.id === forecastId) || hospitals[0];
  const trend = useMemo(() => genTrend(hashSeed(forecastHospital?.id)), [forecastHospital?.id]);

  const totalBeds = hospitals.reduce((s, h) => s + h.totalBeds, 0);
  const availBeds = hospitals.reduce((s, h) => s + h.availableBeds, 0);
  const occPct = totalBeds ? Math.round(((totalBeds - availBeds) / totalBeds) * 100) : 0;
  const doctorsOnDuty = hospitals.reduce((s, h) => s + h.doctorsOnDuty, 0);
  const criticalCount = hospitals.filter((h) => getStatus(h) === "critical").length;
  const admittedCount = patients.filter((p) => p.status === "Admitted").length;
  const pendingPatientCount = patients.filter((p) => p.requestStatus === "Pending").length;
  const pendingCallCount = teleconsults.filter((t) => t.status === "Waiting").length;
  const pendingCount = pendingPatientCount + pendingCallCount;

  const typeBreakdown = useMemo(() => {
    const map = {};
    hospitals.forEach((h) => { map[h.type] = (map[h.type] || 0) + 1; });
    return Object.entries(map).map(([type, count]) => ({ type, count }));
  }, [hospitals]);
  const pieColors = [C.teal, C.info, C.moderate, C.available, C.critical, C.ink];

  const criticalList = hospitals.filter((h) => getStatus(h) === "critical").slice(0, 6);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard icon={Building2} label="Health Institutions" value={hospitals.length} color={C.ink} />
        <KpiCard icon={Bed} label="Beds Available" value={`${availBeds}/${totalBeds}`} sub={`${occPct}% occupied`} color={C.teal} />
        <KpiCard icon={Stethoscope} label="Doctors on Duty" value={doctorsOnDuty} color={C.info} />
        <KpiCard icon={UserPlus} label="Pending Requests" value={pendingCount} sub={pendingCount ? `${pendingPatientCount} patient · ${pendingCallCount} call` : "None right now"} color={pendingCount ? C.moderate : C.textSoft} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 border shadow-sm min-w-0" style={{ borderColor: C.line }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: C.text }}>
              <TrendingUp size={16} style={{ color: C.teal }} /> AI Occupancy Trend &amp; Forecast
            </h3>
            <select value={forecastId} onChange={(e) => setForecastId(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 outline-none max-w-full" style={{ borderColor: C.line, color: C.text }}>
              {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={trend.data}>
              <defs>
                <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.teal} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.textSoft }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.textSoft }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${C.line}` }} />
              <Area type="monotone" dataKey="occupancy" stroke={C.teal} fill="url(#occ)" strokeWidth={2.5} connectNulls />
              <Area type="monotone" dataKey="predicted" stroke={C.moderate} strokeDasharray="5 4" fill="none" strokeWidth={2.5} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-[11px] mt-2" style={{ color: C.textSoft }}>
            Solid line = actual occupancy · Dashed = AI-predicted occupancy for tomorrow (<b style={{ color: C.moderate }}>{trend.predicted}%</b>)
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border shadow-sm min-w-0" style={{ borderColor: C.line }}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-4" style={{ color: C.text }}>
            <BarChart3 size={16} style={{ color: C.teal }} /> Institution Mix
          </h3>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={typeBreakdown} dataKey="count" nameKey="type" innerRadius={45} outerRadius={72} paddingAngle={3}>
                {typeBreakdown.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {typeBreakdown.map((t, i) => (
              <div key={t.type} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-1.5 min-w-0 truncate" style={{ color: C.textSoft }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: pieColors[i % pieColors.length] }} /> {t.type}
                </span>
                <span className="font-semibold shrink-0" style={{ color: C.text }}>{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 border shadow-sm" style={{ borderColor: C.line }}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-4" style={{ color: C.text }}>
            <Activity size={16} style={{ color: C.teal }} /> Live Pulse Grid
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {hospitals.map((h) => {
              const st = getStatus(h);
              return (
                <button key={h.id} onClick={() => onOpenHospital(h)} className="text-left p-3 rounded-xl border relative overflow-hidden hover:shadow-md transition-shadow" style={{ borderColor: C.line }}>
                  {st === "critical" && <span className="absolute top-2 right-2 w-2 h-2 rounded-full animate-ping" style={{ background: C.critical }} />}
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[st] }} />
                  <div className="text-[11px] font-semibold truncate pr-4" style={{ color: C.text }}>{h.name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: C.textSoft }}>{h.district}</div>
                  <div className="text-xs font-bold mt-1.5" style={{ color: STATUS_COLOR[st] }}>{h.availableBeds}/{h.totalBeds} beds</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border shadow-sm min-w-0" style={{ borderColor: C.line }}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-4" style={{ color: C.critical }}>
            <Bell size={16} /> Live Activity Feed
          </h3>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {activity.length === 0 && <p className="text-xs italic" style={{ color: C.textSoft }}>No activity yet this session.</p>}
            {activity.slice(0, 8).map((a) => (
              <div key={a.id} className="text-xs pb-2.5 border-b last:border-0 break-words" style={{ borderColor: C.line, color: C.text }}>
                {a.msg}
                <div className="text-[10px] mt-0.5" style={{ color: C.textSoft }}>{timeAgo(a.time)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {criticalList.length > 0 && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border shadow-sm" style={{ borderColor: C.line }}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3" style={{ color: C.critical }}>
            <AlertTriangle size={16} /> Needs Attention ({criticalList.length})
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {criticalList.map((h) => (
              <button key={h.id} onClick={() => onOpenHospital(h)} className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-left" style={{ background: `${C.critical}0D` }}>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: C.text }}>{h.name}</div>
                  <div className="text-[10px]" style={{ color: C.textSoft }}>{h.district} · only {h.availableBeds} of {h.totalBeds} beds free</div>
                </div>
                <ChevronRight size={14} className="shrink-0" style={{ color: C.critical }} />
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11px] text-center" style={{ color: C.textSoft }}>
        Admitted right now: <b>{admittedCount}</b> patients · Teleconsultations logged: <b>{teleconsults.length}</b>
        {teleconsults.length > 0 && (
          <> ({pendingCallCount} waiting · {teleconsults.filter((t) => t.status === "Connected").length} connected · {teleconsults.filter((t) => t.status === "Completed").length} completed)</>
        )}
      </p>
    </div>
  );
}

/* ============================== ADMIN: HOSPITAL GRID ================================= */

function AdminGrid({ hospitals, onOpen, onAddNew }) {
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const types = ["All", ...new Set(hospitals.map((h) => h.type))];

  const filtered = hospitals.filter((h) => {
    const matchQ = (h.name + h.district).toLowerCase().includes(q.toLowerCase());
    const matchType = filterType === "All" || h.type === filterType;
    const matchStatus = filterStatus === "All" || getStatus(h) === filterStatus;
    return matchQ && matchType && matchStatus;
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white flex-1 min-w-[160px]" style={{ borderColor: C.line }}>
          <Search size={15} style={{ color: C.textSoft }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hospital or district…" className="text-sm outline-none w-full bg-transparent" style={{ color: C.text }} />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-xs border rounded-xl px-3 py-2.5 bg-white outline-none" style={{ borderColor: C.line, color: C.text }}>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs border rounded-xl px-3 py-2.5 bg-white outline-none" style={{ borderColor: C.line, color: C.text }}>
          {["All", "available", "moderate", "critical"].map((s) => <option key={s} value={s}>{s === "All" ? "All Status" : STATUS_LABEL[s]}</option>)}
        </select>
        <button onClick={onAddNew} className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl text-white shrink-0" style={{ background: C.ink }}>
          <Plus size={14} /> Add Institution
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((h) => {
          const st = getStatus(h);
          return (
            <button key={h.id} onClick={() => onOpen(h)} className="text-left bg-white rounded-2xl p-4 border shadow-sm hover:shadow-lg transition-shadow relative min-w-0" style={{ borderColor: C.line }}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: C.teal }}>{h.type}</span>
                <Badge status={st} />
              </div>
              <h4 className="font-bold text-sm mt-1.5 break-words" style={{ color: C.text }}>{h.name}</h4>
              <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: C.textSoft }}><MapPin size={11} className="shrink-0" /> {h.district}</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="rounded-lg p-2" style={{ background: C.bg }}>
                  <div className="text-sm font-extrabold" style={{ color: C.text }}>{h.availableBeds}/{h.totalBeds}</div>
                  <div className="text-[10px]" style={{ color: C.textSoft }}>beds free</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: C.bg }}>
                  <div className="text-sm font-extrabold" style={{ color: C.text }}>{h.doctorsOnDuty}/{h.totalDoctors}</div>
                  <div className="text-[10px]" style={{ color: C.textSoft }}>doctors</div>
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-sm col-span-full text-center py-10" style={{ color: C.textSoft }}>No institutions match your filters.</p>}
      </div>
    </div>
  );
}

/* ============================== ADMIN: PATIENTS REGISTRY ================================= */

function AdminPatients({ patients, hospitals, onOpenPatient }) {
  const [q, setQ] = useState("");
  const filtered = patients.filter((p) =>
    [p.name, p.aadhar, p.contact, p.village, p.district, p.post, p.ps, p.code].join(" ").toLowerCase().includes(q.toLowerCase())
  );
  const hospName = (id) => hospitals.find((h) => h.id === id)?.name || "—";

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white mb-5 max-w-md" style={{ borderColor: C.line }}>
        <Search size={15} style={{ color: C.textSoft }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, code, Aadhaar, village, contact…" className="text-sm outline-none w-full bg-transparent" style={{ color: C.text }} />
      </div>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: C.line }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr style={{ background: C.bg }}>
                {["Patient", "Code", "Aadhaar", "Village / Dist.", "Contact", "Hospital", "Request", "Patient Status", "Payment", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: C.textSoft }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => onOpenPatient(p)} className="border-t cursor-pointer hover:bg-[#F8FBFB]" style={{ borderColor: C.line }}>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: C.text }}>
                    {p.name}
                    {p.source === "self" && (
                      <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${C.teal}1A`, color: C.teal }}>SELF</span>
                    )}
                    <div className="font-normal text-[10px]" style={{ color: C.textSoft }}>{p.age}yr · {p.gender}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap" style={{ color: C.teal }}>{p.code}</td>
                  <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ color: C.textSoft }}>{maskAadhar(p.aadhar)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: C.text }}>{p.village}<div className="text-[10px]" style={{ color: C.textSoft }}>{p.district}</div></td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: C.text }}>{p.contact}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: C.text }}>{hospName(p.hospitalId)}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><ReqBadge status={p.requestStatus || "Approved"} /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><PatientStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><PayBadge status={p.paymentStatus} amount={p.paymentAmount} /></td>
                  <td className="px-4 py-3"><ChevronRight size={14} style={{ color: C.textSoft }} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-8" style={{ color: C.textSoft }}>No patients found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PatientModal({ patient, hospital, onClose, onDischarge, isAdmin, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  if (!patient) return null;
  const rows = [
    ["Full Name", patient.name], ["Patient Code", patient.code || "—"],
    ["Registered By", patient.source === "self" ? "Self (Patient Portal)" : "Admin / Hospital Staff"],
    ["Age / Gender", `${patient.age} yrs · ${patient.gender}`],
    ["Aadhaar No.", maskAadhar(patient.aadhar)], ["Village", patient.village],
    ["Post", patient.post], ["Police Station", patient.ps], ["District", patient.district],
    ["Contact No.", patient.contact], ["Reason", patient.reason || "—"],
    ["Hospital", hospital?.name || "—"], ["Admitted", timeAgo(patient.admitDate)],
  ];
  const isPending = (patient.requestStatus || "Approved") === "Pending";
  return (
    <Modal onClose={onClose} width="max-w-lg">
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: C.teal }}>{patient.name[0]}</div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold break-words" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>{patient.name}</h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <ReqBadge status={patient.requestStatus || "Approved"} />
                <PatientStatusBadge status={patient.status} />
                <PayBadge status={patient.paymentStatus} amount={patient.paymentAmount} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0"><X size={20} style={{ color: C.textSoft }} /></button>
        </div>

        {patient.requestStatus === "Rejected" && patient.rejectReason && (
          <div className="rounded-xl p-3 mb-4 text-xs font-medium break-words" style={{ background: `${C.critical}0D`, color: C.critical }}>
            Rejected reason: {patient.rejectReason}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          {rows.map(([label, val]) => (
            <div key={label} className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.textSoft }}>{label}</div>
              <div className="text-sm font-medium break-words" style={{ color: label === "Patient Code" ? C.teal : C.text }}>{val}</div>
            </div>
          ))}
        </div>

        {isAdmin && isPending && !rejecting && (
          <div className="flex items-center gap-2 mt-6 flex-wrap">
            <button onClick={() => onApprove(patient.id)} className="flex-1 min-w-[140px] py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-1.5" style={{ background: C.available }}>
              <CheckCircle2 size={15} /> Approve &amp; Admit
            </button>
            <button onClick={() => setRejecting(true)} className="flex-1 min-w-[140px] py-2.5 rounded-xl font-semibold text-sm border-2 flex items-center justify-center gap-1.5" style={{ borderColor: C.critical, color: C.critical }}>
              <XCircle size={15} /> Reject
            </button>
          </div>
        )}
        {isAdmin && isPending && rejecting && (
          <div className="mt-6">
            <Field label="Reason for rejection" icon={AlertTriangle}>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate request, wrong hospital…" />
            </Field>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => { if (reason.trim()) { onReject(patient.id, reason.trim()); } }}
                className="flex-1 min-w-[140px] py-2.5 rounded-xl font-semibold text-sm text-white"
                style={{ background: C.critical }}
              >
                Confirm Rejection
              </button>
              <button onClick={() => setRejecting(false)} className="flex-1 min-w-[140px] py-2.5 rounded-xl font-semibold text-sm border-2" style={{ borderColor: C.line, color: C.textSoft }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {isAdmin && patient.status === "Admitted" && (
          <button onClick={() => { onDischarge(patient.id); onClose(); }} className="w-full mt-6 py-2.5 rounded-xl font-semibold text-sm border-2" style={{ borderColor: C.available, color: C.available }}>
            Mark as Discharged
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ============================== ADMIN: TELECONSULT LOG & ALERTS ================================= */

function AdminTeleconsult({ teleconsults, hospitals, onMarkConnected, onMarkComplete }) {
  const hospName = (id) => hospitals.find((h) => h.id === id)?.name || "—";
  return (
    <div className="p-4 sm:p-8">
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: C.line }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead><tr style={{ background: C.bg }}>{["Caller", "Contact", "Hospital", "Status", "Requested", ""].map((h) => <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: C.textSoft }}>{h}</th>)}</tr></thead>
            <tbody>
              {teleconsults.map((t) => (
                <tr key={t.id} className="border-t" style={{ borderColor: C.line }}>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: C.text }}>{t.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: C.textSoft }}>{t.contact}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: C.text }}>{hospName(t.hospitalId)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 rounded-full text-[10px] font-semibold" style={{
                      background: t.status === "Waiting" ? `${C.moderate}1A` : t.status === "Connected" ? `${C.info}1A` : `${C.available}1A`,
                      color: t.status === "Waiting" ? C.moderate : t.status === "Connected" ? C.info : C.available,
                    }}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: C.textSoft }}>{timeAgo(t.time)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {t.status === "Waiting" && (
                      <button onClick={() => onMarkConnected(t.id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: C.teal }}>Connect</button>
                    )}
                    {t.status === "Connected" && (
                      <button onClick={() => onMarkComplete(t.id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white flex items-center gap-1" style={{ background: C.critical }}>
                        <PhoneOff size={11} /> End Call
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {teleconsults.length === 0 && <tr><td colSpan={6} className="text-center py-8" style={{ color: C.textSoft }}>No teleconsultation requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PatientCodeLookup({ patients, onOpenPatient }) {
  const [codeInput, setCodeInput] = useState("");
  const [codeErr, setCodeErr] = useState("");

  function verifyCode(e) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    const norm = codeInput.trim().toLowerCase().replace(/\s+/g, "");
    const found = patients.find((p) => (p.code || "").toLowerCase().replace(/\s+/g, "") === norm);
    if (!found) {
      setCodeErr("No patient found with this code. Data syncs live — ask the patient to confirm the code, or check spelling/dashes.");
      return;
    }
    setCodeErr("");
    onOpenPatient(found);
    setCodeInput("");
  }

  return (
    <div className="rounded-2xl p-4 sm:p-5 border shadow-sm relative overflow-hidden" style={{ borderColor: C.line, background: `linear-gradient(120deg, ${C.tealDark}, ${C.teal})` }}>
      <div className="flex items-start gap-2.5 mb-1">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
          <KeyRound size={18} color="#fff" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-white">Doctor Patient Lookup</h3>
          <p className="text-[11px]" style={{ color: "#D9F2EF" }}>Enter the patient's code to instantly verify, view full details, and approve or reject</p>
        </div>
      </div>
      <form onSubmit={verifyCode} className="flex items-center gap-2 mt-4 bg-white rounded-xl p-1.5 flex-wrap sm:flex-nowrap">
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="e.g. SG-482913"
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent px-2.5 py-1.5"
          style={{ color: C.text }}
        />
        <button type="submit" className="text-xs font-semibold px-4 py-2 rounded-lg text-white flex items-center gap-1.5 shrink-0" style={{ background: C.ink }}>
          <Search size={13} /> Verify
        </button>
      </form>
      {codeErr && <p className="text-xs mt-2 font-medium" style={{ color: "#FFD7D7" }}>{codeErr}</p>}
    </div>
  );
}

function NewArrivalsPanel({ patients, hospitals, onOpenPatient, onApprove, onReject }) {
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");

  const arrivals = useMemo(
    () =>
      patients
        .filter((p) => p.source === "self")
        .sort((a, b) => new Date(b.admitDate) - new Date(a.admitDate)),
    [patients]
  );

  const byDistrict = useMemo(() => {
    const map = {};
    arrivals.forEach((p) => {
      (map[p.district] = map[p.district] || []).push(p);
    });
    return map;
  }, [arrivals]);

  const hospName = (id) => hospitals.find((h) => h.id === id)?.name || "—";
  const pendingCount = arrivals.filter((p) => p.requestStatus === "Pending").length;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border shadow-sm" style={{ borderColor: C.line }}>
      <h3 className="font-bold text-sm flex items-center gap-2 mb-1" style={{ color: C.teal }}>
        <UserPlus size={16} /> Self-Registered Patient Requests ({pendingCount} pending)
      </h3>
      <p className="text-[11px] mb-4" style={{ color: C.textSoft }}>
        Patients who registered themselves via the Patient Portal, grouped by district. Approve to allot a bed, or reject with a reason.
      </p>

      <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
        {Object.keys(byDistrict).length === 0 && (
          <p className="text-xs italic" style={{ color: C.textSoft }}>No self-registered patients yet.</p>
        )}
        {Object.entries(byDistrict).map(([district, list]) => (
          <div key={district}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <MapPin size={12} style={{ color: C.teal }} />
              <span className="text-xs font-bold" style={{ color: C.text }}>{district}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${C.teal}1A`, color: C.teal }}>
                {list.length}
              </span>
            </div>
            <div className="space-y-2">
              {list.map((p) => (
                <div key={p.id} className="rounded-xl relative" style={{ background: p.requestStatus === "Pending" ? `${C.moderate}0D` : `${C.teal}0D` }}>
                  <button
                    onClick={() => onOpenPatient(p)}
                    className="w-full text-left flex items-center justify-between gap-2 px-3 py-2.5"
                  >
                    {p.requestStatus === "Pending" && (
                      <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full animate-ping" style={{ background: C.moderate }} />
                    )}
                    <div className="pr-4 min-w-0">
                      <div className="text-xs font-semibold flex items-center gap-1.5 flex-wrap" style={{ color: C.text }}>
                        {p.name} <span className="font-normal" style={{ color: C.textSoft }}>· {p.age}{p.gender[0]}</span>
                        <ReqBadge status={p.requestStatus} />
                      </div>
                      <div className="text-[10px] mt-0.5 break-words" style={{ color: C.textSoft }}>{p.reason || "No reason given"} · {hospName(p.hospitalId)}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-mono font-semibold" style={{ color: C.teal }}>Code: {p.code}</span>
                        <PayBadge status={p.paymentStatus} amount={p.paymentAmount} />
                      </div>
                    </div>
                    <span className="text-[10px] whitespace-nowrap shrink-0" style={{ color: C.textSoft }}>{timeAgo(p.admitDate)}</span>
                  </button>
                  {p.requestStatus === "Pending" && rejectingId !== p.id && (
                    <div className="flex items-center gap-2 px-3 pb-2.5 flex-wrap">
                      <button onClick={() => onApprove(p.id)} className="flex-1 min-w-[100px] py-1.5 rounded-lg text-[11px] font-semibold text-white flex items-center justify-center gap-1" style={{ background: C.available }}>
                        <CheckCircle2 size={12} /> Approve
                      </button>
                      <button onClick={() => { setRejectingId(p.id); setReason(""); }} className="flex-1 min-w-[100px] py-1.5 rounded-lg text-[11px] font-semibold border-2 flex items-center justify-center gap-1" style={{ borderColor: C.critical, color: C.critical }}>
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  )}
                  {rejectingId === p.id && (
                    <div className="px-3 pb-2.5">
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason for rejection…"
                        className="w-full text-xs border rounded-lg px-2.5 py-1.5 outline-none mb-1.5 bg-white"
                        style={{ borderColor: C.line, color: C.text }}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => { if (reason.trim()) { onReject(p.id, reason.trim()); setRejectingId(null); } }}
                          className="flex-1 min-w-[100px] py-1.5 rounded-lg text-[11px] font-semibold text-white"
                          style={{ background: C.critical }}
                        >
                          Confirm
                        </button>
                        <button onClick={() => setRejectingId(null)} className="flex-1 min-w-[100px] py-1.5 rounded-lg text-[11px] font-semibold border-2" style={{ borderColor: C.line, color: C.textSoft }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingCallsPanel({ teleconsults, hospitals, onMarkConnected }) {
  const hospName = (id) => hospitals.find((h) => h.id === id)?.name || "—";
  const waiting = useMemo(
    () => teleconsults.filter((t) => t.status === "Waiting").sort((a, b) => new Date(a.time) - new Date(b.time)),
    [teleconsults]
  );
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border shadow-sm" style={{ borderColor: C.line }}>
      <h3 className="font-bold text-sm flex items-center gap-2 mb-1" style={{ color: C.moderate }}>
        <Video size={16} /> Pending Teleconsultation Requests ({waiting.length} waiting)
      </h3>
      <p className="text-[11px] mb-4" style={{ color: C.textSoft }}>
        Patients waiting to be connected via IT Phone / video link. Connect them as soon as a doctor is free.
      </p>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {waiting.length === 0 && <p className="text-xs italic" style={{ color: C.textSoft }}>No teleconsultation requests waiting right now.</p>}
        {waiting.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl" style={{ background: `${C.moderate}0D` }}>
            <div className="min-w-0">
              <div className="text-xs font-semibold" style={{ color: C.text }}>{t.name} <span className="font-normal" style={{ color: C.textSoft }}>· {t.contact}</span></div>
              <div className="text-[10px] mt-0.5" style={{ color: C.textSoft }}>{hospName(t.hospitalId)} · {timeAgo(t.time)}</div>
            </div>
            <button onClick={() => onMarkConnected(t.id)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white shrink-0" style={{ background: C.teal }}>Connect</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminAlerts({ hospitals, patients, teleconsults, onOpen, onOpenPatient, onApprove, onReject, onMarkConnected }) {
  const bedAlerts = hospitals.filter((h) => getStatus(h) === "critical");
  const doctorAlerts = hospitals.filter((h) => h.doctorsOnDuty <= 2);
  return (
    <div className="p-4 sm:p-8 space-y-5">
      <PatientCodeLookup patients={patients} onOpenPatient={onOpenPatient} />
      <NewArrivalsPanel patients={patients} hospitals={hospitals} onOpenPatient={onOpenPatient} onApprove={onApprove} onReject={onReject} />
      <PendingCallsPanel teleconsults={teleconsults} hospitals={hospitals} onMarkConnected={onMarkConnected} />

      <div className="bg-white rounded-2xl p-4 sm:p-5 border shadow-sm" style={{ borderColor: C.line }}>
        <h3 className="font-bold text-sm flex items-center gap-2 mb-3" style={{ color: C.critical }}><Bed size={16} /> Bed Capacity Alerts ({bedAlerts.length})</h3>
        <div className="space-y-2">
          {bedAlerts.map((h) => (
            <button key={h.id} onClick={() => onOpen(h)} className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-left" style={{ background: `${C.critical}0D` }}>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: C.text }}>{h.name}</div>
                <div className="text-[10px]" style={{ color: C.textSoft }}>{h.district} · only {h.availableBeds} of {h.totalBeds} beds free</div>
              </div>
              <ChevronRight size={14} className="shrink-0" style={{ color: C.critical }} />
            </button>
          ))}
          {bedAlerts.length === 0 && <p className="text-xs italic" style={{ color: C.textSoft }}>No critical bed shortages right now.</p>}
        </div>
      </div>
      <div className="bg-white rounded-2xl p-4 sm:p-5 border shadow-sm" style={{ borderColor: C.line }}>
        <h3 className="font-bold text-sm flex items-center gap-2 mb-3" style={{ color: C.moderate }}><Stethoscope size={16} /> Doctor Shortage Alerts ({doctorAlerts.length})</h3>
        <div className="space-y-2">
          {doctorAlerts.map((h) => (
            <button key={h.id} onClick={() => onOpen(h)} className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-left" style={{ background: `${C.moderate}0D` }}>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: C.text }}>{h.name}</div>
                <div className="text-[10px]" style={{ color: C.textSoft }}>{h.district} · only {h.doctorsOnDuty} doctor(s) on duty</div>
              </div>
              <ChevronRight size={14} className="shrink-0" style={{ color: C.moderate }} />
            </button>
          ))}
          {doctorAlerts.length === 0 && <p className="text-xs italic" style={{ color: C.textSoft }}>No doctor shortages right now.</p>}
        </div>
      </div>
    </div>
  );
}

/* ============================== USER: FIND HOSPITAL ================================= */

function UserFind({ hospitals, onOpen, onBookCall }) {
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("All");
  const districts = ["All", ...new Set(hospitals.map((h) => h.district))];

  const filtered = hospitals.filter((h) => {
    const matchQ = (h.name + h.district).toLowerCase().includes(q.toLowerCase());
    const matchD = district === "All" || h.district === district;
    return matchQ && matchD;
  });

  const best = useMemo(() => {
    const pool = district === "All" ? hospitals : hospitals.filter((h) => h.district === district);
    return [...pool].sort((a, b) => (b.availableBeds / b.totalBeds + b.doctorsOnDuty / b.totalDoctors) - (a.availableBeds / a.totalBeds + a.doctorsOnDuty / a.totalDoctors))[0];
  }, [hospitals, district]);

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white flex-1 min-w-[160px]" style={{ borderColor: C.line }}>
          <Search size={15} style={{ color: C.textSoft }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hospital or district…" className="text-sm outline-none w-full bg-transparent" style={{ color: C.text }} />
        </div>
        <select value={district} onChange={(e) => setDistrict(e.target.value)} className="text-xs border rounded-xl px-3 py-2.5 bg-white outline-none" style={{ borderColor: C.line, color: C.text }}>
          {districts.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {best && (
        <button onClick={() => onOpen(best)} className="w-full text-left mb-6 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 text-white" style={{ background: `linear-gradient(120deg, ${C.tealDark}, ${C.teal})` }}>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: "#D9F2EF" }}><Activity size={12} /> AI Recommended · Best availability</span>
            <div className="text-lg font-bold mt-1 truncate" style={{ fontFamily: "Poppins, sans-serif" }}>{best.name}</div>
            <div className="text-xs mt-0.5" style={{ color: "#D9F2EF" }}>{best.availableBeds} beds free · {best.doctorsOnDuty} doctors on duty · {best.district}</div>
          </div>
          <ChevronRight size={22} className="shrink-0" />
        </button>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((h) => {
          const st = getStatus(h);
          return (
            <div key={h.id} className="bg-white rounded-2xl p-4 border shadow-sm min-w-0" style={{ borderColor: C.line }}>
              <div onClick={() => onOpen(h)} className="cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: C.teal }}>{h.type}</span>
                  <Badge status={st} />
                </div>
                <h4 className="font-bold text-sm mt-1.5 break-words" style={{ color: C.text }}>{h.name}</h4>
                <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: C.textSoft }}><MapPin size={11} className="shrink-0" /> {h.district}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="rounded-lg p-2" style={{ background: C.bg }}>
                    <div className="text-sm font-extrabold" style={{ color: C.text }}>{h.availableBeds}</div>
                    <div className="text-[10px]" style={{ color: C.textSoft }}>beds free</div>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: C.bg }}>
                    <div className="text-sm font-extrabold" style={{ color: C.text }}>{h.doctorsOnDuty}</div>
                    <div className="text-[10px]" style={{ color: C.textSoft }}>doctors</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                <button onClick={() => onBookCall(h)} className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-white" style={{ background: C.ink }}>
                  <Video size={13} /> Teleconsult
                </button>
                <a href={`tel:${h.contact}`} className="py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border-2 shrink-0" style={{ borderColor: C.teal, color: C.teal }}>
                  <Phone size={13} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== USER: HELPLINE / CONTACT DIRECTORY ================================= */

function UserContacts({ hospitals }) {
  const [q, setQ] = useState("");
  const byDistrict = useMemo(() => {
    const map = {};
    hospitals
      .filter((h) => (h.name + h.district).toLowerCase().includes(q.toLowerCase()))
      .forEach((h) => { (map[h.district] = map[h.district] || []).push(h); });
    return map;
  }, [hospitals, q]);

  return (
    <div className="p-4 sm:p-8">
      <div className="rounded-2xl p-4 sm:p-5 mb-5 text-white" style={{ background: `linear-gradient(120deg, ${C.tealDark}, ${C.teal})` }}>
        <h3 className="font-bold text-sm flex items-center gap-2"><HelpCircle size={16} /> Not sure why your request hasn't moved?</h3>
        <p className="text-[11px] mt-1" style={{ color: "#D9F2EF" }}>Call your hospital directly using the numbers below — staff can tell you exactly why a registration is pending or was rejected.</p>
      </div>
      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white mb-5 max-w-md" style={{ borderColor: C.line }}>
        <Search size={15} style={{ color: C.textSoft }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hospital or district…" className="text-sm outline-none w-full bg-transparent" style={{ color: C.text }} />
      </div>
      <div className="space-y-5">
        {Object.entries(byDistrict).map(([district, list]) => (
          <div key={district}>
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin size={13} style={{ color: C.teal }} />
              <span className="text-sm font-bold" style={{ color: C.text }}>{district}</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {list.map((h) => (
                <a key={h.id} href={`tel:${h.contact}`} className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white border min-w-0" style={{ borderColor: C.line }}>
                  <div className="pr-2 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: C.text }}>{h.name}</div>
                    <div className="text-[10px]" style={{ color: C.textSoft }}>{h.type}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold whitespace-nowrap shrink-0" style={{ color: C.teal }}>
                    <Phone size={12} /> {h.contact}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(byDistrict).length === 0 && <p className="text-sm text-center py-10" style={{ color: C.textSoft }}>No institutions match "{q}".</p>}
      </div>
    </div>
  );
}

/* ============================== USER: MY CALLS ================================= */

function UserCalls({ teleconsults, hospitals, currentUser, onJoin }) {
  const mine = useMemo(() => {
    if (!currentUser) return [];
    return teleconsults.filter((t) => {
      if (currentUser.email && t.userEmail) return t.userEmail === currentUser.email;
      if (currentUser.contact) return t.contact === currentUser.contact;
      return false;
    });
  }, [teleconsults, currentUser]);
  const hospOf = (id) => hospitals.find((h) => h.id === id);
  return (
    <div className="p-4 sm:p-8">
      <div className="space-y-3 max-w-2xl">
        {mine.length === 0 && (
          <div className="bg-white rounded-2xl p-8 border text-center" style={{ borderColor: C.line }}>
            <Video size={28} className="mx-auto mb-2" style={{ color: C.textSoft }} />
            <p className="text-sm" style={{ color: C.textSoft }}>No teleconsultations booked yet. Find a hospital and tap "Teleconsult".</p>
          </div>
        )}
        {mine.map((t) => {
          const hosp = hospOf(t.hospitalId);
          return (
          <div key={t.id} className="bg-white rounded-2xl p-4 border shadow-sm flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: C.line }}>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate" style={{ color: C.text }}>{hosp?.name || "—"}</div>
              <div className="text-[11px] mt-0.5" style={{ color: C.textSoft }}>Requested {timeAgo(t.time)}</div>
              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{
                background: t.status === "Waiting" ? `${C.moderate}1A` : t.status === "Connected" ? `${C.info}1A` : `${C.available}1A`,
                color: t.status === "Waiting" ? C.moderate : t.status === "Connected" ? C.info : C.available,
              }}>{t.status}</span>
            </div>
            {t.status !== "Completed" && (
              <a
                href={`tel:${hosp?.contact || ""}`}
                onClick={() => onJoin(t)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl text-white shrink-0"
                style={{ background: C.teal }}
              >
                <Video size={13} /> Join Call
              </a>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== USER: MY REGISTRATION ================================= */

function EditPatientForm({ patient, onSave, onCancel }) {
  const [name, setName] = useState(patient.name);
  const [reason, setReason] = useState(patient.reason);
  const remaining = MAX_FREE_EDITS - (patient.editCount || 0);
  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: C.line }}>
      <Field label="Full Name" icon={User}><Input value={name} onChange={(e) => setName(capitalizeWords(e.target.value))} /></Field>
      <Field label="Reason / Symptoms" icon={Stethoscope}><Input value={reason} onChange={(e) => setReason(capitalizeWords(e.target.value))} /></Field>
      <p className="text-[11px] mb-3" style={{ color: C.textSoft }}>No extra fee for corrections — {remaining} free edit{remaining === 1 ? "" : "s"} remaining after this one is used.</p>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => onSave(name.trim() || patient.name, reason.trim())} className="flex-1 min-w-[120px] py-2 rounded-xl text-xs font-semibold text-white" style={{ background: C.teal }}>Save Correction</button>
        <button onClick={onCancel} className="flex-1 min-w-[120px] py-2 rounded-xl text-xs font-semibold border-2" style={{ borderColor: C.line, color: C.textSoft }}>Cancel</button>
      </div>
    </div>
  );
}

function UserMyRegistration({ patients, hospitals, currentUser, onEdit }) {
  const [editingId, setEditingId] = useState(null);
  const mine = useMemo(() => {
    if (!currentUser) return [];
    return [...patients]
      .filter((p) => {
        if (currentUser.email && p.userEmail) return p.userEmail === currentUser.email;
        if (currentUser.contact) return p.contact === currentUser.contact;
        return false;
      })
      .sort((a, b) => new Date(b.admitDate) - new Date(a.admitDate));
  }, [patients, currentUser]);
  const hospName = (id) => hospitals.find((h) => h.id === id);

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      {mine.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border text-center" style={{ borderColor: C.line }}>
          <ClipboardList size={28} className="mx-auto mb-2" style={{ color: C.textSoft }} />
          <p className="text-sm" style={{ color: C.textSoft }}>You haven't registered as a patient yet. Go to "Register as Patient" to get a bed allotted.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mine.map((p) => {
            const hospital = hospName(p.hospitalId);
            const reqStatus = p.requestStatus || "Approved";
            const editsUsed = p.editCount || 0;
            const canEdit = p.source === "self" && reqStatus !== "Rejected" && editsUsed < MAX_FREE_EDITS;
            return (
              <div key={p.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: C.line }}>
                <div className="flex items-center justify-between gap-2 px-5 py-4 flex-wrap" style={{ background: C.tealLight }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <KeyRound size={16} style={{ color: C.tealDark }} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.tealDark }}>Your Patient Code</div>
                      <div className="text-lg font-extrabold tracking-wider truncate" style={{ color: C.teal, fontFamily: "Poppins, sans-serif" }}>{p.code}</div>
                    </div>
                  </div>
                  <ReqBadge status={reqStatus} />
                </div>

                {reqStatus === "Pending" && (
                  <div className="px-5 py-3 text-xs flex items-start gap-2" style={{ background: `${C.moderate}0D`, color: C.moderate }}>
                    <Clock size={14} className="mt-0.5 shrink-0" />
                    <span>Your request is with hospital staff for review. Bed will be allotted once approved — this usually takes a little while. Call the hospital if it's urgent: <a href={`tel:${hospital?.contact}`} className="font-bold underline">{hospital?.contact}</a></span>
                  </div>
                )}
                {reqStatus === "Rejected" && (
                  <div className="px-5 py-3 text-xs flex items-start gap-2" style={{ background: `${C.critical}0D`, color: C.critical }}>
                    <XCircle size={14} className="mt-0.5 shrink-0" />
                    <span>Not admitted — reason given: <b>{p.rejectReason || "No reason given"}</b>. Call the hospital to discuss or re-register: <a href={`tel:${hospital?.contact}`} className="font-bold underline">{hospital?.contact}</a></span>
                  </div>
                )}

                <div className="p-5">
                  <h3 className="text-sm font-bold" style={{ color: C.text }}>{p.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>{p.age} yrs · {p.gender} · {p.village}, {p.district}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl p-3 min-w-0" style={{ background: C.bg }}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.textSoft }}>Hospital</div>
                      <div className="text-xs font-semibold mt-0.5 break-words" style={{ color: C.text }}>{hospital?.name || "—"}</div>
                    </div>
                    <div className="rounded-xl p-3 min-w-0" style={{ background: C.bg }}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.textSoft }}>Reason</div>
                      <div className="text-xs font-semibold mt-0.5 break-words" style={{ color: C.text }}>{p.reason || "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <PayBadge status={p.paymentStatus} amount={p.paymentAmount} />
                    <span className="text-[11px]" style={{ color: C.textSoft }}>Registered {timeAgo(p.admitDate)}</span>
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: C.textSoft }}>Show your code at the reception or to the duty doctor for quick verification.</p>

                  {editingId === p.id ? (
                    <EditPatientForm
                      patient={p}
                      onCancel={() => setEditingId(null)}
                      onSave={(name, reason) => { onEdit(p.id, name, reason); setEditingId(null); }}
                    />
                  ) : (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between flex-wrap gap-2" style={{ borderColor: C.line }}>
                      {p.source === "self" ? (
                        canEdit ? (
                          <button onClick={() => setEditingId(p.id)} className="text-xs font-semibold flex items-center gap-1.5" style={{ color: C.teal }}>
                            <Edit3 size={13} /> Correct name / reason ({MAX_FREE_EDITS - editsUsed} free edit{MAX_FREE_EDITS - editsUsed === 1 ? "" : "s"} left)
                          </button>
                        ) : (
                          <span className="text-[11px]" style={{ color: C.textSoft }}>
                            {reqStatus === "Rejected" ? "Editing closed — this request was rejected." : "Free edit limit reached for this registration."}
                          </span>
                        )
                      ) : <span />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================== USER: REGISTER ================================= */

function UserRegister({ hospitals, currentUser, onRegistered }) {
  const [done, setDone] = useState(null);
  const doneHospital = done ? hospitals.find((h) => h.id === done.hospitalId) : null;

  function handleDone(patient) {
    setDone(patient);
    onRegistered(patient);
  }

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      {done ? (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border text-center shadow-sm" style={{ borderColor: C.line }}>
          <Clock size={36} className="mx-auto mb-3" style={{ color: C.moderate }} />
          <h3 className="font-bold text-lg" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>Request Submitted — Awaiting Approval</h3>
          <p className="text-xs mt-2" style={{ color: C.textSoft }}>Hospital staff will review and admit you shortly. Save this code — it's how the duty doctor verifies your registration.</p>
          <div className="mt-3 mx-auto max-w-xs rounded-2xl p-4" style={{ background: C.tealLight }}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <KeyRound size={16} style={{ color: C.tealDark }} />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.tealDark }}>Your Patient Code</span>
            </div>
            <div className="text-3xl font-extrabold tracking-wider break-words" style={{ color: C.teal, fontFamily: "Poppins, sans-serif" }}>{done.code}</div>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-3 text-xs font-medium flex-wrap" style={{ color: C.textSoft }}>
            <Clock size={12} style={{ color: C.teal }} />
            Registered on {new Date(done.admitDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} at {new Date(done.admitDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <PayBadge status="Paid" amount={REGISTRATION_FEE} />
            <span className="text-[11px]" style={{ color: C.textSoft }}>Bihar Govt OPD registration receipt</span>
          </div>
          {doneHospital && (
            <p className="text-[11px] mt-3" style={{ color: C.textSoft }}>Questions or urgent? Call {doneHospital.name}: <a href={`tel:${doneHospital.contact}`} className="font-bold" style={{ color: C.teal }}>{doneHospital.contact}</a></p>
          )}
          <p className="text-[11px] mt-1" style={{ color: C.textSoft }}>Track live status anytime under "My Registration".</p>
          <button onClick={() => setDone(null)} className="mt-5 text-xs font-semibold px-4 py-2 rounded-xl border-2" style={{ borderColor: C.teal, color: C.teal }}>Register another patient</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 sm:p-7 border shadow-sm" style={{ borderColor: C.line }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>Register as Patient</h2>
          <p className="text-xs mb-5" style={{ color: C.textSoft }}>Submit your details — hospital staff will review and confirm your bed. A small government registration fee applies, paid securely via Razorpay.</p>
          <AdmitInline hospitals={hospitals} prefill={currentUser} onDone={handleDone} />
        </div>
      )}
    </div>
  );
}

function AdmitInline({ hospitals, prefill, onDone }) {
  const [step, setStep] = useState("form"); // form -> pay
  const [form, setForm] = useState({
    name: prefill?.name || "", age: "", gender: "Male", aadhar: "",
    village: "", post: "", ps: "", contact: prefill?.contact || "",
    reason: "", hospitalId: hospitals[0]?.id || "",
  });
  const [err, setErr] = useState("");
  const [paying, setPaying] = useState(false);

  const NO_CAPS_ADMIT = ["age", "gender", "aadhar", "contact", "hospitalId"];
  function set(k, v) { setForm((f) => ({ ...f, [k]: NO_CAPS_ADMIT.includes(k) ? v : capitalizeWords(v) })); }

  function continueToPay(e) {
    e.preventDefault();
    if (!form.name || !form.age || form.aadhar.length !== 12 || form.contact.length !== 10 || !form.village || !form.post || !form.ps) {
      setErr("Please fill all fields correctly — Aadhaar must be 12 digits, Contact 10 digits.");
      return;
    }
    setErr("");
    setStep("pay");
  }

  // Opens Razorpay Checkout for the ₹5 OPD fee. The backend re-verifies the
  // payment signature before creating the patient record — see
  // /api/patients/register-self in the backend.
  async function payAndSubmit() {
    setErr("");
    if (!window.Razorpay) {
      setErr("Payment could not load. Check your internet connection and try again.");
      return;
    }
    setPaying(true);
    try {
      const order = await apiFetch("/payments/create-order", {
        method: "POST",
        body: JSON.stringify({ amount: REGISTRATION_FEE }),
      });

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "SanjeevaniGrid",
        description: "Bihar Govt OPD Registration Fee",
        prefill: { name: form.name, contact: form.contact },
        theme: { color: "#0E7C7B" },
        handler: async function (response) {
          try {
            const patient = await apiFetch("/patients/register-self", {
              method: "POST",
              body: JSON.stringify({
                ...form,
                userEmail: prefill?.email || "",
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            onDone({ ...withId(patient), admitDate: new Date(patient.admitDate) });
          } catch (e) {
            setErr(
              (e.message || "Registration failed after payment.") +
              ` Please contact the hospital with your payment ID: ${response.razorpay_payment_id}`
            );
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on("payment.failed", () => setPaying(false));
      rzp.open();
    } catch (e) {
      setErr(e.message || "Could not start payment. Please try again.");
      setPaying(false);
    }
  }

  if (step === "pay") {
    const hospital = hospitals.find((h) => h.id === form.hospitalId);
    return (
      <div>
        <div className="rounded-2xl p-5 mb-4" style={{ background: C.bg }}>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={16} style={{ color: C.teal }} />
            <h3 className="text-sm font-bold" style={{ color: C.text }}>Bihar Govt OPD Registration Receipt</h3>
          </div>
          <div className="flex items-center justify-between text-sm mb-1" style={{ color: C.text }}>
            <span>Registration fee</span>
            <span className="font-bold flex items-center gap-0.5"><IndianRupee size={13} />{REGISTRATION_FEE}</span>
          </div>
          <p className="text-[11px]" style={{ color: C.textSoft }}>One-time fee for {hospital?.name || "the selected hospital"}. Paid securely via Razorpay — covers your OPD receipt and doctor verification code, no charge for later spelling / reason corrections.</p>
        </div>
        {err && <p className="text-xs mb-2 font-medium" style={{ color: C.critical }}>{err}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={payAndSubmit} disabled={paying} className="flex-1 min-w-[200px] py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-1.5 disabled:opacity-60" style={{ background: C.teal }}>
            <IndianRupee size={14} /> {paying ? "Processing…" : `Pay ₹${REGISTRATION_FEE} & Submit Request`}
          </button>
          <button onClick={() => setStep("form")} disabled={paying} className="py-3 px-4 rounded-xl font-semibold text-sm border-2 disabled:opacity-60" style={{ borderColor: C.line, color: C.textSoft }}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={continueToPay}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Full Name" icon={User}><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Age" icon={Clock}><Input type="number" min="0" value={form.age} onChange={(e) => set("age", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Gender" icon={User}>
          <Select value={form.gender} onChange={(e) => set("gender", e.target.value)}><option>Male</option><option>Female</option><option>Other</option></Select>
        </Field>
        <Field label="Aadhaar No." icon={Fingerprint}><Input value={form.aadhar} maxLength={12} onChange={(e) => set("aadhar", e.target.value.replace(/\D/g, ""))} placeholder="12-digit" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Village" icon={Home}><Input value={form.village} onChange={(e) => set("village", e.target.value)} /></Field>
        <Field label="Post" icon={Landmark}><Input value={form.post} onChange={(e) => set("post", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Police Station (PS)" icon={Shield}><Input value={form.ps} onChange={(e) => set("ps", e.target.value)} /></Field>
        <Field label="Contact No." icon={Phone}><Input value={form.contact} maxLength={10} onChange={(e) => set("contact", e.target.value.replace(/\D/g, ""))} /></Field>
      </div>
      <Field label="Hospital / Health Centre" icon={Building2}>
        <Select value={form.hospitalId} onChange={(e) => set("hospitalId", e.target.value)}>
          {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.availableBeds} beds free)</option>)}
        </Select>
      </Field>
      <Field label="Reason / Symptoms" icon={Stethoscope}><Input value={form.reason} onChange={(e) => set("reason", e.target.value)} /></Field>
      {err && <p className="text-xs mb-2 font-medium" style={{ color: C.critical }}>{err}</p>}
      <button type="submit" className="w-full mt-3 py-3 rounded-xl font-semibold text-sm text-white" style={{ background: C.teal }}>Continue to Payment</button>
    </form>
  );
}

/* ============================== LIVE CLOCK WIDGET ================================= */

function LiveClockWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

  return (
    <div
      className="hidden md:flex fixed bottom-4 left-4 z-[70] items-center gap-3 rounded-2xl shadow-xl border pl-3 pr-4 py-2"
      style={{ background: "rgba(255,255,255,0.97)", borderColor: C.line, backdropFilter: "blur(6px)" }}
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.tealLight, color: C.teal }}>
        <Clock size={16} />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-extrabold tabular-nums" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>{timeStr}</div>
        <div className="text-[10px] font-medium" style={{ color: C.textSoft }}>{dateStr}</div>
      </div>
    </div>
  );
}

/* ============================== ROOT APP ================================= */

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [patients, setPatients] = useState([]);
  const [teleconsults, setTeleconsults] = useState([]);
  const [activity, setActivity] = useState([]);
  const ADMIN_TABS = ["overview", "grid", "patients", "teleconsult", "alerts"];
  const USER_TABS = ["find", "register", "calls", "myregistration", "contacts"];
  const [adminTab, setAdminTabState] = useState(() => {
    const saved = sessionStorage.getItem(TAB_KEY + "_admin");
    return ADMIN_TABS.includes(saved) ? saved : "overview";
  });
  const [userTab, setUserTabState] = useState(() => {
    const saved = sessionStorage.getItem(TAB_KEY + "_user");
    return USER_TABS.includes(saved) ? saved : "find";
  });
  function setAdminTab(t) { setAdminTabState(t); sessionStorage.setItem(TAB_KEY + "_admin", t); }
  function setUserTab(t) { setUserTabState(t); sessionStorage.setItem(TAB_KEY + "_user", t); }
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [selectedHospital, setSelectedHospital] = useState(null);
  const [admitTarget, setAdmitTarget] = useState(null);
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [toast, setToast] = useState(null);

  // Pending-alert count, used for the sidebar badge AND to trigger a short
  // device vibration (Android Chrome/Edge only — iOS Safari has no
  // Vibration API) whenever a NEW request comes in while an admin has the
  // tab open. prevPendingRef remembers the last count so we only vibrate on
  // increases, not on every 8s poll or when counts go down.
  const pendingCount = patients.filter((p) => p.requestStatus === "Pending").length + teleconsults.filter((t) => t.status === "Waiting").length;
  const prevPendingRef = useRef(0);
  useEffect(() => {
    if (currentUser?.role === "admin" && pendingCount > prevPendingRef.current) {
      vibrateAlert();
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount, currentUser]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 3200);
  }
  function logActivityLocal(msg, prevActivity) {
    return [{ id: Date.now() + Math.random(), msg, time: new Date() }, ...prevActivity].slice(0, 40);
  }
  function logActivity(msg) {
    setActivity((prev) => logActivityLocal(msg, prev));
  }

  useEffect(() => {
    if (document.getElementById("razorpay-checkout-script")) return;
    const script = document.createElement("script");
    script.id = "razorpay-checkout-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    (async () => {
      try { setHospitals(await fetchHospitals()); } catch (e) { showToast(e.message); }

      const token = getToken();
      if (token) {
        try {
          const me = await apiFetch("/auth/me");
          setCurrentUser({ role: me.role, name: me.name, email: me.email, contact: me.contact || "" });
        } catch (e) {
          clearToken();
        }
      }
      setAuthChecked(true);
    })();
  }, []);

  useEffect(() => {
    if (!currentUser) { setPatients([]); setTeleconsults([]); return; }
    (async () => {
      try {
        const [p, t] = await Promise.all([fetchPatients(), fetchTeleconsults()]);
        setPatients(p);
        setTeleconsults(t);
      } catch (e) {
        showToast(e.message);
      }
    })();
  }, [currentUser]);

  useEffect(() => {
    const iv = setInterval(async () => {
      try { setHospitals(await fetchHospitals()); } catch (e) { /* ignore transient errors */ }
      if (currentUser) {
        try {
          const [p, t] = await Promise.all([fetchPatients(), fetchTeleconsults()]);
          setPatients(p);
          setTeleconsults(t);
        } catch (e) { /* ignore transient errors */ }
      }
    }, 8000);
    return () => clearInterval(iv);
  }, [currentUser]);

  async function adjustHospital(hospitalId, field, delta) {
    try {
      const updated = await apiFetch(`/hospitals/${hospitalId}/adjust`, {
        method: "PATCH", body: JSON.stringify({ field, delta }),
      });
      setHospitals((prev) => prev.map((h) => (h.id === hospitalId ? withId(updated) : h)));
    } catch (e) { showToast(e.message); }
  }

  async function addHospital(data) {
    try {
      const created = await apiFetch("/hospitals", { method: "POST", body: JSON.stringify(data) });
      setHospitals((prev) => [withId(created), ...prev]);
      logActivity(`🏥 New institution added: ${data.name} (${data.district})`);
      showToast("Institution added successfully.");
      setShowAddHospital(false);
    } catch (e) { showToast(e.message); }
  }

  async function admitPatient(form) {
    try {
      const created = await apiFetch("/patients/admit", { method: "POST", body: JSON.stringify(form) });
      const patient = { ...withId(created), admitDate: new Date(created.admitDate) };
      setPatients((prev) => [patient, ...prev]);
      try { setHospitals(await fetchHospitals()); } catch (e) { /* ignore */ }
      logActivity(`🛏️ ${patient.name} admitted — bed count updated`);
      showToast(`Patient registered. Code: ${patient.code}`);
      setAdmitTarget(null);
      return patient;
    } catch (e) {
      showToast(e.message);
    }
  }

  async function approvePatient(patientId) {
    try {
      const updated = await apiFetch(`/patients/${patientId}/approve`, { method: "PATCH" });
      const patient = { ...withId(updated), admitDate: new Date(updated.admitDate) };
      setPatients((prev) => prev.map((p) => (p.id === patientId ? patient : p)));
      try { setHospitals(await fetchHospitals()); } catch (e) { /* ignore */ }
      logActivity(`✅ ${patient.name} approved & admitted — bed allotted`);
      showToast(`${patient.name} approved and admitted.`);
      setSelectedPatient(null);
    } catch (e) { showToast(e.message); }
  }

  async function rejectPatient(patientId, reason) {
    try {
      const updated = await apiFetch(`/patients/${patientId}/reject`, {
        method: "PATCH", body: JSON.stringify({ reason }),
      });
      const patient = { ...withId(updated), admitDate: new Date(updated.admitDate) };
      setPatients((prev) => prev.map((p) => (p.id === patientId ? patient : p)));
      logActivity(`🚫 ${patient.name}'s request rejected — ${reason}`);
      showToast("Request rejected.");
      setSelectedPatient(null);
    } catch (e) { showToast(e.message); }
  }

  async function editPatient(patientId, name, reason) {
    try {
      const updated = await apiFetch(`/patients/${patientId}/edit`, {
        method: "PATCH", body: JSON.stringify({ name, reason }),
      });
      const patient = { ...withId(updated), admitDate: new Date(updated.admitDate) };
      setPatients((prev) => prev.map((p) => (p.id === patientId ? patient : p)));
      logActivity("✏️ Registration corrected by patient (name/reason) — no extra fee");
      showToast("Correction saved — no extra fee charged.");
    } catch (e) { showToast(e.message); }
  }

  async function dischargePatient(patientId) {
    try {
      const updated = await apiFetch(`/patients/${patientId}/discharge`, { method: "PATCH" });
      const patient = { ...withId(updated), admitDate: new Date(updated.admitDate) };
      setPatients((prev) => prev.map((p) => (p.id === patientId ? patient : p)));
      try { setHospitals(await fetchHospitals()); } catch (e) { /* ignore */ }
      logActivity(`✅ ${patient.name} discharged — bed freed up`);
      showToast("Patient marked as discharged.");
    } catch (e) { showToast(e.message); }
  }

  async function bookCall(hospital) {
    try {
      const created = await apiFetch("/teleconsults", {
        method: "POST",
        body: JSON.stringify({
          name: currentUser.name,
          contact: currentUser.contact || "9800000000",
          userEmail: currentUser.email || "",
          hospitalId: hospital.id,
        }),
      });
      setTeleconsults((prev) => [{ ...withId(created), time: new Date(created.time) }, ...prev]);
      logActivity(`📞 Teleconsultation requested at ${hospital.name} by ${currentUser.name}`);
      showToast("Request sent — connecting via IT Phone / video link.");
    } catch (e) { showToast(e.message); }
  }

  async function markConnected(id) {
    try {
      const updated = await apiFetch(`/teleconsults/${id}/connect`, { method: "PATCH" });
      setTeleconsults((prev) => prev.map((t) => (t.id === id ? { ...withId(updated), time: new Date(updated.time) } : t)));
      logActivity(`📹 Teleconsultation ${id} connected`);
    } catch (e) { showToast(e.message); }
  }
  async function completeCall(id) {
    try {
      const updated = await apiFetch(`/teleconsults/${id}/complete`, { method: "PATCH" });
      setTeleconsults((prev) => prev.map((t) => (t.id === id ? { ...withId(updated), time: new Date(updated.time) } : t)));
      logActivity(`✔️ Teleconsultation ${id} completed`);
    } catch (e) { showToast(e.message); }
  }

  function handleRegistered(patient) {
    setPatients((prev) => [patient, ...prev]);
    logActivity(`🆕 New request in ${patient.district}: ${patient.name} — ${patient.reason || "no reason given"} · ₹${REGISTRATION_FEE} paid · Code: ${patient.code}`);
    showToast(`Request submitted — awaiting approval. Code: ${patient.code}`);
  }

  function handleLogout() {
    clearToken();
    setCurrentUser(null);
    setPatients([]);
    setTeleconsults([]);
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <p className="text-sm" style={{ color: C.textSoft }}>Loading…</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginScreen onLogin={setCurrentUser} />
        <LiveClockWidget />
      </>
    );
  }

  const isAdmin = currentUser.role === "admin";
  const tab = isAdmin ? adminTab : userTab;
  const setTab = isAdmin ? setAdminTab : setUserTab;

  const titleMap = isAdmin
    ? { overview: "Overview", grid: "Hospital Grid", patients: "Patients Registry", teleconsult: "Teleconsultation Log", alerts: "Alerts" }
    : { find: "Find a Hospital", register: "Register as Patient", calls: "My Teleconsultations", myregistration: "My Registration", contacts: "Helpline Directory" };
  const subMap = isAdmin
    ? { overview: "Live snapshot of Bihar's health infrastructure", grid: "All tracked institutions — tap any card for full detail", patients: "Every registered patient across the network", teleconsult: "Video / landline teleconsultation requests", alerts: "New requests, approvals & AI-flagged capacity issues" }
    : { find: "AI-matched beds & doctors near you", register: "Fill your details to submit an admission request", calls: "Your booked video consultations", myregistration: "Track your request status & patient code", contacts: "Call any hospital directly for status or help" };

  return (
    <>
      <div className="flex h-75 w-full overflow-hidden" style={{ background: C.bg, fontFamily: "Inter, sans-serif" }}>
        <style>{`@keyframes fadein{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
        <Sidebar role={currentUser.role} tab={tab} setTab={setTab} onLogout={handleLogout} name={currentUser.name} open={sidebarOpen} setOpen={setSidebarOpen} alertCount={isAdmin ? pendingCount : 0} />

        <div className="flex-1 min-w-0 w-full h-screen overflow-y-auto" style={{ paddingBottom: 84 }}>
          <Topbar
            title={titleMap[tab]}
            subtitle={subMap[tab]}
            onMenu={() => setSidebarOpen(true)}
            right={
              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0" style={{ background: C.tealLight, color: C.tealDark }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.available }} /> Live · {hospitals.length} institutions tracked
              </div>
            }
          />

          {isAdmin && tab === "overview" && <AdminOverview hospitals={hospitals} patients={patients} teleconsults={teleconsults} activity={activity} onOpenHospital={setSelectedHospital} />}
          {isAdmin && tab === "grid" && <AdminGrid hospitals={hospitals} onOpen={setSelectedHospital} onAddNew={() => setShowAddHospital(true)} />}
          {isAdmin && tab === "patients" && <AdminPatients patients={patients} hospitals={hospitals} onOpenPatient={setSelectedPatient} />}
          {isAdmin && tab === "teleconsult" && <AdminTeleconsult teleconsults={teleconsults} hospitals={hospitals} onMarkConnected={markConnected} onMarkComplete={completeCall} />}
          {isAdmin && tab === "alerts" && <AdminAlerts hospitals={hospitals} patients={patients} teleconsults={teleconsults} onOpen={setSelectedHospital} onOpenPatient={setSelectedPatient} onApprove={approvePatient} onReject={rejectPatient} onMarkConnected={markConnected} />}

          {!isAdmin && tab === "find" && <UserFind hospitals={hospitals} onOpen={setSelectedHospital} onBookCall={bookCall} />}
          {!isAdmin && tab === "register" && <UserRegister hospitals={hospitals} currentUser={currentUser} onRegistered={handleRegistered} />}
          {!isAdmin && tab === "calls" && <UserCalls teleconsults={teleconsults} hospitals={hospitals} currentUser={currentUser} onJoin={setActiveCall} />}
          {!isAdmin && tab === "myregistration" && <UserMyRegistration patients={patients} hospitals={hospitals} currentUser={currentUser} onEdit={editPatient} />}
          {!isAdmin && tab === "contacts" && <UserContacts hospitals={hospitals} />}
        </div>
      </div>

      {selectedHospital && (
        <HospitalModal
          hospital={hospitals.find((h) => h.id === selectedHospital.id) || selectedHospital}
          patients={patients}
          onClose={() => setSelectedHospital(null)}
          onAdjust={adjustHospital}
          isAdmin={isAdmin}
          onOpenAdmit={(h) => { setAdmitTarget(h); setSelectedHospital(null); }}
        />
      )}

      {admitTarget && (
        <AdmitForm hospitals={hospitals} presetHospitalId={admitTarget.id} prefill={currentUser} onClose={() => setAdmitTarget(null)} onSubmit={admitPatient} />
      )}

      {showAddHospital && <AddHospitalForm onClose={() => setShowAddHospital(false)} onSubmit={addHospital} />}

      {selectedPatient && (
        <PatientModal
          patient={patients.find((x) => x.id === selectedPatient.id) || selectedPatient}
          hospital={hospitals.find((h) => h.id === selectedPatient.hospitalId)}
          onClose={() => setSelectedPatient(null)}
          onDischarge={dischargePatient}
          isAdmin={isAdmin}
          onApprove={approvePatient}
          onReject={rejectPatient}
        />
      )}

      {activeCall && (
        <VideoCallModal entry={activeCall} hospital={hospitals.find((h) => h.id === activeCall.hospitalId)} onClose={() => setActiveCall(null)} onComplete={completeCall} />
      )}

      <Toast toast={toast} />
      <LiveClockWidget />
    </>
  );
}