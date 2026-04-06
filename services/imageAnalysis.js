const axios = require("axios");
const sharp = require("sharp");
const OpenAIMod = require("openai");
const OpenAI = OpenAIMod.default || OpenAIMod;
const config = require("../config");
const { sanitizeTypes, ALLOWED } = require("./damageTypes");

let geminiUnavailableUntil = 0;
let geminiUnavailableReason = "";

const ANALYSIS_JSON_INSTRUCTION = `You are a road inspection vision model. Analyze the image for paved road surface damage.
Return ONLY valid JSON with this shape:
{
  "label": "pothole" or "no pothole",
  "confidence": number,
  "severity": "small" | "medium" | "large",
  "area_ratio": number,
  "description": string,
  "damage_types": string[]
}
Rules:
- label must be "pothole" whenever road damage is present; otherwise "no pothole".
- damage_types must be a subset of: ${ALLOWED.join(", ")}
- Use "pothole" for depressions/holes; "crack" for linear breaks; "alligator_cracking" for interconnected cracks; "surface_wear" for raveling/general wear; "faded_markings" for paint only; "other" if unsure.
- severity must be based on area_ratio: small (< 0.20), medium (0.20-0.50), large (> 0.50).
- area_ratio must estimate the fraction of the full image occupied by the damaged area, from 0.0 to 1.0.
- confidence must reflect BOTH detection certainty and size. Larger potholes must have higher confidence than smaller ones.
- If the damage is small but clearly visible, confidence should still be lower than for a larger damage area.
- description: 1-3 short factual sentences, suitable for a work order, no markdown.
- road_damage_visible false if image is not a road, interior scene, or no discernible pavement damage. If no damage is present, use label "no pothole", area_ratio 0, severity "small", and low confidence.
`;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function severityFromAreaRatio(areaRatio) {
  if (areaRatio > 0.5) return "large";
  if (areaRatio >= 0.2) return "medium";
  return "small";
}

function sizeScoreFromAreaRatio(areaRatio) {
  return clamp(parseNumber(areaRatio, 0), 0, 1);
}

function confidenceFromSize(areaRatio, detectionConfidence, isDamage) {
  const sizeScore = sizeScoreFromAreaRatio(areaRatio);
  const certainty = clamp(parseNumber(detectionConfidence, 0.5), 0, 1);

  if (!isDamage) {
    return clamp(0.1 + (1 - certainty) * 0.18 + (1 - sizeScore) * 0.12, 0.05, 0.45);
  }

  return clamp(0.08 + 0.2 * certainty + 0.72 * sizeScore, 0.08, 0.99);
}

function normalizeParsedAnalysis(parsed) {
  const types = sanitizeTypes(parsed.damage_types || parsed.damageTypes || []);
  const roadDamageVisible =
    parsed.road_damage_visible != null ? Boolean(parsed.road_damage_visible) : null;

  const rawLabel = String(parsed.label || "").trim().toLowerCase();
  let label = "no pothole";
  if (rawLabel === "pothole") {
    label = "pothole";
  } else if (rawLabel === "no pothole") {
    label = "no pothole";
  } else if (roadDamageVisible === true || types.length > 0) {
    label = "pothole";
  }

  const areaRatio = clamp(
    parseNumber(parsed.area_ratio ?? parsed.areaRatio, label === "pothole" ? 0.25 : 0),
    0,
    1
  );
  const severity = String(parsed.severity || "").trim().toLowerCase() || severityFromAreaRatio(areaRatio);
  const modelConfidence = clamp(
    parseNumber(parsed.confidence, label === "pothole" ? 0.7 : 0.2),
    0,
    1
  );
  const description =
    String(parsed.description || "").trim() ||
    (label === "pothole"
      ? "Road surface damage is visible."
      : "No clear road damage is visible.");

  const confidence = confidenceFromSize(areaRatio, modelConfidence, label === "pothole");

  return {
    valid: label === "pothole",
    label,
    severity: severity === "small" || severity === "medium" || severity === "large"
      ? severity
      : severityFromAreaRatio(areaRatio),
    areaRatio,
    damageTypes: label === "pothole" ? (types.length ? types : ["pothole"]) : [],
    description,
    confidence,
  };
}

async function imageUrlForVision(imageUrl) {
  const local =
    /localhost|127\.0\.0\.1|^https?:\/\/192\.168\.|^https?:\/\/10\./i.test(imageUrl);
  if (!local) {
    return imageUrl;
  }
  const { data, headers } = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 20000,
    maxContentLength: 15 * 1024 * 1024,
  });
  const mime = headers["content-type"] && headers["content-type"].split(";")[0].trim();
  const mt = mime && mime.startsWith("image/") ? mime : "image/jpeg";
  const b64 = Buffer.from(data).toString("base64");
  return `data:${mt};base64,${b64}`;
}

async function analyzeWithOpenAI(imageUrl) {
  const client = new OpenAI({ apiKey: config.openaiKey });
  const visionUrl = await imageUrlForVision(imageUrl);
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ANALYSIS_JSON_INSTRUCTION },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this image for road damage." },
          { type: "image_url", image_url: { url: visionUrl } },
        ],
      },
    ],
    max_tokens: 500,
  });
  const raw = response.choices[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from vision model");
  }
  const result = normalizeParsedAnalysis(parsed);
  return {
    ...result,
    analyzer: "openai-vision",
  };
}

async function analyzeWithGeminiModel(imageUrl, model) {
  const visionUrl = await imageUrlForVision(imageUrl);
  const imageBase64 = visionUrl.startsWith("data:")
    ? visionUrl.split(",")[1] || ""
    : Buffer.from(
        (await axios.get(visionUrl, { responseType: "arraybuffer" })).data
      ).toString("base64");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(config.geminiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${ANALYSIS_JSON_INSTRUCTION}\nAnalyze this image for road damage and return only JSON.`,
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini analysis failed with status ${response.status}`);
  }

  const payload = await response.json();
  const raw =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from Gemini vision model");
  }

  const result = normalizeParsedAnalysis(parsed);
  return {
    ...result,
    analyzer: "gemini-vision",
  };
}

async function analyzeWithGemini(imageUrl) {
  if (Date.now() < geminiUnavailableUntil) {
    throw new Error(
      `Gemini temporarily disabled after ${geminiUnavailableReason || "previous failure"}`
    );
  }
  const candidates = [config.geminiModel, "gemini-2.5-flash", "gemini-2.0-flash"].filter(
    (value, index, list) => value && list.indexOf(value) === index
  );

  let lastError = null;
  for (const model of candidates) {
    try {
      return await analyzeWithGeminiModel(imageUrl, model);
    } catch (e) {
      lastError = e;
      const message = String(e.message || "");
      if (!/404/.test(message) && !/not found/i.test(message) && !/model/i.test(message)) {
        throw e;
      }
      console.warn(`Gemini model ${model} unavailable, trying fallback.`);
    }
  }

  throw lastError || new Error("Gemini analysis failed");
}

function geminiStatusCode(error) {
  const message = String(error && error.message ? error.message : "");
  const fromMessage = message.match(/status\s+(\d{3})/i);
  if (fromMessage) {
    return Number(fromMessage[1]);
  }
  return Number(error && error.status) || Number(error && error.response && error.response.status) || 0;
}

function markGeminiUnavailable(error) {
  const status = geminiStatusCode(error);
  const cooldownMs = status === 429 ? 15 * 60 * 1000 : 5 * 60 * 1000;
  geminiUnavailableUntil = Date.now() + cooldownMs;
  geminiUnavailableReason = status ? `HTTP ${status}` : "a recent failure";
}

function shouldSkipGemini() {
  return Date.now() < geminiUnavailableUntil;
}

async function analyzeWithLocalFallback(imageUrl, reason) {
  if (reason) {
    console.warn(`Falling back to local analysis after ${reason}.`);
  }
  return analyzeWithSharpPipeline(imageUrl);
}

function featureClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value, min, max) {
  if (!Number.isFinite(value) || max <= min) {
    return 0;
  }
  return featureClamp((value - min) / (max - min), 0, 1);
}

function intensityLabel(score) {
  if (score >= 0.75) return "strong";
  if (score >= 0.5) return "moderate";
  return "subtle";
}

function estimateLocalAreaRatio(type, darkRatio, edgeAvg, variance, damageScore) {
  if (type === "pothole") {
    return clamp(0.1 + darkRatio * 2.2 + normalize(edgeAvg, 18, 40) * 0.1, 0, 1);
  }
  if (type === "alligator_cracking") {
    return clamp(0.08 + normalize(variance, 450, 1000) * 0.55 + normalize(edgeAvg, 22, 45) * 0.08, 0, 1);
  }
  if (type === "crack") {
    return clamp(0.04 + normalize(edgeAvg, 18, 34) * 0.18 + normalize(variance, 280, 800) * 0.05, 0, 1);
  }
  if (type === "surface_wear") {
    return clamp(0.08 + normalize(420 - variance, 0, 220) * 0.18, 0, 1);
  }
  return clamp(0.12 + damageScore * 0.22, 0, 1);
}

async function analyzeWithSharpPipeline(imageUrl) {
  const { data: buf } = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 20000,
    maxContentLength: 15 * 1024 * 1024,
    validateStatus: (s) => s === 200,
  });
  const { data, info } = await sharp(Buffer.from(buf))
    .resize(384, 384, { fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  let sum = 0;
  let sumSq = 0;
  let edgeScore = 0;
  let darkLow = 0;
  const n = (w - 2) * (h - 2) || 1;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const c = data[i];
      sum += c;
      sumSq += c * c;
      if (c < 70) darkLow++;
      const gx =
        -data[i - 1 - w] +
        data[i + 1 - w] +
        -2 * data[i - 1] +
        2 * data[i + 1] +
        -data[i - 1 + w] +
        data[i + 1 + w];
      const gy =
        -data[i - 1 - w] -
        2 * data[i - w] -
        data[i + 1 - w] +
        data[i - 1 + w] +
        2 * data[i + w] +
        data[i + 1 + w];
      edgeScore += Math.abs(gx) + Math.abs(gy);
    }
  }

  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const edgeAvg = edgeScore / n;
  const darkRatio = darkLow / n;
  const varianceScore = normalize(variance, 240, 900);
  const edgeScoreNorm = normalize(edgeAvg, 10, 40);
  const darkScore = normalize(darkRatio, 0.02, 0.18);
  const roadLikeScore = clamp(0.5 * varianceScore + 0.35 * edgeScoreNorm + 0.15 * darkScore, 0, 1);

  const roadLike = variance > 280 && edgeAvg > 12;
  if (!roadLike) {
    return {
      valid: false,
      label: "no pothole",
      severity: "small",
      areaRatio: 0,
      damageTypes: [],
      description:
        "No clear paved road surface or damage pattern detected in this image. Texture cues are " +
        intensityLabel(roadLikeScore) +
        " and do not strongly support a reportable defect.",
      confidence: clamp(0.12 + roadLikeScore * 0.28, 0.08, 0.45),
      analyzer: "local-cv-heuristic",
    };
  }

  const damageTypes = [];
  let descriptionParts = [];
  let damageScore = 0.25;
  let type = "other";

  if (darkRatio > 0.08 && edgeAvg > 22) {
    type = "pothole";
    damageTypes.push("pothole");
    damageScore = clamp(
      0.45 * normalize(darkRatio, 0.06, 0.18) +
        0.35 * normalize(edgeAvg, 18, 40) +
        0.2 * normalize(variance, 320, 900),
      0,
      1
    );
    descriptionParts.push(
      `${intensityLabel(damageScore)} dark, irregular regions with pronounced edges suggest localized pavement loss consistent with pothole damage.`
    );
  } else if (edgeAvg > 26 && variance > 520) {
    type = "alligator_cracking";
    damageTypes.push("alligator_cracking");
    damageScore = clamp(0.5 * normalize(edgeAvg, 22, 45) + 0.5 * normalize(variance, 450, 1000), 0, 1);
    descriptionParts.push(
      `${intensityLabel(damageScore)} edge activity and broad texture variance are consistent with interconnected cracking (alligator pattern).`
    );
  } else if (edgeAvg > 19) {
    type = "crack";
    damageTypes.push("crack");
    damageScore = clamp(0.7 * normalize(edgeAvg, 18, 34) + 0.3 * normalize(variance, 280, 800), 0, 1);
    descriptionParts.push(
      `${intensityLabel(damageScore)} linear edge response suggests longitudinal or transverse cracking.`
    );
  } else if (variance < 420 && edgeAvg < 18) {
    type = "surface_wear";
    damageTypes.push("surface_wear");
    damageScore = clamp(
      0.6 * normalize(420 - variance, 0, 220) + 0.4 * normalize(18 - edgeAvg, 0, 12),
      0,
      1
    );
    descriptionParts.push(
      `${intensityLabel(damageScore)} diffuse texture changes may indicate general surface wear or weathering.`
    );
  } else {
    damageTypes.push("other");
    damageScore = clamp(0.4 * edgeScoreNorm + 0.35 * varianceScore + 0.25 * darkScore, 0, 1);
    descriptionParts.push("Pavement distress is present but the damage type is ambiguous from texture cues alone.");
  }

  const areaRatio = estimateLocalAreaRatio(type, darkRatio, edgeAvg, variance, damageScore);
  const severity = severityFromAreaRatio(areaRatio);
  const confidence = confidenceFromSize(areaRatio, damageScore, true);
  const description = descriptionParts.join(" ");

  return {
    valid: true,
    label: "pothole",
    severity,
    areaRatio,
    damageTypes: sanitizeTypes(damageTypes.length ? damageTypes : ["pothole"]),
    description,
    confidence,
    analyzer: "local-cv-heuristic",
  };
}

async function analyzeRoadDamage(imageUrl) {
  const mode = config.detectionMode;

  if (mode === "demo_valid") {
    return {
      valid: true,
      label: "pothole",
      severity: "medium",
      areaRatio: 0.35,
      damageTypes: ["pothole"],
      description:
        "Demo mode: simulated detection of pavement depression consistent with a pothole. Replace demo mode for real analysis.",
      confidence: 0.5,
      analyzer: "demo",
    };
  }
  if (mode === "demo_invalid") {
    return {
      valid: false,
      label: "no pothole",
      severity: "small",
      areaRatio: 0,
      damageTypes: [],
      description: "Demo mode: no damage.",
      confidence: 0.2,
      analyzer: "demo",
    };
  }

  if (mode === "auto" || mode === "sharp") {
    try {
      return await analyzeWithSharpPipeline(imageUrl);
    } catch (e) {
      console.error("Local CV analysis failed:", e.message);
    }
  }

  if (
    config.useGemini &&
    config.geminiKey &&
    !shouldSkipGemini() &&
    (mode === "gemini" || mode === "auto")
  ) {
    try {
      return await analyzeWithGemini(imageUrl);
    } catch (e) {
      console.error("Gemini analysis failed:", e.message);
      markGeminiUnavailable(e);
    }
  }

  if (config.openaiKey && (mode === "openai" || mode === "auto")) {
    try {
      return await analyzeWithOpenAI(imageUrl);
    } catch (e) {
      console.error("OpenAI analysis failed:", e.message);
    }
  }

  if (mode === "gemini" || mode === "openai") {
    try {
      return await analyzeWithLocalFallback(imageUrl, `${mode} fallback`);
    } catch (e) {
      console.error("Local fallback failed:", e.message);
    }
  }

  return {
    valid: true,
    label: "pothole",
    severity: "small",
    areaRatio: 0.1,
    damageTypes: ["other"],
    description: "Image accepted; detailed classification was skipped (configure OPENAI_API_KEY or DETECTION_MODE).",
    confidence: 0.4,
    analyzer: "fallback",
  };
}

function legacyTextResult(imageUrl, valid) {
  if (valid) {
    return `${imageUrl} : Your image is valid!`;
  }
  return `${imageUrl} : No pothole detected in this image.`;
}

module.exports = {
  analyzeRoadDamage,
  legacyTextResult,
  analyzeWithSharpPipeline,
};
