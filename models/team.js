const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TeamSchema = new Schema(
  {
    owner: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    name: String,
    description: String,
    email: String,
    cell_phone: String,
    picture: String,
    highlights: { type: Array, default: [] },
    brands: { type: Array, default: [] },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    invites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    requests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    join_link: String,
    referrals: { type: Array, default: [] },
    editors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
    pdfs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    folders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'folder' }],
    automations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'automation' }],
    email_templates: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'email_template' },
    ],
    is_public: { type: Boolean, default: true },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

TeamSchema.index({ owner: 1, unique: true });
const Team = mongoose.model('team', TeamSchema);

module.exports = Team;
