const config = require("../config");

function statusStep(status) {
  const m = { submitted: 0, approved: 1, working: 2, completed: 3, cancelled: 4 };
  return m[status] ?? 0;
}

function publicUploadPath(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";

  let pathname = text;
  try {
    pathname = new URL(text, config.appBaseUrl()).pathname;
  } catch (_err) {
    pathname = text;
  }

  const normalized = pathname.replace(/^\/+/, "");
  if (!normalized.startsWith("uploads/")) {
    return text;
  }

  return `/${normalized}`;
}

function formatReport(r) {
  const d = r.created_date || r.createdAt;
  const created_date =
    typeof d === "string"
      ? d
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  const dateShort = typeof d === "string" ? d.split(" ")[0] : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    case_id: r.case_id,
    userId: r.userId,
    description: r.description,
    aiDescription: r.aiDescription || "",
    analysisAnalyzer: r.analysisAnalyzer || "",
    analysisLabel: r.analysisLabel || "",
    analysisSeverity: r.analysisSeverity || "",
    analysisAreaRatio: r.analysisAreaRatio,
    damageTypes: Array.isArray(r.damageTypes) ? r.damageTypes : [],
    analysisConfidence: r.analysisConfidence,
    priorityScore: r.priorityScore != null ? r.priorityScore : 50,
    triageStatus: r.triageStatus || "pending",
    impactLevel: r.impactLevel || "medium",
    location: r.location,
    latitude: r.latitude,
    longitude: r.longitude,
    imageURL: publicUploadPath(r.imageURL),
    proofImageURL: publicUploadPath(r.proofImageURL),
    proofUpdatedAt: r.proofUpdatedAt || null,
    severity: r.severity,
    status: r.status,
    created_date,
    dateShort,
    stepNumber: statusStep(r.status),
  };
}

module.exports = { formatReport };
