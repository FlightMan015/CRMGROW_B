const mongoose = require('mongoose');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');
const FollowUp = require('../models/follow_up');
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

const followup_test = async () => {
  const due_date = new Date();

  const reminder_array = await FollowUp.find({
    user: '5fd97ad994cf273d68a016da',
    remind_at: { $lte: due_date },
    status: 0,
  }).catch((err) => {
    console.log('followup find err', err.message);
  });

  for (let i = 0; i < 1; i++) {
    const follow_up = reminder_array[i];
    const user = await User.findOne({
      _id: follow_up.user,
      del: false,
    }).catch((err) => {
      console.log('err: ', err);
    });

    if (!user) {
      continue;
    }

    const contact = await Contact.findOne({
      _id: follow_up.contact,
    }).catch((err) => {
      console.log('err: ', err.message);
    });

    const garbage = await Garbage.findOne({ user: user.id }).catch((err) => {
      console.log('err: ', err.message);
    });

    const email_notification = garbage['email_notification'];

    const time_zone = user.time_zone_info
      ? JSON.parse(user.time_zone_info).tz_name
      : system_settings.TIME_ZONE;

    const due_date = moment(follow_up.due_date).tz(time_zone).format('h:mm a');

    if (email_notification['follow_up']) {
      const type = follow_up.type || 'task';

      const data = {
        template_data: {
          user_name: user.user_name,
          created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
          contact_url: urls.CONTACT_PAGE_URL + contact.id,
          contact_name: `${contact.first_name} ${contact.last_name}`,
          follow_up_type: type,
          follow_up_description: follow_up.content,
          follow_up_type_url: urls.FOLLOWUP_TYPE_URL[type],
          due_start: due_date,
        },
        cc: 'superwebtop@outlook.com',
        template_name: 'TaskReminder',
        required_reply: false,
        email: user.email,
      };

      sendNotificationEmail(data);
    }
  }
};

const followup_migrate = async () => {
  const users = await User.find({
    del: true,
  }).catch((err) => {
    console.log('user find err', err.message);
  });

  const follow_ups = await FollowUp.deleteMany({
    user: { $in: users },
  })
    .then(() => {
      console.log('remove old followups successfully');
    })
    .catch((err) => {
      console.log('follows err', err.message);
    });
};

// followup_migrate();
followup_test();
