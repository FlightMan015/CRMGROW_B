const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const VideoSchema = new Schema(
  {
    original_id: { type: mongoose.Schema.Types.ObjectId },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    company: { type: String },
    description: String,
    converted: { type: String, default: 'none' },
    uploaded: { type: Boolean, default: false },
    thumbnail: String,
    thumbnail_path: String,
    site_image: String,
    custom_thumbnail: { type: Boolean, default: false },
    preview: String,
    recording: { type: Boolean, default: false },
    path: String,
    old_path: String,
    type: String,
    duration: Number,
    url: String,
    role: String,
    key: String,
    bucket: String,
    material_theme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'material_theme',
    },
    material_theme1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'material_theme',
    },
    capture_form: { type: String, default: '' },
    enabled_capture: { type: Boolean, default: false },
    default_edited: { type: Boolean, default: false },
    default_video: { type: mongoose.Schema.Types.ObjectId, ref: 'video' },
    has_shared: { type: Boolean, default: false },
    shared_video: { type: mongoose.Schema.Types.ObjectId, ref: 'video' },
    priority: { type: Number, default: 1000 },
    is_draft: { type: Boolean, default: false },
    chunk_count: { type: Number, default: 1 },
    status: { type: Object },
    del: { type: Boolean, default: false },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

VideoSchema.index({ user: 1 });
const Video = mongoose.model('video', VideoSchema);

module.exports = Video;
