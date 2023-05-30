const mongoose = require('mongoose');
const moment = require('moment-timezone');
const CronJob = require('cron').CronJob;
const fs = require('fs');
const uuidv1 = require('uuid/v1');
const AWS = require('aws-sdk');
const child_process = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });

const User = require('../models/user');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const FollowUp = require('../models/follow_up');
const Video = require('../models/video');
const Notification = require('../models/notification');
const Garbage = require('../models/garbage');
const CampaignJob = require('../models/campaign_job');
const EmailTemplate = require('../models/email_template');
const Payment = require('../models/payment');
const Task = require('../models/task');
const Appointment = require('../models/appointment');
const Deal = require('../models/deal');

const api = require('../config/api');
const system_settings = require('../config/system_settings');
const { VIDEO_PATH, TEMP_PATH } = require('../config/path');
const urls = require('../constants/urls');
const notifications = require('../constants/notification');
const mail_contents = require('../constants/mail_contents');

const { sendNotificationEmail } = require('../helpers/email');
const EmailHelper = require('../helpers/email');
const FileHelper = require('../helpers/file');
const { clearData } = require('../helpers/user');

const { DB_PORT } = require('../config/database');
const { createCronNotification } = require('../helpers/notificationImpl');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const daily_report = new CronJob(
  '0 21 * * 1-6',
  async () => {
    await User.find({ daily_report: true, del: false })
      .then(async (users) => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        // end.setHours(20, 59, 59, 999);
        for (let i = 0; i < users.length; i++) {
          const currentUser = users[i];
          const activity = await Activity.find({
            user: currentUser.id,
            created_at: { $gte: start, $lt: end },
          }).catch((err) => {
            console.log('err: ', err);
          });

          let content_html = '';

          for (let j = 0; j < activity.length; j++) {
            const contact = await Contact.findOne({
              _id: activity[j].contacts,
            }).catch((err) => {
              console.log('err: ', err);
            });

            if (typeof contact.cell_phone === 'undefined')
              contact.cell_phone = '';

            const content =
              "<tr><td><h3 style='display: inline'>" +
              contact.first_name +
              contact.last_name +
              "</h3><p style='margin: 0px'>" +
              contact.email +
              ' ' +
              contact.cell_phone +
              '</p>' +
              "<p style='margin: 0px'>" +
              activity[j].content +
              '</p></td>' +
              "<td><a href='" +
              urls.CONTACT_PAGE_URL +
              contact.id +
              "' style='text-decoration: none'><img src='" +
              urls.DOMAIN_URL +
              "assets/images/contact.png'/></a></td></tr>";

            content_html += content;
          }

          const _follow_up = await FollowUp.find({
            user: currentUser.id,
            status: 0,
            due_date: { $lt: end },
          }).catch((err) => {
            console.log('err: ', err);
          });

          for (let j = 0; j < _follow_up.length; j++) {
            const contact = await Contact.findOne({
              _id: _follow_up[j].contact,
            }).catch((err) => {
              console.log('err: ', err);
            });

            if (!contact.cell_phone) {
              contact.cell_phone = '';
            }

            const content =
              "<tr><td><h3 style='display: inline'>" +
              contact.first_name +
              contact.last_name +
              "</h3><p style='margin: 0px'>" +
              contact.email +
              ' ' +
              contact.cell_phone +
              '</p>' +
              "<p style='margin: 0px'>" +
              _follow_up[j].content +
              '</p></td>' +
              "<td><a href='" +
              urls.FOLLOWUP_PAGE_URL +
              contact.id +
              "' style='text-decoration: none'><img src='" +
              urls.DOMAIN_URL +
              "assets/images/followup.png'/></a></td></tr>";

            content_html += content;
          }

          const time_zone = currentUser.time_zone_info
            ? JSON.parse(currentUser.time_zone_info).tz_name
            : system_settings.TIME_ZONE;

          if (activity.length > 0 || _follow_up.length > 0) {
            const data = {
              template_data: {
                user_name: currentUser.user_name,
                created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
                content: content_html,
              },
              template_name: 'DailyReport',
              required_reply: false,
              email: currentUser.email,
            };

            sendNotificationEmail(data);
          }
        }
      })
      .catch((err) => {
        console.log('err', err);
      });
  },
  function () {
    console.log('Daily Report Job finished.');
  },
  false,
  'US/Central'
);

const weekly_report = new CronJob({
  // Run at 21:00 Central time, only on friday
  cronTime: '00 21 * * Sun',
  onTick: async () => {
    await User.find({ weekly_report: true, del: false })
      .then(async (users) => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(today.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(20, 59, 59, 999);
        for (let i = 0; i < users.length; i++) {
          const currentUser = users[i];
          const activity = await Activity.find({
            user: currentUser.id,
            created_at: { $gte: monday, $lt: end },
          })
            .sort({ _id: -1 })
            .limit(15)
            .catch((err) => {
              console.log('err: ', err);
            });
          const now = moment();
          const today = now.format('MMMM, dddd Do YYYY');

          const contacts = [];
          for (let j = 0; j < activity.length; j++) {
            const contact = await Contact.findOne({
              _id: activity[j].contacts,
            }).catch((err) => {
              console.log('err: ', err);
            });
            if (typeof contact.cell_phone === 'undefined')
              contact.cell_phone = '';
            const content =
              "<tr><td><h3 style='display: inline'>" +
              contact.first_name +
              contact.last_name +
              "</h3><p style='margin: 0px'>" +
              contact.email +
              ' ' +
              contact.cell_phone +
              '</p>' +
              "<p style='margin: 0px'>" +
              activity[j].content +
              '</p></td>' +
              "<td><a href='" +
              urls.CONTACT_PAGE_URL +
              contact.id +
              "' style='text-decoration: none'><img src='" +
              urls.DOMAIN_URL +
              "assets/images/contact.png'/></a></td></tr>";
            contacts.push(content);
          }

          const _follow_up = await FollowUp.find({
            user: currentUser.id,
            status: 0,
            due_date: { $lt: end },
          }).catch((err) => {
            console.log('err: ', err);
          });
          const overdue = [];

          for (let j = 0; j < _follow_up.length; j++) {
            const contact = await Contact.findOne({
              _id: _follow_up[j].contact,
            }).catch((err) => {
              console.log('err: ', err);
            });
            if (typeof contact.cell_phone === 'undefined')
              contact.cell_phone = '';
            const _overdue =
              "<tr><td><h3 style='display: inline'>" +
              contact.first_name +
              contact.last_name +
              "</h3><p style='margin: 0px'>" +
              contact.email +
              ' ' +
              contact.cell_phone +
              '</p>' +
              "<p style='margin: 0px'>" +
              _follow_up[j].content +
              '</p></td>' +
              "<td><a href='" +
              urls.FOLLOWUP_PAGE_URL +
              contact.id +
              "' style='text-decoration: none'><img src='" +
              urls.DOMAIN_URL +
              "assets/images/contact.png'/></a></td></tr>";
            overdue.push(_overdue);
          }

          if (contacts.length > 0 || overdue.length > 0) {
            const msg = {
              to: currentUser.email,
              from: mail_contents.DAILY_REPORT.MAIL,
              subject: mail_contents.DAILY_REPORT.SUBJECT,
              templateId: api.SENDGRID.SENDGRID_DAILY_REPORT_TEMPLATE,
              dynamic_template_data: {
                contacts,
                overdue,
                day: today,
              },
            };

            /*
            sgMail
              .send(msg)
              .then((res) => {
                console.log('mailres.errorcode', res[0].statusCode);
                if (res[0].statusCode >= 200 && res[0].statusCode < 400) {
                  console.log('Successful send to ' + msg.to);
                } else {
                  console.log(res[0].statusCode);
                }
              })
              .catch((err) => {
                console.log('err: ', err);
              });
              */
          }
        }
      })
      .catch((err) => {
        console.log('err', err);
      });
  },
  start: false,
  timeZone: 'US/Central',
});

const task_job = new CronJob(
  '*/10 * * * 0-6',
  async () => {
    const due_date = new Date();

    const reminder_array = await FollowUp.find({
      remind_at: { $exists: true, $lte: due_date },
      status: 0,
    }).catch((err) => {
      console.log('followup find err', err.message);
    });

    for (let i = 0; i < reminder_array.length; i++) {
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

      if (!follow_up.contact) {
        continue;
      }

      if (follow_up.is_full) {
        continue;
      }

      const contact = await Contact.findOne({
        _id: follow_up.contact,
      }).catch((err) => {
        console.log('contact found err: ', err.message);
      });

      if (!contact) {
        continue;
      }

      let deal;
      if (follow_up.shared_follow_up) {
        const deal_follow_up = await FollowUp.findOne({
          _id: follow_up.deal,
        }).catch((err) => {
          console.log('deal follow up found err: ', err.message);
        });

        deal = await Deal.findOne({
          _id: deal_follow_up.deal,
        }).catch((err) => {
          console.log('deal found err: ', err.message);
        });
      }

      createCronNotification(
        'task_reminder',
        {
          criteria: 'task_reminder',
          contact,
          task: follow_up,
          deal,
        },
        user
      );

      FollowUp.updateOne(
        {
          _id: follow_up.id,
        },
        {
          $set: { status: 2 },
        }
      ).catch((err) => {
        console.log('follow up update err', err.message);
      });

      if (follow_up.set_recurrence && follow_up.parent_follow_up) {
        const recurring_follow_up = await FollowUp.findOne({
          user: follow_up.user,
          _id: follow_up.parent_follow_up,
        });

        const garbage = await Garbage.findOne({
          user: follow_up.user,
        }).catch((err) => {
          console.log('err', err);
        });
        let reminder_before = 30;
        if (garbage) {
          reminder_before = garbage.reminder_before;
        }

        let update_date;
        if (follow_up.timezone) {
          update_date = moment
            .tz(follow_up.due_date, follow_up.timezone)
            .clone();
        } else {
          update_date = moment(follow_up.due_date).clone();
        }

        let max_date = update_date.clone().add(6, 'weeks').endOf('weeks');

        if (
          recurring_follow_up.recurrence_date &&
          moment(recurring_follow_up.recurrence_date).isBefore(max_date.clone())
        ) {
          max_date = moment(recurring_follow_up.recurrence_date);
        }
        while (max_date.isAfter(update_date)) {
          switch (follow_up.recurrence_mode) {
            case 'DAILY': {
              update_date.add(1, 'days');
              break;
            }
            case 'WEEKLY': {
              update_date.add(7, 'days');
              break;
            }
            case 'MONTHLY': {
              update_date.add(1, 'months');
              break;
            }
            case 'YEARLY': {
              update_date.add(1, 'years');
              break;
            }
          }

          let deleted;
          if (recurring_follow_up.deleted_due_dates) {
            deleted = recurring_follow_up.deleted_due_dates.some((e) => {
              return update_date.clone().isSame(moment(e));
            });
          } else {
            deleted = false;
          }

          if (!deleted) {
            delete follow_up._doc._id;
            const new_follow_up = new FollowUp({
              ...follow_up._doc,
              status: 0,
              due_date: update_date.clone(),
              remind_at:
                follow_up.deal || follow_up.is_full
                  ? undefined
                  : update_date.clone().subtract(reminder_before, 'minutes'),
            });
            new_follow_up.save().catch((err) => {
              console.log('new followup save err', err.message);
            });
          }
        }
      }
    }
  },
  function () {
    console.log('Reminder Job finished.');
  },
  false,
  'US/Central'
);

const scheduler_job = new CronJob(
  '*/10 * * * 0-6',
  async () => {
    const due_date = new Date();
    due_date.setSeconds(0);
    due_date.setMilliseconds(0);

    const reminder_array = await Appointment.find({
      type: 2,
      status: 0,
      remind_at: { $lte: due_date },
    }).catch((err) => {
      console.log('appointment find err', err.message);
    });

    for (let i = 0; i < reminder_array.length; i++) {
      const appointment = reminder_array[i];
      const user = await User.findOne({
        _id: appointment.user,
        del: false,
      }).catch((err) => {
        console.log('err: ', err);
      });

      if (!user) {
        continue;
      }

      if (appointment.contacts && appointment.contacts[0]) {
        const contact = await Contact.findOne({
          _id: appointment.contacts[0],
        }).catch((err) => {
          console.log('contact found err: ', err.message);
        });

        if (contact) {
          createCronNotification(
            'scheduler_reminder',
            { contact, appointment, desktop_notification: true },
            user
          );
          const user_contact = {
            ...user,
            first_name: user.user_name.split(' ')[0],
            last_name: user.user_name.split(' ')[1],
          };
          createCronNotification(
            'scheduler_reminder',
            { contact: user_contact, appointment, desktop_notification: false },
            contact
          );
        } else {
          continue;
        }
      }

      Appointment.updateOne(
        {
          _id: appointment._id,
        },
        {
          $set: { status: 1 },
        }
      ).catch((err) => {
        console.log('appointment update err', err.message);
      });
    }
  },
  function () {
    console.log('Scheduler Reminder Job finished.');
  },
  false,
  'US/Central'
);

const signup_job = new CronJob(
  '0,30 * * * 0-6',
  async () => {
    const subscribers = await User.find({
      welcome_email: false,
      del: false,
    }).catch((err) => {
      console.log('err', err);
    });

    if (subscribers) {
      for (let i = 0; i < subscribers.length; i++) {
        const subscriber = subscribers[i];
        const created_at = new Date(subscriber['created_at']).getTime();
        const now = new Date().getTime();
        const offset = now - created_at;
        if (offset >= 30 * 60 * 1000 && offset < 60 * 60 * 1000) {
          // const msg = {
          //   to: subscriber.email,
          //   from: mail_contents.WELCOME_SIGNUP.MAIL,
          //   templateId: api.SENDGRID.SENDGRID_SIGNUP_FLOW_REACH,
          //   dynamic_template_data: {
          //     first_name: subscriber.user_name,
          //   },
          // };
          // sgMail
          //   .send(msg)
          //   .then((res) => {
          //     console.log('mailres.errorcode', res[0].statusCode);
          //     if (res[0].statusCode >= 200 && res[0].statusCode < 400) {
          //       console.log('Successful send to ' + msg.to);
          //     } else {
          //       console.log('email sending err', msg.to + res[0].statusCode);
          //     }
          //   })
          //   .catch((err) => {
          //     console.log('err', err);
          //   });

          const templatedData = {
            user_name: subscriber.user_name,
            created_at: moment().format('h:mm MMMM Do, YYYY'),
            webinar_link: system_settings.WEBINAR_LINK,
          };

          const params = {
            Destination: {
              ToAddresses: [subscriber.email],
            },
            Source: mail_contents.REPLY,
            Template: 'WebinarInvitation',
            TemplateData: JSON.stringify(templatedData),
          };

          // Create the promise and SES service object

          ses.sendTemplatedEmail(params).promise();

          const notification = new Notification({
            user: subscribers[i].id,
            criteria: 'webniar',
            content: notifications.webinar.content,
            description: notifications.webinar.description,
          });
          notification.save().catch((err) => {
            console.log('notification save err', err.message);
          });
        }
        if (offset >= 24 * 60 * 60 * 1000 && offset < 24.5 * 60 * 60 * 1000) {
          const msg = {
            to: subscriber.email,
            from: mail_contents.WELCOME_SIGNUP.MAIL,
            templateId: api.SENDGRID.SENDGRID_SIGNUP_FLOW_THIRD,
            dynamic_template_data: {
              first_name: subscriber.user_name,
              video_link: `<a href="${urls.INTRO_VIDEO_URL}">Click this link - Download Video</a>`,
              recruiting_material: `<a href="${urls.MATERIAL_VIEW_PAGE}">Material Page</a>`,
            },
          };
          /*
          sgMail
            .send(msg)
            .then((res) => {
              console.log('mailres.errorcode', res[0].statusCode);
              if (res[0].statusCode >= 200 && res[0].statusCode < 400) {
                console.log('Successful send to ' + msg.to);
              } else {
                console.log('email sending err', msg.to + res[0].statusCode);
              }
            })
            .catch((err) => {
              console.log('err', err);
            });
            */
        }
        if (offset >= 48 * 60 * 60 * 1000 && offset < 48.5 * 60 * 60 * 1000) {
          const msg = {
            to: subscriber.email,
            from: mail_contents.WELCOME_SIGNUP.MAIL,
            templateId: api.SENDGRID.SENDGRID_SIGNUP_FLOW_FORTH,
            dynamic_template_data: {
              first_name: subscriber.user_name,
              login_link: `<a href="${urls.LOGIN_URL}">Click here to login into your account</a>`,
            },
          };
          /*
          sgMail
            .send(msg)
            .then((res) => {
              console.log('mailres.errorcode', res[0].statusCode);
              if (res[0].statusCode >= 200 && res[0].statusCode < 400) {
                console.log('Successful send to ' + msg.to);
                subscriber['welcome_email'] = true;
                subscriber.save().catch((err) => {
                  console.log('err', err);
                });
              } else {
                console.log('email sending err', msg.to + res[0].statusCode);
              }
            })
            .catch((err) => {
              console.log('err', err);
            });
            */
        }
      }
    }
  },
  function () {
    console.log('Reminder Job finished.');
  },
  false,
  'US/Central'
);

const payment_check = new CronJob(
  '0 21 */3 * *',
  async () => {
    const subscribers = await User.find({
      'subscription.is_failed': true,
      'subscription.is_suspended': false,
      del: false,
    }).catch((err) => {
      console.log('err', err.messsage);
    });

    if (subscribers && subscribers.length > 0) {
      for (let i = 0; i < subscribers.length; i++) {
        const user = subscribers[i];

        const time_zone = user.time_zone_info
          ? JSON.parse(user.time_zone_info).tz_name
          : system_settings.TIME_ZONE;

        const payment = await Payment.findOne({ _id: user.payment }).catch(
          (err) => {
            console.log('payment find err', err.message);
          }
        );

        const data = {
          template_data: {
            user_name: user.user_name,
            created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
            amount: user.subscription.amount / 100 || 29,
            last_4_cc: payment.last4 || 'Unknown',
          },
          template_name: 'PaymentFailed',
          required_reply: true,
          email: user.email,
        };

        sendNotificationEmail(data);
      }
    }
  },
  function () {
    console.log('Payment Check Job finished.');
  },
  false,
  'US/Central'
);

const logger_check = new CronJob(
  '0 21 */3 * *',
  async () => {
    const logger_notification = await Notification.findOne({
      type: 'urgent',
      criteria: 'long_out',
    }).catch((err) => {
      console.log('err', err);
    });
    if (logger_notification) {
      let startdate = moment();
      startdate = startdate.subtract(30, 'days');
      const users = await User.find({
        last_logged: { $lt: startdate },
        del: false,
      }).catch((err) => {
        console.log('err', err);
      });
      if (users) {
        for (let i = 0; i < users.length; i++) {
          const subscriber = users[i];

          const msg = {
            to: users.email,
            from: mail_contents.SUPPORT_CRMGROW.MAIL,
            templateId: api.SENDGRID.SENDGRID_SYSTEM_NOTIFICATION,
            dynamic_template_data: {
              first_name: subscriber.user_name,
              content: logger_notification['content'],
            },
          };

          /*
          sgMail
            .send(msg)
            .then((res) => {
              console.log('mailres.errorcode', res[0].statusCode);
              if (res[0].statusCode >= 200 && res[0].statusCode < 400) {
                console.log('Successful send to ' + msg.to);
              } else {
                console.log('email sending err', msg.to + res[0].statusCode);
              }
            })
            .catch((err) => {
              console.log('err', err);
            });
            */
        }
      }
    }
  },
  function () {
    console.log('Logger check Job finished.');
  },
  false,
  'US/Central'
);

const notification_check = new CronJob(
  '0 21 * * *',
  async () => {
    const notifications = await Notification.find({
      type: 'static',
      sent: false,
    }).catch((err) => {
      console.log('err', err);
    });
    if (notifications) {
      const subscribers = await User.find({ del: false }).catch((err) => {
        console.log('err', err);
      });
      for (let i = 0; i < notifications.length; i++) {
        const notification = notifications[i];

        for (let j = 0; j < subscribers.length; j++) {
          const subscriber = subscribers[j];
          const msg = {
            to: subscriber.email,
            from: mail_contents.SUPPORT_CRMGROW.MAIL,
            templateId: api.SENDGRID.SENDGRID_SYSTEM_NOTIFICATION,
            dynamic_template_data: {
              first_name: subscriber.user_name,
              content: notification.content,
            },
          };
          /*
          sgMail
            .send(msg)
            .then((res) => {
              console.log('mailres.errorcode', res[0].statusCode);
              if (res[0].statusCode >= 200 && res[0].statusCode < 400) {
                console.log('Successful send to ' + msg.to);
                notification['sent'] = true;
              } else {
                console.log('email sending err', msg.to + res[0].statusCode);
              }
            })
            .catch((err) => {
              console.log('err', err);
            });
            */
        }
      }
    }

    let startdate = moment();
    startdate = startdate.subtract(7, 'days');
    const old_notifications = await Notification.find({
      type: 'static',
      created_at: { $lte: startdate },
    }).catch((err) => {
      console.log('err', err);
    });
    for (let i = 0; i < old_notifications.length; i++) {
      const old_notification = old_notifications[i];
      old_notification['del'] = true;
      old_notification.save().catch((err) => {
        console.log('err', err);
      });
    }
  },
  function () {
    console.log('Notification Check Job finished.');
  },
  false,
  'US/Central'
);

const convert_video_job = new CronJob(
  '0 1 * * *',
  async () => {
    const record_videos = await Video.find({
      recording: true,
      converted: 'none',
      del: false,
    }).catch((err) => {
      console.log('record videos convert err', err.message);
    });
    for (let i = 0; i < record_videos.length; i++) {
      const video = record_videos[i];
      const file_path = video.path;
      if (file_path) {
        if (fs.existsSync(file_path)) {
          const new_file = uuidv1() + '.mov';
          const new_path = TEMP_PATH + new_file;
          const args = [
            '-i',
            file_path,
            '-max_muxing_queue_size',
            '1024',
            '-vf',
            'pad=ceil(iw/2)*2:ceil(ih/2)*2',
            new_path,
          ];
          const ffmpegConvert = await child_process.spawn(ffmpegPath, args);
          ffmpegConvert.on('close', function () {
            console.log('converted end', file_path);
            const new_url = urls.VIDEO_URL + new_file;
            video['url'] = new_url;
            video['recording'] = false;
            video['path'] = new_path;
            video['converted'] = 'completed';
            video
              .save()
              .then(() => {
                fs.unlinkSync(file_path);
              })
              .catch((err) => {
                console.log('err', err.message);
              });
          });
        }
      }
    }

    const uploaded_videos = await Video.find({
      recording: false,
      converted: 'none',
      del: false,
      type: { $nin: ['youtube', 'vimeo'] },
    }).catch((err) => {
      console.log('uploaded videos convert err', err.message);
    });
    for (let i = 0; i < uploaded_videos.length; i++) {
      const video = uploaded_videos[i];
      const file_path = video.path;
      if (file_path) {
        if (fs.existsSync(file_path)) {
          const new_file = uuidv1() + '.mp4';
          const new_path = TEMP_PATH + new_file;
          const args = [
            '-i',
            file_path,
            '-c:v',
            'libx264',
            '-b:v',
            '1.5M',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            new_path,
          ];

          const ffmpegConvert = await child_process.spawn(ffmpegPath, args);
          ffmpegConvert.on('close', function () {
            console.log('converted end', file_path);
            if (fs.existsSync(new_path)) {
              const new_url = urls.VIDEO_URL + new_file;
              video['url'] = new_url;
              video['converted'] = 'completed';
              video['path'] = new_path;
              video
                .save()
                .then(() => {
                  fs.unlinkSync(file_path);
                })
                .catch((err) => {
                  console.log('err', err.message);
                });
            }
          });
        }
      }
    }
  },
  function () {
    console.log('Video Convert Job Finished.');
  },
  false,
  'US/Central'
);

const upload_video_job = new CronJob(
  '0 4 * * *',
  async () => {
    const videos = await Video.find({
      uploaded: false,
      del: false,
      type: { $nin: ['youtube', 'vimeo'] },
    }).catch((err) => {
      console.log('err', err.message);
    });

    if (videos) {
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const file_path = video.path;
        const old_path = video.old_path;
        if (file_path) {
          const file_name = video.path.slice(37);

          if (fs.existsSync(file_path)) {
            try {
              fs.readFile(file_path, (err, data) => {
                if (err) {
                  FileHelper.readFile(file_path)
                    .then(function (data1) {
                      console.log('File read was successful by stream', data1);
                      const today = new Date();
                      const year = today.getYear();
                      const month = today.getMonth();
                      const params = {
                        Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
                        Key: 'video' + year + '/' + month + '/' + file_name,
                        Body: data1,
                        ACL: 'public-read',
                      };
                      s3.upload(params, async (s3Err, upload) => {
                        if (s3Err) throw s3Err;
                        console.log(
                          `File uploaded successfully at ${upload.Location}`
                        );
                        video['url'] = upload.Location;
                        video['uploaded'] = true;
                        video
                          .save()
                          .then(() => {
                            fs.unlinkSync(file_path);
                          })
                          .catch((err) => {
                            console.log('err', err);
                          });
                      });
                    })
                    .catch(function (err) {
                      console.log('File read by stream error', err);
                    });
                } else {
                  console.log('File read was successful', data);
                  const today = new Date();
                  const year = today.getYear();
                  const month = today.getMonth();
                  const params = {
                    Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
                    Key: 'video' + year + '/' + month + '/' + file_name,
                    Body: data,
                    ACL: 'public-read',
                  };
                  s3.upload(params, async (s3Err, upload) => {
                    if (s3Err) throw s3Err;
                    console.log(
                      `File uploaded successfully at ${upload.Location}`
                    );
                    video['url'] = upload.Location;
                    video['uploaded'] = true;
                    video
                      .save()
                      .then(() => {
                        fs.unlinkSync(file_path);
                      })
                      .catch((err) => {
                        console.log('err', err.message);
                      });
                  });
                }
              });
            } catch (err) {
              console.log('err', err.message);
              // read file
            }
          }
          if (old_path && fs.existsSync(old_path)) {
            fs.unlinkSync(old_path);
          }
        }
      }
    }
  },
  function () {
    console.log('Convert Job finished.');
  },
  false,
  'US/Central'
);

const reset_daily_limit = new CronJob(
  '0 3 * * *',
  async () => {
    User.updateMany(
      {
        del: false,
      },
      {
        $set: {
          'email_info.count': 0,
        },
      }
    ).catch((err) => {
      console.log('daily email reset failed', err.message);
    });

    const smtp_users = await User.find({
      primary_connected: true,
      connected_email_type: 'smtp',
      del: false,
    }).catch((err) => {
      console.log('smtp user get err', err.message);
    });
    for (let i = 0; i < smtp_users.length; i++) {
      const smtp_user = smtp_users[i];
      const garbage = await Garbage.findOne({ user: smtp_user.id });

      const active_task = await Task.findOne({
        'action.type': 'assign_automation',
        user: smtp_user.id,
        status: 'pending',
      });

      const smtp_email_limit = garbage['smtp_info']['daily_limit'];

      if (active_task) {
        User.updateOne(
          {
            _id: smtp_user.id,
          },
          {
            $set: { 'email_info.max_count': smtp_email_limit },
          }
        ).catch((err) => {
          console.log('user update err', err.message);
        });
      } else {
        User.updateOne(
          {
            _id: smtp_user.id,
          },
          {
            $set: { 'email_info.max_count': smtp_email_limit * 2 },
          }
        ).catch((err) => {
          console.log('user update err', err.message);
        });
      }
    }
  },
  function () {
    console.log('Reminder Job finished.');
  },
  false,
  'US/Central'
);

const reset_monthly_limit = new CronJob(
  '0 3 1 * *',
  async () => {
    User.updateMany(
      { del: false },
      {
        $set: {
          'text_info.count': 0,
        },
      }
    ).catch((err) => {
      console.log('users found err', err.message);
    });
  },
  function () {
    console.log('Reminder Job finished.');
  },
  false,
  'US/Central'
);

const campaign_job = new CronJob(
  '0 * * * *',
  async () => {
    const due_date = new Date();
    const campaign_jobs = await CampaignJob.find({
      status: 'active',
      due_date: { $lte: due_date },
    }).populate({
      path: 'campaign',
      select: {
        email_template: 1,
        video: 1,
        pdf: 1,
        image: 1,
      },
    });

    if (campaign_jobs && campaign_jobs.length > 0) {
      for (let i = 0; i < campaign_jobs.length; i++) {
        const campaign_job = campaign_jobs[i];
        const campaign = campaign_job.email_template;
        const email_template = await EmailTemplate.findOne({
          _id: campaign.email_template,
        });

        const { user, contacts } = campaign_job;
        const data = {
          user,
          content: email_template.content,
          subject: email_template.subject,
          contacts,
          video_ids: campaign.videos,
          pdf_ids: campaign.pdfs,
          image_ids: campaign.images,
        };

        EmailHelper.sendEmail(data)
          .then((res) => {})
          .catch((err) => {
            console.log('err', err.message);
          });
      }
    }
  },
  function () {
    console.log('Reminder Job finished.');
  },
  false,
  'US/Central'
);

const clean_data = new CronJob(
  '0 1 * * *',
  async () => {
    const expired_date = new Date();
    expired_date.setDate(expired_date.getDate() - 60);

    const users = await User.find({
      del: true,
      data_cleaned: false,
      disabled_at: { $lte: expired_date },
    }).catch((err) => {
      console.log('admin user found err', err.message);
    });

    if (users && users.length) {
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        clearData(user.id).catch((err) => {
          console.log('user clear data err', err.message);
        });
      }
    }
  },
  function () {
    console.log('Reminder Job finished.');
  },
  false,
  'US/Central'
);

clean_data.start();
// signup_job.start();
task_job.start();
// weekly_report.start();
// upload_video_job.start();
// convert_video_job.start();
payment_check.start();
// campaign_job.start();
// logger_check.start()
// notification_check.start();
reset_daily_limit.start();
reset_monthly_limit.start();
scheduler_job.start();
// daily_report.start();
