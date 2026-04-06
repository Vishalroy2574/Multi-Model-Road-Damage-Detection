const { analyzeRoadDamage, legacyTextResult } = require("./imageAnalysis");

/**
 * Back-compat plain text for old clients: "<url> : Your image is valid!"
 */
async function detectPothole(imageUrl) {
  const a = await analyzeRoadDamage(imageUrl);
  return legacyTextResult(imageUrl, a.valid);
}

module.exports = { detectPothole, analyzeRoadDamage, legacyTextResult };
