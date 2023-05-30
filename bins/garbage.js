const mongoose = require('mongoose');
const User = require('../models/user');
const Garbage = require('../models/garbage');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const migrate = async () => {
  const users = await User.find({ del: false }).catch((err) => {
    console.log('err', err);
  });
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    Garbage.findOne({
      user: user.id,
    })
      .then((res) => {
        console.log('data', res);
        if (!res) {
          const garbage = new Garbage({
            user: user.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          garbage.save().catch((err) => {
            console.log('err', err);
          });
        }
      })
      .catch((err) => {
        console.log('err', err);
      });
  }
};
// migrate();

const lowerCustomCode = async () => {
  const users = await User.find({
    del: false,
  });

  // const user = await User.findOne({
  //   email: 'super@crmgrow.com',
  //   del: false,
  // });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const garbage = await Garbage.findOne({
      user: user.id,
    });
    if (garbage && garbage.smart_codes) {
      const new_smart_codes = {};
      Object.keys(garbage.smart_codes).forEach((key) => {
        const code = key.toLowerCase().trim();
        new_smart_codes[code] = garbage.smart_codes[key];
      });
      Garbage.updateOne(
        {
          user: user.id,
        },
        {
          $set: {
            smart_codes: new_smart_codes,
          },
        }
      )
        .then(() => {
          console.log('new smart code', new_smart_codes);
        })
        .catch((err) => {
          console.log('new smart code', err.message);
        });
    }
  }
};

lowerCustomCode();
