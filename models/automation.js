const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const AutomationSchema = new Schema(
  {
    original_id: { type: mongoose.Schema.Types.ObjectId },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    company: { type: String },
    automations: Array,
    type: { type: String, default: 'contact' },
    label: { type: String, default: 'contact' },
    role: String,
    del: { type: Boolean, default: false },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

AutomationSchema.index({ user: 1 });
const Automation = mongoose.model('automation', AutomationSchema);

module.exports = Automation;
