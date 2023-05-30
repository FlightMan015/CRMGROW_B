const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const FolderSchema = new Schema(
  {
    original_id: { type: mongoose.Schema.Types.ObjectId },
    title: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
    pdfs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    templates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'template' }],
    automations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'automation' }],
    company: { type: String },
    role: { type: String },
    type: {
      type: String,
      enum: ['material', 'template', 'automation'],
      default: 'material',
    }, // material, template, automation ...
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Folder = mongoose.model('folder', FolderSchema);

module.exports = Folder;
