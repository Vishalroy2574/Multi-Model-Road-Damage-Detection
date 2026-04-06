const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    caseId: { type: Number, required: true, index: true },
    commentText: { type: String, required: true },
    userType: { type: String, default: "U" },
    commentDateTime: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);
