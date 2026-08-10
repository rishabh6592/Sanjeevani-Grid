const crypto = require("crypto");

// Produces a code like "SG-482913" — unique enough combined with a DB unique index.
function generatePatientCode(seedStr) {
  const hash = crypto.createHash("md5").update(seedStr).digest("hex");
  const num = (parseInt(hash.slice(0, 8), 16) % 900000) + 100000;
  return `SG-${num}`;
}

module.exports = generatePatientCode;
