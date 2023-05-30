const mongoose = require('mongoose');
const CronJob = require('cron').CronJob;
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));
const api = require('../config/api');
const system_settings = require('../config/system_settings');
const Contact = require('../models/contact');
const User = require('../models/user');
const Activity = require('../models/activity');
const FollowUp = require('../models/follow_up');
const Labels = require('../constants/label');

const addContacts = async () => {
  const admin = await User.findOne({
    email: system_settings.ADMIN_ACCOUNT,
    role: 'admin',
  }).catch((err) => {
    console.log('err', err);
  });

  if (admin) {
    const users = await User.find({ del: false }).catch((err) => {
      console.log('err', err);
    });
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      let contact;
      let label;
      let old_user;
      old_user = await Contact.findOne({
        source: user.id,
        user: admin.id,
      }).catch((err) => {
        console.log('err', err);
      });

      if (!old_user) {
        old_user = await Contact.findOne({
          email: user.email,
          user: admin.id,
        }).catch((err) => {
          console.log('find err', err);
        });
        if (old_user) {
          let tags;
          if (user.payment) {
            tags = ['active', user.company];
          } else {
            tags = ['free', user.company];
          }
          Contact.updateOne(
            {
              _id: user.id,
            },
            {
              $set: {
                source: user.id,
                tags,
                label: Labels[1].id,
              },
            }
          ).catch((err) => {
            console.log('err', err);
          });
        }
      }

      if (!old_user) {
        const week_ago = new Date();
        const month_ago = new Date();
        const two_month_ago = new Date();
        week_ago.setDate(week_ago.getDate() - 7);
        month_ago.setMonth(month_ago.getMonth() - 1);
        two_month_ago.setMonth(two_month_ago.getMonth() - 2);
        if (user.last_logged) {
          const last_logged = new Date(user.last_logged);
          const created = new Date(user.created_at);

          if (created.getTime() > week_ago.getTime()) {
            label = Labels[1].id;
          } else if (last_logged.getTime() > week_ago.getTime()) {
            label = Labels[5].id;
          } else if (last_logged.getTime() > month_ago.getTime()) {
            label = Labels[4].id;
          } else {
            label = Labels[2].id;
          }
        } else {
          label = Labels[2].id;
        }
        if (user.payment) {
          if (user.subscription && user.subscription.is_suspended) {
            contact = new Contact({
              first_name: user.user_name.split(' ')[0],
              last_name: user.user_name.split(' ')[1],
              email: user.email,
              cell_phone: user.cell_phone,
              tags: ['suspended', user.company],
              label,
              created_at: user.created_at,
              user: admin.id,
              source: user.id,
            });
          } else if (user.subscription && user.subscription.is_failed) {
            contact = new Contact({
              first_name: user.user_name.split(' ')[0],
              last_name: user.user_name.split(' ')[1],
              email: user.email,
              cell_phone: user.cell_phone,
              tags: ['failed', user.company],
              label,
              created_at: user.created_at,
              user: admin.id,
              source: user.id,
            });
          } else {
            contact = new Contact({
              first_name: user.user_name.split(' ')[0],
              last_name: user.user_name.split(' ')[1],
              email: user.email,
              cell_phone: user.cell_phone,
              tags: ['active', user.company],
              label,
              created_at: user.created_at,
              user: admin.id,
              source: user.id,
            });
          }
        } else if (
          user.last_logged &&
          new Date(user.last_logged.getTime()) > two_month_ago.getTime()
        ) {
          contact = new Contact({
            first_name: user.user_name.split(' ')[0],
            last_name: user.user_name.split(' ')[1],
            email: user.email,
            cell_phone: user.cell_phone,
            created_at: user.created_at,
            tags: ['free', user.company],
            label,
            user: admin.id,
            source: user.id,
          });
        }
        if (contact) {
          contact
            .save()
            .then((_contact) => {
              const activity = new Activity({
                content: 'added contact',
                contacts: _contact.id,
                user: admin.id,
                type: 'contacts',
                created_at: new Date(),
                updated_at: new Date(),
              });

              activity.save().then((_activity) => {
                _contact['last_activity'] = _activity.id;
                _contact
                  .save()
                  .then((__contact) => {
                    console.log('email', __contact.email);
                  })
                  .catch((err) => {
                    console.log('err', err.message);
                  });
              });
            })
            .catch((err) => {
              console.log('err', err.message);
            });
        }
      }
    }
  }
};

const updateContacts = async () => {
  const admin = await User.findOne({
    email: system_settings.ADMIN_ACCOUNT,
    role: 'admin',
  }).catch((err) => {
    console.log('admin account found', err.message);
  });

  const adminContacts = await Contact.find({ user: admin.id }).catch((err) => {
    console.log('admin contact found err', err.message);
  });
  for (let i = 0; i < adminContacts.length; i++) {
    let label;
    const adminContact = adminContacts[i];
    /**
    if (adminContact.tags && adminContact.tags.indexOf('unsubscribed') !== -1) {
      Contact.deleteOne({
        _id: adminContact.id,
        user: admin.id,
      }).catch((err) => {
        console.log('err', err.message);
      });

      Activity.deleteMany({ contacts: adminContact.id }).catch((err) => {
        console.log('activity remove error', err.message);
      });
      FollowUp.deleteMany({ contact: adminContact.id }).catch((err) => {
        console.log('activity remove error', err.message);
      });
      continue;
    }
     */

    /**
    if (adminContact.label === Labels[6].id) {
      Contact.deleteOne({
        _id: adminContact.id,
        user: admin.id,
      }).catch((err) => {
        console.log('err', err.message);
      });
      continue;
    }
     */

    if (adminContact.source) {
      const user = await User.findOne({
        _id: adminContact.source,
        del: false,
      }).catch((err) => {
        console.log('admin user found err', err.message);
      });

      if (!user) {
        Contact.updateOne(
          {
            _id: adminContact.id,
            user: admin.id,
          },
          {
            $set: { label: Labels[6].id },
          }
        ).catch((err) => {
          console.log('err', err.message);
        });
        continue;
      }

      let update_data = {};
      const week_ago = new Date();
      const month_ago = new Date();
      const two_month_ago = new Date();

      week_ago.setDate(week_ago.getDate() - 7);
      month_ago.setMonth(month_ago.getMonth() - 1);
      two_month_ago.setMonth(two_month_ago.getMonth() - 2);

      if (user.last_logged) {
        const last_logged = new Date(user.last_logged);
        const created = new Date(user.created_at);

        if (created.getTime() > week_ago.getTime()) {
          // New
          label = Labels[1].id;
        } else if (last_logged.getTime() > week_ago.getTime()) {
          //  Hot
          label = Labels[5].id;
        } else if (last_logged.getTime() > month_ago.getTime()) {
          //  Warm
          label = Labels[4].id;
        } else {
          //  Cold
          label = Labels[2].id;
        }
      } else {
        //  Cold
        label = Labels[2].id;
      }
      if (user.payment) {
        if (user.subscription && user.subscription.is_suspended) {
          update_data = {
            email: user.email,
            cell_phone: user.cell_phone,
            tags: ['suspended', user.company],
            label,
            updated_at: new Date(),
          };
        } else if (user.subscription && user.subscription.is_failed) {
          update_data = {
            email: user.email,
            cell_phone: user.cell_phone,
            tags: ['failed', user.company],
            label,
            updated_at: new Date(),
          };
        } else {
          update_data = {
            email: user.email,
            cell_phone: user.cell_phone,
            tags: ['active', user.company],
            label,
            updated_at: new Date(),
          };
        }
      } else if (
        user.last_logged &&
        new Date(user.last_logged.getTime()) > two_month_ago.getTime()
      ) {
        update_data = {
          email: user.email,
          cell_phone: user.cell_phone,
          label,
          tags: ['free', user.company],
          updated_at: new Date(),
        };
      } else {
        update_data = {
          email: user.email,
          cell_phone: user.cell_phone,
          label: Labels[6].id,
          tags: ['free', user.company],
          updated_at: new Date(),
        };
      }

      Contact.updateOne(
        { source: adminContact.source, user: admin.id },
        { $set: update_data }
      )
        .then(() => {
          console.log('updated email', adminContact.email);
        })
        .catch((err) => {
          console.log('contact update error', err.message);
        });
    }
  }
};

const sourceUpdate = async () => {
  const admin = await User.findOne({ email: 'support@crmgrow.com' }).catch(
    (err) => {
      console.log('admin account found', err.message);
    }
  );

  const adminContacts = await Contact.find({ user: admin.id }).catch((err) => {
    console.log('admin contact found err', err.message);
  });
  for (let i = 0; i < adminContacts.length; i++) {
    const adminContact = adminContacts[i];
    const user = await User.findOne({
      email: adminContact.email,
      del: false,
    }).catch((err) => {
      console.log('admin user maching contact err ', err.message);
    });
    Contact.updateOne(
      { _id: adminContact.id },
      { $set: { source: user.id } }
    ).catch((err) => {
      console.log('contact update error', err.message);
    });
  }
};

const update_contact = new CronJob(
  '0 1 * * *',
  updateContacts,
  function () {
    console.log('Reminder Job finished.');
  },
  false,
  'US/Central'
);

const add_contact = new CronJob(
  '0 2 * * *',
  addContacts,
  function () {
    console.log('Reminder Job finished.');
  },
  false,
  'US/Central'
);

const clean_user_data = new CronJob(
  '0 3 * * *',
  addContacts,
  function () {
    console.log('Reminder Job finished.');
  },
  false,
  'US/Central'
);

update_contact.start();
add_contact.start();
// clean_user_data.start();
// addContacts();
// sourceUpdate()
// updateContacts();
const clean = async () => {
  const admin = await User.findOne({
    email: system_settings.ADMIN_ACCOUNT,
    role: 'admin',
  }).catch((err) => {
    console.log('admin account found', err.message);
  });
  Activity.deleteMany({ user: admin.id }).catch((err) => {
    console.log('activity remove error', err.message);
  });
  FollowUp.deleteMany({ user: admin.id }).catch((err) => {
    console.log('activity remove error', err.message);
  });
};

// clean();
