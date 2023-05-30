const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PDFSchema = new Schema(
  {
    original_id: { type: mongoose.Schema.Types.ObjectId },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    description: String,
    preview: String,
    type: String,
    url: String,
    role: String,
    company: { type: String },
    key: String,
    total_pages: Number,
    capture_form: { type: String, default: '' },
    enabled_capture: { type: Boolean, default: false },
    default_edited: { type: Boolean, default: false },
    default_pdf: { type: mongoose.Schema.Types.ObjectId, ref: 'pdf' },
    has_shared: { type: Boolean, default: false },
    shared_pdf: { type: mongoose.Schema.Types.ObjectId, ref: 'pdf' },
    del: { type: Boolean, default: false },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const PDF = mongoose.model('pdf', PDFSchema);

module.exports = PDF;
