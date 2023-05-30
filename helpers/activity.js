const Activity = require('../models/activity');
const Contact = require('../models/contact');

const assistantLog = (content) => {
  return `${content} (assistant)`;
};

const autoSettingLog = (content) => {
  return `${content} (auto setting)`;
};

const automationLog = (content) => {
  return `${content} (automation)`;
};

const apiLog = (content) => {
  return `${content} (api)`;
};

const campaignLog = (content) => {
  return `${content} (campaign)`;
};

const activityLog = (content, mode) => {
  let activity_content = 'sent email';

  switch (mode) {
    case 'automation':
      activity_content = `${content} (automation)`;
      break;
    case 'campaign':
      activity_content = `${content} (campaign)`;
      break;
    case 'api':
      activity_content = `${content} (api)`;
      break;
  }

  return activity_content;
};

const updateLastActivity = async (ids) => {
  const last_activities = [];
  for (let i = 0; i < ids.length; i++) {
    const last_activity = await Activity.find({
      contacts: ids[i],
      status: { $ne: 'pending' },
    })
      .sort({ updated_at: -1 })
      .limit(1)
      .catch((err) => {
        console.log('last activity getting err', err.message);
      });

    if (last_activity.length > 0) {
      Contact.updateOne(
        { _id: ids[i] },
        {
          $set: { last_activity: last_activity[0]['_id'] },
        }
      ).catch((err) => {
        console.log('update contact err', err.message);
      });
    } else {
      Contact.updateOne(
        { _id: ids[i] },
        {
          $unset: { last_activity: true },
        }
      ).catch((err) => {
        console.log('update contact err', err.message);
      });
    }
    const activity_object = {};
    activity_object[ids[i]] = last_activity;
    last_activities.push(activity_object);
  }

  return last_activities;
};

module.exports = {
  assistantLog,
  autoSettingLog,
  automationLog,
  apiLog,
  campaignLog,
  activityLog,
  updateLastActivity,
};
