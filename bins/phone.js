const mongoose = require('mongoose');
const User = require('../models/user');
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');
const { sendNewMessage } = require('node-outlook/mail-api');
const api = require('../config/api');
const TextHelper = require('../helpers/text');
const urls = require('../constants/urls');

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;

const twilio = require('twilio')(accountSid, authToken);
const phone = require('phone');
const request = require('request-promise');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

// Fetch or read data from
// const migrate = async() => {
//   const users = await User.find({del: true}).catch(err=>{
//     console.log('err', err)
//   })
//   for(let i=0; i<users.length; i++){
//     const user = users[i]
//     if(user.proxy_number){
//       console.log(user.proxy_number)
//     }
//   }
// }

const migrate = async () => {
  const users = await User.find({
    del: true,
    'proxy_phone.is_released': false,
  }).catch((err) => {
    console.log('err', err);
  });
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.proxy_number) {
      const number = user.proxy_number;
      user['proxy_phone']['is_released'] = true;
      user
        .save()
        .then(() => {
          console.log(number);
        })
        .catch((err) => {
          console.err('err', err.message);
        });
    }
  }
};

const twilioNumber = async () => {
  const users = await User.find({
    del: false,
  }).catch((err) => {
    console.log('err', err);
  });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.proxy_number) {
      const number = user.proxy_number;
      user['twilio_number'] = number;
      user
        .save()
        .then(() => {
          console.log(number);
        })
        .catch((err) => {
          console.err('err', err.message);
        });
    }
  }
};

const sendSMS = () => {
  // const fromNumber = '+16474916957';
  const fromNumber = '+447578103293';
  const e164Phone = '+13124938446';
  twilio.messages
    .create({
      from: fromNumber,
      body: 'This is new testing for twilio',
      to: e164Phone,
    })
    .then((res) => {
      console.log('message send response', res);
    })
    .catch((err) => {
      console.log('message send err', err);
    });
};

// twilioNumber();
// sendSMS();

const validatePhone = (data) => {
  const validate = phone(data);
  console.log('validate', validate);
};

const receivedStatus = async () => {
  // const message_sid = '37153dcc-8ab2-4915-aad0-8e576d6a33d5';
  const message_sid = 'SM864bf86d09e74616a052b87a52a481c6';

  TextHelper.getStatus(message_sid, 'twilio').then((res) => {
    console.log('res', res);
  });
};

const buyNumber = async () => {
  const number = '+18442631354';
  const proxy_number = await request({
    method: 'POST',
    uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/phone_numbers`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: api.SIGNALWIRE.PROJECT_ID,
      password: api.SIGNALWIRE.TOKEN,
    },
    body: {
      number,
    },
    json: true,
  }).catch((err) => {
    console.log('phone number get err', err);
  });
  console.log('proxy_number', proxy_number);
};

const updateVoiceUrl = async () => {
  const users = await User.find({
    del: false,
  }).catch((err) => {
    console.log('user fine err', err.message);
  });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.twilio_number_id) {
      var options = {
        method: 'POST',
        url: `https://api.twilio.com/2010-04-01/Accounts/AC7fe2f51734b1c5dc1893faafee0bc289/IncomingPhoneNumbers/${user.twilio_number_id}.json`,
        headers: {
          Authorization:
            'Basic QUM3ZmUyZjUxNzM0YjFjNWRjMTg5M2ZhYWZlZTBiYzI4OTpiNDhiZGZkZjZmYzE2YWY1YWYyMDhjYjY5NGU5ZmQ3OA==',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        form: {
          VoiceUrl: urls.CALL_RECEIVE_URL,
        },
      };

      request(options, function (error, response) {
        if (error) throw new Error(error);
        console.log(user.twilio_number);
      });
    }
  }
};

updateVoiceUrl();

// validatePhone('7758158669');
// sendSMS();
// receivedStatus();
