const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const api = require('../config/api');
const mail_contents = require('../constants/mail_contents');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const { sendNotificationEmail } = require('../helpers/email');

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const sendWelcomeEmail = async (data) => {
  const { id, email, user_name, password, time_zone } = data;
  const verification_url = `${urls.DOMAIN_URL}?id=${id}`;
  const templatedData = {
    user_name,
    verification_url,
    created_at: moment().tz(time_zone).format('MMMM D, YYYY, h:mmA'),
    webinar_url: system_settings.WEBINAR_LINK,
    import_url: urls.IMPORT_CSV_URL,
    template_url: urls.CONTACT_CSV_URL,
    facebook_url: urls.FACEBOOK_URL,
    login_url: urls.LOGIN_URL,
    terms_url: urls.TERMS_SERVICE_URL,
    privacy_url: urls.PRIVACY_URL,
    unsubscription_url: urls.UNSUSCRIPTION_URL,
    connect_url: urls.PROFILE_URL,
    user_email: email,
    recording_url: urls.INTRO_VIDEO_URL,
    recording_preview: urls.RECORDING_PREVIEW_URL,
    oneonone_url: urls.ONEONONE_URL,
    password,
  };

  const params = {
    Destination: {
      ToAddresses: [email],
    },
    Source: mail_contents.REPLY,
    Template: 'Welcome',
    TemplateData: JSON.stringify(templatedData),
  };

  // Create the promise and SES service object
  console.log('params', params);
  ses
    .sendTemplatedEmail(params)
    .promise()
    .then((res) => {
      console.log('res', res);
    })
    .catch((err) => {
      console.log('send email err', err);
    });
};

const testNotificationEmail = () => {
  const data = {
    template_data: {
      user_name: 'Garrett',
      created_at: moment().tz('America/Cancun').format('h:mm MMMM Do, YYYY'),
      reason: 'New reason',
      feedback: 'Feedback',
    },
    template_name: 'CancelAccount',
    required_reply: false,
    email: mail_contents.REPLY,
    cc: 'super@crmgrow.com',
  };

  const data1 = {
    template_data: {
      user_name: 'Garrett Steve',
      created_at: moment().tz('America/Cancun').format('h:mm MMMM Do, YYYY'),
      amount: 29,
      last_4_cc: 1234,
    },
    template_name: 'PaymentFailed',
    required_reply: true,
    email: 'super@crmgrow.com',
  };

  const data2 = {
    template_data: {
      full_name: 'da jin',
      email: 'dajin@gad.ai',
      message: 'test contact us message',
    },
    template_name: 'ContactUs',
    required_reply: true,
    email: mail_contents.REPLY,
    cc: 'dajin@gad.ai',
  };

  const data3 = {
    template_data: {
      event_type_url: 'https://google.com',
      event_type_name: 'Test schedule event',
      duration: '10 mins',
      scheduled_time: moment().tz('America/Cancun').format('h:mm MMMM Do, YYYY'),
      invite_name: `dajin`,
      invite_email: 'dajin@gad.ai',
      invite_description: 'description'
    },
    template_name: 'ScheduleEvent',
    required_reply: false,
    email: 'dajin@gad.ai',
  };
  console.log('send email ===========>', data3);
  // sendWelcomeEmail(data);
  sendNotificationEmail(data3);
};

const sendVerification = () => {
  var params = {
    EmailAddress: 'super@crmgrow.com',
  };
  ses.verifyEmailIdentity(params, function (err, data) {
    if (err) console.log(err, err.stack);
    // an error occurred
    else console.log(data); // successful response
    /*
     data = {
     }
     */
  });
};

testNotificationEmail();
