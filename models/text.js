const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TextSchema = new Schema(
  {
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'deal' },
    phone: String,
    content: String,
    from: String,
    type: Number,
    status: Number,
    has_shared: Boolean,
    shared_text: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'text',
    },
    message_id: String,
    segment: { type: Object },
    assigned_contacts: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    ],
    email_tracker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'email_tracker',
    },
    video_tracker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'video_tracker',
    },
    pdf_tracker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'pdf_tracker',
    },
    image_tracker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'image_tracker',
    },
    service_type: String,
    send_status: { type: Object },
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

TextSchema.index({ contacts: 1 });
TextSchema.index({ deal: 1 });
const Text = mongoose.model('text', TextSchema);

module.exports = Text;
