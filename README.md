# SanjeevaniGrid — Bihar Health Resource Network

**Live:** [sanjeevani-grid-iota.vercel.app](https://sanjeevani-grid-iota.vercel.app/)

AI-tracked bed & doctor availability across Bihar's public hospitals (PMCH, medical colleges, Sadar hospitals, CHC/PHC, Health & Wellness Centres), with a video teleconsultation flow, an admin console, and a public/patient dashboard.

## What it does

- **Live bed & doctor tracking** across 55+ seeded Bihar government health institutions spanning all 38 districts.
- **Admin dashboard** — KPI overview, AI occupancy trend + next-day forecast, live pulse grid of every institution, patient registry, teleconsultation log, bed/doctor shortage alerts, and the ability to add new institutions.
- **Patient/public dashboard** — search & filter hospitals, get an AI "best match" suggestion, register as a patient (Aadhaar, village, post, PS, district, contact), and book/join a video teleconsultation.
- **Real-time-feel updates** — admitting/discharging a patient instantly updates bed counts everywhere; a background "AI Sync" tick simulates live monitoring; a live activity feed shows recent actions.
- **Auth** — admin login (ID containing `.admin`) vs. patient/public login (name + mobile), plus Google Sign-In and email/password on the backend.
- **Payments** — Razorpay integration for the ₹5 OPD registration fee (backend re-verifies the payment signature server-side).

## Tech stack

**Frontend**
- React 18 + Vite
- Tailwind CSS
- Recharts (occupancy trend / forecast / institution-mix charts)
- lucide-react (icons)

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- JWT auth (email/password) + Google OAuth (`google-auth-library`)
- Razorpay (payments)
- bcryptjs, cookie-parser, nodemailer, dotenv

## Getting started

### Frontend

```bash
cd sanjeevanigrid
npm install
npm run dev
```

Opens on `http://localhost:5173` by default.

Build for production:

```bash
npm run build
npm run preview
```

### Backend

```bash
cd sanjeevanigrid-backend
npm install
cp .env.example .env   # fill in the real values (see below)
npm run dev            # nodemon, auto-restarts on changes
# or: npm start
```
