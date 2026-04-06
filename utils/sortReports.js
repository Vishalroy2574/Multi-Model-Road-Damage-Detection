function toMillis(value) {
  if (!value) return 0;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function compareReportsByReviewPriority(a, b) {
  const confidenceDiff = num(b.analysisConfidence, -1) - num(a.analysisConfidence, -1);
  if (confidenceDiff !== 0) return confidenceDiff;

  const areaDiff = num(b.analysisAreaRatio, -1) - num(a.analysisAreaRatio, -1);
  if (areaDiff !== 0) return areaDiff;

  const priorityDiff = num(b.priorityScore, -1) - num(a.priorityScore, -1);
  if (priorityDiff !== 0) return priorityDiff;

  return toMillis(b.created_date || b.createdAt) - toMillis(a.created_date || a.createdAt);
}

module.exports = { compareReportsByReviewPriority };
