const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const LabelSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    name: String,
    color: { type: String, default: '#000000' },
    font_color: { type: String, default: '#000000' },
    role: String,
    company: String,
    priority: { type: Number, default: 1000 },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('label', LabelSchema);
