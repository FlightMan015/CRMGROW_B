const jwt = require('jsonwebtoken');
const Garbage = require('../models/garbage');
const api = require('../config/api');
const { REDIS_ENDPOINT } = require('../config/redis');
const io = require('socket.io-emitter')({ host: REDIS_ENDPOINT, port: 6379 });

const User = require('../models/user');
const {
  sendEmailNotification,
  sendTextNotification,
  sendWebPushNotification,
  sendMobileNotification,
  createDBNotification,
} = require('./notificationImpl');

const setupNotification = (io) => {
  io.on('connection', async (socket) => {
    socket.emit('connected');

    socket.on('join', async (data) => {
      if (data.token) {
        let decoded;
        try {
          decoded = jwt.verify(data.token, api.JWT_SECRET);
        } catch (err) {
          console.log('check verify error', err.message || err.msg);
          socket.emit('error', { type: 'auth_failed', message: 'jwt_invalid' });
          socket.disconnect();
          return;
        }

        const user = await User.findOne({ _id: decoded.id }).catch((err) => {
          console.log('err', err);
        });
        if (!user) {
          socket.emit('error', {
            type: 'auth_failed',
            message: 'not_found_user',
          });
          socket.disconnect();
          return;
        }
        socket.join(user._id, () => {
          socket.emit('joined');
        });
      }
    });

    socket.on('leave', async (data) => {
      if (data.token) {
        let decoded;
        try {
          decoded = jwt.verify(data.token, api.JWT_SECRET);
        } catch (err) {
          console.log('check verify error', err.message || err.msg);
          socket.emit('error', { type: 'auth_failed', message: 'jwt_invalid' });
          socket.disconnect();
          return;
        }

        const user = await User.findOne({ _id: decoded.id }).catch((err) => {
          console.log('err', err);
        });
        if (!user) {
          socket.emit('error', {
            type: 'auth_failed',
            message: 'not_found_user',
          });
          socket.disconnect();
          return;
        }
        socket.leave(user._id);
      }
    });
  });
};

const createNotification = async (
  type,
  notification,
  targetUser,
  sourceUser
) => {
  // Read the notification setting information
  const garbage = await Garbage.findOne({
    user: targetUser._id,
  }).catch((err) => {
    console.log('not_found_user_setting_notification', err);
  });
  const emailNotification = garbage.email_notification || {};
  const textNotification = garbage.text_notification || {};
  const desktopNotification = garbage.desktop_notification || {};
  const mobileNotification = garbage.mobile_notification || {};

  let userObject;
  // Check the notification type and setting and call detail functions
  switch (type) {
    case 'watch_video':
    case 'review_pdf':
    case 'review_image':
      // check the email notification setting
      emailNotification.material &&
        sendEmailNotification(type, notification, targetUser);
      // check the text notification setting
      textNotification.material &&
        sendTextNotification(type, notification, targetUser);
      // check the mobile notification setting
      mobileNotification.material &&
        sendMobileNotification(type, notification, targetUser);
      // check the desktop notification setting
      desktopNotification.material &&
        sendSocketNotification('notification', targetUser, {
          ...notification,
          criteria: type,
        });
      break;
    case 'video_lead_capture':
    case 'pdf_lead_capture':
    case 'image_lead_capture':
    case 'video_interesting_capture':
    case 'pdf_interesting_capture':
    case 'image_interesting_capture':
      // check the email notification setting
      emailNotification.lead_capture &&
        sendEmailNotification(type, notification, targetUser);
      // check the text notification setting
      textNotification.lead_capture &&
        sendTextNotification(type, notification, targetUser);
      // check the mobile notification setting
      mobileNotification.lead_capture &&
        sendMobileNotification(type, notification, targetUser);
      // check the desktop notification setting
      desktopNotification.lead_capture &&
        sendSocketNotification('notification', targetUser, {
          ...notification,
          criteria: type,
        });
      break;
    // case 'open_email':
    //   // check the email notification setting
    //   emailNotification.email &&
    //     sendEmailNotification(type, notification, targetUser);
    //   // check the text notification setting
    //   textNotification.email &&
    //     sendTextNotification(type, notification, targetUser);
    //   // check the mobile notification setting
    //   mobileNotification.email &&
    //     sendMobileNotification(type, notification, targetUser);
    //   // check the desktop notification setting
    //   desktopNotification.email &&
    //     sendSocketNotification('notification', targetUser, notification);
    //   break;
    // case 'click_link':
    //   // check the email notification setting
    //   emailNotification.link_clicked &&
    //     sendEmailNotification(type, notification, targetUser);
    //   // check the text notification setting
    //   textNotification.link_clicked &&
    //     sendTextNotification(type, notification, targetUser);
    //   // check the mobile notification setting
    //   mobileNotification.link_clicked &&
    //     sendMobileNotification(type, notification, targetUser);
    //   // check the desktop notification setting
    //   desktopNotification.link_clicked &&
    //     sendSocketNotification('notification', targetUser, notification);
    //   break;
    case 'unsubscribe_email':
      // check the email notification setting
      emailNotification.unsubscription &&
        sendEmailNotification(type, notification, targetUser);
      // check the text notification setting
      textNotification.unsubscription &&
        sendTextNotification(type, notification, targetUser);
      // check the mobile notification setting
      mobileNotification.unsubscription &&
        sendMobileNotification(type, notification, targetUser);
      // check the desktop notification setting
      desktopNotification.unsubscription &&
        sendSocketNotification('notification', targetUser, notification);
      break;
    case 'unsubscribe_text':
      // check the email notification setting
      emailNotification.unsubscription &&
        sendEmailNotification(type, notification, targetUser);
      // check the text notification setting
      textNotification.unsubscription &&
        sendTextNotification(type, notification, targetUser);
      // check the mobile notification setting
      mobileNotification.unsubscription &&
        sendMobileNotification(type, notification, targetUser);
      // check the desktop notification setting
      desktopNotification.unsubscription &&
        sendSocketNotification('notification', targetUser, notification);
      break;
    case 'lead_capture':
      sendSocketNotification('notification', targetUser, notification);
      break;
    case 'receive_text':
      // check the email notification setting
      emailNotification.text_replied &&
        sendEmailNotification(type, notification, targetUser);
      // check the text notification setting
      textNotification.text_replied &&
        sendTextNotification(type, notification, targetUser);
      // check the mobile notification setting
      mobileNotification.text_replied &&
        sendMobileNotification(type, notification, targetUser);
      // check the desktop notification setting
      desktopNotification.text_replied &&
        sendSocketNotification('notification', targetUser, notification);
      sendSocketNotification('receive_text', targetUser, notification);
      break;
    case 'team_invited':
      break;
    case 'team_accept':
      break;
    case 'team_reject':
      break;
    case 'team_requested':
      break;
    case 'join_accept':
      break;
    case 'join_reject':
      break;
    case 'team_remove':
      break;
    case 'team_member_remove':
      break;
    case 'team_role_change':
      break;
    case 'share_template':
      break;
    case 'stop_share_template':
      break;
    case 'contact_shared':
      break;
    case 'stop_share_contact':
      break;
    case 'share_automation':
      break;
    case 'stop_share_automation':
      break;
    case 'share_material':
      break;
    case 'stop_share_material':
      break;
  }
};
/**
 * Send Socket Notification
 * @param {*} message : Notification Message
 * @param {*} user : user id
 * @param {*} notification : notification object
 */
const sendSocketNotification = (message, user, notification) => {
  if (message === 'notification') {
    const data = { ...notification };
    if (notification['user']) {
      delete data['user'];
    }
    if (notification.contact) {
      data.contact = {
        _id: notification.contact._id,
        first_name: notification.contact.first_name,
        last_name: notification.contact.last_name,
        cell_phone: notification.contact.cell_phone,
        email: notification.contact.email,
      };
    } else {
      data.contact = {
        first_name: 'Someone',
        last_name: '',
        activity: notification['activity'],
      };
    }
    io.of('/application').to(user._id).emit(message, data);
  } else {
    console.log('message for notification', message);
    io.of('/application').to(user._id).emit('command', message);
  }
};

module.exports = {
  setupNotification,
  createNotification,
};
