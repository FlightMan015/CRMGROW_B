const mongoose = require('mongoose');
const User = require('../models/user');
const Contact = require('../models/contact');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));
// Fetch or read data from
const migrate = async () => {
  const user = await User.findOne({
    email: 'andrelafountain@gmail.com',
  }).catch((err) => {
    console.log('err', err);
  });

  const contacts = await Contact.find({ user: user.id }).catch((err) => {
    console.log('err', err);
  });

  if (contacts) {
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const user_name = contact.first_name;
      if (user_name.split(' ')[1]) {
        console.log('user name', user_name.split(' ')[1]);
        const first_name = user_name.split(' ')[0];
        const last_name = user_name.split(' ')[1];
        Contact.updateOne(
          {
            _id: contact.id,
          },
          {
            $set: {
              first_name,
              last_name,
            },
          }
        ).catch((err) => {
          console.log('err', err);
        });
      }
    }
  }
};
migrate();
