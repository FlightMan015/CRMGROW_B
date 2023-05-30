const mongoose = require('mongoose');
const User = require('../models/user');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));
// Fetch or read data from

const migrate = async () => {
  const users = await User.find({}).catch((err) => {
    console.log('err', err);
  });
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const contacts = await Contact.find({ user }).catch((err) => {
      console.log('err', err);
    });
    if (contacts) {
      for (let j = 0; j < contacts.length; j++) {
        const contact = contacts[j];
        console.log(contact.id);
        if (!contacts[j].last_activity) {
          const last_activity = await Activity.find({ contacts: contact.id })
            .sort({ updated_at: -1 })
            .limit(1)
            .catch((err) => {
              console.log('err', err);
            });
          if (last_activity[0]) {
            contact['last_activity'] = last_activity[0].id;
            contact.save().catch((err) => {
              console.log('err', err);
            });
          }
        }
      }
    }
  }
};
migrate();
