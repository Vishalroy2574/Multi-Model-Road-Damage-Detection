function toRad(d) {
  return (d * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function locationImpactBoost(lat, lng) {
  const clat = process.env.TRIAGE_CENTER_LAT;
  const clng = process.env.TRIAGE_CENTER_LNG;
  if (lat == null || lng == null || clat == null || clng == null) return 0;
  const dist = haversineKm(Number(lat), Number(lng), Number(clat), Number(clng));
  const radius = Number(process.env.TRIAGE_HOTSPOT_KM || 8);
  const bonus = Number(process.env.TRIAGE_HOTSPOT_PRIORITY_BOOST || 12);
  return dist <= radius ? bonus : 0;
}

/**
 * Priority score (0–100) and AI triage status pending vs resolved (low-impact auto-closure).
 */
function computeTriage({ severity, damageTypes, latitude, longitude }) {
  const s = Math.min(10, Math.max(0, Number(severity) || 0));
  const types = (damageTypes || []).map((t) => String(t).toLowerCase());
  const has = (x) => types.includes(x);

  const hasPothole = has("pothole");
  const hasGator = has("alligator_cracking");
  const hasCrack = has("crack");
  const hasWear = has("surface_wear");
  const hasFaded = has("faded_markings");

  const minorCosmeticOnly =
    types.length > 0 &&
    types.every((t) => t === "surface_wear" || t === "faded_markings");

  let impactLevel = "medium";
  if (s >= 8 || hasPothole || hasGator) {
    impactLevel = "high";
  } else if (minorCosmeticOnly && s <= 4) {
    impactLevel = "low";
  } else if (s <= 3 && !hasPothole && !hasGator && !hasCrack) {
    impactLevel = "low";
  }

  const locBoost =
    process.env.TRIAGE_DISABLE_HOTSPOT === "1" ? 0 : locationImpactBoost(latitude, longitude);

  const priorityScore = Math.min(
    100,
    Math.round(
      s * 6 +
        (hasPothole ? 28 : 0) +
        (hasGator ? 20 : 0) +
        (hasCrack ? 14 : 0) +
        (hasWear ? 8 : 0) +
        (hasFaded ? 4 : 0) +
        (has("other") ? 6 : 0) +
        locBoost
    )
  );

  let triageStatus = "pending";
  if (hasPothole || hasGator || s >= 7) {
    triageStatus = "pending";
  } else if (s <= 3 && minorCosmeticOnly) {
    triageStatus = "resolved";
  } else if (s <= 2 && hasCrack && !hasPothole && !hasGator) {
    triageStatus = "resolved";
  }

  return { priorityScore, triageStatus, impactLevel };
}

module.exports = { computeTriage, locationImpactBoost };
