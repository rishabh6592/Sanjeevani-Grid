# SanjeevaniGrid Backend

Node.js + Express + MongoDB backend for the SanjeevaniGrid React app —
adds real authentication (email/password + Google), MongoDB persistence,
and a real Razorpay payment gateway for the ₹5 OPD registration fee.

## 1. Install & Run

```bash
cd sanjeevanigrid-backend
npm install
cp .env.example .env      # then fill in the real values (see below)
npm run dev                # nodemon, auto-restarts on changes
# or: npm start
```

Server runs on `http://localhost:5000` by default.

## 2. MongoDB Setup (Atlas — free tier is fine)

1. Go to https://www.mongodb.com/cloud/atlas → create a free account → create a free (M0) cluster.
2. **Database Access** → add a database user (username + password).
3. **Network Access** → add IP `0.0.0.0/0` (allow from anywhere) for development.
4. **Connect** → "Drivers" → copy the connection string, looks like:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/`
5. Paste it into `.env` as `MONGO_URI`, add a database name at the end, e.g.
   `.../sanjeevanigrid?retryWrites=true&w=majority`

## 3. Google OAuth Setup

1. Go to https://console.cloud.google.com/ → create a project.
2. **APIs & Services → OAuth consent screen** → set up (External, add your email as test user).
3. **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173` (your Vite dev URL)
   - Authorized redirect URIs: not needed for the flow used here (Google Identity Services renders a button and posts a token directly — no redirect).
4. Copy the **Client ID** into `.env` as `GOOGLE_CLIENT_ID` (you do NOT need the client secret for this flow).

### Frontend piece (add to your React app)

Add the Google script once, e.g. in `index.html`:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

In your `LoginScreen` component, render the button and handle the callback:
```jsx
useEffect(() => {
  window.google?.accounts.id.initialize({
    client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    callback: async (response) => {
      const res = await fetch("http://localhost:5000/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      localStorage.setItem("token", data.token);
      onLogin({ role: data.role, name: data.name, contact: data.contact });
    },
  });
  window.google?.accounts.id.renderButton(
    document.getElementById("googleBtn"),
    { theme: "outline", size: "large", width: 280 }
  );
}, []);
```
Then just add `<div id="googleBtn"></div>` somewhere in the login form.

## 4. Razorpay Setup

1. Sign up at https://dashboard.razorpay.com/ (test mode works without KYC).
2. **Settings → API Keys → Generate Test Key** → copy Key ID and Key Secret.
3. Paste into `.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.

### Frontend piece — replace the fake "Pay ₹5" button

Add the Razorpay checkout script in `index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

Replace the `payAndSubmit` function in `AdmitInline` (inside `App.jsx`) with something like:
```js
async function payAndSubmit() {
  // 1. Ask backend to create a Razorpay order
  const orderRes = await fetch("http://localhost:5000/api/payments/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 5 }),
  });
  const order = await orderRes.json();

  // 2. Open Razorpay Checkout
  const rzp = new window.Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    order_id: order.orderId,
    name: "SanjeevaniGrid",
    description: "Bihar Govt OPD Registration Fee",
    handler: async function (response) {
      // 3. Send patient form + payment proof to backend together
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/patients/register-self", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
      });
      const patient = await res.json();
      onSubmit(patient); // your existing setDone(result) flow
    },
    theme: { color: "#0E7C7B" },
  });
  rzp.open();
}
```

**Important:** the backend re-verifies the Razorpay signature itself
(`routes/patientRoutes.js` → `/register-self`) — never trust the frontend's
"payment succeeded" callback alone, since that can be faked.

## 5. Replacing `window.storage` calls in the frontend

Right now your app uses `window.storage.get/set` (Claude-artifact-only storage)
for hospitals/patients/teleconsults/activity. Swap these for real API calls:

| Old (window.storage)                    | New (API)                                      |
|------------------------------------------|-------------------------------------------------|
| `loadShared(SKEY.hospitals, ...)`         | `fetch("/api/hospitals")`                       |
| `loadShared(SKEY.patients, ...)`          | `fetch("/api/patients", { headers: authHeader })` |
| `admitPatient(form, "self")`              | `POST /api/patients/register-self` (after payment) |
| `admitPatient(form, "admin")`             | `POST /api/patients/admit`                      |
| `approvePatient(id)`                      | `PATCH /api/patients/:id/approve`               |
| `rejectPatient(id, reason)`               | `PATCH /api/patients/:id/reject`                |
| `dischargePatient(id)`                    | `PATCH /api/patients/:id/discharge`             |
| `editPatient(id, name, reason)`           | `PATCH /api/patients/:id/edit`                  |
| `adjustHospital(id, field, delta)`        | `PATCH /api/hospitals/:id/adjust`               |
| `bookCall(hospital)`                      | `POST /api/teleconsults`                        |
| `markConnected(id)` / `completeCall(id)`  | `PATCH /api/teleconsults/:id/connect` / `/complete` |

Replace the 6-second `setInterval` polling of `window.storage` with polling
the same REST endpoints instead (or, for true real-time later, add Socket.IO —
happy to add that next if you want live updates instead of polling).

## 6. Auth token storage on frontend

After login/register/Google-login, store `data.token` (e.g. in `localStorage`)
and attach it as `Authorization: Bearer <token>` on every protected request
(anything except `GET /api/hospitals`).

## API Summary

- `POST /api/auth/register` `{ name, email, password, contact }`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/google` `{ credential }`
- `GET  /api/auth/me` (protected)
- `GET  /api/hospitals` (public)
- `POST /api/hospitals` (admin)
- `PATCH /api/hospitals/:id/adjust` (admin)
- `GET  /api/patients` (protected)
- `POST /api/patients/register-self` (protected — after Razorpay payment)
- `POST /api/patients/admit` (admin)
- `PATCH /api/patients/:id/approve|reject|discharge|edit`
- `GET  /api/patients/lookup/:code` (admin)
- `GET/POST /api/teleconsults`, `PATCH /:id/connect|complete`
- `POST /api/payments/create-order` `{ amount }`
- `POST /api/payments/verify` `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`
