const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const DraftSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    content: String,
    subject: String,
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'deal' },
    type: String,
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

DraftSchema.index({ user: 1 });
DraftSchema.index({ contacts: 1 });
DraftSchema.index({ deal: 1 });
const Draft = mongoose.model('draft', DraftSchema);

module.exports = Draft;
