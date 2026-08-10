/**
 * seedGovtHospitals.js
 * -----------------------------------------------------------------------
 * District-wise GOVERNMENT hospitals for Bihar — for SanjeevaniGrid.
 *
 * Structure matches the fields used in AddHospitalForm / POST /api/hospitals:
 *   { name, type, district, totalBeds, totalDoctors, contact }
 *
 * Two tiers are included per district (where applicable):
 *   1. Sadar Hospital  — every district in Bihar has one, run by the
 *      district health society (DHS). This is the safest "always exists"
 *      government facility to seed for each district.
 *   2. Govt. Medical College Hospitals — only in districts that actually
 *      have one (Patna, Darbhanga, Bhagalpur, Muzaffarpur, Gaya, etc.)
 *
 * NOTE ON DATA ACCURACY:
 *   Bed counts, doctor counts and landline numbers change over time and
 *   vary by source. The numbers below are reasonable placeholder defaults
 *   (editable from the Admin → Hospital Grid → "Add Institution" screen,
 *   or directly in Mongo) — treat them as a starting point, not verified
 *   real-time capacity. Update via the Admin UI once you have confirmed
 *   figures from the District Health Society / State Health Society Bihar.
 * -----------------------------------------------------------------------
 */

const GOVT_HOSPITALS = [
  // ---- Government Medical College Hospitals (tertiary care) ----
  { name: "Patna Medical College Hospital (PMCH)", type: "Medical College Hospital", district: "Patna", totalBeds: 2200, totalDoctors: 300, contact: "0612-2300006" },
  { name: "Nalanda Medical College Hospital (NMCH)", type: "Medical College Hospital", district: "Patna", totalBeds: 700, totalDoctors: 150, contact: "0612-2951234" },
  { name: "AIIMS Patna", type: "Medical College Hospital", district: "Patna", totalBeds: 960, totalDoctors: 250, contact: "0612-2451070" },
  { name: "Darbhanga Medical College Hospital (DMCH)", type: "Medical College Hospital", district: "Darbhanga", totalBeds: 1000, totalDoctors: 180, contact: "06272-253493" },
  { name: "Jawaharlal Nehru Medical College Hospital (JLNMCH)", type: "Medical College Hospital", district: "Bhagalpur", totalBeds: 750, totalDoctors: 150, contact: "0641-2400740" },
  { name: "Sri Krishna Medical College Hospital (SKMCH)", type: "Medical College Hospital", district: "Muzaffarpur", totalBeds: 1000, totalDoctors: 170, contact: "0621-2263355" },
  { name: "Anugrah Narayan Magadh Medical College Hospital (ANMMCH)", type: "Medical College Hospital", district: "Gaya", totalBeds: 700, totalDoctors: 140, contact: "0631-2952230" },
  { name: "Government Medical College, Bettiah (GMC)", type: "Medical College Hospital", district: "West Champaran", totalBeds: 500, totalDoctors: 100, contact: "06254-233333" },
  { name: "Vardhman Institute of Medical Sciences (VIMS), Pawapuri", type: "Medical College Hospital", district: "Nalanda", totalBeds: 500, totalDoctors: 100, contact: "06112-256789" },
  { name: "Government Medical College, Purnea", type: "Medical College Hospital", district: "Purnia", totalBeds: 500, totalDoctors: 100, contact: "06454-242345" },

  // ---- Sadar Hospitals (one per district — secondary care) ----
  { name: "Sadar Hospital, Patna", type: "Sadar Hospital", district: "Patna", totalBeds: 150, totalDoctors: 30, contact: "0612-2661234" },
  { name: "Sadar Hospital, Nalanda (Bihar Sharif)", type: "Sadar Hospital", district: "Nalanda", totalBeds: 100, totalDoctors: 20, contact: "06112-232323" },
  { name: "Sadar Hospital, Bhojpur (Ara)", type: "Sadar Hospital", district: "Bhojpur", totalBeds: 100, totalDoctors: 18, contact: "06182-222365" },
  { name: "Sadar Hospital, Buxar", type: "Sadar Hospital", district: "Buxar", totalBeds: 100, totalDoctors: 16, contact: "06183-222234" },
  { name: "Sadar Hospital, Rohtas (Sasaram)", type: "Sadar Hospital", district: "Rohtas", totalBeds: 100, totalDoctors: 18, contact: "06184-223456" },
  { name: "Sadar Hospital, Kaimur (Bhabua)", type: "Sadar Hospital", district: "Kaimur", totalBeds: 75, totalDoctors: 14, contact: "06189-222234" },
  { name: "Sadar Hospital, Gaya", type: "Sadar Hospital", district: "Gaya", totalBeds: 100, totalDoctors: 20, contact: "0631-2222234" },
  { name: "Sadar Hospital, Jehanabad", type: "Sadar Hospital", district: "Jehanabad", totalBeds: 75, totalDoctors: 14, contact: "06114-233456" },
  { name: "Sadar Hospital, Arwal", type: "Sadar Hospital", district: "Arwal", totalBeds: 50, totalDoctors: 10, contact: "06398-222345" },
  { name: "Sadar Hospital, Aurangabad", type: "Sadar Hospital", district: "Aurangabad", totalBeds: 100, totalDoctors: 18, contact: "06186-222234" },
  { name: "Sadar Hospital, Nawada", type: "Sadar Hospital", district: "Nawada", totalBeds: 100, totalDoctors: 16, contact: "06324-212345" },
  { name: "Sadar Hospital, Vaishali (Hajipur)", type: "Sadar Hospital", district: "Vaishali", totalBeds: 100, totalDoctors: 18, contact: "06224-262345" },
  { name: "Sadar Hospital, Saran (Chapra)", type: "Sadar Hospital", district: "Saran", totalBeds: 100, totalDoctors: 20, contact: "06152-242345" },
  { name: "Sadar Hospital, Siwan", type: "Sadar Hospital", district: "Siwan", totalBeds: 100, totalDoctors: 18, contact: "06158-222345" },
  { name: "Sadar Hospital, Gopalganj", type: "Sadar Hospital", district: "Gopalganj", totalBeds: 100, totalDoctors: 16, contact: "06156-222345" },
  { name: "Sadar Hospital, Muzaffarpur", type: "Sadar Hospital", district: "Muzaffarpur", totalBeds: 100, totalDoctors: 20, contact: "0621-2242345" },
  { name: "Sadar Hospital, Sitamarhi", type: "Sadar Hospital", district: "Sitamarhi", totalBeds: 100, totalDoctors: 16, contact: "06226-252345" },
  { name: "Sadar Hospital, Sheohar", type: "Sadar Hospital", district: "Sheohar", totalBeds: 50, totalDoctors: 10, contact: "06225-222345" },
  { name: "Sadar Hospital, East Champaran (Motihari)", type: "Sadar Hospital", district: "East Champaran", totalBeds: 100, totalDoctors: 18, contact: "06252-232345" },
  { name: "Sadar Hospital, West Champaran (Bettiah)", type: "Sadar Hospital", district: "West Champaran", totalBeds: 100, totalDoctors: 18, contact: "06254-233345" },
  { name: "Sadar Hospital, Darbhanga", type: "Sadar Hospital", district: "Darbhanga", totalBeds: 100, totalDoctors: 18, contact: "06272-222345" },
  { name: "Sadar Hospital, Madhubani", type: "Sadar Hospital", district: "Madhubani", totalBeds: 100, totalDoctors: 16, contact: "06276-222345" },
  { name: "Sadar Hospital, Samastipur", type: "Sadar Hospital", district: "Samastipur", totalBeds: 100, totalDoctors: 18, contact: "06274-222345" },
  { name: "Sadar Hospital, Begusarai", type: "Sadar Hospital", district: "Begusarai", totalBeds: 100, totalDoctors: 18, contact: "06243-222345" },
  { name: "Sadar Hospital, Munger", type: "Sadar Hospital", district: "Munger", totalBeds: 100, totalDoctors: 16, contact: "06344-222345" },
  { name: "Sadar Hospital, Lakhisarai", type: "Sadar Hospital", district: "Lakhisarai", totalBeds: 75, totalDoctors: 12, contact: "06345-222345" },
  { name: "Sadar Hospital, Sheikhpura", type: "Sadar Hospital", district: "Sheikhpura", totalBeds: 50, totalDoctors: 10, contact: "06341-222345" },
  { name: "Sadar Hospital, Jamui", type: "Sadar Hospital", district: "Jamui", totalBeds: 75, totalDoctors: 14, contact: "06345-223345" },
  { name: "Sadar Hospital, Khagaria", type: "Sadar Hospital", district: "Khagaria", totalBeds: 75, totalDoctors: 14, contact: "06244-222345" },
  { name: "Sadar Hospital, Bhagalpur", type: "Sadar Hospital", district: "Bhagalpur", totalBeds: 100, totalDoctors: 20, contact: "0641-2400345" },
  { name: "Sadar Hospital, Banka", type: "Sadar Hospital", district: "Banka", totalBeds: 75, totalDoctors: 14, contact: "06424-222345" },
  { name: "Sadar Hospital, Purnia", type: "Sadar Hospital", district: "Purnia", totalBeds: 100, totalDoctors: 18, contact: "06454-222345" },
  { name: "Sadar Hospital, Katihar", type: "Sadar Hospital", district: "Katihar", totalBeds: 100, totalDoctors: 16, contact: "06452-222345" },
  { name: "Sadar Hospital, Araria", type: "Sadar Hospital", district: "Araria", totalBeds: 75, totalDoctors: 14, contact: "06453-222345" },
  { name: "Sadar Hospital, Kishanganj", type: "Sadar Hospital", district: "Kishanganj", totalBeds: 75, totalDoctors: 14, contact: "06456-222345" },
  { name: "Sadar Hospital, Saharsa", type: "Sadar Hospital", district: "Saharsa", totalBeds: 100, totalDoctors: 16, contact: "06478-222345" },
  { name: "Sadar Hospital, Supaul", type: "Sadar Hospital", district: "Supaul", totalBeds: 75, totalDoctors: 14, contact: "06473-222345" },
  { name: "Sadar Hospital, Madhepura", type: "Sadar Hospital", district: "Madhepura", totalBeds: 75, totalDoctors: 14, contact: "06476-222345" },
];

module.exports = { GOVT_HOSPITALS };

/* -----------------------------------------------------------------------
 * OPTIONAL: run this file directly with Node to push everything into your
 * running backend (http://localhost:5000) via the existing admin endpoint
 * used by AddHospitalForm (POST /api/hospitals).
 *
 * Usage:
 *   1. Log in as admin in the app once, open browser devtools → Application
 *      → Local Storage → copy the "sg_token" value.
 *   2. Run:  ADMIN_TOKEN=<paste_token> node seedGovtHospitals.js
 * ------------------------------------------------------------------- */
if (require.main === module) {
  const API_BASE = process.env.API_BASE || "http://localhost:5000/api";
  const TOKEN = process.env.ADMIN_TOKEN;

  if (!TOKEN) {
    console.error("Set ADMIN_TOKEN env var (copy 'sg_token' from localStorage after logging in as admin).");
    process.exit(1);
  }

  (async () => {
    // Node 18+ has global fetch. If on an older Node, `npm i node-fetch` first.
    let added = 0, failed = 0;
    for (const h of GOVT_HOSPITALS) {
      try {
        const res = await fetch(`${API_BASE}/hospitals`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify(h),
        });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        added++;
        console.log(`✔ Added: ${h.name}`);
      } catch (e) {
        failed++;
        console.error(`✘ Failed: ${h.name} — ${e.message}`);
      }
    }
    console.log(`\nDone. Added ${added}, failed ${failed}, total attempted ${GOVT_HOSPITALS.length}.`);
  })();
}
