const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CampaignSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    mail_list: { type: mongoose.Schema.Types.ObjectId, ref: 'mail_list' },
    subject: String,
    content: String,
    newsletter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'material_theme',
    },
    due_start: Date,
    videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
    pdfs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    failed: { type: Array, default: [] },
    sent: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    status: { type: String },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('campaign', CampaignSchema);
