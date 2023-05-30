const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const EmailSchema = new Schema(
  {
    original_id: { type: mongoose.Schema.Types.ObjectId },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    subject: String,
    content: String,
    role: String,
    company: { type: String },
    video_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
    pdf_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    image_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    type: String,
    default: { type: Boolean, default: false },
    category: String,
    attachments: Array,
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const EmailTemplate = mongoose.model('email_template', EmailSchema);

module.exports = EmailTemplate;
