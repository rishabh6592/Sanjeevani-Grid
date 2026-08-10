# SanjeevaniGrid — Bihar Health Resource Network

AI-tracked bed & doctor availability across Bihar's public hospitals (PMCH, medical
colleges, Sadar hospitals, CHC/PHC, Health & Wellness Centres), with a landline /
IT-phone style video teleconsultation flow, an admin console and a public/patient
dashboard.

## Features

- **Auth**: Admin login (ID containing `.admin`, e.g. `rajesh.admin`, or demo
  `admin` / `admin@123`) vs Patient/Public login (name + mobile number).
- **Admin dashboard**: KPI overview, AI occupancy trend + next-day forecast,
  live pulse grid of every institution, patients registry, teleconsultation
  log, bed/doctor shortage alerts, add new institutions.
- **User dashboard**: search/filter hospitals, AI "best match" suggestion,
  register as a patient (Aadhaar, village, post, PS, district, contact),
  book & join a simulated video teleconsultation.
- **Real-time-feel updates**: admitting/discharging a patient instantly
  updates bed counts everywhere; a background "AI Sync" tick simulates live
  monitoring; a live activity feed shows recent actions.
- 55+ seeded Bihar government health institutions across all 38 districts.

> Note: state lives in memory (React state) for this demo — refreshing the
> page resets data. Hook up a backend (Firebase/Supabase/Node+Postgres) to
> persist patients, hospitals and calls permanently.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (default `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

## Project structure

```
sanjeevanigrid/
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
├─ postcss.config.js
└─ src/
   ├─ main.jsx      # React entry point
   ├─ App.jsx        # Entire application (auth, admin & user dashboards)
   └─ index.css      # Tailwind entry
```

## Tech stack

- React 18 + Vite
- Tailwind CSS
- Recharts (occupancy trend / forecast / institution-mix charts)
- lucide-react (icons)
