const mongoose = require('mongoose');
const moment = require('moment-timezone');
const CronJob = require('cron').CronJob;

const User = require('../models/user');
const Contact = require('../models/contact');
const Activity = require('../models/activity');

const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

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

weekly_report.start();
