const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PipeLineSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    updated_at: Date,
    created_at: Date,
    is_active: Boolean,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

PipeLineSchema.index({ user: 1, title: 1 });
const PipeLine = mongoose.model('pipe_line', PipeLineSchema);

module.exports = PipeLine;
