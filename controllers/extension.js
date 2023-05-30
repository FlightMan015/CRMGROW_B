const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { google } = require('googleapis');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { REDIS_ENDPOINT } = require('../config/redis');
const io = require('socket.io-emitter')({ host: REDIS_ENDPOINT, port: 6379 });

const User = require('../models/user');
const Activity = require('../models/activity');
const VideoTracker = require('../models/video_tracker');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
const EmailTracker = require('../models/email_tracker');

const api = require('../config/api');
const _ = require('lodash');

const setupExtension = (io) => {
  io.on('connection', (socket) => {
    socket.emit('connnected');
    /**
     * Check Authentication by token
     */
    socket.on('join', async (data) => {
      const { token } = data;
      if (token) {
        await checkAuth(socket, token);
      } else {
        setTimeout(() => {
          if (!socket || !socket.decoded) {
            // not authenticated for 15 seconds
            try {
              socket.disconnect(true);
            } catch (e) {
              console.error(e);
            }
          }
        }, 15000);
      }

      // get activities
      // sendActivities(socket, { skip: 0, count: 50 });
    });
  });
};

const sendActivities = async (socket, data) => {
  const { currentUser } = socket;
  const { skip, count } = data;

  const extension_activities = await Activity.find({
    user: currentUser._id,
    send_type: 2,
  })
    .skip(skip || 0)
    .limit(count || 50);

  const extension_activityIds = extension_activities.map((e) => e._id);

  const video_trackers = await VideoTracker.find({
    activity: { $in: extension_activityIds },
  }).catch((err) => {
    console.log('deal video tracker find err', err.message);
  });

  const pdf_trackers = await PDFTracker.find({
    activity: { $in: extension_activityIds },
  }).catch((err) => {
    console.log('deal pdf tracker find err', err.message);
  });

  const image_trackers = await ImageTracker.find({
    activity: { $in: extension_activityIds },
  }).catch((err) => {
    console.log('deal image tracker find err', err.message);
  });

  const email_trackers = await EmailTracker.find({
    activity: { $in: extension_activityIds },
  }).catch((err) => {
    console.log('deal video tracker find err', err.message);
  });

  socket.emit('inited_activity', {
    activities: extension_activities,
    video_trackers,
    pdf_trackers,
    image_trackers,
    email_trackers,
  });
};

/**
 *
 * @param {*} req
 * @param {*} res
 * @returns
 */

const getActivities = async (req, res) => {
  const { currentUser } = req;
  const { starting_after, ending_before } = req.body;
  const count = req.body.count || 10;
  let extension_activities;

  if (starting_after) {
    extension_activities = await Activity.find({
      user: currentUser._id,
      send_type: 2,
      updated_at: { $gt: starting_after },
    })
      .sort({ updated_at: -1 })
      .populate([
        { path: 'video_trackers' },
        { path: 'image_trackers' },
        { path: 'pdf_trackers' },
        { path: 'email_trackers' },
      ]);
  } else if (ending_before) {
    extension_activities = await Activity.find({
      user: currentUser._id,
      send_type: 2,
      updated_at: { $lt: ending_before },
    })
      .sort({ updated_at: -1 })
      .populate([
        { path: 'video_trackers' },
        { path: 'image_trackers' },
        { path: 'pdf_trackers' },
        { path: 'email_trackers' },
      ])
      .limit(count || 10);
  } else {
    extension_activities = await Activity.find({
      user: currentUser._id,
      send_type: 2,
    })
      .sort({ updated_at: -1 })
      .populate([
        { path: 'video_trackers' },
        { path: 'image_trackers' },
        { path: 'pdf_trackers' },
        { path: 'email_trackers' },
      ])
      .limit(count || 10);
  }

  return res.send({
    status: true,
    data: extension_activities,
  });
};

/**
 *
 * @param {*} req
 * @param {*} res
 */
const sendActivity = async (req, res) => {
  const { currentUser } = req;

  if (
    currentUser.material_track_info.is_enabled &&
    (!currentUser.material_track_info.is_limit ||
      (currentUser.material_track_info.is_limit &&
        currentUser.material_track_info.max_count > 0))
  ) {
    const activity = new Activity({
      ...req.body,
      user: currentUser.id,
    });

    let i = 1;
    const emailInterval = setInterval(function () {
      io.of('/extension').to(currentUser._id).emit('updated_activity', {
        last_time: activity.updated_at,
      });
      i++;
      if (i > 5) {
        clearInterval(emailInterval);
      }
    }, 1000);

    activity.save().catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
    if (currentUser.material_track_info.max_count > 0) {
      currentUser.material_track_info.max_count--;
      currentUser.save();
    }
    return res.send({
      status: true,
    });
  } else {
    return res.status(400).send({
      status: false,
      error: 'Material track limit is exceeded',
    });
  }
};

/**
 *
 * @param {*} req
 * @param {*} res
 */

const getActivityDetail = async (req, res) => {
  const email_trackers = await EmailTracker.find({
    activity: req.params.id,
  }).catch((err) => {
    console.log('deal email tracker find err', err.message);
  });

  const video_trackers = await VideoTracker.find({
    activity: req.params.id,
  }).catch((err) => {
    console.log('deal video tracker find err', err.message);
  });

  const pdf_trackers = await PDFTracker.find({
    activity: req.params.id,
  }).catch((err) => {
    console.log('deal pdf tracker find err', err.message);
  });

  const image_trackers = await ImageTracker.find({
    activity: req.params.id,
  }).catch((err) => {
    console.log('deal image tracker find err', err.message);
  });

  return res.send({
    status: true,
    data: {
      video_trackers,
      pdf_trackers,
      image_trackers,
      email_trackers,
    },
  });
};

/**
 *
 * @param {*} socket
 * @param {*} token
 */

const checkAuth = async (socket, token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, api.JWT_SECRET);
  } catch (e) {
    console.error('Socket Auth Failed:', e);
    socket.disconnect(true);
    return;
  }

  const currentUser = await User.findOne({ _id: decoded.id, del: false }).catch(
    (err) => {
      console.log('user find err', err.message);
    }
  );

  if (currentUser) {
    console.info('Auth Success:', currentUser.email);
    socket.currentUser = currentUser;
    socket.join(currentUser._id);
  } else {
    console.error('Not found user:');
    socket.disconnect(true);
  }
};

module.exports = {
  setupExtension,
  sendActivity,
  getActivities,
  getActivityDetail,
};
