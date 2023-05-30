const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const DealStageSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    role: String,
    title: String,
    priority: Number,
    pipe_line: { type: mongoose.Schema.Types.ObjectId, ref: 'pipe_line' },
    deals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'deal' }],
    automation: { type: mongoose.Schema.Types.ObjectId, ref: 'automation' },
    duration: Number,
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

DealStageSchema.index({ user: 1, title: 1 });
DealStageSchema.index({ user: 1, pipe_line: 1 });
const DealStage = mongoose.model('deal_stage', DealStageSchema);

module.exports = DealStage;
