const { google } = require('googleapis');
const moment = require('moment-timezone');
const path = require('path');
const mime = require('mime-types');
const { REDIS_ENDPOINT } = require('../config/redis');
const io = require('socket.io-emitter')({ host: REDIS_ENDPOINT, port: 6379 });

var graph = require('@microsoft/microsoft-graph-client');
const sgMail = require('@sendgrid/mail');
const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
require('isomorphic-fetch');

const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Deal = require('../models/deal');
const Email = require('../models/email');
const EmailTracker = require('../models/email_tracker');
const VideoTracker = require('../models/video_tracker');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
const User = require('../models/user');
const TimeLine = require('../models/time_line');

const mail_contents = require('../constants/mail_contents');
const api = require('../config/api');
const system_settings = require('../config/system_settings');

const urls = require('../constants/urls');

const { TRAKER_PATH } = require('../config/path');

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};
const oauth2 = require('simple-oauth2')(credentials);

const {
  activeTimeline,
  disableNext,
  remove: removeTimeline,
} = require('../helpers/automation');

const { createNotification } = require('../helpers/notification');

const listGmail = async (req, res) => {
  const { currentUser } = req;
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );
  const token = JSON.parse(currentUser.google_refresh_token);
  oauth2Client.setCredentials({ refresh_token: token.refresh_token });
  const gmail = google.gmail({ auth: oauth2Client, version: 'v1' });
  gmail.users.messages.list(
    {
      includeSpamTrash: false,
      userId: currentUser.email,
    },
    function (err, response) {
      console.log(err);
      const data = response.data;
      return res.send({
        data,
      });
    }
  );
};

const getGmail = async (req, res) => {
  const { currentUser } = req;
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );
  const token = JSON.parse(currentUser.google_refresh_token);
  oauth2Client.setCredentials({ refresh_token: token.refresh_token });

  const gmail = google.gmail({ auth: oauth2Client, version: 'v1' });
  gmail.users.messages.get(
    {
      userId: currentUser.email,
      id: req.params.id,
    },
    function (err, response) {
      console.log(err);
      const data = response.data;
      return res.send({
        data,
      });
    }
  );
};

const openTrack = async (req, res) => {
  const message_id = req.params.id;
  const _email = await Email.findOne({ message_id }).catch((err) => {
    console.log('err', err);
  });
  const user = await User.findOne({ _id: _email.user, del: false }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  const contact = await Contact.findOne({ _id: _email.contacts }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  const opened = new Date();
  if (contact && user) {
    const created_at = moment(opened)
      .utcOffset(user.time_zone)
      .format('h:mm a');
    const action = 'opened';
    const email_activity = await Activity.findOne({
      contacts: contact.id,
      emails: _email.id,
    }).catch((err) => {
      console.log('err', err);
    });

    let reopened = moment();
    reopened = reopened.subtract(1, 'hours');
    const old_activity = await EmailTracker.findOne({
      activity: email_activity.id,
      type: 'open',
      created_at: { $gte: reopened },
    }).catch((err) => {
      console.log('err', err);
    });

    if (!old_activity) {
      const email_tracker = new EmailTracker({
        user: user.id,
        contact: contact.id,
        email: _email.id,
        type: 'open',
        activity: email_activity.id,
        updated_at: opened,
        created_at: opened,
      });

      const _email_tracker = await email_tracker
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });

      const activity = new Activity({
        content: 'opened email',
        contacts: contact.id,
        user: user.id,
        type: 'email_trackers',
        emails: _email.id,
        email_trackers: _email_tracker.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const _activity = await activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });

      Contact.updateOne(
        { _id: contact.id },
        { $set: { last_activity: _activity.id } }
      ).catch((err) => {
        console.log('err', err);
      });

      createNotification(
        'open_email',
        {
          criteria: 'open_email',
          contact,
          user,
          action: {
            object: 'email',
            email: _email.id,
          },
          email: _email,
          email_tracker: _email_tracker,
        },
        user
      );
    }
  }
  const contentType = mime.contentType(path.extname(TRAKER_PATH));
  res.set('Content-Type', contentType);
  return res.sendFile(TRAKER_PATH);
};

const receiveEmailSendGrid = async (req, res) => {
  const message_id = req.body[0].sg_message_id.split('.')[0];
  const event = req.body[0].event;
  const email = req.body[0].email;
  const time_stamp = req.body[0].timestamp;
  const _email = await Email.findOne({ message_id }).catch((err) => {
    console.log('err', err);
  });
  if (_email) {
    const user = await User.findOne({ _id: _email.user, del: false }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    let contact;
    if (user) {
      contact = await Contact.findOne({ email, user: user.id }).catch((err) => {
        console.log('err', err);
      });
    }

    if (contact && user) {
      const opened = new Date(time_stamp * 1000);
      // const created_at = moment(opened)
      //   .utcOffset(user.time_zone)
      //   .format('h:mm a');
      const time_zone = user.time_zone_info
        ? JSON.parse(user.time_zone_info).tz_name
        : system_settings.TIME_ZONE;
      const created_at = moment(opened).tz(time_zone).format('h:mm a');
      let action = '';
      if (event === 'open') {
        action = 'opened';
        const email_activity = await Activity.findOne({
          contacts: contact.id,
          emails: _email.id,
        }).catch((err) => {
          console.log('err', err);
        });

        let old_activity;
        if (email_activity) {
          const reopened = new Date(time_stamp * 1000 - 60 * 60 * 1000);
          old_activity = await EmailTracker.findOne({
            activity: email_activity.id,
            type: 'open',
            created_at: { $gte: reopened },
          }).catch((err) => {
            console.log('err', err.message);
          });
        }

        if (!old_activity && email_activity) {
          const sent = new Date(email_activity.updated_at);
          const opened_gap = opened.getTime() - sent.getTime();

          if (opened_gap < 2000) {
            return;
          }

          const email_tracker = new EmailTracker({
            user: user.id,
            contact: contact.id,
            email: _email.id,
            type: 'open',
            activity: email_activity.id,
            updated_at: opened,
            created_at: opened,
          });
          const _email_tracker = await email_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          const activity = new Activity({
            content: 'opened email',
            contacts: contact.id,
            user: user.id,
            type: 'email_trackers',
            emails: _email.id,
            email_trackers: _email_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });

          const _activity = await activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          Contact.updateOne(
            { _id: contact.id },
            { $set: { last_activity: _activity.id } }
          ).catch((err) => {
            console.log('err', err);
          });

          createNotification(
            'open_email',
            {
              criteria: 'open_email',
              contact,
              user,
              action: {
                object: 'email',
                email: _email.id,
              },
              email_tracker: _email_tracker,
              email: _email,
            },
            user
          );

          /**
           * Automation checking
           */
          const timelines = await TimeLine.find({
            contact: contact.id,
            status: 'active',
            opened_email: req.params.id,
            'condition.case': 'opened_email',
            'condition.answer': true,
          }).catch((err) => {
            console.log('err', err);
          });

          if (timelines.length > 0) {
            for (let i = 0; i < timelines.length; i++) {
              try {
                const timeline = timelines[i];
                activeTimeline(timeline.id);
              } catch (err) {
                console.log('err', err.message);
              }
            }
          }
          const unopened_timelines = await TimeLine.findOne({
            contact: contact.id,
            status: 'active',
            opened_email: req.params.id,
            'condition.case': 'opened_email',
            'condition.answer': false,
          }).catch((err) => {
            console.log('err', err);
          });
          if (unopened_timelines.length > 0) {
            for (let i = 0; i < unopened_timelines.length; i++) {
              const timeline = unopened_timelines[i];
              disableNext(timeline.id);
            }
          }
        } else {
          return;
        }
      }
      if (event === 'click') {
        action = 'clicked the link on';
        const email_activity = await Activity.findOne({
          contacts: contact.id,
          emails: _email.id,
        }).catch((err) => {
          console.log('err', err);
        });
        const reclicked = new Date(time_stamp * 1000 - 60 * 60 * 1000);
        const old_activity = await EmailTracker.findOne({
          activity: email_activity.id,
          type: 'click',
          created_at: { $gte: reclicked },
        }).catch((err) => {
          console.log('err', err);
        });

        if (old_activity) {
          return;
        }
        const email_tracker = new EmailTracker({
          user: user.id,
          contact: contact.id,
          email: _email.id,
          type: 'click',
          activity: email_activity.id,
          updated_at: opened,
          created_at: opened,
        });
        if (email_activity.campaign) {
          email_tracker['campaign'] = email_activity.campaign;
        }
        const _email_tracker = await email_tracker
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const activity = new Activity({
          content: 'clicked the link on email',
          contacts: contact.id,
          user: user.id,
          type: 'email_trackers',
          emails: _email.id,
          email_trackers: _email_tracker.id,
          created_at: new Date(),
          updated_at: new Date(),
        });
        if (email_activity.campaign) {
          activity['campaign'] = email_activity.campaign;
        }

        const _activity = await activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: _activity.id },
          }
        ).catch((err) => {
          console.log('err', err);
        });

        createNotification(
          'click_link',
          {
            criteria: 'click_link',
            contact,
            user,
            action: {
              object: 'email',
              email: _email.id,
            },
            email: _email,
            email_tracker: _email_tracker,
          },
          user
        );
      }
      if (event === 'unsubscribe') {
        action = 'unsubscribed';
        const email_activity = await Activity.findOne({
          contacts: contact.id,
          emails: _email.id,
        }).catch((err) => {
          console.log('err', err);
        });
        const email_tracker = new EmailTracker({
          user: user.id,
          contact: contact.id,
          email: _email.id,
          type: 'unsubscribe',
          activity: email_activity.id,
          updated_at: opened,
          created_at: opened,
        });
        const _email_tracker = await email_tracker
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const activity = new Activity({
          content: 'unsubscribed email',
          contacts: contact.id,
          user: user.id,
          type: 'email_trackers',
          emails: _email.id,
          email_trackers: _email_tracker.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        const _activity = await activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: _activity.id },
            $push: { tags: { $each: ['unsubscribed'] } },
          }
        ).catch((err) => {
          console.log('err', err);
        });

        createNotification(
          'unsubscribe_email',
          {
            criteria: 'unsubscribe_email',
            contact,
            user,
            action: {
              object: 'email',
              email: _email.id,
            },
            email: _email,
            email_trackers: _email_tracker,
          },
          user
        );
      }
    }
  }

  return res.send({
    status: true,
  });
};

const receiveEmail = async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id })
    .populate({ path: 'emails', select: 'has_shared shared_email' })
    .catch((err) => {
      console.log('activity finding err', err.message);
    });

  if (activity) {
    const user = await User.findOne({ _id: activity.user, del: false }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    const contact = await Contact.findOne({ _id: activity.contacts }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    const opened = new Date();
    if (contact && user) {
      const sent = new Date(activity.updated_at);
      const opened_gap = opened.getTime() - sent.getTime();

      if (opened_gap < 4000) {
        return;
      }

      let reopened = moment();
      reopened = reopened.subtract(1, 'hours');

      const old_activity = await EmailTracker.findOne({
        activity: req.params.id,
        type: 'open',
        created_at: { $gte: reopened },
      }).catch((err) => {
        console.log('err', err);
      });

      if (!old_activity) {
        const email_tracker = new EmailTracker({
          user: user.id,
          contact: contact.id,
          email: activity.emails,
          type: 'open',
          activity: req.params.id,
          updated_at: opened,
          created_at: opened,
        });
        if (activity.campaign) {
          email_tracker['campaign'] = activity.campaign;
        }

        const _email_tracker = await email_tracker
          .save()
          .then()
          .catch((err) => {
            console.log('email tracker err', err.message);
          });

        const opened_activity = new Activity({
          content: 'opened email',
          contacts: contact.id,
          user: user.id,
          type: 'email_trackers',
          emails: activity.emails,
          email_trackers: _email_tracker.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        if (activity.campaign) {
          opened_activity.campaign = activity.campaign;
        }

        const _activity = await opened_activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.updateOne(
          { _id: contact.id },
          { $set: { last_activity: _activity.id } }
        ).catch((err) => {
          console.log('err', err);
        });
        /**
         * Deal activity
         */

        if (activity && activity.emails && activity.emails.has_shared) {
          Email.updateOne(
            {
              _id: activity.emails.shared_email,
            },
            {
              $set: {
                email_tracker: _email_tracker.id,
              },
              $unset: {
                video_tracker: true,
                pdf_tracker: true,
                image_tracker: true,
              },
            }
          ).catch((err) => {
            console.log('email update one', err.message);
          });

          const shared_email = await Email.findOne({
            _id: activity.emails.shared_email,
          });

          if (shared_email && shared_email.deal) {
            const timeline_data = {
              contact: contact.id,
              deal: shared_email.deal,
              email_activity: activity.id,
            };

            triggerTimeline(timeline_data);
          }
        }

        const timeline_data = {
          contact: contact.id,
          email_activity: activity.id,
        };

        triggerTimeline(timeline_data);

        /**
         * Notification
         */
        const _email = await Email.findOne({ _id: activity.emails }).catch(
          (err) => {
            console.log('email finding err', err);
          }
        );

        createNotification(
          'open_email',
          {
            criteria: 'open_email',
            contact,
            user,
            action: {
              object: 'email',
              email: activity.emails,
            },
            email_tracker: _email_tracker,
            email: _email,
          },
          user
        );
      }
    }
  }

  const contentType = mime.contentType(path.extname(TRAKER_PATH));
  res.set('Content-Type', contentType);
  res.sendFile(TRAKER_PATH);
};

const receiveEmailExtension = async (req, res) => {
  const activity = await Activity.findOne({ send_uuid: req.params.id }).catch(
    (err) => {
      console.log('activity finding err', err.message);
    }
  );

  if (activity) {
    const user = await User.findOne({ _id: activity.user, del: false }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    const opened = new Date();

    if (user) {
      const sent = new Date(activity.updated_at);
      const opened_gap = opened.getTime() - sent.getTime();

      if (opened_gap < 4000) {
        return;
      }

      let reopened = moment();
      reopened = reopened.subtract(1, 'hours');

      const old_activity = await EmailTracker.findOne({
        activity: activity._id,
        type: 'open',
        created_at: { $gte: reopened },
      }).catch((err) => {
        console.log('err', err);
      });

      if (!old_activity) {
        const email_tracker = new EmailTracker({
          user: user._id,
          email: activity.emails,
          type: 'open',
          activity: activity._id,
          updated_at: opened,
          created_at: opened,
        });

        email_tracker.save().catch((err) => {
          console.log('email tracker err', err.message);
        });

        Activity.updateOne(
          {
            _id: activity._id,
          },
          {
            $set: {
              email_trackers: email_tracker.id,
            },
            $unset: {
              video_trackers: true,
              pdf_trackers: true,
              image_trackers: true,
            },
          }
        ).catch((err) => {
          console.log('email update one', err.message);
        });

        let i = 1;
        const emailInterval = setInterval(function () {
          io.of('/extension').to(user._id).emit('updated_activity', {
            last_time: email_tracker.updated_at,
          });
          i++;
          if (i > 5) {
            clearInterval(emailInterval);
          }
        }, 1000);
      }
    }
  }

  const contentType = mime.contentType(path.extname(TRAKER_PATH));
  res.set('Content-Type', contentType);
  return res.sendFile(TRAKER_PATH);
};

const unSubscribePage = async (req, res) => {
  return res.render('unsubscribe');
};

const unSubscribeEmail = async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id }).catch(
    (err) => {
      console.log('activity finding err', err);
    }
  );

  let _activity;
  if (activity) {
    const user = await User.findOne({ _id: activity.user, del: false }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    const contact = await Contact.findOne({ _id: activity.contacts }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    const action = 'unsubscribed';

    if (user && contact) {
      const activity_type = activity.type;
      switch (activity_type) {
        case 'emails': {
          const email_tracker = new EmailTracker({
            user: user.id,
            contact: contact.id,
            email: activity.emails,
            type: 'unsubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          if (activity.campaign) {
            email_tracker.campaign = activity.campaign;
          }
          const _email_tracker = await email_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('email tracker save error', err.message);
            });

          _activity = new Activity({
            content: 'unsubscribed email',
            contacts: contact.id,
            user: user.id,
            type: 'email_trackers',
            emails: activity.emails,
            email_trackers: _email_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        case 'videos': {
          const video_tracker = new VideoTracker({
            user: user.id,
            contact: contact.id,
            video: activity.videos,
            type: 'unsubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          if (activity.campaign) {
            video_tracker.campaign = activity.campaign;
          }
          const _video_tracker = await video_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('video track save error', err.message);
            });

          _activity = new Activity({
            content: 'unsubscribed video email',
            contacts: contact.id,
            user: user.id,
            type: 'video_trackers',
            videos: activity.videos,
            video_trackers: _video_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        case 'pdfs': {
          const pdf_tracker = new PDFTracker({
            user: user.id,
            contact: contact.id,
            pdf: activity.pdfs,
            type: 'unsubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          if (activity.campaign) {
            pdf_tracker.campaign = activity.campaign;
          }
          const _pdf_tracker = await pdf_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('pdf track save error', err.message);
            });

          _activity = new Activity({
            content: 'unsubscribed pdf email',
            contacts: contact.id,
            user: user.id,
            type: 'pdf_trackers',
            pdfs: activity.pdfs,
            pdf_trackers: _pdf_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        case 'images': {
          const image_tracker = new ImageTracker({
            user: user.id,
            contact: contact.id,
            image: activity.images,
            type: 'unsubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          if (activity.campaign) {
            image_tracker.campaign = activity.campaign;
          }
          const _image_tracker = await image_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('image track save error', err.message);
            });

          _activity = new Activity({
            content: 'unsubscribed image email',
            contacts: contact.id,
            user: user.id,
            type: 'image_trackers',
            images: activity.images,
            image_trackers: _image_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        default:
          break;
      }
    }

    if (activity.campaign) {
      _activity.campaign = activity.campaign;
    }

    const last_activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });
    Contact.updateOne(
      { _id: contact.id },
      {
        $set: { last_activity: last_activity.id },
        $push: { tags: { $each: ['unsubscribed'] } },
      }
    ).catch((err) => {
      console.log('err', err);
    });
    // Unsubscribe Notification
    createNotification(
      'unsubscribe_email',
      {
        criteria: 'unsubscribe_email',
        user,
        contact,
      },
      user
    );
  }
  res.send('You successfully unsubscribed CRMGrow email');
};

const reSubscribeEmail = async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id }).catch(
    (err) => {
      console.log('activity finding err', err.message);
    }
  );

  let _activity;
  if (activity) {
    const user = await User.findOne({ _id: activity.user }).catch((err) => {
      console.log('err', err.message);
    });

    const contact = await Contact.findOne({ _id: activity.contacts }).catch(
      (err) => {
        console.log('err', err.message);
      }
    );

    const action = 'resubscribed';

    if (user && contact) {
      const activity_type = activity.type;
      switch (activity_type) {
        case 'emails': {
          const email_tracker = new EmailTracker({
            user: user.id,
            contact: contact.id,
            email: activity.emails,
            type: 'resubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          const _email_tracker = await email_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('email tracker save error', err.message);
            });

          _activity = new Activity({
            content: 'resubscribed email',
            contacts: contact.id,
            user: user.id,
            type: 'email_trackers',
            emails: activity.emails,
            email_trackers: _email_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        case 'videos': {
          const video_tracker = new VideoTracker({
            user: user.id,
            contact: contact.id,
            video: activity.videos,
            type: 'resubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          const _video_tracker = await video_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('video track save error', err.message);
            });

          _activity = new Activity({
            content: 'resubscribed video email',
            contacts: contact.id,
            user: user.id,
            type: 'video_trackers',
            videos: activity.videos,
            video_trackers: _video_tracker.id,
          });
          break;
        }
        case 'pdfs': {
          const pdf_tracker = new PDFTracker({
            user: user.id,
            contact: contact.id,
            pdf: activity.pdfs,
            type: 'resubscribe',
            activity: activity.id,
          });

          const _pdf_tracker = await pdf_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('pdf track save error', err.message);
            });

          _activity = new Activity({
            content: 'resubscribed pdf email',
            contacts: contact.id,
            user: user.id,
            type: 'pdf_trackers',
            pdfs: activity.pdfs,
            pdf_trackers: _pdf_tracker.id,
          });
          break;
        }
        case 'images': {
          const image_tracker = new ImageTracker({
            user: user.id,
            contact: contact.id,
            image: activity.images,
            type: 'resubscribe',
            activity: activity.id,
          });

          const _image_tracker = await image_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('image track save error', err.message);
            });

          _activity = new Activity({
            content: 'resubscribed image email',
            contacts: contact.id,
            user: user.id,
            type: 'image_trackers',
            images: activity.images,
            image_trackers: _image_tracker.id,
          });
          break;
        }
        default:
          break;
      }
    }

    const last_activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err.message);
      });
    Contact.updateOne(
      { _id: contact.id },
      {
        $set: { last_activity: last_activity.id },
        $pull: { tags: { $in: ['unsubscribed'] } },
      }
    ).catch((err) => {
      console.log('err', err.message);
    });

    // Notification
    createNotification(
      'resubscribe_email',
      {
        criteria: 'resubscribe_email',
        user,
        contact,
      },
      user
    );
  }
  res.send('You successfully resubscribed CRMGrow email');
};

const sharePlatform = async (req, res) => {
  sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

  const { currentUser } = req;
  const { contacts, content, subject } = req.body;

  const promise_array = [];
  const error = [];

  for (let i = 0; i < contacts.length; i++) {
    let email_content = content;
    let email_subject = subject;
    const _contact = contacts[i];

    email_subject = email_subject
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name || '')
      .replace(/{contact_last_name}/gi, _contact.last_name || '')
      .replace(/{contact_email}/gi, _contact.email);

    email_content = email_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name || '')
      .replace(/{contact_last_name}/gi, _contact.last_name || '')
      .replace(/{contact_email}/gi, _contact.email);

    const msg = {
      from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
      to: _contact.email,
      replyTo: currentUser.connected_email,
      subject: email_subject,
      html: email_content + '<br/><br/>' + currentUser.email_signature,
      text: email_content,
    };

    const promise = new Promise((resolve, reject) => {
      sgMail
        .send(msg)
        .then(async (_res) => {
          if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
            resolve();
          } else {
            error.push({
              contact: {
                first_name: _contact.name,
                email: _contact.email,
              },
              error: _res[0].statusCode,
            });
            resolve();
          }
        })
        .catch((err) => {
          error.push({
            contact: {
              first_name: _contact.name,
              email: _contact.email,
            },
            err,
          });
          resolve();
        });
    });
    promise_array.push(promise);
  }
  Promise.all(promise_array)
    .then(() => {
      if (error.length > 0) {
        return res.status(405).json({
          status: false,
          error,
        });
      }
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err);
      return res.status(400).json({
        status: false,
        error: err,
      });
    });
};

const clickEmailLink = async (req, res) => {
  const { url, activity_id } = req.query;

  // eliminate http, https, ftp from url.
  const pattern = /^((http|https|ftp):\/\/)/;
  const link = url.replace(pattern, '');
  const activity = await Activity.findOne({ _id: activity_id }).catch((err) => {
    console.log('activity finding err', err.message);
  });

  let _activity;
  if (activity) {
    const user = await User.findOne({ _id: activity.user, del: false }).catch(
      (err) => {
        console.log('user found err', err.message);
      }
    );

    const contact = await Contact.findOne({ _id: activity.contacts }).catch(
      (err) => {
        console.log('contact found err', err.message);
      }
    );

    const action = 'clicked the link on';

    if (user && contact) {
      if (user.link_track_enabled) {
        const email_tracker = new EmailTracker({
          user: user.id,
          contact: contact.id,
          email: activity.emails,
          type: 'click',
          link,
          activity: activity.id,
        });

        if (activity.campaign) {
          email_tracker.campaign = activity.campaign;
        }

        const _email_tracker = await email_tracker
          .save()
          .then()
          .catch((err) => {
            console.log('email tracker save error', err.message);
          });

        _activity = new Activity({
          content: 'clicked the link on email',
          contacts: contact.id,
          user: user.id,
          type: 'email_trackers',
          emails: activity.emails,
          email_trackers: _email_tracker.id,
        });

        if (activity.campaign) {
          _activity.campaign = activity.campaign;
        }
        const last_activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('activity save err', err.message);
          });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: last_activity.id },
          }
        ).catch((err) => {
          console.log('contact update err', err.message);
        });

        const _email = await Email.findOne({ _id: activity.emails }).catch(
          (err) => {
            console.log('err', err);
          }
        );

        // Notification
        createNotification(
          'click_link',
          {
            criteria: 'click_link',
            contact,
            user,
            action: {
              object: 'email',
              email: activity.emails,
            },
            email_tracker: _email_tracker,
            email: _email,
          },
          user
        );
      }
    }
  }
  res.render('redirect', {
    url,
  });
};

const sendEmail = async (req, res) => {
  const { emails, email_content, email_subject } = req.body;
  const { currentUser } = req;
  const promise_array = [];
  const error = [];
  if (
    currentUser.connected_email_type === 'gmail' ||
    currentUser.connected_email_type === 'gsuit'
  ) {
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );
    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message || err.msg);
      return res.status(406).send({
        status: false,
        error: 'not connected',
      });
    });
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const promise = new Promise(async (resolve, reject) => {
        try {
          const body = createBody({
            headers: {
              To: email,
              From: `${currentUser.user_name} <${currentUser.connected_email}>`,
              Subject: email_subject,
            },
            textHtml: email_content,
          });
          request({
            method: 'POST',
            uri: 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
            headers: {
              Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
              'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
            },
            body,
          })
            .then(async () => {
              resolve();
            })
            .catch((err) => {
              console.log('user send email err', err.message);
              error.push(email);
              resolve();
            });
        } catch (err) {
          console.log('user send email err', err.message);
          error.push(email);
        }
      }).catch((err) => {
        console.log('promise err', err);
      });
      promise_array.push(promise);
    }
  } else if (
    currentUser.connected_email_type === 'outlook' ||
    currentUser.connected_email_type === 'microsoft'
  ) {
    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      let accessToken;
      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error.message);
          } else {
            resolve(result.token);
          }
        });
      })
        .then((token) => {
          accessToken = token.access_token;
        })
        .catch((error) => {
          console.log('outlook token grant error', error);
          return res.status(406).send({
            status: false,
            error: 'not connected',
          });
        });
      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      const sendMail = {
        message: {
          subject: email_subject,
          from: {
            emailAddress: {
              name: currentUser.user_name,
              address: currentUser.connected_email,
            },
          },
          body: {
            contentType: 'HTML',
            content: email_content,
          },
          toRecipients: [
            {
              emailAddress: {
                address: email,
              },
            },
          ],
        },
        saveToSentItems: 'true',
      };

      const promise = new Promise((resolve, reject) => {
        client
          .api('/me/sendMail')
          .post(sendMail)
          .then(() => {
            resolve();
          })
          .catch((err) => {
            console.log('outlook err', err.message);
            error.push(email);
            resolve();
          });
      });
      promise_array.push(promise);
    }
  }
  Promise.all(promise_array)
    .then(() => {
      if (error.length > 0) {
        return res.send({
          status: false,
          error,
        });
      }
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).json({
        status: false,
        errror: err.message,
      });
    });
};

const triggerTimeline = async (timeline_data) => {
  const { deal, contact, email_activity } = timeline_data;

  if (deal) {
    const _deal = await Deal.findOne({
      _id: deal,
    });

    if (_deal && _deal.primary_contact.toString() === contact) {
      /**
       * Automation checking
       */
      const timeline = await TimeLine.findOne({
        deal,
        status: 'checking',
        opened_email: email_activity,
        'condition.case': 'opened_email',
        'condition.answer': true,
      }).catch((err) => {
        console.log('timeline find err', err.message);
      });

      if (timeline) {
        activeTimeline(timeline.id);
      }

      const unopened_timeline = await TimeLine.findOne({
        deal,
        status: 'active',
        opened_email: email_activity,
        'condition.case': 'opened_email',
        'condition.answer': false,
      }).catch((err) => {
        console.log('timeline find err', err.message);
      });

      if (unopened_timeline) {
        const next_data = {
          ref: unopened_timeline.ref,
          deal,
        };

        disableNext(next_data);

        if (!timeline) {
          removeTimeline({ contact });
        }
      }
    }
  } else {
    /**
     * Automation checking
     */
    const timeline = await TimeLine.findOne({
      contact,
      status: 'checking',
      opened_email: email_activity,
      'condition.case': 'opened_email',
      'condition.answer': true,
    }).catch((err) => {
      console.log('timeline find err', err.message);
    });

    if (timeline) {
      activeTimeline(timeline.id);
    }

    const unopened_timeline = await TimeLine.findOne({
      contact,
      status: 'active',
      opened_email: email_activity,
      'condition.case': 'opened_email',
      'condition.answer': false,
    }).catch((err) => {
      console.log('timeline find err', err.message);
    });

    if (unopened_timeline) {
      const next_data = {
        ref: unopened_timeline.ref,
        contact,
      };

      disableNext(next_data);

      if (!timeline) {
        removeTimeline({ contact });
      }
    }
  }
};

module.exports = {
  openTrack,
  getGmail,
  listGmail,
  receiveEmailSendGrid,
  receiveEmail,
  receiveEmailExtension,
  clickEmailLink,
  unSubscribeEmail,
  unSubscribePage,
  reSubscribeEmail,
  sharePlatform,
  sendEmail,
};
