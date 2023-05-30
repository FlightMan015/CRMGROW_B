const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const system_settings = require('../config/system_settings');

const UserSchema = new Schema(
  {
    user_name: String,
    nick_name: String,
    social_id: String,
    email: String,
    hash: String,
    salt: String,
    cell_phone: String,
    phone: {
      number: String,
      internationalNumber: String,
      nationalNumber: String,
      countryCode: String,
      areaCode: String,
      dialCode: String,
    },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'payment' },
    additional_payments: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'payment' },
    ],
    sub_account_payments: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'payment' },
    ],
    time_zone_info: String,
    time_zone: { type: String, default: '-07:00' },
    email_signature: { type: String, default: '' },
    pre_loaded: Boolean,
    location: { type: String, default: '' },
    proxy_number: String,
    proxy_number_id: String,
    twilio_number: String,
    twilio_number_id: String,
    picture_profile: String,
    learn_more: String,
    role: String,
    primary_connected: Boolean,
    outlook_refresh_token: String,
    google_refresh_token: String,
    yahoo_refresh_token: String,
    other_emailer: Object,
    connected_email_type: String,
    calendar_connected: Boolean,
    calendar_list: Array,
    connected_email: String,
    daily_report: Boolean,
    weekly_report: Boolean,
    admin_notification: { type: Number, default: 0 },
    desktop_notification: Boolean,
    desktop_notification_subscription: String,
    text_notification: Boolean,
    sub_account_info: {
      is_enabled: Boolean,
      is_limit: { type: Boolean, default: true },
      max_count: Number,
    },
    is_minimal: Boolean,
    is_primary: { type: Boolean, default: true },
    login_disabled: { type: Boolean, default: false },
    master_disabled: { type: Boolean, default: false },
    primary_account: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    assistant_info: {
      is_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.ASSISTANT_LIMIT.PRO,
      },
    },
    contact_info: {
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.CONTACT_UPLOAD_LIMIT.PRO,
      },
    },
    text_info: {
      is_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.TEXT_MONTHLY_LIMIT.PRO,
      },
      count: Number,
      additional_credit: Object,
    },
    calendar_info: {
      is_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.CALENDAR_LIMIT.PRO,
      },
    },
    email_info: {
      mass_enable: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.EMAIL_DAILY_LIMIT.BASIC,
      },
      count: Number,
    },
    automation_info: {
      is_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.AUTOMATION_ASSIGN_LIMIT.PRO,
      },
    },
    material_info: {
      is_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: true },
      upload_max_count: {
        type: Number,
        default: system_settings.MATERIAL_UPLOAD_LIMIT.PRO,
      },
      record_max_duration: {
        type: Number,
        default: system_settings.VIDEO_RECORD_LIMIT.PRO,
      },
    },
    team_info: {
      owner_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.TEAM_OWN_LIMIT.PRO,
      },
    },
    dialer_info: {
      is_enabled: Boolean,
      level: String,
      payment: { type: mongoose.Schema.Types.ObjectId, ref: 'payment' },
    },
    pipe_info: {
      is_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.PIPE_LIMIT.PRO,
      },
    },
    ext_email_info: {
      is_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: false },
      max_count: Number,
      emails: {
        type: Array,
        default: [],
      },
    },
    material_track_info: {
      is_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: false },
      max_count: Number,
    },
    // onboarding embedded
    user_version: { type: Number, default: 2.1 },
    capture_enabled: { type: Boolean, default: true },
    link_track_enabled: { type: Boolean, default: true },
    email_verified: Boolean,
    welcome_email: { type: Boolean, default: false },
    is_trial: { type: Boolean, default: true },
    is_free: Boolean,
    subscription: {
      is_failed: Boolean,
      updated_at: Date,
      is_suspended: { type: Boolean, default: false },
      suspended_at: Date,
      attempt_count: Number,
      amount: Number,
      period: { type: String, default: 'month' },
    },
    equal_account: { type: Number, default: 1 },
    package_level: { type: String, default: 'PRO' },
    due_commission: Number,
    paid_commission: Number,
    total_commission: Number,
    setup_oneonone: Boolean,
    created_at: Date,
    updated_at: Date,
    last_logged: Date,
    del: { type: Boolean, default: false },
    extension_single: { type: Boolean, default: false },
    disabled_at: Date,
    data_cleaned: Boolean,
    close_reason: String,
    close_feedback: String,
    admin_loggin: Boolean,
    guest_loggin: Boolean,
    sub_domain: String,
    social_link: {
      facebook: String,
      twitter: String,
      linkedin: String,
    },
    company: { type: String, default: system_settings.COMPANY.DEFAULT },
    affiliate: {
      id: String,
      link: String,
      paypal: String,
      firstpromoter_id: String,
      ref_id: String,
    },
    old_affiliate: Object,
    referred_firstpromoter: Boolean,
    parent_affiliate: String,
    smtp_connected: Boolean,
    smtp_verified: Boolean,
    campaign_info: {
      is_enabled: { type: Boolean, default: true },
    },
    email_draft: {
      subject: String,
      content: String,
    },
    text_draft: {
      content: String,
    },
    dialer: String,
    scheduler_info: {
      is_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: true },
      connected_email: String,
      calendar_id: String,
      max_count: {
        type: Number,
        default: system_settings.SCHEDULER_LIMIT.PRO,
      },
    },
    landing_page_info: {
      is_enabled: { type: Boolean, default: true },
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.LANDING_PAGE_LIMIT.PRO,
      },
    },
    onboard: {
      watched_modal: { type: Boolean, default: false },
      profile: { type: Boolean, default: false },
      connect_email: { type: Boolean, default: false },
      created_contact: { type: Boolean, default: false },
      upload_video: { type: Boolean, default: false },
      send_video: { type: Boolean, default: false },
      sms_service: { type: Boolean, default: false },
      connect_calendar: { type: Boolean, default: false },
      dialer_checked: { type: Boolean, default: false },
      tour: { type: Boolean, default: false },
      material_download: { type: Boolean, default: false },
      automation_download: { type: Boolean, default: false },
      template_download: { type: Boolean, default: false },
      complete: { type: Boolean, default: false },
    },
    support_info: {
      feature_request: { type: Boolean, default: false },
    },
    version: Object,
    iOSDeviceToken: { type: String },
    androidDeviceToken: { type: String },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

UserSchema.index({ email: 1 });
UserSchema.index({ nick_name: 1 });
UserSchema.index({ primary_account: 1 });

const User = mongoose.model('user', UserSchema);

module.exports = User;
