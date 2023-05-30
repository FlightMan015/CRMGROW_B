const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const MaterialThemeSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    subject: String,
    type: String,
    role: String,
    thumbnail: String,
    template_id: String,
    html_content: String,
    json_content: String,
    company: String,
    created_at: Date,
    updated_at: Date,
    videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
    pdfs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

MaterialThemeSchema.index({ user: 1 });
const MaterialTheme = mongoose.model('material_theme', MaterialThemeSchema);

module.exports = MaterialTheme;
