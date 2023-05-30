const request = require('request-promise');

const api = require('../config/api');
const urls = require('../constants/urls');

const requestAuth = (code) => {
  const options = {
    method: 'POST',
    url: 'https://zoom.us/oauth/token',
    qs: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: urls.ZOOM_AUTHORIZE_URL,
    },
    headers: {
      /** The credential below is a sample base64 encoded credential. Replace it with "Authorization: 'Basic ' + Buffer.from(your_app_client_id + ':' + your_app_client_secret).toString('base64')"
       * */
      Authorization:
        'Basic ' +
        Buffer.from(api.CLIENT_ID + ':' + api.CLIENT_SECRET).toString('base64'),
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
};

const createMeeting = (data) => {
  const { access_token } = data;
  const options = {
    method: 'POST',
    url: 'https://api.zoom.us/v2/users/me/meetings',
    headers: {
      Authorization: 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
    body: { ...data },
    json: true,
  };

  return request(options);
};

const removeMeeting = (data) => {
  const { meeting_id, access_token } = data;
  const options = {
    method: 'DELETE',
    url: `https://api.zoom.us/v2/meetings/${meeting_id}`,
    headers: {
      Authorization: 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
  };

  return request(options);
};

const refreshToken = (refresh_token) => {
  const options = {
    method: 'POST',
    url: 'https://zoom.us/oauth/token',
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(
          api.ZOOM_CLIENT.ZOOM_CLIENT_ID +
            ':' +
            api.ZOOM_CLIENT.ZOOM_CLIENT_SECRET
        ).toString('base64'),
      'Content-Type': 'application/json',
    },
    qs: {
      grant_type: 'refresh_token',
      refresh_token,
    },
  };

  return new Promise((resolve, reject) => {
    request(options, function (error, response, body) {
      if (error) {
        console.log('zoom refresh token error', error);
        reject(error);
      }

      resolve(JSON.parse(body));
    });
  });
};

module.exports = {
  requestAuth,
  refreshToken,
  createMeeting,
  removeMeeting,
};
