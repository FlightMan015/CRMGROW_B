const mongoose = require('mongoose');
const User = require('../models/user');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));
// Fetch or read data from
const search = async () => {
  //   const user = await User.findOne({
  //     email: 'andrelafountain@gmail.com',
  //   }).catch((err) => {
  //     console.log('err', err);
  //   });

  const user_id = '5fb42aca7eb22804afd30319';

  const due_date = new Date('2020-12-16T14:52:53.728Z');
  const contacts = await Activity.find({
    user: user_id,
    updated_at: { $lte: due_date },
  }).sort({ _id: -1 })
  .populate('contacts')
  .skip(skip)
  .limit(size * 5).catch((err) => {
    console.log('contacts find err', err.message);
  });

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    if (contact) {
      Activity.deleteOne({
        contacts: contact.id,
      }).catch((err) => {
        console.log('activity remove err', err.message);
      });
      Contact.deleteOne({
        _id: contact.id,
      }).catch((err) => {
        console.log('contact remove err', err.message);
      });
    }
  }
};
search();
