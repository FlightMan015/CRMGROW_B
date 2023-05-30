const mongoose = require('mongoose');
const VideoTracker = require('../models/video_tracker');
const Activity = require('../models/activity');

const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });

const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const videoAnalytics = () => {
  const eXp_intro = '5e2a05c94d04d37842cc8ff9';
  Activity.countDocuments({
    videos: mongoose.Types.ObjectId(eXp_intro),
    type: 'videos',
  })
    .then((_video_detail) => {
      console.log('_video_detail', _video_detail);
    })
    .catch((err) => {
      console.log('video analytices', err.message);
    });
};

try {
  videoAnalytics();
} catch (err) {
  console.log('analytices err', err);
}

setTimeout(() => {
  console.log('Close');
}, 10000);
