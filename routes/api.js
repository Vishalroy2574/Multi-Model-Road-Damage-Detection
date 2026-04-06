const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const User = require("../models/User");
const Report = require("../models/Report");
const Comment = require("../models/Comment");
const Counter = require("../models/Counter");
const { detectPothole, analyzeRoadDamage } = require("../services/potholeDetect");
const { computeTriage } = require("../services/reportTriage");
const { sanitizeTypes } = require("../services/damageTypes");
const { formatReport } = require("../utils/formatReport");
const { compareReportsByReviewPriority } = require("../utils/sortReports");
const config = require("../config");
const { normalizeEmail } = require("../utils/password");

const router = express.Router();

router.use((req, res, next) => {
  if (!req.session?.user?.userId) {
    return res.status(401).json({ error: "login required" });
  }
  next();
});

const uploadDir = path.join(__dirname, "..", "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

function isAdmin(req) {
  return req.session?.user?.role === "admin";
}

function localUploadPath(urlValue) {
  if (!urlValue) return null;
  const text = String(urlValue).trim();
  if (!text) return null;

  let pathname = text;
  try {
    pathname = new URL(text, config.appBaseUrl()).pathname;
  } catch (_err) {
    pathname = text;
  }

  const normalized = pathname.replace(/^\/+/, "");
  if (!normalized.startsWith("uploads/")) return null;

  const resolved = path.resolve(uploadDir, path.basename(normalized));
  const root = path.resolve(uploadDir);
  if (!resolved.startsWith(root + path.sep) && resolved !== path.join(root, path.basename(normalized))) {
    return null;
  }
  return resolved;
}

function removeLocalUpload(urlValue) {
  const target = localUploadPath(urlValue);
  if (!target) return;
  try {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  } catch (err) {
    console.error("Failed to remove upload:", err.message);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpeg|jpg)$/i.test(file.mimetype);
    cb(ok ? null : new Error("Only PNG and JPEG images are allowed"), ok);
  },
});

function hasAuthorityAccess(req) {
  const role = req.session?.user?.role;
  const email = normalizeEmail(req.session?.user?.emailId);
  return role === "authority" || email === "nilesh23@gmail.com";
}

function isAdmin(req) {
  const role = req.session?.user?.role;
  const email = normalizeEmail(req.session?.user?.emailId);
  return role === "admin" || email === "vishalroy2574@gmail.com";
}

async function nextCaseId() {
  const c = await Counter.findOneAndUpdate(
    { _id: "report_case" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return c.seq;
}

router.post("/upload", (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    const file = req.files && req.files[0];
    if (!file) {
      return res.status(400).json({ error: "No file" });
    }
    const base = config.appBaseUrl();
    const url = `${base}/uploads/${file.filename}`;
    return res.json({ filename: [url] });
  });
});

router.post("/detect/single", async (req, res) => {
  try {
    const imageUrl = req.body?.image_url;
    if (!imageUrl) {
      if (req.query.format === "text") {
        return res.status(400).type("text").send(" : Missing image_url");
      }
      return res.status(400).json({ error: "image_url required" });
    }
    const wantText =
      req.query.format === "text" ||
      (typeof req.headers.accept === "string" && req.headers.accept.includes("text/plain"));

    if (wantText) {
      const text = await detectPothole(imageUrl);
      return res.type("text").send(text);
    }

    const full = await analyzeRoadDamage(imageUrl);
    return res.json({
      imageUrl,
      valid: full.valid,
      message: full.valid
        ? "Your image is valid!"
        : "No road damage detected or image not suitable for analysis.",
      analysis: {
        label: full.label,
        severity: full.severity,
        areaRatio: full.areaRatio,
        damageTypes: full.damageTypes,
        description: full.description,
        confidence: full.confidence,
        analyzer: full.analyzer,
      },
    });
  } catch (e) {
    console.error(e);
    if (req.query.format === "text") {
      return res.status(500).type("text").send(" : Detection failed");
    }
    return res.status(500).json({ error: "detection_failed", message: String(e.message) });
  }
});

router.post("/reports", async (req, res) => {
  try {
    const rows = await Report.find({});
    rows.sort(compareReportsByReviewPriority);
    return res.json(rows.map(formatReport));
  } catch (e) {
    console.error(e);
    return res.status(500).json([]);
  }
});

router.post("/reports/all", async (_req, res) => {
  try {
    const rows = await Report.find({});
    rows.sort(compareReportsByReviewPriority);
    return res.json(rows.map(formatReport));
  } catch (e) {
    console.error(e);
    return res.status(500).json([]);
  }
});

router.post("/submit/report", async (req, res) => {
  try {
    const d = req.body?.data;
    if (!d?.description) {
      return res.status(400).json({ error: "invalid" });
    }

    const userId = req.session.user.userId;
    const case_id = await nextCaseId();
    const severity = Number(d.severity);
    const damageTypes = sanitizeTypes(d.damageTypes);
    const aiDescription = String(d.aiDescription || "").slice(0, 8000);
    const analysisAnalyzer = String(d.analysisAnalyzer || "").slice(0, 120);
    const analysisLabel = String(d.analysisLabel || "").slice(0, 40);
    const analysisSeverity = String(d.analysisSeverity || "").slice(0, 40);
    const analysisAreaRatio =
      d.analysisAreaRatio != null ? Math.min(1, Math.max(0, Number(d.analysisAreaRatio))) : undefined;
    const analysisConfidence =
      d.analysisConfidence != null ? Math.min(1, Math.max(0, Number(d.analysisConfidence))) : undefined;

    const triage = computeTriage({
      severity,
      damageTypes,
      latitude: d.locationLatLng?.lat,
      longitude: d.locationLatLng?.lng,
    });

    await Report.create({
      case_id,
      userId,
      description: d.description,
      aiDescription,
      damageTypes,
      analysisAnalyzer,
      analysisLabel,
      analysisSeverity,
      analysisAreaRatio,
      analysisConfidence,
      priorityScore: triage.priorityScore,
      triageStatus: triage.triageStatus,
      impactLevel: triage.impactLevel,
      location: d.location,
      latitude: d.locationLatLng?.lat,
      longitude: d.locationLatLng?.lng,
      imageURL: d.imageURL,
      severity,
      status: "submitted",
      created_date: new Date(),
    });
    return res.json({
      ok: true,
      triage: {
        priorityScore: triage.priorityScore,
        triageStatus: triage.triageStatus,
        impactLevel: triage.impactLevel,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
});

router.post("/reports/comments", async (req, res) => {
  try {
    const caseId = req.body?.data?.caseId;
    if (caseId === undefined || caseId === null) {
      return res.status(400).json([]);
    }
    const cid = Number(caseId);
    const rows = await Comment.find({ caseId: cid }).sort({ commentDateTime: 1 });
    return res.json(
      rows.map((c) => ({
        userType: c.userType,
        commentText: c.commentText,
        commentDateTime: c.commentDateTime,
      }))
    );
  } catch (e) {
    console.error(e);
    return res.status(500).json([]);
  }
});

router.post("/submit/report/comment", async (req, res) => {
  try {
    const d = req.body?.data;
    if (!d?.caseId || !d?.commentText) {
      return res.status(400).json({ error: "invalid" });
    }
    await Comment.create({
      caseId: Number(d.caseId),
      commentText: d.commentText,
      userType: d.userType || "U",
      commentDateTime: new Date(),
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
});

router.post("/reports/status", async (req, res) => {
  try {
    if (!hasAuthorityAccess(req)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const caseId = Number(req.body?.data?.caseId);
    const status = String(req.body?.data?.status || "").trim().toLowerCase();
    const allowed = new Set(["submitted", "approved", "working", "completed", "cancelled"]);
    if (!Number.isFinite(caseId) || !allowed.has(status)) {
      return res.status(400).json({ error: "invalid" });
    }

    const updated = await Report.findOneAndUpdate(
      { case_id: caseId },
      { $set: { status } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "not_found" });
    }

    return res.json({ ok: true, report: formatReport(updated) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
});

router.post("/reports/proof", async (req, res) => {
  try {
    if (!hasAuthorityAccess(req)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const caseId = Number(req.body?.data?.caseId);
    const proofImageURL = String(req.body?.data?.proofImageURL || "").trim();
    if (!Number.isFinite(caseId) || !proofImageURL) {
      return res.status(400).json({ error: "invalid" });
    }

    const report = await Report.findOne({ case_id: caseId });
    if (!report) {
      return res.status(404).json({ error: "not_found" });
    }
    if (report.status !== "completed") {
      return res.status(400).json({ error: "resolution_required" });
    }

    report.proofImageURL = proofImageURL;
    report.proofUpdatedAt = new Date();
    await report.save();

    return res.json({ ok: true, report: formatReport(report) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
});

router.post("/reports/delete", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const caseId = Number(req.body?.data?.caseId);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ error: "invalid" });
    }

    const report = await Report.findOne({ case_id: caseId });
    if (!report) {
      return res.status(404).json({ error: "not_found" });
    }

    await Comment.deleteMany({ caseId });
    removeLocalUpload(report.imageURL);
    removeLocalUpload(report.proofImageURL);
    await Report.deleteOne({ case_id: caseId });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
});

router.post("/users/update", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const userId = String(req.body?.data?.userId || "").trim().toLowerCase();
    const role = String(req.body?.data?.role || "").trim().toLowerCase();
    const isActiveRaw = req.body?.data?.isActive;
    const isActive =
      typeof isActiveRaw === "boolean"
        ? isActiveRaw
        : String(isActiveRaw).toLowerCase() === "true" || String(isActiveRaw) === "1";

    const allowedRoles = new Set(["user", "authority", "admin"]);
    if (!userId || !allowedRoles.has(role)) {
      return res.status(400).json({ error: "invalid" });
    }

    if (userId === "vishalroy2574@gmail.com" || userId === "nilesh23@gmail.com") {
      return res.status(400).json({ error: "protected_account" });
    }

    if (userId === String(req.session?.user?.emailId || "").toLowerCase()) {
      return res.status(400).json({ error: "cannot_modify_self" });
    }

    const updated = await User.findOneAndUpdate(
      { emailId: userId },
      { $set: { role, isActive } },
      { new: true }
    ).select("userId emailId name role isActive");

    if (!updated) {
      return res.status(404).json({ error: "not_found" });
    }

    return res.json({
      ok: true,
      user: {
        userId: updated.userId,
        emailId: updated.emailId,
        name: updated.name,
        role: updated.role,
        isActive: updated.isActive !== false,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
});

module.exports = router;
