const sgMail = require('@sendgrid/mail');
const webpush = require('web-push');
const phone = require('phone');
const moment = require('moment-timezone');
const { REDIS_ENDPOINT } = require('../config/redis');
const io = require('socket.io-emitter')({ host: REDIS_ENDPOINT, port: 6379 });

const User = require('../models/user');
const Contact = require('../models/contact');
const Email = require('../models/email');
const Text = require('../models/text');
const PDFTracker = require('../models/pdf_tracker');
const PDF = require('../models/pdf');
const VideoTracker = require('../models/video_tracker');
const Video = require('../models/video');
const Image = require('../models/image');
const ImageTracker = require('../models/image_tracker');
const Activity = require('../models/activity');
const TimeLine = require('../models/time_line');
const Deal = require('../models/deal');
const {
  activeTimeline,
  disableNext,
  remove: removeTimeline,
} = require('../helpers/automation');
const Notification = require('../models/notification');
const { createNotification } = require('../helpers/notification');

const createPDF = async (req, res) => {
  const { activity_id } = req.body;
  const { total_pages } = req.body;
  const sent_activity = await Activity.findOne({ _id: activity_id })
    .populate([
      { path: 'emails', select: 'has_shared shared_email' },
      { path: 'texts', select: 'has_shared shared_text' },
    ])
    .catch((err) => {
      console.log('send activity', err.message);
    });
  let queryContact = null;
  if (sent_activity.contacts) {
    queryContact = sent_activity.contacts;
  }
  if (sent_activity) {
    const user_id = sent_activity.user;
    const contact_id = sent_activity.contacts;
    const pdf_id = sent_activity.pdfs;
    const user = await User.findOne({ _id: user_id });
    const pdf = await PDF.findOne({ _id: pdf_id });
    if (queryContact) {
      const pdf_tracker = new PDFTracker({
        activity: activity_id,
        contact: contact_id,
        user: user_id,
        pdf: pdf_id,
        total_pages,
      });
      pdf_tracker.save().catch((err) => {
        console.log('pdf tracker save err', err.message);
      });
      if (sent_activity.send_type !== 2) {
        const contact = await Contact.findOne({ _id: contact_id });
        createNotification(
          'review_pdf',
          {
            criteria: 'material_track',
            user,
            contact,
            pdf,
            pdf_tracker,
            action: {
              object: 'pdf',
              pdf: [pdf.id],
            },
          },
          user
        );
        const timeline_data = {
          contact: contact_id,
          material: pdf_id,
        };

        triggerTimeline(timeline_data);

        if (sent_activity.send_type === 1) {
          // create send video activity && tracker activity
          const sendActivity = new Activity({
            content: 'sent pdf using mobile',
            contacts: pdf_tracker.contact,
            user: pdf_tracker.user,
            type: 'pdfs',
            pdfs: pdf_tracker.pdf,
            texts: sent_activity.texts,
            send_uuid: sent_activity.send_uuid,
          });
          // Video Tracker activity update with the send activity
          sendActivity.save().then(() => {
            pdf_tracker.activity = sendActivity._id;
            pdf_tracker.save();
          });
        }

        const activity = new Activity({
          content: 'reviewed pdf',
          contacts: contact_id,
          user: user_id,
          type: 'pdf_trackers',
          pdf_trackers: pdf_tracker.id,
          pdfs: pdf.id,
        });

        activity
          .save()
          .then(async (_activity) => {
            // deal last activity check
            if (
              sent_activity &&
              sent_activity.emails &&
              sent_activity.emails.has_shared
            ) {
              Email.updateOne(
                {
                  _id: sent_activity.emails.shared_email,
                },
                {
                  $set: {
                    pdf_tracker: pdf_tracker.id,
                  },
                  $unset: {
                    video_tracker: true,
                    image_tracker: true,
                    email_tracker: true,
                  },
                }
              ).catch((err) => {
                console.log('email update one', err.message);
              });

              const shared_email = await Email.findOne({
                _id: sent_activity.emails.shared_email,
              });

              if (shared_email && shared_email.deal) {
                const timeline_data = {
                  contact: contact_id,
                  deal: shared_email.deal,
                  material: pdf_id,
                };

                triggerTimeline(timeline_data);
              }
            }

            if (
              sent_activity &&
              sent_activity.texts &&
              sent_activity.texts.has_shared
            ) {
              Text.updateOne(
                {
                  _id: sent_activity.texts.shared_text,
                },
                {
                  $set: {
                    pdf_tracker: pdf_tracker.id,
                  },
                  $unset: {
                    video_tracker: true,
                    image_tracker: true,
                    email_tracker: true,
                  },
                }
              ).catch((err) => {
                console.log('email update one', err.message);
              });

              const shared_text = await Email.findOne({
                _id: sent_activity.texts.shared_text,
              });

              if (shared_text && shared_text.deal) {
                const timeline_data = {
                  contact: contact_id,
                  deal: shared_text.deal,
                  material: pdf_id,
                };

                triggerTimeline(timeline_data);
              }
            }

            if (contact_id) {
              Contact.updateOne(
                { _id: contact_id },
                {
                  $set: { last_activity: _activity.id },
                }
              ).catch((err) => {
                console.log('err', err.message);
              });
            }
          })
          .catch((err) => {
            console.log('err', err.message);
          });
        Activity.updateOne(
          {
            _id: activity_id,
          },
          {
            $set: {
              pdf_trackers: pdf_tracker.id,
            },
            $unset: {
              email_trackers: true,
              video_trackers: true,
              image_trackers: true,
            },
          }
        ).catch((err) => {
          console.log('email update one', err.message);
        });

        let i = 1;
        const pdfInterval = setInterval(function () {
          io.of('/extension').to(user._id).emit('updated_activity', {
            last_time: pdf_tracker.updated_at,
          });
          i++;
          if (i > 5) {
            clearInterval(pdfInterval);
          }
        }, 1000);

        // ========================= Notifications for web push, email, text =========================

        // ========================= Auto Follow up (2nd case) removing logic ========================
      } else {
        /**
        www.ioObject
          .of('/extension')
          .to(user._id)
          .emit('pdf_tracked', {
            data: {
              content: 'reviewed pdf',
              title: pdf.title,
              preview: pdf.preview,
              contact: sent_activity.to_emails,
              watched_date: pdf_tracker.updated_at,
              _id: sent_activity.send_uuid,
            },
          });
        */
        Activity.updateOne(
          {
            _id: activity_id,
          },
          {
            $set: {
              pdf_trackers: pdf_tracker.id,
            },
            $unset: {
              email_trackers: true,
              video_trackers: true,
              image_trackers: true,
            },
          }
        ).catch((err) => {
          console.log('email update one', err.message);
        });

        let i = 1;
        const pdfInterval = setInterval(function () {
          io.of('/extension').to(user._id).emit('updated_activity', {
            last_time: pdf_tracker.updated_at,
          });
          i++;
          if (i > 5) {
            clearInterval(pdfInterval);
          }
        }, 1000);
      }
      return res.send({
        status: true,
        data: pdf_tracker.id,
      });
    } else {
      const pdf_tracker = new PDFTracker({
        activity: activity_id,
        user: user_id,
        pdf: pdf_id,
        total_pages,
      });
      pdf_tracker.save().catch((err) => {
        console.log('pdf tracker save err', err.message);
      });
      createNotification(
        'review_pdf',
        {
          criteria: 'material_track',
          user,
          pdf,
          pdf_tracker,
          activity: activity_id,
          action: {
            object: 'pdf',
            pdf: [pdf.id],
          },
        },
        user
      );
      let i = 1;
      const pdfInterval = setInterval(function () {
        io.of('/extension').to(user._id).emit('updated_activity', {
          last_time: pdf_tracker.updated_at,
        });
        i++;
        if (i > 5) {
          clearInterval(pdfInterval);
        }
      }, 1000);
      return res.send({
        status: true,
        data: pdf_tracker.id,
      });
    }
  } else {
    return res.send({
      status: false,
    });
  }
};

const updatePDF = async (req, res) => {
  PDFTracker.updateOne(
    { _id: req.params.id },
    {
      $set: { ...req.body },
    }
  ).catch((err) => {
    console.log('update pdf track err', err.message);
  });

  return res.send({
    status: true,
  });
};

const createVideo = async (data) => {
  const video_tracker = new VideoTracker({
    ...data,
  });
  video_tracker.save().then(() => {
    let contact = null;
    if (video_tracker.contact && video_tracker.contact.length) {
      contact = video_tracker.contact;
    }

    Activity.findOne({
      _id: data.activity,
    })
      .then((send_activity) => {
        if (send_activity.send_type !== 2) {
          if (send_activity.send_type === 1) {
            // create send video activity && tracker activity
            const sendActivity = new Activity({
              content: 'sent video using mobile',
              contacts: contact,
              user: video_tracker.user,
              type: 'videos',
              videos: video_tracker.video,
              texts: send_activity.texts,
              send_uuid: send_activity.send_uuid,
            });
            // Video Tracker activity update with the send activity
            sendActivity.save().then(() => {
              video_tracker.activity = sendActivity._id;
              video_tracker.save();
            });
          }
          const activity = new Activity({
            content: 'watched video',
            contacts: contact,
            user: video_tracker.user,
            type: 'video_trackers',
            video_trackers: video_tracker._id,
            videos: video_tracker.video,
          });
          const trackerId = video_tracker._id;
          if (send_activity && send_activity.campaign) {
            VideoTracker.updateOne(
              { _id: trackerId },
              { $set: { campaign: send_activity.campaign } }
            ).catch(() => {});
            activity.campaign = send_activity.campaign;
          }
          activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });
        }
      })
      .catch((err) => {
        console.log('send video activity finding is failed', err.message);
      });
  });
  return video_tracker;
};

const disconnectVideo = async (video_tracker_id, isEnd = false) => {
  const query = await VideoTracker.findOne({ _id: video_tracker_id });
  const currentUser = await User.findOne({ _id: query['user'], del: false });
  const video = await Video.findOne({ _id: query['video'] });
  console.log('query', query);

  let queryContact;
  if (query && query.contact && query.contact.length) {
    queryContact = query.contact;
  }
  let full_watched;

  const sent_activity = await Activity.findOne({ _id: query.activity })
    .populate([
      { path: 'emails', select: 'has_shared shared_email' },
      { path: 'texts', select: 'has_shared shared_text' },
    ])
    .catch((err) => {
      console.log('send activity', err.message);
    });

  if (currentUser && sent_activity) {
    if (query.material_last) {
      if (query.material_last * 1000 > video.duration - 10000) {
        full_watched = true;
      }
      Activity.updateOne(
        {
          _id: query.activity,
        },
        {
          $set: {
            material_last: query.material_last,
            full_watched,
          },
        },
        {
          timestamps: false,
        }
      ).catch((err) => {
        console.log('activty material last update err', err.message);
      });
    }

    let percent = 0;

    if (full_watched) {
      percent = 100;
    } else if (video.duration && query.duration) {
      percent = (query.duration / video.duration) * 100;
    }

    if (sent_activity.send_type !== 2) {
      const currentCount = await Activity.countDocuments({
        video_trackers: query.id,
      }).catch((err) => {
        console.log('activity remove err', err.message);
      });
      const notificationAction = {
        object: 'video',
        video: [video.id],
      };
      if (isEnd) {
        notificationAction.isEnd = true;
      }
      const d = query['duration'] / 1000;
      let h = Math.floor(d / 3600);
      let m = Math.floor((d % 3600) / 60);
      let s = Math.floor((d % 3600) % 60);

      if (h < 10) {
        h = '0' + h;
      }
      if (m < 10) {
        m = '0' + m;
      }
      if (s < 10) {
        s = '0' + s;
      }
      const watched_time = h + ':' + m + ':' + s;
      const tD = Math.floor(video.duration / 1000);
      let tH = Math.floor(tD / 3600);
      let tM = Math.floor((tD % 3600) / 60);
      let tS = Math.floor((tD % 3600) % 60);

      if (tH < 10) {
        tH = '0' + tH;
      }
      if (tM < 10) {
        tM = '0' + tM;
      }
      if (tS < 10) {
        tS = '0' + tS;
      }

      let total_time = '';

      if (tH === '00') {
        total_time = tM + ':' + tS;
      } else {
        total_time = tH + ':' + tM + ':' + tS;
      }
      if (queryContact) {
        const activity = new Activity({
          content: 'watched video',
          contacts: query.contact,
          user: currentUser.id,
          type: 'video_trackers',
          video_trackers: query.id,
          videos: video.id,
        });

        if (query.campaign) {
          activity.campaign = query.campaign;
        }
        await Activity.deleteMany({
          video_trackers: query.id,
          type: 'video_trackers',
        }).catch((err) => {
          console.log('activity remove err', err.message);
        });

        activity
          .save()
          .then(async (_activity) => {
            /**
             * Deal last activity check
             */

            if (
              sent_activity &&
              sent_activity.emails &&
              sent_activity.emails.has_shared
            ) {
              Email.updateOne(
                {
                  _id: sent_activity.emails.shared_email,
                },
                {
                  $set: {
                    video_tracker: query.id,
                  },
                  $unset: {
                    pdf_tracker: true,
                    image_tracker: true,
                    email_tracker: true,
                  },
                }
              ).catch((err) => {
                console.log('email update one', err.message);
              });

              const shared_email = await Email.findOne({
                _id: sent_activity.emails.shared_email,
              });

              if (shared_email && shared_email.deal) {
                const timeline_data = {
                  contact: query.contact[0],
                  deal: shared_email.deal,
                  material: query.video,
                  percent,
                };

                triggerTimeline(timeline_data);
              }
            }

            if (
              sent_activity &&
              sent_activity.texts &&
              sent_activity.texts.has_shared
            ) {
              Text.updateOne(
                {
                  _id: sent_activity.texts.shared_text,
                },
                {
                  $set: {
                    video_tracker: query.id,
                  },
                  $unset: {
                    pdf_tracker: true,
                    image_tracker: true,
                    email_tracker: true,
                  },
                }
              ).catch((err) => {
                console.log('email update one', err.message);
              });

              const shared_text = await Text.findOne({
                _id: sent_activity.texts.shared_text,
              });

              if (shared_text && shared_text.deal) {
                const timeline_data = {
                  contact: query.contact,
                  deal: shared_text.deal,
                  material: query.video,
                  percent,
                };

                triggerTimeline(timeline_data);
              }
            }
            /**
             * Deal last activity check
             */

            Contact.updateOne(
              { _id: query.contact },
              { $set: { last_activity: _activity._id } }
            ).catch((err) => {
              console.log('err', err.message);
            });
          })
          .catch((err) => {
            console.log('watched acitvity save err', err.message);
          });

        Activity.updateOne(
          {
            _id: query.activity,
          },
          {
            $set: {
              video_trackers: query.id,
            },
            $unset: {
              email_trackers: true,
              pdf_trackers: true,
              image_trackers: true,
            },
          }
        ).catch((err) => {
          console.log('activity update one', err.message);
        });

        await Notification.deleteMany({ video_tracker: query.id });

        const contact = await Contact.findOne({ _id: query['contact'] });
        const timeline_data = {
          contact: query.contact,
          material: query.video,
          percent,
        };

        triggerTimeline(timeline_data);

        if (currentCount < 2) {
          createNotification(
            'watch_video',
            {
              criteria: 'material_track',
              user: currentUser,
              contact,
              action: notificationAction,
              video_tracker: query,
              detail: {
                ...query._doc,
                watched_time,
                total_time,
              },
              video,
            },
            currentUser
          );
        }

        // =============================== Auto follow up (2nd case) removing logic ==================

        // =========================================== Web push, Email, Text Notification ==================

        // =========================================== Auto Follow up, Auto Send Generate logic =============
      } else {
        createNotification(
          'watch_video',
          {
            criteria: 'material_track',
            user: currentUser,
            action: notificationAction,
            video_tracker: query,
            activity: query.activity,
            detail: {
              ...query._doc,
              watched_time,
              total_time,
            },
            video,
          },
          currentUser
        );
      }
    } else {
      Activity.updateOne(
        {
          _id: query.activity,
        },
        {
          $set: {
            video_trackers: query.id,
          },
          $unset: {
            email_trackers: true,
            pdf_trackers: true,
            image_trackers: true,
          },
        }
      ).catch((err) => {
        console.log('email update one', err.message);
      });

      // Extension tracking
      let i = 1;
      const videoInterval = setInterval(function () {
        io.of('/extension').to(currentUser._id).emit('updated_activity', {
          last_time: query.updated_at,
        });
        i++;
        if (i > 5) {
          clearInterval(videoInterval);
        }
      }, 1000);
    }
  }
};

const updateVideo = async (
  video_tracker_id,
  duration,
  material_last,
  start,
  end,
  gap
) => {
  const gapData = {};
  if (gap && gap.length) {
    gapData['gap'] = gap;
  }
  await VideoTracker.updateOne(
    { _id: video_tracker_id },
    {
      $set: {
        duration,
        material_last,
        start,
        end,
        ...gapData,
      },
    }
  );
};

const createImage = async (req, res) => {
  const { activity_id } = req.body;
  console.log('acitivity', activity_id);
  const sent_activity = await Activity.findOne({ _id: activity_id }).populate([
    { path: 'emails', select: 'has_shared shared_email' },
    { path: 'texts', select: 'has_shared shared_text' },
  ]);
  if (sent_activity) {
    const user_id = sent_activity.user;
    let contact_id = null;
    if (sent_activity.contacts) {
      contact_id = sent_activity.contacts;
    }
    console.log('contact_id*******', contact_id);
    const image_id = sent_activity.images;

    const image_tracker = new ImageTracker({
      activity: activity_id,
      contact: contact_id,
      user: user_id,
      image: image_id,
    });

    image_tracker.save().catch((err) => {
      console.log('image tracker save err', err.message);
    });
    const user = await User.findOne({ _id: user_id });
    const image = await Image.findOne({ _id: image_id });

    if (sent_activity.send_type !== 2) {
      let contact;
      if (contact_id) {
        contact = await Contact.findOne({ _id: contact_id });
        createNotification(
          'review_image',
          {
            criteria: 'material_track',
            user,
            image,
            contact,
            image_tracker,
            action: {
              object: 'image',
              image: [image.id],
            },
          },
          user
        );
      } else {
        createNotification(
          'review_image',
          {
            criteria: 'material_track',
            user,
            image,
            activity: activity_id,
            image_tracker,
            action: {
              object: 'image',
              image: [image.id],
            },
          },
          user
        );
      }
      // ======================== Web Push, Email, Text notification ==================
      // ======================== Auto Follow, Auto Send (2nd case) remove logic ==================

      // automation
      const timeline_data = {
        contact: contact_id,
        material: image_id,
      };

      triggerTimeline(timeline_data);

      if (sent_activity.send_type === 1) {
        // create send video activity && tracker activity
        const sendActivity = new Activity({
          content: 'sent image using mobile',
          contacts: image_tracker.contact,
          user: image_tracker.user,
          type: 'images',
          pdfs: image_tracker.pdf,
          texts: sent_activity.texts,
          send_uuid: sent_activity.send_uuid,
        });
        // Video Tracker activity update with the send activity
        sendActivity.save().then(() => {
          image_tracker.activity = sendActivity._id;
          image_tracker.save();
        });
      }

      const activity = new Activity({
        content: 'reviewed image',
        contacts: contact_id,
        user: user_id,
        type: 'image_trackers',
        image_trackers: image_tracker.id,
        images: image.id,
      });

      activity
        .save()
        .then(async (_activity) => {
          // Deal shared tracker
          if (
            sent_activity &&
            sent_activity.emails &&
            sent_activity.emails.has_shared
          ) {
            Email.updateOne(
              {
                _id: sent_activity.emails.shared_email,
              },
              {
                $set: {
                  image_tracker: image_tracker.id,
                },
                $unset: {
                  video_tracker: true,
                  pdf_tracker: true,
                  email_tracker: true,
                },
              }
            ).catch((err) => {
              console.log('email update one', err.message);
            });

            const shared_email = await Email.findOne({
              _id: sent_activity.emails.shared_email,
            });

            if (shared_email && shared_email.deal) {
              const timeline_data = {
                contact: contact_id,
                deal: shared_email.deal,
                material: image_id,
              };

              triggerTimeline(timeline_data);
            }
          }

          if (
            sent_activity &&
            sent_activity.texts &&
            sent_activity.texts.has_shared
          ) {
            Text.updateOne(
              {
                _id: sent_activity.texts.shared_text,
              },
              {
                $set: {
                  image_tracker: image_tracker.id,
                },
                $unset: {
                  video_tracker: true,
                  pdf_tracker: true,
                  email_tracker: true,
                },
              }
            ).catch((err) => {
              console.log('email update one', err.message);
            });

            const shared_text = await Email.findOne({
              _id: sent_activity.texts.shared_text,
            });

            if (shared_text && shared_text.deal) {
              const timeline_data = {
                contact: contact_id,
                deal: shared_text.deal,
                material: image_id,
              };

              triggerTimeline(timeline_data);
            }
          }

          if (contact_id) {
            Contact.updateOne(
              { _id: contact_id },
              {
                $set: { last_activity: _activity.id },
              }
            ).catch((err) => {
              console.log('err', err.message);
            });
          }
        })
        .catch((err) => {
          console.log('activity save err', err.message);
        });
    } else {
      /**
      www.ioObject
        .of('/extension')
        .to(user._id)
        .emit('image_tracked', {
          data: {
            content: 'reviewed image',
            title: image.title,
            preview: image.preview,
            contact: sent_activity.to_emails,
            watched_date: image_tracker.updated_at,
            _id: sent_activity.send_uuid,
          },
        });
      */

      Activity.updateOne(
        {
          _id: activity_id,
        },
        {
          $set: {
            image_trackers: image_tracker.id,
          },
          $unset: {
            video_trackers: true,
            pdf_trackers: true,
            email_trackers: true,
          },
        }
      ).catch((err) => {
        console.log('email update one', err.message);
      });

      let i = 1;
      const imageInterval = setInterval(function () {
        io.of('/extension').to(user._id).emit('updated_activity', {
          last_time: image_tracker.updated_at,
        });
        i++;
        if (i > 5) {
          clearInterval(imageInterval);
        }
      }, 1000);
    }

    return res.send({
      status: true,
      data: image_tracker.id,
    });
  } else {
    return res.send({
      status: false,
    });
  }
};

const setupTracking = (io) => {
  console.info('Setup Socket.io:');
  io.sockets.on('connection', (socket) => {
    socket.emit('connected');

    // socket.on('init_pdf', (data) => {
    //   createPDF(data).then((_pdf_tracker) => {
    //     socket.type = 'pdf';
    //     socket.pdf_tracker = _pdf_tracker;
    //   });
    // });

    // socket.on('update_pdf', (duration) => {
    //   const pdf_tracker = socket.pdf_tracker;
    //   if (typeof pdf_tracker !== 'undefined') {
    //     updatePDF(duration, pdf_tracker._id).catch((err) => {
    //       console.log('err', err);
    //     });
    //   }
    // });

    socket.on('init_video', (data) => {
      createVideo(data).then((_video_tracker) => {
        socket.type = 'video';
        socket.video_tracker = _video_tracker;
        socket.emit('inited_video', { _id: _video_tracker._id });
      });
    });

    socket.on('update_video', (data) => {
      const video_tracker = socket.video_tracker;
      if (typeof video_tracker !== 'undefined') {
        const { duration, material_last, start, end, gap } = data;
        updateVideo(video_tracker._id, duration, material_last, start, end, gap)
          .then(() => {})
          .catch((err) => {
            console.log('video update err', err.message);
          });
      } else {
        const { duration, material_last, tracker_id, start, end, gap } = data;
        updateVideo(tracker_id, duration, material_last, start, end, gap)
          .then(() => {
            VideoTracker.findOne({ _id: tracker_id }).then((tracker) => {
              socket.type = 'video';
              socket.video_tracker = tracker;
            });
          })
          .catch((err) => {
            console.log('update track err', err.message);
          });
      }
    });

    /**
    socket.on('init_image', (data) => {
      createImage(data).then((_image_tracker) => {
        socket.type = 'image';
        socket.image_tracker = _image_tracker;
      });
    });

    socket.on('update_image', (duration) => {
      const image_tracker = socket.image_tracker;
      if (typeof image_tracker !== 'undefined') {
        updateImage(duration, image_tracker._id)
          .then(() => {})
          .catch((err) => {
            console.log('err', err);
          });
      }
    });
    */

    socket.on('disconnect', () => {
      if (socket.type === 'pdf') {
        console.log('PDF_disconnecting');
        const pdf_tracker = socket.pdf_tracker;
        if (!socket.pdf_tracker.viewed) {
          console.log('PDF disconnected');
          // disconnectPDF(pdf_tracker._id);
        }
      } else if (socket.type === 'video') {
        const video_tracker = socket.video_tracker;
        if (!socket.video_tracker.viewed) {
          console.log('disconnected');
          disconnectVideo(video_tracker._id);
        }
      } else if (socket.type === 'image') {
        console.log('image_disconnecting');
        const image_tracker = socket.image_tracker;
        if (!socket.image_tracker.viewed) {
          console.log('disconnected', image_tracker);
          // disconnectImage(image_tracker._id);
        }
      }
    });

    socket.on('close', (data) => {
      if (socket.type === 'pdf') {
        const pdf_tracker = socket.pdf_tracker;
        socket.pdf_tracker.viewed = true;
        // disconnectPDF(pdf_tracker._id);
      } else if (socket.type === 'video') {
        console.log('close', JSON.stringify(data));
        const video_tracker = socket.video_tracker;
        if (data.mode === 'end_reached') {
          disconnectVideo(video_tracker._id, true);
          return;
        }
        if (data.mode === 'full_watched') {
          socket.video_tracker.viewed = true;
        }
        disconnectVideo(video_tracker._id);
      } else if (socket.type === 'image') {
        console.log('disconnectiong with full view');
        const image_tracker = socket.image_tracker;
        socket.image_tracker.viewed = true;
        // disconnectImage(image_tracker._id);
      }
    });
    // auth(socket)
  });
};

const triggerTimeline = async (timeline_data) => {
  const { deal, contact, material, percent } = timeline_data;

  if (deal) {
    const _deal = await Deal.findOne({
      _id: deal,
    });

    if (_deal && _deal.primary_contact.toString() === contact.toString()) {
      const timelines = await TimeLine.find({
        deal,
        status: 'checking',
        watched_materials: material,
        'condition.case': 'watched_material',
        'condition.answer': true,
      }).catch((err) => {
        console.log('time line find err', err.message);
      });

      if (timelines && timelines.length > 0) {
        for (let i = 0; i < timelines.length; i++) {
          const timeline = timelines[i];

          if (
            !timeline.condition.percent ||
            (timeline.condition.percent && timeline.condition.percent < percent)
          ) {
            try {
              const condition = timeline.condition;

              if (
                condition.condition_type &&
                timeline.watched_materials.length > 1
              ) {
                TimeLine.updateOne(
                  {
                    _id: timeline.id,
                  },
                  {
                    $pull: {
                      watched_materials: material,
                    },
                    $push: {
                      finished_materials: material,
                    },
                  }
                ).catch((err) => {
                  console.log('timeline watched upate', err.message);
                });
              } else {
                activeTimeline(timeline.id);
              }
            } catch (err) {
              console.log('trigger timeline err', err.message);
            }
          }
        }
      }

      const unwatched_timelines = await TimeLine.find({
        deal,
        status: 'active',
        watched_materials: material,
        'condition.case': 'watched_material',
        'condition.answer': false,
      }).catch((err) => {
        console.log('time line find err', err.message);
      });

      if (unwatched_timelines && unwatched_timelines.length) {
        for (let i = 0; i < timelines.length; i++) {
          const unwatched_timeline = unwatched_timelines[i];

          if (
            !unwatched_timeline.condition.percent ||
            (unwatched_timeline.condition.percent &&
              unwatched_timeline.condition.percent < percent)
          ) {
            try {
              const condition = unwatched_timeline.condition;

              if (
                condition.condition_type &&
                unwatched_timeline.watched_materials.length > 1
              ) {
                TimeLine.updateOne(
                  {
                    _id: unwatched_timeline.id,
                  },
                  {
                    $pull: {
                      watched_materials: material,
                    },
                    $push: {
                      finished_materials: material,
                    },
                  }
                ).catch((err) => {
                  console.log('timeline watched upate', err.message);
                });
              } else {
                const next_data = {
                  deal: _deal._id,
                  contact,
                  ref: unwatched_timeline.ref,
                };

                disableNext(next_data);
              }
            } catch (err) {
              console.log('trigger timeline err', err.message);
            }
          }
        }
      }
    }
  } else {
    const timeline = await TimeLine.findOne({
      contact,
      status: 'checking',
      watched_materials: material,
      'condition.case': 'watched_material',
      'condition.answer': true,
    }).catch((err) => {
      console.log('time line find err', err.message);
    });

    if (timeline) {
      if (
        !timeline.condition.percent ||
        (timeline.condition.percent && timeline.condition.percent < percent)
      ) {
        try {
          const condition = timeline.condition;

          if (
            condition.condition_type &&
            timeline.watched_materials.length > 1
          ) {
            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $pull: {
                  watched_materials: material,
                },
                $push: {
                  finished_materials: material,
                },
              }
            ).catch((err) => {
              console.log('timeline watched upate', err.message);
            });
          } else {
            activeTimeline(timeline.id);
          }
        } catch (err) {
          console.log('trigger timeline err', err.message);
        }
      }
    }

    const unwatched_timeline = await TimeLine.findOne({
      contact,
      status: 'active',
      watched_materials: material,
      'condition.case': 'watched_material',
      'condition.answer': false,
    }).catch((err) => {
      console.log('time line find err', err.message);
    });

    if (unwatched_timeline) {
      if (
        !unwatched_timeline.condition.percent ||
        (unwatched_timeline.condition.percent &&
          unwatched_timeline.condition.percent < percent)
      ) {
        try {
          const condition = timeline.condition;

          if (
            condition.condition_type &&
            unwatched_timeline.watched_materials.length > 1
          ) {
            TimeLine.updateOne(
              {
                _id: unwatched_timeline.id,
              },
              {
                $pull: {
                  watched_materials: material,
                },
                $push: {
                  finished_materials: material,
                },
              }
            ).catch((err) => {
              console.log('timeline watched upate', err.message);
            });
          } else {
            const next_data = {
              contact,
              ref: unwatched_timeline.ref,
            };

            disableNext(next_data);

            if (!timeline) {
              removeTimeline({ contact });
            }
          }
        } catch (err) {
          console.log('trigger timeline err', err.message);
        }
      }
    }
  }
};

module.exports = {
  setupTracking,
  createPDF,
  updatePDF,
  createImage,
  triggerTimeline,
};
