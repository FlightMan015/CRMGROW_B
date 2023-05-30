const mongoose = require('mongoose');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');
const FollowUp = require('../models/follow_up');
const Activity = require('../models/activity');
const User = require('../models/user');
const Contact = require('../models/contact');
const Garbage = require('../models/garbage');
const { sendNotificationEmail } = require('../helpers/email');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const moment = require('moment-timezone');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const task_activity_backup = async () => {
  Activity.deleteMany({
    type: 'follow_ups',
    created_at: {
      $gte: moment('2022-02-18T03:26:00Z').toDate(),
      $lte: moment('2022-02-18T03:41:00Z').toDate(),
    },
  })
    .then(() => {
      console.log('all should be removed');
    })
    .catch((err) => {
      console.log('remove error');
    });
};

task_activity_backup();
