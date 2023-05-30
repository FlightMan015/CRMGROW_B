const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const LogSchema = new Schema(
  {
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    answered: Boolean,
    human: Boolean,
    content: String,
    rating: Number,
    recording: String,
    recording_duration: Number,
    status: String,
    label: String,
    voicemail: String,
    duration: Number,
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'deal' },
    has_shared: Boolean,
    shared_log: { type: mongoose.Schema.Types.ObjectId, ref: 'phone_log' },
    assigned_contacts: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    ],
    uuid: String,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const PhoneLog = mongoose.model('phone_log', LogSchema);

module.exports = PhoneLog;
