const { WEBINAR_LINK } = require('../config/system_settings');

const notifications = {
  webinar: {
    content: `You can register Crmgrow live "how to" webinar by <a href="${WEBINAR_LINK}">clicking here</a>`,
    description:
      `Every Tuesday at 1pm CST we host a deep dive live demo, where one of our experts goes through how to use the software, best practices, and Q&A. Please register to join by, <a href="https://zoom.us/meeting/register/tJUlcuyhrTgjGNUusD4B2Mtd9F_IbKCFlj_e">clicking here</a>.` +
      `We've also recorded last weeks demo, check it out <a href="https://app.crmgrow.com/video?video=5f41a6e783263323df4b2554&user=5e9a02eaefb6b2a3449245dc">here</a>.`,
  },
  automation_completed: {
    content: 'Assigned automation is completed',
  },
};

module.exports = notifications;
