const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const request = require('request-promise');
const converter = require('json-2-csv');
const phone = require('phone');
const crypto = require('crypto');

const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');
const api = require('../config/api');
const User = require('../models/user');
const Garbage = require('../models/garbage');
const Team = require('../models/team');
const { setPackage } = require('../helpers/user');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const getAffiliate = async () => {
  const customers = [];
  const promise_array = [];

  fs.createReadStream('../../affiliate.csv')
    .pipe(csv())
    .on('data', async (data) => {
      const affilate_id = data['ID'];
      const auth = Buffer.from(api.REWARDFUL.API_KEY + ':').toString('base64');

      const promise = new Promise((resolve, reject) => {
        request({
          method: 'GET',
          uri: `https://api.getrewardful.com/v1/referrals?affiliate_id=${affilate_id}&limit=100&conversion_state[]=lead&conversion_state[]=conversion`,
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          json: true,
        }).then((response) => {
          const visitors = response.data;
          for (let i = 0; i < visitors.length; i++) {
            const visitor = visitors[i];
            if (visitor.customer) {
              visitor.customer.affilate = data['Email'];
              customers.push(visitor.customer);
            }
          }
          resolve();
        });
      });
      promise_array.push(promise);
    })
    .on('end', () => {
      console.log('end');
      Promise.all(promise_array).then(() => {
        converter.json2csv(customers, (err, csv) => {
          if (err) {
            throw err;
          }

          // print CSV string
          console.log(csv);
          fs.writeFileSync('todos.csv', csv);
        });
      });
    });
};

const uploadShonLeads = async () => {
  const level = 'PRO';
  const password = 'AttractionOct21';
  const timezone = {
    country: 'CA',
    name: 'EST (Eastern Standard Time: UTC -05)',
    zone: '-05:00',
    tz_name: 'America/Toronto',
    standard: '-05:00',
    daylight: '-04:00',
  };

  fs.createReadStream('../../2.csv')
    .pipe(csv())
    .on('data', async (data) => {
      const {
        Email: email,
        'First Name': first_name,
        'Last Name': last_name,
        Phone: cell_phone,
      } = data;
      const user = await User.findOne({ email, del: false }).catch((err) => {
        console.log('user find err', err.message);
      });
      if (user) {
        console.log('existing user email', email);
      } else {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto
          .pbkdf2Sync(password, salt, 10000, 512, 'sha512')
          .toString('hex');

        let user_phone;
        let user_phone1;
        if (cell_phone) {
          user_phone = phone(cell_phone)[0];
          if (user_phone) {
            user_phone1 = formatPhoneNumber1(user_phone);
          } else {
            console.log('user phone2 err', user_phone);
          }
        } else {
          console.log('user phone1 err', cell_phone);
        }

        const user = new User({
          email,
          user_name: `${first_name} ${last_name}`,
          cell_phone: user_phone,
          salt,
          hash,
          package_level: level,
          company: 'eXp Realty',
          time_zone_info: JSON.stringify(timezone),
          phone: user_phone1,
          subscription: {
            is_suspended: true,
          },
        });

        user
          .save()
          .then((_res) => {
            const garbage = new Garbage({
              user: _res.id,
              is_read: true,
            });

            garbage.save().catch((err) => {
              console.log('garbage save err', err.message);
            });

            const package_data = {
              user: _res.id,
              level,
            };

            setPackage(package_data).catch((err) => {
              console.log('user set package err', err.message);
            });
          })
          .catch((err) => {
            console.log('user creat err', err.message);
          });
      }
    });
};

const addUsersShonTeam = async () => {
  const email_data = [
    'matt@mattplumer.com',
    'doug@dougdanzey.com',
    'garrett.nann@exprealty.com',
    'tammie@homesbycrane.com',
    'kevin@thepreferredteamfl',
    'duncan.cory@gmail.com',
    'thecarters@exprealty.com',
    'niki.plenty@gmail.com',
    'frank@frankvalente.com',
    'sean.sturrock@exprealty.com',
    'dorothy.manning@exprealty.com',
    'christopher.collins@exprealty.com',
    'james.cottrell@exprealty.com',
    'brett@famrealtygroup.com',
    'rodney.heard@exprealty.com',
  ];
  fs.createReadStream('../../2.csv')
    .pipe(csv())
    .on('data', async (data) => {
      const { Email: email } = data;
      const user = await User.findOne({ email, del: false }).catch((err) => {
        console.log('user find err', err.message);
      });

      if (!email_data.includes(email)) {
        console.log('existing user email', email);
        User.updateOne(
          {
            _id: user.id,
          },
          {
            $set: {
              pre_loaded: true,
            },
          }
        ).catch((err) => {
          console.log('user update err', err.message);
        });
      }

      Team.updateOne(
        {
          _id: mongoose.Types.ObjectId('6170c6564e79390017c76e83'),
        },
        {
          $push: { members: user.id },
        }
      ).catch((err) => {
        console.log('update err', err.message);
      });
    });
};

// uploadShonLeads();
// addUsersShonTeam();

function formatPhoneNumber1(phoneNumberString) {
  var cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  var match = cleaned.match(/^(1)(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    const interNumber = '+1 ' + match[2] + '-' + match[3] + '-' + match[4];
    const nationNumber = '(' + match[2] + ') ' + match[3] + '-' + match[4];
    const number = match[2] + '-' + match[3] + '-' + match[4];
    return {
      countryCode: 'US',
      dialCode: '+1',
      internationalNumber: interNumber,
      nationalNumber: nationNumber,
      number,
    };
  }
  return null;
}

const migrateRewardful = async () => {
  const users = await User.find({
    del: false,
  });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.affiliate && user.affiliate.id) {
      User.updateOne(
        {
          _id: user.id,
        },
        {
          $set: {
            old_affiliate: {
              id: user.affiliate.id,
              link: user.affiliate.link,
            },
          },
          $unset: {
            affiliate: true,
          },
        }
      )
        .then(() => {
          console.log('user email', user.email);
        })
        .catch((err) => {
          console.log('user update err', err.message);
        });
    }
  }
};

// migrateRewardful();

const promoterList = () => {
  request({
    method: 'GET',
    uri: 'https://firstpromoter.com/api/v1/promoters/list',
    headers: {
      'x-api-key': api.FIRSTPROMOTER.API_KEY,
      'Content-Type': 'application/json',
    },
    json: true,
  })
    .then((response) => {
      console.log('response', response);
    })
    .catch((err) => {
      console.log('user firstpromoter set err', err.message);
    });
};

// promoterList();

const setPromoter = () => {
  fs.createReadStream('../../promoters.csv')
    .pipe(csv())
    .on('data', (data) => {
      const email = data['email'];
      const affiliate_id = data['id'];
      const referral_link = data['default_referral_link'];

      User.updateOne(
        {
          email,
          del: false,
        },
        {
          $set: {
            affiliate: {
              id: affiliate_id,
              link: referral_link,
            },
          },
        }
      )
        .then(() => {
          console.log('promoter updated', email);
        })
        .catch((err) => {
          console.log('user update err', err.message);
        });
    });
};

setPromoter();
