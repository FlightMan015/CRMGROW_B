const mongoose = require('mongoose');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const User = require('../models/user');
const Note = require('../models/note');
const PhoneLog = require('../models/phone_log');

const noteMigrate = async () => {
  const users = await User.find({
    del: false,
  });
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const phone_logs = await PhoneLog.find({
      user: user.id,
    });
    phone_logs.forEach((phone_log) => {
      const newNote = new Note({
        user: phone_log.user,
        contact: phone_log.contact,
        content: phone_log.content,
        updated_at: phone_log.updated_at,
        created_at: phone_log.created_at,
      });

      newNote
        .save({
          timestamps: false,
        })
        .then(() => {
          console.log('created');
        })
        .catch((err) => {
          console.log('note save err', err.message);
        });
    });
  }
};

const noteTest = async () => {
  const newNote = new Note({
    user: mongoose.Types.ObjectId('5fd97ad994cf273d68a016da'),
    contact: mongoose.Types.ObjectId('606bc60e74e1dc3af76568f0'),
    content: 'new Test',
    updated_at: new Date('2020-06-20T20:42:55.792Z'),
  });

  newNote
    .save({
      timestamps: false,
    })
    .catch((err) => {
      console.log('note save err', err.message);
    });
};
noteMigrate();
// noteTest();
