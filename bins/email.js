const mongoose = require('mongoose');
const User = require('../models/user');
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
  const users = await User.find({ del: false }).catch((err) => {
    console.log('err', err);
  });
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    user['connected_email'] = user.email;
    user
      .save()
      .then(() => {
        console.log('email', user.email);
      })
      .catch((err) => {
        console.log('err', err.message);
      });
  }
};
migrate();
