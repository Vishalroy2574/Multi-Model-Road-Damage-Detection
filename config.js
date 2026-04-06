const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const PORT = parseInt(process.env.PORT || "3000", 10);

function appBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  return `http://localhost:${PORT}`;
}

function isAllowedEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .endsWith("@gmail.com");
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

module.exports = {
  PORT,
  appBaseUrl,
  isAllowedEmail,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/spothole",
  sessionSecret: process.env.SESSION_SECRET || "change-me-in-production",
  openaiKey: process.env.OPENAI_API_KEY || "",
  geminiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  useGemini: isTruthy(process.env.USE_GEMINI) || Boolean(process.env.GEMINI_API_KEY),
  detectionMode: process.env.DETECTION_MODE || "auto",
};
