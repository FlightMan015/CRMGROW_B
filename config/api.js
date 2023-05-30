const api = {
  AWS: {
    AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_REGION: process.env.AWS_S3_REGION,
    AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
    AWS_SES_REGION: process.env.AWS_SES_REGION,
    AWS_PRIVATE_S3_BUCKET: process.env.AWS_PRIVATE_S3_BUCKET,
    CLOUDFRONT_ACCESS_KEY: process.env.CLOUDFRONT_ACCESS_KEY,
    CLOUDFRONT_PUBLIC_KEY: process.env.CLOUDFRONT_PUBLIC_KEY,
    CLOUDFRONT: process.env.CLOUDFRONT,
    API_GATEWAY:
      process.env.API_GATEWAY ||
      'https://f8nhu9b8o4.execute-api.us-east-2.amazonaws.com',
  },
  OUTLOOK_CLIENT: {
    OUTLOOK_CLIENT_ID: process.env.OUTLOOK_CLIENT_ID,
    OUTLOOK_CLIENT_SECRET: process.env.OUTLOOK_CLIENT_SECRET,
  },
  GMAIL_CLIENT: {
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
  },
  YAHOO_CLIENT: {
    YAHOO_CLIENT_ID: process.env.YAHOO_CLIENT_ID,
    YAHOO_CLIENT_CECRET: process.env.YAHOO_CLIENT_CECRET,
  },
  ZOOM_CLIENT: {
    ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID,
    ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
  },
  JWT_SECRET:
    process.env.JWT_SECRET || 'THIS IS USED TO SIGN AND VERIFY JWT TOKENS',
  SENDGRID: {
    SENDGRID_KEY: process.env.SENDGRID_KEY,
    SENDGRID_APPOITMENT_TEMPLATE:
      process.env.SENDGRID_APPOITMENT_TEMPLATE ||
      'd-6e29f70dd72b4667afea58314bfbc2a7',
    SENDGRID_NOTICATION_TEMPLATE:
      process.env.SENDGRID_NOTICATION_TEMPLATE ||
      'd-e8af9d714f7344cc8c847b5ab096ab14',
    SENDGRID_DAILY_REPORT_TEMPLATE:
      process.env.SENDGRID_DAILY_REPORT_TEMPLATE ||
      'd-4f6682ae1f1d4d1b94317cefa31e24d4',
    SENDGRID_WEEKLY_REPORT_TEMPLATE:
      process.env.SENDGRID_WEEKLY_REPORT_TEMPLATE ||
      'd-2573c1290cdd4cf9b4917561e4a9d1ae',
    SENDGRID_FOLLOWUP_REMINDER_TEMPLATE:
      process.env.SENDGRID_FOLLOWUP_REMINDER_TEMPLATE ||
      'd-9746307f64714c96860be74362a952af',
    SENDGRID_APPOINTMENT_REMINDER_TEMPLATE:
      process.env.SENDGRID_APPOINTMENT_REMINDER_TEMPLATE ||
      'd-54a3f51c073d49c1a0277903deb6520b',
    SENDGRID_APPOINTMENT_NOTIFICATION_TEMPLATE:
      process.env.SENDGRID_APPOINTMENT_NOTIFICATION_TEMPLATE ||
      'd-0a022398ae784e2589e7815a75127ba9',
    SENDGRID_WELCOME_TEMPLATE:
      process.env.SENDGRID_WELCOME_TEMPLATE ||
      'd-8d02186ef9eb4606b07d554a105f56e2',
    SENDGRID_SIGNUP_FLOW_FIRST:
      process.env.SENDGRID_SIGNUP_FLOW_FIRST ||
      'd-5b173abe1ebc4a9eb8ccde097e1e3860',
    SENDGRID_SIGNUP_FLOW_SECOND:
      process.env.SENDGRID_SIGNUP_FLOW_SECOND ||
      'd-c044da37b4c94ec2bfa056149392d74d',
    SENDGRID_SIGNUP_FLOW_REACH:
      process.env.SENDGRID_SIGNUP_FLOW_REACH ||
      'd-5216f3be8efb41dcaef4ca69d0b6f6ca',
    SENDGRID_SIGNUP_FLOW_THIRD:
      process.env.SENDGRID_SIGNUP_FLOW_THIRD ||
      'd-ada9743225184690b6a14ca92df76cf7',
    SENDGRID_SIGNUP_FLOW_FORTH:
      process.env.SENDGRID_SIGNUP_FLOW_FORTH ||
      'd-12bb4db57b5b4107b7c9380825cb82ae',
    SENDGRID_SYSTEM_NOTIFICATION:
      process.env.SENDGRID_SYSTEM_NOTIFICATION ||
      'd-a829cc5764184be695de903030681eb5',
    SENDGRID_INVITE_GUEST:
      process.env.SENDGRID_INVITE_GUEST || 'd-5c8deb9857ec46a08b65ac484bbd9c92',
    NOTIFICATION_INVITE_TEAM_MEMBER:
      process.env.NOTIFICATION_INVITE_TEAM_MEMBER ||
      'd-b7cdf4b01448440f80ba0d2a88ac3310',
    TEAM_ACCEPT_NOTIFICATION:
      process.env.TEAM_ACCEPT_NOTIFICATION ||
      'd-c8561720ef7a4b87bed4bfbffd38f00e',
  },
  TWILIO: {
    TWILIO_SID: process.env.TWILIO_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_NUMBER: process.env.TWILIO_NUMBER,
    SYSTEM_NUMBER: '+18445531347',
  },
  VAPID: {
    PUBLIC_VAPID_KEY: process.env.PUBLIC_VAPID_KEY,
    PRIVATE_VAPID_KEY: process.env.PRIVATE_VAPID_KEY,
  },
  STRIPE: {
    SECRET_KEY: process.env.SECRET_KEY,
    PLAN: {
      LITE: process.env.STRIPE_PLAN_LITE,
      PRO: process.env.STRIPE_PLAN_PRO,
      EVO_PRO: process.env.STRIPE_PLAN_PRO,
      ELITE: process.env.STRIPE_PLAN_ELITE,
      EVO_ELITE: process.env.STRIPE_PLAN_ELITE,
      MINIMAL: process.env.STRIPE_PLAN_MINIMAL,
      SLEEP: process.env.STRIPE_PLAN_SLEEP,
      EXT_MONTH: process.env.STRIPE_PLAN_EXT_MONTH,
      EXT_YEAR: process.env.STRIPE_PLAN_EXT_YEAR,
    },
    DISCOUNT: {
      TWENTY: process.env.STRIPE_DISCOUNT_TWENTY,
    },
    DIALER: {
      PREV: process.env.STRIPE_DIALER_PREV,
      SINGLE: process.env.STRIPE_DIALER_SINGLE,
      MULTI: process.env.STRIPE_DIALER_MULTI,
    },
  },
  EMAIL_VERIFICATION_KEY: process.env.EMAIL_VERIFICATION_KEY,
  REWARDFUL: {
    API_KEY: process.env.REWARDFUL_API_KEY,
  },
  FIRSTPROMOTER: {
    API_KEY: process.env.FIRSTPROMOTER_API_KEY,
  },
  SIGNALWIRE: {
    PROJECT_ID: process.env.SIGNALWIRE_PROJECT_ID,
    TOKEN: process.env.SIGNALWIRE_TOKEN,
    WORKSPACE: 'https://crmgrow.signalwire.com',
    WORKSPACE_DOMAIN: 'crmgrow.signalwire.com',
    SYSTEM_NUMBER: '+18445193609',
    EMAIL_NUMBER: '+18445176437',
    DEFAULT_NUMBER2: '+13127391036',
    DEFAULT_NUMBER: '+18442631354',
  },
  UNLAYER: {
    PROJECT_ID: process.env.UNLAYER_PROJECT_ID,
  },
  DIALER: {
    VENDOR_ID: process.env.WAVV_VENDOR_ID,
    API_KEY: process.env.WAVV_API_KEY,
  },
  CONVRRT: {
    JWT_SECRET: process.env.CONVRRT_JWT_SECRET,
    PROJECT_ID: process.env.CONVRRT_PROJECT_ID,
    ORG_ID: process.env.CONVRRT_ORG_ID,
  },
  FIREBASE: {
    type: process.env.FB_TYPE || 'service_account',
    project_id: process.env.FB_PROJECT_ID || 'crmgrow-xxxxx',
    private_key_id:
      process.env.FB_PRIVATE_KEY_ID || 'xxxxx3fb6cfcb8f9ea66146ccrmgrowcrmgrow',
    private_key:
      process.env.FB_PRIVATE_KEY ||
      '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n',
    client_email:
      process.env.FB_CLIENT_EMAIL ||
      'firebase-adminsdk-xxxxx@crmgrow-xxxxx.iam.gserviceaccount.com',
    client_id: process.env.FB_CLIENT_ID || 'crmgrow4274335crmgrow',
    auth_uri:
      process.env.FB_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    token_uri:
      process.env.FB_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url:
      process.env.FB_AUTH_PROVIDER_CERT_URI ||
      'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url:
      process.env.FB_CLIENT_CERT_URI ||
      'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx2%40crmgrow-xxxxx.iam.gserviceaccount.com',
  },
};

module.exports = api;
