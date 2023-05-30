const moment = require('moment-timezone');
const FollowUp = require('../models/follow_up');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const Garbage = require('../models/garbage');
const ActivityHelper = require('./activity');

const createFollowup = async (data) => {
  const {
    contacts,
    content,
    due_date,
    type,
    set_recurrence,
    recurrence_mode,
    user,
    task,
  } = data;

  const garbage = await Garbage.findOne({ user }).catch((err) => {
    console.log('err', err);
  });

  let reminder_before = 30;
  if (garbage) {
    reminder_before = garbage.reminder_before;
  }

  const startdate = moment(due_date);
  const remind_at = startdate.subtract(reminder_before, 'minutes');

  let detail_content = 'added task';
  detail_content = ActivityHelper.assistantLog(detail_content);

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const followUp = new FollowUp({
      task,
      type,
      content,
      due_date,
      contact,
      set_recurrence,
      recurrence_mode,
      remind_at,
      user,
    });

    followUp
      .save()
      .then((_followup) => {
        const activity = new Activity({
          content: detail_content,
          contacts: _followup.contact,
          user,
          type: 'follow_ups',
          follow_ups: _followup.id,
        });

        activity
          .save()
          .then((_activity) => {
            Contact.updateOne(
              { _id: _followup.contact },
              {
                $set: { last_activity: _activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
          })
          .catch((err) => {
            console.log('bulk create follow error', err.message);
          });
      })
      .catch((err) => {
        console.log('follow create error', err.message);
      });
  }
};
const completeFollowup = async (query) => {
  const detail_content = 'completed task';

  const follow_ups = await FollowUp.find({
    query,
  });

  for (let i = 0; i < follow_ups.length; i++) {
    const follow_up = follow_ups[i];

    FollowUp.updateOne(
      {
        _id: follow_up.id,
      },
      {
        $set: { status: 1 },
      }
    ).catch((err) => {
      console.log('followup complete update err', err.message);
    });

    const activity = new Activity({
      content: detail_content,
      contacts: follow_up.contact,
      user: follow_up.user,
      type: 'follow_ups',
      follow_ups: follow_up,
    });

    activity
      .save()
      .then((_activity) => {
        Contact.updateOne(
          { _id: follow_up.contact },
          {
            $set: { last_activity: _activity.id },
          }
        ).catch((err) => {
          console.log('activity save err', err.message);
        });
      })
      .catch((err) => {
        console.log('follow error', err.message);
      });
  }
};
module.exports = {
  createFollowup,
  completeFollowup,
};
