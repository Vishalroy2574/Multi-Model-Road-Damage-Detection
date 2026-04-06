const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    case_id: { type: Number, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    description: String,
    /** CV / vision model narrative (work-order style) */
    aiDescription: String,
    /** Vision source used to produce the AI summary */
    analysisAnalyzer: String,
    analysisLabel: String,
    analysisSeverity: String,
    analysisAreaRatio: Number,
    /** Normalized labels: pothole, crack, alligator_cracking, surface_wear, faded_markings, other */
    damageTypes: [{ type: String }],
    analysisConfidence: { type: Number, min: 0, max: 1 },
    /** AI triage: ordering crews (0–100, higher = more urgent) */
    priorityScore: { type: Number, default: 50, min: 0, max: 100 },
    /** AI lifecycle: pending = needs action, resolved = auto-closed as low impact */
    triageStatus: {
      type: String,
      enum: ["pending", "resolved"],
      default: "pending",
      index: true,
    },
    impactLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    location: String,
    latitude: Number,
    longitude: Number,
    imageURL: String,
    proofImageURL: String,
    proofUpdatedAt: Date,
    severity: Number,
    status: {
      type: String,
      enum: ["submitted", "approved", "working", "completed", "cancelled"],
      default: "submitted",
    },
    created_date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
