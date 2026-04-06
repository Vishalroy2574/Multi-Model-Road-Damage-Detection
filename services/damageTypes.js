/** Normalized labels stored on reports and returned by analysis */
const ALLOWED = [
  "pothole",
  "crack",
  "alligator_cracking",
  "surface_wear",
  "faded_markings",
  "other",
];

function sanitizeTypes(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    const t = String(x || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_");
    if (ALLOWED.includes(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

module.exports = { ALLOWED, sanitizeTypes };
