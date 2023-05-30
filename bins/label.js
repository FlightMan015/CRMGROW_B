const mongoose = require('mongoose');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');
const Label = require('../models/label');
const User = require('../models/user');
const Contact = require('../models/contact');

console.log('DB_PORT', DB_PORT);
mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));
// Fetch or read data from
const LABEL_SETS = [
  { New: '5f16d58d0af09220208b6e09' },
  { Team: '5f16d58d0af09220208b6e0b' },
  { Cold: '5f16d58d0af09220208b6e0a' },
  { Warm: '5f16d58d0af09220208b6e0c' },
  { Trash: '5f16d58d0af09220208b6e0e' },
  { Hot: '5f16d58d0af09220208b6e0d' },
  { 'App set': '5f16d58d0af09220208b6e0f' },
  { 'Appt Missed': '5f16d58d0af09220208b6e10' },
  { Lead: '5f16d58d0af09220208b6e11' },
];
const create = async () => {
  const newLabel = new Label({
    role: 'admin',
    name: 'New',
    color: '#fbedc6',
    font_color: '#000',
  });

  newLabel
    .save()
    .then((label) => {
      console.log('new label saved', label.id);
    })
    .catch((err) => {
      console.log('new label save err', err.message);
    });

  const coldLabel = new Label({
    role: 'admin',
    name: 'Cold',
    color: '#00f',
    font_color: '#FFF',
  });

  coldLabel
    .save()
    .then((label) => {
      console.log('cold label saved', label.id);
    })
    .catch((err) => {
      console.log('cold label save err', err.message);
    });

  const teamLabel = new Label({
    role: 'admin',
    name: 'Team',
    color: '#0aa643',
    font_color: '#FFF',
  });

  teamLabel
    .save()
    .then((label) => {
      console.log('team label saved', label.id);
    })
    .catch((err) => {
      console.log('team label save err', err.message);
    });

  const warmLabel = new Label({
    role: 'admin',
    name: 'Warm',
    color: '#ffcb03',
    font_color: '#000',
  });

  warmLabel
    .save()
    .then((label) => {
      console.log('warm label saved', label.id);
    })
    .catch((err) => {
      console.log('warm label save err', err.message);
    });

  const hotLabel = new Label({
    role: 'admin',
    name: 'Hot',
    color: '#f94839',
    font_color: '#000',
  });

  hotLabel
    .save()
    .then((label) => {
      console.log('hot label saved', label.id);
    })
    .catch((err) => {
      console.log('hot label save err', err.message);
    });

  const trashLabel = new Label({
    role: 'admin',
    name: 'Trash',
    color: '#f94839',
    font_color: '#000',
  });

  trashLabel
    .save()
    .then((label) => {
      console.log('trash label saved', label.id);
    })
    .catch((err) => {
      console.log('trash label save err', err.message);
    });

  const apptSetLabel = new Label({
    role: 'admin',
    name: 'Appt Set',
    color: '#FFF',
    font_color: '#00f',
  });

  apptSetLabel
    .save()
    .then((label) => {
      console.log('appt set label saved', label.id);
    })
    .catch((err) => {
      console.log('appt set label save err', err.message);
    });

  const apptMissedLabel = new Label({
    role: 'admin',
    name: 'Appt Missed',
    color: '#FFF',
    font_color: '#ff0000',
  });

  apptMissedLabel
    .save()
    .then((label) => {
      console.log('appt missed label saved', label.id);
    })
    .catch((err) => {
      console.log('appt missed label save err', err.message);
    });

  const leadLabel = new Label({
    role: 'admin',
    name: 'Lead',
    color: '#FFF',
    font_color: '#444',
  });

  leadLabel
    .save()
    .then((label) => {
      console.log('lead label saved', label.id);
    })
    .catch((err) => {
      console.log('lead label save err', err.message);
    });
};

const migrate = async () => {
  const users = await User.find({ del: false }).catch((err) => {
    console.log('user found err', err.message);
  });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const contacts = await Contact.find({ user }).catch((err) => {
      console.log('contact found err', err.message);
    });

    for (let j = 0; j < contacts.length; j++) {
      const contact = contacts[j];
      if (contact.label) {
        let label;
        switch (contact.label) {
          case 'New':
            label = '5f16d58d0af09220208b6e09';
            break;
          case 'Team':
            label = '5f16d58d0af09220208b6e0b';
            break;
          case 'Cold':
            label = '5f16d58d0af09220208b6e0a';
            break;
          case 'Warm':
            label = '5f16d58d0af09220208b6e0c';
            break;
          case 'Hot':
            label = '5f16d58d0af09220208b6e0d';
            break;
          case 'Trash':
            label = '5f16d58d0af09220208b6e0e';
            break;
          case 'Appt set':
            label = '5f16d58d0af09220208b6e0f';
            break;
          case 'Appt Set':
            label = '5f16d58d0af09220208b6e0f';
            break;
          case 'Appt Missed':
            label = '5f16d58d0af09220208b6e10';
            break;
          case 'Lead':
            label = '5f16d58d0af09220208b6e11';
            break;
          default:
            console.log(`No defined, ${contact.label}.`);
        }
        contact.label = label;
        contact
          .save()
          .then(() => {
            console.log('contact updated', contact.email);
          })
          .catch((err) => {
            console.log('contact err', err.message);
          });
      }
    }
  }
};

const fredMigrate = async () => {
  await Label.deleteMany({
    user: mongoose.Types.ObjectId('5f9051174197df49a8da8b2d'),
    _id: {
      $nin: [
        mongoose.Types.ObjectId('60b194d87ed8587ffb029de0'),
        mongoose.Types.ObjectId('5f91d58f547b0c540f251e28'),
      ],
    },
  });

  /**
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const contact = await Contact.findOne({
      label: label.id,
      user: mongoose.Types.ObjectId('5f9051174197df49a8da8b2d'),
    });

    if (contact) {
      Contact.updateOne(
        {
          _id: contact.id,
        },
        {
          $push: {
            tags: { $each: [label.name] },
          },
          $unset: {
            label: true,
          },
        }
      )
        .then(() => {
          console.log('contact updated');
        })
        .catch((err) => {
          console.log('contact update err', err.message);
        });
    }
  }
   */
};

fredMigrate();
// migrate();
// create();
