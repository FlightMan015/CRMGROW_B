const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const system_settings = require('../config/system_settings');

const GarbageSchema = new Schema(
  {
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    canned_message: {
      sms: { type: mongoose.Schema.Types.ObjectId, ref: 'email_template' },
      email: { type: mongoose.Schema.Types.ObjectId, ref: 'email_template' },
    },
    edited_video: [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
    edited_pdf: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    edited_image: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    edited_automation: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'automation' },
    ],
    edited_label: [{ type: mongoose.Schema.Types.ObjectId, ref: 'label' }],
    desktop_notification: {
      material: { type: Boolean, default: false },
      text_replied: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      link_clicked: { type: Boolean, default: false },
      follow_up: { type: Boolean, default: false },
      lead_capture: { type: Boolean, default: false },
      unsubscription: { type: Boolean, default: false },
      resubscription: { type: Boolean, default: false },
      reminder_scheduler: { type: Boolean, default: false },
    },
    email_notification: {
      material: { type: Boolean, default: true },
      text_replied: { type: Boolean, default: false },
      email: { type: Boolean, default: true },
      link_clicked: { type: Boolean, default: true },
      follow_up: { type: Boolean, default: true },
      lead_capture: { type: Boolean, default: false },
      unsubscription: { type: Boolean, default: true },
      resubscription: { type: Boolean, default: true },
      reminder_scheduler: { type: Boolean, default: false },
    },
    mobile_notification: {
      material: { type: Boolean, default: true },
      text_replied: { type: Boolean, default: false },
      email: { type: Boolean, default: true },
      link_clicked: { type: Boolean, default: true },
      follow_up: { type: Boolean, default: true },
      lead_capture: { type: Boolean, default: false },
      unsubscription: { type: Boolean, default: true },
      resubscription: { type: Boolean, default: true },
      reminder_scheduler: { type: Boolean, default: false },
    },
    task_setting: {
      schedule_email: Boolean,
      schedule_text: Boolean,
      schedule_meeting: Boolean,
      default_scheduler: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'event_type',
      },
    },
    text_notification: {
      material: { type: Boolean, default: true },
      text_replied: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      link_clicked: { type: Boolean, default: false },
      follow_up: { type: Boolean, default: false },
      lead_capture: { type: Boolean, default: false },
      unsubscription: { type: Boolean, default: false },
      resubscription: { type: Boolean, default: false },
      reminder_scheduler: { type: Boolean, default: false },
    },
    reminder_before: { type: Number, default: 30 },
    reminder_scheduler: { type: Number, default: 30 },
    capture_dialog: { type: Boolean, default: false },
    capture_delay: { type: Number, default: 0 },
    capture_videos: { type: Array, default: [] },
    capture_images: { type: Array, default: [] },
    capture_pdfs: { type: Array, default: [] },
    capture_form: { type: String, default: 'default' },
    capture_forms: { type: Object, default: {} },
    capture_field: {
      type: Object,
      default: {
        default: {
          name: 'Simple Form',
          fields: [
            {
              required: true,
              name: 'Name',
              type: 'text',
              placeholder: '',
            },
            {
              required: true,
              name: 'Email',
              type: 'email',
              placeholder: '',
            },
            {
              required: false,
              name: 'Phone',
              type: 'phone',
              placeholder: '',
            },
          ],
          tags: [],
          automation: '',
          capture_delay: 0,
          capture_video: '',
        },
      },
    },
    index_page: { type: mongoose.Schema.Types.ObjectId, ref: 'page' },
    logo: { type: String },
    material_theme: { type: String, default: 'theme2' },
    auto_follow_up: {
      enabled: { type: Boolean, default: false },
      period: { type: Number, default: 0 },
      content: { type: String, default: system_settings.AUTO_FOLLOW_UP },
    },
    auto_resend: {
      enabled: { type: Boolean, default: false },
      period: { type: Number, default: 24 },
      sms_canned_message: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'email_template',
      },
      email_canned_message: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'email_template',
      },
    },
    auto_follow_up2: {
      enabled: { type: Boolean, default: false },
      period: { type: Number, default: 0 },
      content: { type: String, default: system_settings.AUTO_FOLLOW_UP },
    },
    auto_resend2: {
      enabled: { type: Boolean, default: false },
      period: { type: Number, default: 24 },
      sms_canned_message: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'email_template',
      },
      email_canned_message: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'email_template',
      },
    },
    tag_automation: Object,
    material_themes: { type: Object },
    access_token: String,
    highlights: { type: Array, default: [] },
    brands: { type: Array, default: [] },
    intro_video: { type: String },
    additional_fields: { type: Array, default: [] },
    calendar_info: {
      is_enabled: { type: Boolean, default: false },
      start_time: String,
      end_time: String,
    },
    calendly: {
      id: String,
      token: String,
      email: String,
      link: String,
    },
    zoom: {
      email: String,
      refresh_token: String,
    },
    smart_codes: Object,
    smtp_info: {
      host: String,
      user: String,
      pass: String,
      secure: Boolean,
      port: Number,
      email: String,
      smtp_sender_verified: Boolean,
      verification_code: String,
      daily_limit: Number,
      start_time: String,
      end_time: String,
    },
    email_time: {
      is_enabled: { type: Boolean, default: false },
      start_time: { type: String },
      end_time: { type: String },
      enabled_days: { type: Array },
      timezone: { type: String },
    },
    text_time: {
      is_enabled: { type: Boolean, default: false },
      start_time: { type: String },
      end_time: { type: String },
      enabled_days: { type: Array },
      timezone: { type: String },
    },
    read_notifications: [{ type: mongoose.Schema.Types.ObjectId }],
    call_labels: [{ type: String }],
    is_read: { type: Boolean },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

GarbageSchema.index({ user: 1, unique: true });
const Garbage = mongoose.model('garbage', GarbageSchema);

module.exports = Garbage;
