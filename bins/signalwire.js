const { RelayClient, RestClient } = require('@signalwire/node');
const request = require('request-promise');
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const api = require('../config/api');
const TextHelper = require('../helpers/text');
const urls = require('../constants/urls');

const mongoose = require('mongoose');
const User = require('../models/user');
const Text = require('../models/text');
const { DB_PORT } = require('../config/database');
const moment = require('moment-timezone');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});

const client1 = new RelayClient({
  project: '4e0e6aa3-56f5-4f62-9c58-02375d0b67e7',
  token: 'PT6f14a8f00f1faf32b55753484f7e526faa03b822c87f7ad4',
});

async function main() {
  client.on('signalwire.ready', async (client) => {
    const sendResult = await client.messaging.send({
      context: 'office',
      from: '+12242592312',
      to: '+‪13124938446',
      body: 'Welcome at SignalWire!',
    });

    if (sendResult.successful) {
      console.log('Message ID: ', sendResult.messageId);
    }
    console.log('sendResult', sendResult);
  });

  client.connect();
}

const releasePhone = () => {
  const phone_numbers = [
    '2c99fd15-bf54-4cfe-938e-4e1ae6af9e45',
    '1557b0a7-5d67-48fa-a678-090c75ddb108',
    '91080ae2-dadf-42ac-8ee5-8456ff377167',
    '6fb1685b-1581-4d85-bcbc-7377f7e8a902',
    '529bf37e-8ca5-420f-a53f-aee2262a251f',
    '292aeeae-d170-4383-9434-6c798c1ec9f9',
    'a8a5c880-ee22-4fb6-8de8-d555f5ac2125',
    '693fee8a-8c85-489b-b468-fa1d31fccda6',
    '41a42bb1-5248-4667-854a-77790c7cf0c4',
    '58331f70-e06f-4be6-ac10-076fd638d9b9',
    '3865fedd-15f3-4067-8372-f51660bda4c3',
    'a3ff9e3f-1388-4353-839d-e3ece17473b1',
    '93af75cb-fefc-48ac-8005-a19a4d1ccbda',
    '3fac2c7e-23aa-4098-85a5-e1ea7e5c694e',
    '398ae929-6188-4341-9452-8a78f9022422',
    'ad269f30-a038-48de-b516-1cecdefd6423',
    '25f59c86-d390-4b15-acac-fb15909e81b5',
    '8529aaa0-9015-4fca-8792-2ac62851b644',
    '60432ded-f949-422b-8f06-18ba235b9573',
    '2823db5a-8847-4e3e-af7f-3ecab73b5a23',
    '3d98ab7a-ca28-4d11-8392-97f064aa37c6',
    '670050da-f653-4ef9-aa99-a97cdcd58287',
    '9436700d-3428-4e64-914d-de06829412cf',
    '7c793642-41b3-4e93-8762-09df944ce549',
    '103472f8-6f46-4a6c-88e6-417cfc066799',
    '6ddc02cb-1153-4cf5-90cb-401312a7c61d',
  ];
  for (let i = 0; i < phone_numbers.length; i++) {
    client
      .incomingPhoneNumbers(phone_numbers[i])
      .remove()
      .then(() => console.log(phone_numbers[i]))
      .catch((err) => console.log(err))
      .done();
  }
};

const longNumber = () => {
  client
    .availablePhoneNumbers('US')
    .tollFree.list()
    .then((availablePhoneNumbers) => {
      console.log(availablePhoneNumbers);
    });
};
// main().catch(console.error);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const sendMessage = async () => {
  const fromNumber = ['+13128205491', '+18442631354'];
  const e164Phone = ['+13124938446', '+15625480802'];
  const content1 = 'Hi, How are you? This is super testing!';
  const content =
    'Hi Super,  Garrett here with Real Estate B-School. I also emailed you but thought I would text you as well. Check out the video below and email me back or text me at 704-610-4888 and let me know if you can make it. -Lars (yes this is really Lars!) Private Confidential Zoom Meeting with Super: https://app.crmgrow.com/video?video=5e2a05c94d04d37842cc8ff9&user=5f5eabe949f8956d8647e050';

  const content2 =
    'Hi Steven, It`s John Rurkowski.Please click and listen to my short video below and text me back at 727-459-7356 so we can set up a time to discuss it. Have a great Saturday. Hello from John Rurkowski: https://app.crmgrow.com/video1/5f6f28f90f0c3a6f7fd57aa9';
  console.log('e164Phone', e164Phone[1]);

  // const j = i % 2;
  client.messages
    .create({
      from: fromNumber[0],
      to: e164Phone[0],
      body: content1,
    })
    .then(async (message) => {
      const intervalId = setInterval(function () {
        let i = 0;
        TextHelper.getStatus(message.sid).then((res) => {
          i++;
          if (res.status === 'delivered') {
            clearInterval(intervalId);
          } else if (res.status === 'sent' && i > 5) {
            clearInterval(intervalId);
          } else if (res.status === 'undelivered') {
            clearInterval(intervalId);
          }
        });
      }, 1000);
    })
    .catch((err) => {
      console.log('message send err', err);
    });
};

const receivedStatus = async () => {
  // const message_sid = '37153dcc-8ab2-4915-aad0-8e576d6a33d5';
  const message_sid = 'SMade086f7861342baa8b8f6bb4a1e12d3';

  TextHelper.getStatus(message_sid, 'twilio').then((res) => {
    console.log('res', res);
  });
};

const getSignalWireNumber = async (id) => {
  // const user = await User.findOne({ _id: id }).catch((err) => {
  //   console.log('err', err);
  // });
  const areaCode = '818';
  const countryCode = 'CA';
  let fromNumber;

  const response = await request({
    method: 'GET',
    uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/phone_numbers/search`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: api.SIGNALWIRE.PROJECT_ID,
      password: api.SIGNALWIRE.TOKEN,
    },
    qs: {
      areacode: areaCode,
    },
    json: true,
  }).catch((err) => {
    console.log('phone number get err', err);
    fromNumber = api.SIGNALWIRE.DEFAULT_NUMBER;
    return fromNumber;
  });

  if (fromNumber) {
    return fromNumber;
  }

  const number = response.data[0];
  console.log('number', number);
  /**
  if (number) {
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
        number: number.e164,
      },
      json: true,
    }).catch((err) => {
      console.log('phone number get err', err);
      fromNumber = api.SIGNALWIRE.DEFAULT_NUMBER;
      return fromNumber;
    });
  }
   */
};

// longNumber();
// buyNumber();
// sendMessage();
// releasePhone();
// receivedStatus();
// getSignalWireNumber();

const getSignalwires = async () => {
  const users = await User.find({
    del: false,
  }).catch((err) => {
    console.log('user fine err', err.message);
  });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.proxy_number_id) {
      request({
        method: 'PUT',
        uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/phone_numbers/${user.proxy_number_id}`,
        headers: {
          'Content-Type': 'application/json',
        },
        auth: {
          user: api.SIGNALWIRE.PROJECT_ID,
          password: api.SIGNALWIRE.TOKEN,
        },
        body: {
          call_request_url: urls.CALL_RECEIVE_URL1,
        },
        json: true,
      })
        .then(() => {
          console.log('number succesfully');
        })
        .catch((err) => {
          console.log('phone number update redirect err', err);
        });
    }
  }
};

const getAllNumbers = async () => {
  /**
  const client = new RestClient(
    api.SIGNALWIRE.PROJECT_ID,
    api.SIGNALWIRE.TOKEN,
    { signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE }
  );

  console.log('client.incomingPhoneNumbers', client.incomingPhoneNumbers);
  client.incomingPhoneNumbers.each((incomingPhoneNumbers) =>
    console.log(incomingPhoneNumbers.sid, incomingPhoneNumbers.phone_number)
  );
 */
  const total = 0;
  // for (let index = 0; index < 900; index += 50) {
  request({
    method: 'GET',
    uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/phone_numbers?page_number=16&page_size=50&page_token=PA222813ff-94f7-449a-8459-a2649d2095b4`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: api.SIGNALWIRE.PROJECT_ID,
      password: api.SIGNALWIRE.TOKEN,
    },
    json: true,
  })
    .then((res) => {
      const link = res.links;
      const numbers = res.data;
      console.log('link', link);
      for (let i = 0; i < numbers.length; i++) {
        const number = numbers[i];
        console.log(number.number);
        User.updateOne(
          { proxy_number: number.number },
          {
            $set: { proxy_number_id: number.id },
          }
        )
          .then(() => {
            console.log('updated successfully', total);
          })
          .catch((err) => {
            console.log('err field', number.number, err);
          });
      }
    })
    .catch((err) => {
      console.log('phone number update redirect err', err);
    });
  // }
};

const getAllId = async () => {
  const users = await User.find({
    del: false,
  }).catch((err) => {
    console.log('users find err', err.message);
  });

  for (let i = 0; i < users.length; i++) {
    if (users[i].proxy_number) {
      if (!users[i].proxy_number_id) {
        console.log(users[i].proxy_number);
      }
    }
  }
};

const registerCampaign = () => {
  request({
    method: 'POST',
    uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/registry/beta/brands`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: api.SIGNALWIRE.PROJECT_ID,
      password: api.SIGNALWIRE.TOKEN,
    },
    body: {
      name: 'crmgrowtest',
      company_name: 'crmgrow',
      contact_email: 'info@crmgrow.com',
      contact_phone: '+19194286118',
      ein_issuing_country: 'United States',
      legal_entity_type: 'NON_PROFIT',
      ein: '84-1900324',
      company_address: '3105 Cone Manor Lane, Raleigh, NC 27613',
      company_vertical: 'REAL_ESTATE',
      company_website: 'crmgrow.com',
      csp_brand_reference: 'crmgrow',
    },
    json: true,
  })
    .then((res) => {
      console.log('campaign registery', res);
    })
    .catch((err) => {
      console.log('phone number update redirect err', err);
    });
};

const getAllNumberCount = async () => {
  const users = await User.find({ del: false });
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.proxy_number) {
      const text = await Text.findOne({
        user: user.id,
        created_at: {
          $gte: moment('2021-12-01T00:10:00Z').toDate(),
        },
      });
      if (!text) {
        client
          .incomingPhoneNumbers(user.proxy_number_id)
          .remove()
          .then(() => {
            console.log(user.user_name);
            User.updateOne(
              {
                _id: user.id,
              },
              {
                $unset: {
                  proxy_number: true,
                  proxy_number_id: true,
                },
              }
            )
              .then(() => {
                console.log('done');
              })
              .catch((err) => {
                console.log('unset err', user.user_name);
              });
          })
          .catch((err) => console.log('err', user.user_name))
          .done();
      }

      // if (!text) {
      //   text = await Text.findOne({
      //     user: user.id,
      //     created_at: {
      //       $lt: moment('2022-01-01T00:10:00Z').toDate(),
      //       $gte: moment('2021-12-01T00:10:00Z').toDate(),
      //     },
      //   });

      //   if (text) {
      //     const text = await Text.findOne({
      //       user: user.id,
      //       type: 1,
      //     });

      //     if (text) {
      //       console.log(user.user_name);
      //     } else {
      //       console.log(user.user_name, '1');
      //     }
      //   }
      // }
    }
  }
};

// registerCampaign();
// getSignalwires();
// getAllNumbers();
// getAllId();
getAllNumberCount();
