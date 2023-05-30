const fs = require('fs');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const sgMail = require('@sendgrid/mail');
const AWS = require('aws-sdk');
const webpush = require('web-push');
const _ = require('lodash');
const phone = require('phone');
const { RestClient } = require('@signalwire/node');
const Notification = require('../models/notification');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const api = require('../config/api');
const { sendNotificationEmail } = require('./email');
const mail_contents = require('../constants/mail_contents');
const Garbage = require('../models/garbage');
const { REDIS_ENDPOINT } = require('../config/redis');
const io = require('socket.io-emitter')({ host: REDIS_ENDPOINT, port: 6379 });
const FBAdmin = require('firebase-admin');

const FBConfig = api.FIREBASE;
try {
  FBAdmin.initializeApp({
    credential: FBAdmin.credential.cert(FBConfig),
  });
} catch (e) {
  console.log('Firebase initialize failed', e);
}

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);

const createCronNotification = async (
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
  if (garbage) {
    const emailNotification = garbage.email_notification || {};
    const textNotification = garbage.text_notification || {};
    const desktopNotification = garbage.desktop_notification || {};
    const mobileNotification = garbage.mobile_notification || {};

    let userObject;
    // Check the notification type and setting and call detail functions
    switch (type) {
      case 'task_reminder':
        // check the email notification setting
        emailNotification.follow_up &&
          sendEmailNotification(type, notification, targetUser);
        // check the text notification setting
        textNotification.follow_up &&
          sendTextNotification(type, notification, targetUser);
        // check the web push notification setting
        // check the mobile notification setting
        mobileNotification.follow_up &&
          sendMobileNotification(type, notification, targetUser);
        // Socket Notification
        desktopNotification.follow_up &&
          sendSocketNotification('notification', targetUser, notification);
        break;
      case 'scheduler_reminder':
        // check the email notification setting
        emailNotification.scheduler_reminder &&
          sendEmailNotification(type, notification, targetUser);
        // check the text notification setting
        textNotification.scheduler_reminder &&
          sendTextNotification(type, notification, targetUser);
        // check the web push notification setting
        // check the mobile notification setting
        mobileNotification.scheduler_reminder &&
          sendMobileNotification(type, notification, targetUser);
        // Socket Notification
        desktopNotification.scheduler_reminder &&
          notification.desktop_notification &&
          sendSocketNotification('notification', targetUser, notification);
        break;
      case 'bulk_email':
        // Update Command
        sendSocketNotification('bulk_email', targetUser, {
          process: notification.process,
        });
        break;
      case 'bulk_text':
        // Update Command
        sendSocketNotification('bulk_text', targetUser, {
          process: notification.process,
        });
        break;
      case 'assign_automation':
        // Notification load command
        sendSocketNotification('load_notification', targetUser, {
          process: notification.process,
        });
        break;
      case 'bulk_email_progress':
        // Update Command
        sendSocketNotification('bulk_email_progress', targetUser, {
          process: notification.process,
        });
        break;
      case 'bulk_text_progress':
        // Update Command
        sendSocketNotification('bulk_text_progress', targetUser, {
          process: notification.process,
        });
        break;
      case 'share_material':
        sendSocketNotification('share_material', targetUser, {
          process: notification.process,
        });
        break;
      case 'share_template':
        sendSocketNotification('share_template', targetUser, {
          process: notification.process,
        });
        break;
      case 'share_automation':
        sendSocketNotification('share_automation', targetUser, {
          process: notification.process,
        });
        break;
      case 'team_invited':
        sendSocketNotification('team_invited', targetUser, {
          process: notification.process,
        });
        break;
      case 'automation_assign_progress':
        // Update Command
        sendSocketNotification('automation_assign_progress', targetUser, {
          process: notification.process,
        });
        break;
      case 'automation':
        asyncCreateDBNotification(type, notification).then((data) => {
          sendSocketNotification('load_notification', targetUser, {
            _id: data._id,
          });
        });
        break;
      case 'campaign':
        break;
    }
  }
};

/**
 * Send Email Notification
 * @param {*} type: Notification detail type
 * @param {*} notification: Notification object with whole related object
 * @param {*} user: Target user
 * @param {*} sourceUser: Source user for user-user action
 * @returns : void
 */
const sendEmailNotification = (type, notification, user, sourceUser) => {
  const time_zone = user.time_zone_info
    ? JSON.parse(user.time_zone_info).tz_name
    : system_settings.TIME_ZONE;
  if (type === 'watch_video') {
    const { video, contact, detail } = notification;
    const created_at = moment(detail.created_at).tz(time_zone).format('h:mm A');
    let data;
    if (contact) {
      data = {
        template_data: {
          user_name: user.user_name,
          created_at,
          contact_url: urls.CONTACT_PAGE_URL + contact.id,
          contact_name: contact.first_name + contact.last_name,
          material_title: video.title,
          material_url: `${urls.MATERIAL_USER_VIEW_VIDEO_URL}/${video.id}`,
          thumbnail_url: video.thumbnail,
          duration: parseFloat(detail.watched_time).toFixed(2),
          end_at: parseFloat(detail.end).toFixed(2),
          start_at: parseFloat(detail.start).toFixed(2),
        },
        template_name: 'VideoWatched',
        required_reply: false,
        email: user.email,
      };
    } else {
      data = {
        template_data: {
          user_name: user.user_name,
          created_at,
          contact_url:
            urls.ANALYTIC_VIDEO_PAGE_URL +
            video.id +
            '/' +
            notification['activity'],
          contact_name: 'Someone',
          material_title: video.title,
          material_url: `${urls.MATERIAL_USER_VIEW_VIDEO_URL}/${video.id}`,
          thumbnail_url: video.thumbnail,
          duration: parseFloat(detail.watched_time).toFixed(2),
          end_at: parseFloat(detail.end).toFixed(2),
          start_at: parseFloat(detail.start).toFixed(2),
        },
        template_name: 'VideoWatched',
        required_reply: false,
        email: user.email,
      };
    }
    sendNotificationEmail(data);
    return;
  }
  if (type === 'review_pdf') {
    const { pdf, contact } = notification;
    const created_at = moment().tz(time_zone).format('h:mm A');
    let data;
    if (contact) {
      data = {
        template_data: {
          user_name: user.user_name,
          created_at,
          contact_url: urls.CONTACT_PAGE_URL + contact.id,
          contact_name: contact.first_name + ' ' + contact.last_name,
          material_url: `${urls.MATERIAL_USER_VIEW_PDF_URL}/${pdf._id}`,
          material_title: pdf.title,
          thumbnail_url: pdf.preview || '',
        },
        template_name: 'PdfWatched',
        required_reply: false,
        email: user.email,
      };
    } else {
      data = {
        template_data: {
          user_name: user.user_name,
          created_at,
          contact_url:
            urls.ANALYTIC_PDF_PAGE_URL +
            pdf._id +
            '/' +
            notification['activity'],
          contact_name: 'Someone',
          material_url: `${urls.MATERIAL_USER_VIEW_PDF_URL}/${pdf._id}`,
          material_title: pdf.title,
          thumbnail_url: pdf.preview || '',
        },
        template_name: 'PdfWatched',
        required_reply: false,
        email: user.email,
      };
    }
    sendNotificationEmail(data);
    return;
  }
  if (type === 'review_image') {
    const { image, contact } = notification;
    const created_at = moment().tz(time_zone).format('h:mmA');
    let data;
    if (contact) {
      data = {
        template_data: {
          user_name: user.user_name,
          created_at,
          contact_url: urls.CONTACT_PAGE_URL + contact.id,
          contact_name: contact.first_name + contact.last_name,
          material_url: `${urls.MATERIAL_USER_VIEW_IMAGE_URL}/${image._id}`,
          material_title: image.title,
          thumbnail_url: image.preview,
        },
        template_name: 'ImageWatched',
        required_reply: false,
        email: user.email,
      };
    } else {
      data = {
        template_data: {
          user_name: user.user_name,
          created_at,
          contact_url:
            urls.ANALYTIC_IMAGE_PAGE_URL +
            image._id +
            '/' +
            notification['activity'],
          contact_name: 'Someone',
          material_url: `${urls.MATERIAL_USER_VIEW_IMAGE_URL}/${image._id}`,
          material_title: image.title,
          thumbnail_url: image.preview,
        },
        template_name: 'ImageWatched',
        required_reply: false,
        email: user.email,
      };
    }
    sendNotificationEmail(data);
    return;
  }
  if (type === 'open_email') {
    const { contact, email } = notification;
    const data = {
      template_data: {
        user_name: user.user_name,
        created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
        contact_url: urls.CONTACT_PAGE_URL + contact.id,
        contact_name: `${contact.first_name} ${contact.last_name}`,
        email_subject: email.subject,
        email_sent: moment(new Date(email.created_at))
          .tz(time_zone)
          .format('MMMM Do, YYYY - hh:mm A'),
        email_opened: moment().tz(time_zone).format('MMMM Do, YYYY - hh:mm A'),
      },
      template_name: 'EmailOpened',
      required_reply: false,
      email: user.email,
    };

    sendNotificationEmail(data);
  }
  if (type === 'video_lead_capture' || type === 'video_interest_capture') {
    const { contact, video } = notification;
    const created_at = moment().tz(time_zone).format('h:mm A');
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);
    const msg = {
      to: user.email,
      from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
      templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
      dynamic_template_data: {
        subject: mail_contents.NOTIFICATION_WATCHED_VIDEO.SUBJECT,
        first_name: contact.first_name,
        phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
        email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
        activity:
          contact.first_name +
          ' watched lead capture video - <b>' +
          video.title +
          '</b> at ' +
          created_at,
        detailed_activity:
          "<a href='" +
          urls.CONTACT_PAGE_URL +
          contact.id +
          "'><img src='" +
          urls.DOMAIN_URL +
          "assets/images/contact.png'/></a>",
      },
    };
    sgMail.send(msg).catch((err) => console.error(err));
  }
  if (type === 'pdf_lead_capture' || type === 'pdf_interest_capture') {
    const { contact, pdf } = notification;
    const created_at = moment().tz(time_zone).format('h:mm A');
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);
    const msg = {
      to: user.email,
      from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
      templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
      dynamic_template_data: {
        subject: mail_contents.NOTIFICATION_WATCHED_VIDEO.SUBJECT,
        first_name: contact.first_name,
        phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
        email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
        activity:
          contact.first_name +
          ' reviewed lead capture pdf - <b>' +
          pdf.title +
          '</b> at ' +
          created_at,
        detailed_activity:
          "<a href='" +
          urls.CONTACT_PAGE_URL +
          contact.id +
          "'><img src='" +
          urls.DOMAIN_URL +
          "assets/images/contact.png'/></a>",
      },
    };
    sgMail.send(msg).catch((err) => console.error(err));
  }
  if (type === 'image_lead_capture' || type === 'image_interest_capture') {
    const { contact, image } = notification;
    const created_at = moment().tz(time_zone).format('h:mm A');
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);
    const msg = {
      to: user.email,
      from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
      templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
      dynamic_template_data: {
        subject: mail_contents.NOTIFICATION_WATCHED_VIDEO.SUBJECT,
        first_name: contact.first_name,
        phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
        email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
        activity:
          contact.first_name +
          ' reviewed lead capture image - <b>' +
          image.title +
          '</b> at ' +
          created_at,
        detailed_activity:
          "<a href='" +
          urls.CONTACT_PAGE_URL +
          contact.id +
          "'><img src='" +
          urls.DOMAIN_URL +
          "assets/images/contact.png'/></a>",
      },
    };
    sgMail.send(msg).catch((err) => console.error(err));
  }
  if (type === 'click_link') {
    const { contact, email, email_tracker } = notification;
    const created_at = moment().tz(time_zone).format('h:mm A');
    const data = {
      template_data: {
        contact_name: contact.first_name + ' ' + contact.last_name,
        clicked_at: created_at,
        contact_url: urls.CONTACT_PAGE_URL + contact._id,
      },
      template_name: 'EmailClicked',
      required_reply: false,
      email: user.email,
    };

    sendNotificationEmail(data);
  }
  if (type === 'unsubscribe_email') {
    const { contact } = notification;
    const created_at = moment().tz(time_zone).format('h:mm A');
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);
    const msg = {
      to: user.email,
      from: mail_contents.NOTIFICATION_UNSUBSCRIPTION.MAIL,
      templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
      dynamic_template_data: {
        subject: `${mail_contents.NOTIFICATION_UNSUBSCRIPTION.SUBJECT}- ${contact.first_name} ${contact.last_name} at ${created_at}`,
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
        email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
        activity: contact.first_name + ' unsubscribed email at ' + created_at,
        detailed_activity:
          "<a href='" +
          urls.CONTACT_PAGE_URL +
          contact.id +
          "'><img src='" +
          urls.DOMAIN_URL +
          "assets/images/contact.png'/></a>",
      },
    };
    sgMail.send(msg).catch((err) => console.error(err));
  }
  if (type === 'unsubscribe_text') {
    // Unsubscribe text
  }
  if (type === 'receive_text') {
    const { contact, text } = notification;
    const created_at = moment().tz(time_zone).format('h:mm A');
    const data = {
      template_data: {
        contact_name: contact.first_name + ' ' + contact.last_name,
        replied_at: created_at,
        text_content: text,
        contact_url: urls.CONTACT_PAGE_URL + contact._id,
      },
      template_name: 'TextReplied',
      required_reply: false,
      email: user.email,
    };

    sendNotificationEmail(data);
  }
  if (type === 'task_reminder') {
    const { contact, task, deal } = notification;
    const due_date = moment(task.due_date).tz(time_zone).format('h:mm a');
    const data = {
      template_data: {
        user_name: user.user_name,
        created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
        contact_url: urls.CONTACT_PAGE_URL + contact._id,
        contact_name: `${contact.first_name} ${contact.last_name}`,
        follow_up_type: task.type,
        follow_up_description: task.content,
        follow_up_type_url: urls.FOLLOWUP_TYPE_URL[task.type],
        due_start: due_date,
        deal_title: deal ? deal.title : undefined,
      },
      template_name: deal ? 'DealTaskReminder' : 'TaskReminder',
      required_reply: false,
      email: user.email,
    };

    sendNotificationEmail(data);
  }
  if (type === 'scheduler_reminder') {
    const { contact, appointment } = notification;
    const data = {
      template_data: {
        contact_name: `${contact.first_name} ${contact.last_name}`,
        contact_email: contact.email,
        title: appointment.title,
        description: appointment.description,
        due_start: moment(appointment.due_start).tz(time_zone).format('h:mm a'),
        due_end: moment(appointment.due_end).tz(time_zone).format('h:mm a'),
      },
      template_name: 'SchedulerReminder',
      required_reply: false,
      email: user.email,
    };

    sendNotificationEmail(data);
  }
};

/**
 * Send Text Notification
 * @param {*} type : notification Detail Type
 * @param {*} notification : Notification data with the whole related objects
 * @param {*} user : target users
 * @param {*} sourceUser : source user for user-user notification
 * @returns : void
 */
const sendTextNotification = (type, notification, user, sourceUser) => {
  const time_zone = user.time_zone_info
    ? JSON.parse(user.time_zone_info).tz_name
    : system_settings.TIME_ZONE;

  const e164Phone = phone(user.cell_phone)[0];
  if (!e164Phone) {
    const error = {
      error: 'Invalid Phone Number',
    };
    throw error; // Invalid phone number
  }
  const fromNumber = api.TWILIO.SYSTEM_NUMBER;
  const unsubscribeLink = '\n\nReply STOP to unsubscribe.';
  if (type === 'watch_video') {
    const { video, contact, detail } = notification;
    const created_at =
      moment(detail.created_at).tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment(detail.created_at).tz(time_zone).format('h:mm a');
    let title;
    let body;
    let contact_link;
    if (contact) {
      title =
        contact.first_name +
        ' ' +
        contact.last_name +
        '\n' +
        contact.email +
        '\n' +
        contact.cell_phone +
        '\n' +
        '\n' +
        'Watched video: ' +
        video.title +
        '\n';
      body =
        'watched ' +
        parseFloat(detail.watched_time).toFixed(2) +
        ' of ' +
        parseFloat(detail.total_time).toFixed(2) +
        ' on ' +
        created_at;
      contact_link = urls.CONTACT_PAGE_URL + contact.id;
    } else {
      title = 'Someone watched video: ' + video.title + '\n';
      body =
        'watched ' +
        parseFloat(detail.watched_time).toFixed(2) +
        ' of ' +
        parseFloat(detail.total_time).toFixed(2) +
        ' on ' +
        created_at;
      contact_link =
        urls.ANALYTIC_VIDEO_PAGE_URL +
        video.id +
        '/' +
        notification['activity'];
    }
    const sms =
      title + '\n' + body + '\n' + contact_link + '\n\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
    return;
  }
  if (type === 'review_pdf') {
    const { pdf, contact } = notification;
    const created_at =
      moment().tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment().tz(time_zone).format('h:mm a');
    let title;
    let body;
    let contact_link;
    if (contact) {
      title =
        contact.first_name +
        ' ' +
        contact.last_name +
        '\n' +
        contact.email +
        '\n' +
        contact.cell_phone +
        '\n' +
        '\n' +
        'Reviewed pdf: ' +
        pdf.title +
        '\n';
      body = 'reviewed on ' + created_at;
      contact_link = urls.CONTACT_PAGE_URL + contact.id;
    } else {
      title = 'Someone reviewed pdf: ' + pdf.title + '\n';
      body = 'reviewed on ' + created_at;
      contact_link =
        urls.ANALYTIC_PDF_PAGE_URL + pdf._id + '/' + notification['activity'];
    }
    const sms =
      title + '\n' + body + '\n' + contact_link + '\n\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
    return;
  }
  if (type === 'review_image') {
    const { image, contact } = notification;
    const created_at =
      moment().tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment().tz(time_zone).format('h:mm a');
    let title;
    let body;
    let contact_link;
    if (contact) {
      title =
        contact.first_name +
        ' ' +
        contact.last_name +
        '\n' +
        contact.email +
        '\n' +
        contact.cell_phone +
        '\n' +
        '\n' +
        'Reviewed image: ' +
        image.title +
        '\n';
      body = 'reviewed on ' + created_at;
      contact_link = urls.CONTACT_PAGE_URL + contact.id;
    } else {
      title = 'Someone reviewed image: ' + image.title + '\n';
      body = 'reviewed on ' + created_at;
      contact_link =
        urls.ANALYTIC_IMAGE_PAGE_URL +
        image._id +
        '/' +
        notification['activity'];
    }
    const sms =
      title + '\n' + body + '\n' + contact_link + '\n\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
    return;
  }
  if (type === 'open_email') {
    const { contact, email } = notification;
    const title =
      contact.first_name +
      ' ' +
      contact.last_name +
      '\n' +
      contact.email +
      '\n' +
      contact.cell_phone +
      '\n' +
      '\n' +
      'opened email: ' +
      '\n' +
      email.subject;
    const created_at =
      moment().tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment().tz(time_zone).format('h:mm a');
    const time = 'on ' + created_at;
    const contact_link = urls.CONTACT_PAGE_URL + contact.id;
    const sms =
      title + '\n' + time + '\n\n' + contact_link + '\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
  }
  if (type === 'video_lead_capture' || type === 'video_interest_capture') {
    const { contact, video } = notification;
    const title =
      contact.first_name +
      '\n' +
      contact.email +
      '\n' +
      contact.cell_phone +
      '\n' +
      '\n' +
      'Watched lead capture video: ' +
      '\n' +
      video.title;
    const created_at =
      moment().tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment().tz(time_zone).format('h:mm a');
    const time = 'on ' + created_at;
    const contact_link = urls.CONTACT_PAGE_URL + contact.id;
    const sms =
      title + '\n' + time + '\n\n' + contact_link + '\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
  }
  if (type === 'pdf_lead_capture' || type === 'pdf_interest_capture') {
    const { contact, pdf } = notification;
    const title =
      contact.first_name +
      '\n' +
      contact.email +
      '\n' +
      contact.cell_phone +
      '\n' +
      '\n' +
      'Reviewed lead capture pdf: ' +
      '\n' +
      pdf.title;
    const created_at =
      moment().tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment().tz(time_zone).format('h:mm a');
    const time = 'on ' + created_at;
    const contact_link = urls.CONTACT_PAGE_URL + contact.id;
    const sms =
      title + '\n' + time + '\n\n' + contact_link + '\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
  }
  if (type === 'image_lead_capture' || type === 'image_interest_capture') {
    const { contact, image } = notification;
    const title =
      contact.first_name +
      '\n' +
      contact.email +
      '\n' +
      contact.cell_phone +
      '\n' +
      '\n' +
      'Reviewed lead capture image: ' +
      '\n' +
      image.title;
    const created_at =
      moment().tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment().tz(time_zone).format('h:mm a');
    const time = 'on ' + created_at;
    const contact_link = urls.CONTACT_PAGE_URL + contact.id;
    const sms =
      title + '\n' + time + '\n\n' + contact_link + '\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
  }
  if (type === 'click_link') {
    const { contact, email, email_tracker } = notification;
    const title =
      contact.first_name +
      '\n' +
      contact.email +
      '\n' +
      contact.cell_phone +
      '\n' +
      '\n' +
      `Clicked link(${email_tracker.link})` +
      '\n' +
      `from email: ${email.subject}`;
    const created_at =
      moment().tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment().tz(time_zone).format('h:mm a');
    const time = 'on ' + created_at;
    const contact_link = urls.CONTACT_PAGE_URL + contact.id;
    const sms =
      title + '\n' + time + '\n\n' + contact_link + '\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
  }
  if (type === 'unsubscribe_email') {
    const { contact, email, email_tracker } = notification;
    const created_at =
      moment().tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment().tz(time_zone).format('h:mm a');
    const title =
      contact.first_name +
      ' ' +
      contact.last_name +
      '\n' +
      contact.email +
      '\n' +
      contact.cell_phone +
      '\n' +
      '\n' +
      'unsubscribed email';
    const time = ' on ' + created_at + '\n ';
    const contact_link = urls.CONTACT_PAGE_URL + contact.id;
    const sms =
      title + '\n' + time + '\n\n' + contact_link + '\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
  }
  if (type === 'unsubscribe_text') {
    const { contact } = notification;
    const created_at =
      moment().tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment().tz(time_zone).format('h:mm a');
    const title =
      contact.first_name +
      ' ' +
      contact.last_name +
      '\n' +
      contact.email +
      '\n' +
      contact.cell_phone +
      '\n' +
      '\n' +
      'Unsubscribed sms';
    const time = 'on ' + created_at + '\n ';
    const contact_link = urls.CONTACT_PAGE_URL + contact.id;
    const sms =
      title + '\n' + time + '\n\n' + contact_link + '\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
  }
  if (type === 'receive_text') {
    console.log('receive text text notification');
    const { contact, text } = notification;
    const created_at =
      moment().tz(time_zone).format('MM/DD/YYYY') +
      ' at ' +
      moment().tz(time_zone).format('h:mm a');
    const title =
      contact.first_name +
      ' ' +
      contact.last_name +
      '\n' +
      contact.email +
      '\n' +
      contact.cell_phone +
      '\n' +
      '\n' +
      'Replied text: ' +
      (text || '').slice(0, 30) +
      '...';
    const time = 'on ' + created_at + '\n ';
    const contact_link = urls.CONTACT_PAGE_URL + contact.id;
    const sms =
      title + '\n' + time + '\n\n' + contact_link + '\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
  }
  if (type === 'task_reminder') {
    const { contact, task } = notification;
    const due_date = moment(task.due_date).tz(time_zone).format('h:mm a');
    const title =
      `Follow up task due today at ${due_date} with following contact` +
      '\n' +
      '\n' +
      contact.first_name +
      contact.last_name +
      '\n' +
      contact.email +
      '\n' +
      contact.cell_phone +
      '\n' +
      '\n';
    const body = task.content + '\n';
    const contact_link = urls.CONTACT_PAGE_URL + contact.id;
    const sms = title + body + '\n\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
  }
  if (type === 'scheduler_reminder') {
    const { contact, appointment } = notification;
    const due_start = moment(appointment.due_start)
      .tz(time_zone)
      .format('h:mm a');
    const title =
      `Scheduled Event due today at ${due_start} with following contact` +
      '\n' +
      '\n' +
      contact.first_name +
      ' ' +
      contact.last_name +
      '\n' +
      contact.email +
      '\n' +
      contact.cell_phone +
      '\n' +
      '\n';
    const body =
      'Title: ' +
      appointment.title +
      '\n' +
      'Duration: ' +
      appointment.duration +
      ' mins' +
      '\n';
    const sms = title + body + '\n\n' + unsubscribeLink;
    sendSNSMessage(fromNumber, e164Phone, sms);
  }
};

/**
 * Send SNS message
 * @param {*} from: from number
 * @param {*} to: target number
 * @param {*} body: body content
 */
const sendSNSMessage = (from, to, body) => {
  twilio.messages
    .create({
      from,
      to,
      body,
    })
    .catch((err) => console.error(err));
};

/**
 * Send the desktop notification
 * @param {*} type : notification detail type
 * @param {*} notification : notification content
 * @param {*} user : target user
 */
const sendWebPushNotification = (type, notification, user) => {
  webpush.setVapidDetails(
    'mailto:support@crmgrow.com',
    api.VAPID.PUBLIC_VAPID_KEY,
    api.VAPID.PRIVATE_VAPID_KEY
  );

  const subscription = JSON.parse(user.desktop_notification_subscription);
  // Related Data
  let contact;
  let video;
  let pdf;
  let image;
  let email;
  let detail;
  // template,
  // automation,
  // team,
  // task,
  // Create at
  const time_zone = user.time_zone_info
    ? JSON.parse(user.time_zone_info).tz_name
    : system_settings.TIME_ZONE;
  let created_at = moment().tz(time_zone).format('h:mm a');

  let title = '';
  let body = '';

  switch (type) {
    case 'watch_video':
      contact = notification.contact;
      video = notification.video;
      detail = notification.detail;
      created_at =
        moment(detail.created_at).tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment(detail.created_at).tz(time_zone).format('h:mm a');
      title = `${contact.first_name} (${contact.email}) watched video - ${video.title}`;
      body = `Watched ${detail.watched_time} of + ${detail.total_time} on ${created_at}`;
      break;
    case 'review_pdf':
      contact = notification.contact;
      pdf = notification.pdf;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      title = `${contact.first_name} (${contact.email}) reviewed pdf - ${pdf.title}`;
      body = `Reviewed on ${created_at}`;
      break;
    case 'review_image':
      contact = notification.contact;
      image = notification.image;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      title = `${contact.first_name} (${contact.email}) reviewed image - ${image.title}`;
      body = `Reviewed on ${created_at}`;
      break;
    case 'video_lead_capture':
    case 'video_interest_capture':
      contact = notification.contact;
      video = notification.video;
      title = contact.first_name + ' watched lead capture video';
      body = `${contact.first_name} (${contact.email}) watched lead capture video: ${video.title} on ${created_at}`;
      break;
    case 'pdf_lead_capture':
    case 'pdf_interest_capture':
      contact = notification.contact;
      pdf = notification.pdf;
      title = contact.first_name + ' reviewed lead capture pdf';
      body = `${contact.first_name} (${contact.email}) reviewed lead capture pdf: ${pdf.title} on ${created_at}`;
      break;
    case 'image_lead_capture':
    case 'image_interest_capture':
      contact = notification.contact;
      image = notification.image;
      title = contact.first_name + ' reviewed lead capture image';
      body = `${contact.first_name} (${contact.email}) reviewed lead capture image: ${image.title} on ${created_at}`;
      break;
    case 'open_email':
      contact = notification.contact;
      email = notification.email;
      title = contact.first_name + ' opened email';
      body = `${contact.first_name} (${contact.email}) opened email: ${email.subject} on ${created_at}`;
      break;
    case 'click_link':
      contact = notification.contact;
      email = notification.email;
      detail = notification.email_tracker;
      title = contact.first_name + ` clicked link`;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      body = `${contact.first_name} (${contact.email}) clicked link(${detail.link}) from email: ${email.subject} on ${created_at}`;
      break;
    case 'unsubscribe_email':
      contact = notification.contact;
      title = contact.first_name + ` unsubscribed`;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      body = `${contact.first_name} (${contact.email}) unsubscribed email on ${created_at}`;
      break;
    case 'resubscribe_email':
      break;
    case 'unsubscribe_text':
      contact = notification.contact;
      title = contact.first_name + ` unsubscribed`;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      body = `${contact.first_name} (${contact.cell_phone}) unsubscribed sms on ${created_at}`;
      break;
    case 'receive_text':
      contact = notification.contact;
      detail = notification.text;
      title = contact.first_name + ` unsubscribed`;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      body = `${contact.first_name} (${contact.cell_phone}) replied text: ${
        (detail || '').slice(0, 30) + '...'
      } on ${created_at}`;
      break;
    case 'task_reminder':
      contact = notification.contact;
      detail = notification.task;
      created_at =
        moment(detail.due_date).tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment(detail.due_date).tz(time_zone).format('h:mm a');
      title = `CRMGrow follow up reminder`;
      body =
        `Follow up task due today at ${created_at} with contact name:` +
        '\n' +
        contact.first_name +
        contact.last_name +
        '\n' +
        contact.email +
        '\n' +
        contact.cell_phone +
        '\n' +
        detail.content;
      break;
  }

  const playload = JSON.stringify({
    notification: {
      title,
      body,
      icon: '/fav.ico',
      badge: '/fav.ico',
    },
  });
  webpush
    .sendNotification(subscription, playload)
    .catch((err) => console.error(err));
};

const sendMobileNotification = (type, notification, user) => {
  let contact;
  let video;
  let pdf;
  let image;
  let email;
  let detail;
  let title;
  let body;
  const time_zone = user.time_zone_info
    ? JSON.parse(user.time_zone_info).tz_name
    : system_settings.TIME_ZONE;
  let created_at = moment().tz(time_zone).format('h:mm a');

  switch (type) {
    case 'watch_video':
      contact = notification.contact;
      video = notification.video;
      detail = notification.detail;
      created_at =
        moment(detail.created_at).tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment(detail.created_at).tz(time_zone).format('h:mm a');
      title = `${contact.first_name} watched video - ${video.title}`;
      body = `Watched ${detail.watched_time} of ${detail.total_time} on ${created_at}`;
      break;
    case 'review_pdf':
      contact = notification.contact;
      pdf = notification.pdf;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      title = `${contact.first_name} reviewed pdf - ${pdf.title}`;
      body = `Reviewed on ${created_at}`;
      break;
    case 'review_image':
      contact = notification.contact;
      image = notification.image;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      title = `${contact.first_name} reviewed image - ${image.title}`;
      body = `Reviewed on ${created_at}`;
      break;
    case 'video_lead_capture':
    case 'video_interest_capture':
      contact = notification.contact;
      video = notification.video;
      title = contact.first_name + ' watched lead capture video';
      body = `${contact.first_name} watched lead capture video: ${video.title} on ${created_at}`;
      break;
    case 'pdf_lead_capture':
    case 'pdf_interest_capture':
      contact = notification.contact;
      pdf = notification.pdf;
      title = contact.first_name + ' reviewed lead capture pdf';
      body = `${contact.first_name} reviewed lead capture pdf: ${pdf.title} on ${created_at}`;
      break;
    case 'image_lead_capture':
    case 'image_interest_capture':
      contact = notification.contact;
      image = notification.image;
      title = contact.first_name + ' reviewed lead capture image';
      body = `${contact.first_name} reviewed lead capture image: ${image.title} on ${created_at}`;
      break;
    case 'click_link':
      contact = notification.contact;
      email = notification.email;
      detail = notification.email_tracker;
      title = contact.first_name + ` clicked link`;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      body = `${contact.first_name} clicked link(${detail.link}) from email: ${email.subject} on ${created_at}`;
      break;
    case 'unsubscribe_email':
      contact = notification.contact;
      title = contact.first_name + ` unsubscribed`;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      body = `${contact.first_name} unsubscribed email on ${created_at}`;
      break;
    case 'unsubscribe_text':
      contact = notification.contact;
      title = contact.first_name + ` unsubscribed`;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      body = `${contact.first_name} unsubscribed sms on ${created_at}`;
      break;
    case 'receive_text':
      contact = notification.contact;
      detail = notification.text;
      title = `${contact.first_name} replied text`;
      created_at =
        moment().tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment().tz(time_zone).format('h:mm a');
      body = `${(detail || '').slice(0, 60) + '...'} on ${created_at}`;
      break;
    case 'task_reminder':
      contact = notification.contact;
      detail = notification.task;
      created_at =
        moment(detail.due_date).tz(time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment(detail.due_date).tz(time_zone).format('h:mm a');
      title = `CRMGrow follow up reminder`;
      body =
        `Follow up task due today at ${created_at} with contact name:` +
        '\n' +
        contact.first_name +
        contact.last_name +
        '\n' +
        contact.email +
        '\n' +
        contact.cell_phone +
        '\n' +
        detail.content;
      break;
  }

  const iOSDeviceToken = user.iOSDeviceToken;
  const androidDeviceToken = user.androidDeviceToken;
  const tokens = [];
  if (iOSDeviceToken) {
    tokens.push(iOSDeviceToken);
  }
  if (androidDeviceToken) {
    tokens.push(androidDeviceToken);
  }
  var payload = {
    notification: {
      title,
      body,
    },
  };

  var options = {
    priority: 'high',
    timeToLive: 60 * 60 * 24,
  };

  if (tokens.length) {
    FBAdmin.messaging()
      .sendToDevice(tokens, payload, options)
      .then((response) => {
        console.log('Successfully sent message:', response);
      })
      .catch((error) => {
        console.log('Error sending message:', error);
      });
  }
};

const createDBNotification = (type, notification) => {
  const _n = new Notification(notification);
  _n.save().catch((err) => {
    console.log('notification save err', err.message);
  });
};

const asyncCreateDBNotification = (type, notification) => {
  return new Promise((resolve, reject) => {
    const _n = new Notification(notification);
    _n.save().catch((err) => {
      console.log('notification save err', err.message);
      resolve(_n);
    });
  });
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
    }
    io.of('/application').to(user._id).emit(message, data);
  } else if (message === 'load_notification') {
    io.of('/application').to(user._id).emit('load_notification', notification);
  } else {
    io.of('/application').to(user._id).emit('command', message);
  }
};

module.exports = {
  sendEmailNotification,
  sendTextNotification,
  sendWebPushNotification,
  sendMobileNotification,
  createDBNotification,
  asyncCreateDBNotification,
  createCronNotification,
};

// Timezone setting update
