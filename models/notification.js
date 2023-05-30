const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const NotificationSchema = new Schema(
  {
    name: String,
    type: { type: String, default: 'personal' },
    del: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' }, // receiver
    owner: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }], // receivers
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'user' }, // creator
    criteria: String,
    description: String,
    content: String,
    is_read: { type: Boolean, default: false },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    deal: [{ type: mongoose.Schema.Types.ObjectId, ref: 'deal' }],
    action: {
      object: String,
      pdf: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
      image: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
      video: [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
      folder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'folder' }],
      email: { type: mongoose.Schema.Types.ObjectId, ref: 'email' },
      template: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'email_template',
        },
      ],
      automation: [{ type: mongoose.Schema.Types.ObjectId, ref: 'automation' }],
    },
    detail: Object,
    message_sid: String,
    status: String,
    read_status: Object,
    process: String,
    deliver_status: Object,
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
    email_tracker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'email_tracker',
    },
    sharer: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    activities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'activity' }],
    followup: { type: mongoose.Schema.Types.ObjectId, ref: 'follow_up' },
    team_requester: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);
NotificationSchema.index({ message_sid: 1 });
NotificationSchema.index({ user: 1 });
const Notification = mongoose.model('notification', NotificationSchema);

module.exports = Notification;
