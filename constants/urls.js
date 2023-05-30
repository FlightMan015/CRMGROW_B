let domain = 'https://ecsbe.crmgrow.com';
const DOMAIN_NAME = 'ecsbe.crmgrow.com';
let front = 'https://app.crmgrow.com';
if (process.env.NODE_ENV === 'production') {
  domain = 'https://ecsbe.crmgrow.com';
  front = 'https://app.crmgrow.com';
} else if (process.env.NODE_ENV === 'staging') {
  domain = 'https://stg-api.crmgrow.com';
  front = 'https://stg-app.crmgrow.com';
} else if (process.env.NODE_ENV === 'development') {
  domain = 'https://stg-api1.crmgrow.com';
  front = 'https://stg-dev.crmgrow.com';
} else {
  domain = 'http://localhost:3000';
  front = 'http://localhost:4201';
}

const urls = {
  DOMAIN_ADDR: domain,
  DOMAIN_NAME,
  DOMAIN_URL: `${front}/`,
  API_URL: `${domain}/api/`,
  LOGIN_URL: `${front}/login`,
  PROFILE_URL: `${front}/profile/`,
  SOCIAL_SIGNUP_URL: `${front}/signup/`,
  INTEGRATION_URL: `${front}/settings/integration`,
  APP_SIGNIN_URL: `${domain}/social-oauth-callback/`,
  APP_SIGNUP_URL: `${domain}/social-register-callback/`,
  OUTLOOK_AUTHORIZE_URL: `${front}/profile/outlook`,
  GMAIL_AUTHORIZE_URL: `${front}/profile/gmail`,
  ZOOM_AUTHORIZE_URL: `${front}/profile/zoom`,
  GOOGLE_CALENDAR_AUTHORIZE_URL: `${front}/calendar/google`,
  OUTLOOK_CALENDAR_AUTHORIZE_URL: `${front}/calendar/outlook`,
  VIDEO_THUMBNAIL_URL: `${domain}/api/video/thumbnail/`,
  PDF_PREVIEW_URL: `${domain}/api/pdf/preview/`,
  IMAGE_PREVIEW_URL: `${domain}/api/image/preview/`,
  FILE_URL: `${domain}/api/file/`,
  VIDEO_URL: `${domain}/api/video/pipe/`,
  MATERIAL_VIEW_VIDEO_URL: `${domain}/video1/`,
  MATERIAL_USER_VIEW_VIDEO_URL: `${domain}/video`,
  MATERIAL_VIEW_PAGE: `${domain}/material`,
  MATERIAL_VIEW_PDF_URL: `${domain}/pdf1/`,
  MATERIAL_USER_VIEW_PDF_URL: `${domain}/pdf`,
  MATERIAL_VIEW_IMAGE_URL: `${domain}/image/`,
  MATERIAL_USER_VIEW_IMAGE_URL: `${domain}/image`,
  CONTACT_PAGE_URL: `${front}/contacts/`,
  DEAL_PAGE_URL: `${front}/deals/`,
  ANALYTIC_VIDEO_PAGE_URL: `${front}/materials/analytics/video/`,
  ANALYTIC_PDF_PAGE_URL: `${front}/materials/analytics/pdf/`,
  ANALYTIC_IMAGE_PAGE_URL: `${front}/materials/analytics/image/`,
  FOLLOWUP_PAGE_URL: `${front}/follow-up/`,
  ASSETS_URL: `${domain}/assets/`,
  ACCEPT_INVITATION_URL: `${domain}/api/appointment/accept?`,
  DECLINE_INVITATION_URL: `${domain}/api/appointment/decline?`,
  SMS_RECEIVE_URL: `${domain}/api/sms/receive-twilio/`,
  SMS_RECEIVE_URL1: `${domain}/api/sms/receive-signalwire/`,
  CALL_RECEIVE_URL: `${domain}/api/call/forward-twilio/`,
  CALL_RECEIVE_URL1: `${domain}/api/call/forward-signalwire/`,
  RESET_PASSWORD_URL: `${front}/reset-password/`,
  AVATAR_URL:
    'https://marketing-image-production.s3.amazonaws.com/uploads/cdf34fec41e40d4000fcf649d42a6666957666fba97ba03fa77eed3365e757943285d8cb65df1e79749c088f114af817384e9ff251957e17162e6e223379f3e2.png',
  CONTACT_CSV_URL:
    'https://teamgrow.s3.us-east-2.amazonaws.com/csv_template.csv',
  IMPORT_CSV_URL: `${front}/contacts/import-csv`,
  INTRO_VIDEO_URL: 'https://crmgrow.com/demo',
  // INTRO_VIDEO_URL: `${domain}/video?video=5eeb3e0c702a0f3536f5501a&user=5e9a02eaefb6b2a3449245dc`,
  GOOGLE_CALENDAR_URL: 'https://calendar.google.com/calendar/r/eventedit?',
  TRACK_URL: `${domain}/api/email/opened/`,
  UNSUBSCRIPTION_URL: `${domain}/unsubscribe`,
  RESUBSCRIPTION_URL: `${domain}/resubscribe/`,
  CLICK_REDIRECT_URL: `${domain}/redirect`,
  LOGO_URL: 'https://teamgrow.s3.us-east-2.amazonaws.com/image.png',
  DEFAULT_TEMPLATE_PAGE_LOGO: `${domain}/theme/images/default_logo.png`,
  STORAGE_BASE: 'https://teamgrow.s3.us-east-2.amazonaws.com',
  TEAM_LIST_URL: `${front}/teams/`,
  TEAM_URL: `${front}/team/`,
  TEAM_ACCEPT_URL: `${front}/team/accept/`,
  TEAM_ACCEPT_REQUEST_URL: `${front}/team/accept-request`,
  TEAM_CALLS: `${front}/team/calls/`,
  BILLING_URL: `${front}/profile/billing`,
  FACEBOOK_URL: 'https://www.facebook.com/crmgrow',
  TERMS_SERVICE_URL: 'https://crmgrow.com/terms_of_service.html',
  PRIVACY_URL: 'https://crmgrow.com/privacy.html',
  UNSUSCRIPTION_URL: `${front}`,
  RECORDING_PREVIEW_URL:
    'https://teamgrow.s3.us-east-2.amazonaws.com/gif120/9/5f7fd210b5c62a75b11e130b',
  ONEONONE_URL: 'https://crmgrow.com/oneonone',
  FOLLOWUP_TYPE_URL: {
    task: 'https://teamgrow.s3.us-east-2.amazonaws.com/twotone_task_black_48dp.png',
    email:
      'https://teamgrow.s3.us-east-2.amazonaws.com/twotone_email_black_48dp.png',
    material:
      'https://teamgrow.s3.us-east-2.amazonaws.com/twotone_smart_display_black_48dp.png',
    call: 'https://teamgrow.s3.us-east-2.amazonaws.com/twotone_call_black_48dp.png',
    meeting:
      'https://teamgrow.s3.us-east-2.amazonaws.com/twotone_people_black_48dp.png',
  },
  VERIFY_EMAIL_URL: `${front}/verify-email`,
};

module.exports = urls;
