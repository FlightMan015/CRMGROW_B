const request = require('request-promise');

const CLIENT_ID = 'xC8pDCZvScGYKNmq6qwdAg';
const CLIENT_SECRET = 'xRZc4tonQvuJ77TBWi0oTo1lwxQZDy0r';
const ACCESS_TOKEN =
  'eyJhbGciOiJIUzUxMiIsInYiOiIyLjAiLCJraWQiOiI0NjdlMWY1YS05NGI5LTRkNTktODE2Ni1kYzEzNGJmNDUwYjIifQ.eyJ2ZXIiOjcsImF1aWQiOiI4ODhkZjk3ZWM4Y2RjZThiNTU4YTk0YWYyZWU4YTQyOSIsImNvZGUiOiJ3ZnFydEc4M0ZGXzhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJpc3MiOiJ6bTpjaWQ6eEM4cERDWnZTY0dZS05tcTZxd2RBZyIsImdubyI6MCwidHlwZSI6MCwidGlkIjowLCJhdWQiOiJodHRwczovL29hdXRoLnpvb20udXMiLCJ1aWQiOiI4bkdLcTFJeVJXQ0lkYTVfN1ZteWN3IiwibmJmIjoxNjE5MDI5Mjg5LCJleHAiOjE2MTkwMzI4ODksImlhdCI6MTYxOTAyOTI4OSwiYWlkIjoic0pBbVFMMmZReUdTcnFZWUZNNlFEQSIsImp0aSI6IjE3MGJhMTAwLWY0YzMtNGQzZC05ZjUwLTRiMjE2ODhmZjM3OSJ9.-892WhdmJ4n6zRtucquiTZGzrmzxGRu4qW8tt9aR055_8MD1sWciSJoT-d0aSAEK_KYJcSdqMGHScUG48AyKfA';
const REFRESH_TOKEN =
  'eyJhbGciOiJIUzUxMiIsInYiOiIyLjAiLCJraWQiOiI3ZjY2ZGNhYi01NGQ4LTRmZDYtYjFlYy0xOTI1NmIzMWRjMTEifQ.eyJ2ZXIiOjcsImF1aWQiOiI2NzkyNzM3MGM1N2FiYjE0YzNmNjNmYWQ2MDFmM2I4NyIsImNvZGUiOiJoNm9ZNWhDMGJOXzhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJpc3MiOiJ6bTpjaWQ6eEM4cERDWnZTY0dZS05tcTZxd2RBZyIsImdubyI6MCwidHlwZSI6MSwidGlkIjowLCJhdWQiOiJodHRwczovL29hdXRoLnpvb20udXMiLCJ1aWQiOiI4bkdLcTFJeVJXQ0lkYTVfN1ZteWN3IiwibmJmIjoxNjE4OTg3NTMyLCJleHAiOjIwOTIwMjc1MzIsImlhdCI6MTYxODk4NzUzMiwiYWlkIjoic0pBbVFMMmZReUdTcnFZWUZNNlFEQSIsImp0aSI6IjYzODRiYzhiLWE3NTQtNDhkYy05YmU3LTJjZjExNjBhZDNlNiJ9.PhQQGRlHO_sItldZKpZ-GDu1MN7hlUU-4_DGWcPO5qWlq2OwaJtkl2mXP3m2ylWLNm_YvfUmgJm9IASnG5vh9g';

const requestAuth = () => {
  var options = {
    method: 'POST',
    url: 'https://zoom.us/oauth/token',
    qs: {
      grant_type: 'authorization_code',
      // The code below is a sample authorization code. Replace it with your actual authorization code while making requests.
      code: 'wfqrtG83FF_8nGKq1IyRWCIda5_7Vmycw',
      // The uri below is a sample redirect_uri. Replace it with your actual redirect_uri while making requests.
      redirect_uri:
        'http://teamgrow-staticsite-green.s3-website-us-west-1.amazonaws.com/profile/zoom',
    },
    headers: {
      /** The credential below is a sample base64 encoded credential. Replace it with "Authorization: 'Basic ' + Buffer.from(your_app_client_id + ':' + your_app_client_secret).toString('base64')"
       * */
      Authorization:
        'Basic ' +
        Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
};

const createMeeting = () => {
  const BODY = {
    topic: 'string',
    type: 'integer',
    start_time: 'string [date-time]',
    duration: 'integer',
    schedule_for: 'string',
    timezone: 'string',
    password: 'string',
    agenda: 'string',
    recurrence: {
      type: 'integer',
      repeat_interval: 'integer',
      weekly_days: 'string',
      monthly_day: 'integer',
      monthly_week: 'integer',
      monthly_week_day: 'integer',
      end_times: 'integer',
      end_date_time: 'string [date-time]',
    },
    settings: {
      host_video: 'boolean',
      participant_video: 'boolean',
      cn_meeting: 'boolean',
      in_meeting: 'boolean',
      join_before_host: 'boolean',
      mute_upon_entry: 'boolean',
      watermark: 'boolean',
      use_pmi: 'boolean',
      approval_type: 'integer',
      registration_type: 'integer',
      audio: 'string',
      auto_recording: 'string',
      enforce_login: 'boolean',
      enforce_login_domains: 'string',
      alternative_hosts: 'string',
      global_dial_in_countries: ['string'],
      registrants_email_notification: 'boolean',
    },
  };

  var options = {
    method: 'POST',
    url: 'https://api.zoom.us/v2/users/me/meetings',
    headers: {
      /** The credential below is a sample base64 encoded credential. Replace it with "Authorization: 'Basic ' + Buffer.from(your_app_client_id + ':' + your_app_client_secret).toString('base64')"
       * */
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: {
      topic: 'This is new test',
      start_time: new Date(),
      type: 2,
      agenda: 'This is a meeting with a Super',
      duration: 30,
    },
    json: true,
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
};

const refreshToken = () => {
  var options = {
    method: 'POST',
    url: 'https://zoom.us/oauth/token',
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      'Content-Type': 'application/json',
    },
    qs: {
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
};

const getMe = () => {
  const profile_option = {
    method: 'GET',
    url: 'https://api.zoom.us/v2/users/me',
    headers: {
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
  };

  request(profile_option, function (error, response, body) {
    const { email } = JSON.parse(body);
    console.log('email', email);
  });
};

// requestAuth();
// refreshToken();
// createMeeting();
getMe();
