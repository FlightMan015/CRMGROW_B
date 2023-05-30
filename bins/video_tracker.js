const mongoose = require('mongoose');

const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });

const { DB_PORT } = require('../config/database');
const VideoTracker = require('../models/video_tracker');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const PDFTracker = require('../models/pdf_tracker');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));
// Fetch or read data from

// const migrate = async () => {
//   const video_trackers = await Activity.find({ type: 'video_trackers' })
//     .populate('video_trackers')
//     .catch((err) => {
//       console.log('err', err);
//     });

//   for (let i = 0; i < video_trackers.length; i++) {
//     const video_tracker = video_trackers[i];
//     console.log('video_tracker.id', video_tracker.id);
//     Activity.findByIdAndUpdate(video_tracker.id, {
//       $set: { videos: video_tracker.video_trackers.video },
//     }).catch((err) => {
//       console.log('err', err);
//     });
//   }
// };
// migrate();

const investigate = async () => {
  const admin_videos = await Video.find({
    role: 'admin',
  });

  for (let i = 0; i < admin_videos.length; i++) {
    const video = admin_videos[i];
    const track_count = await VideoTracker.countDocuments({
      video: video.id,
    });
    console.log('track_counts', track_count);
    console.log('video_title', video.title);
  }
};

const investigatePDF = async () => {
  const admin_pdfs = await PDF.find({
    role: 'admin',
  });

  for (let i = 0; i < admin_pdfs.length; i++) {
    const pdf = admin_pdfs[i];
    const track_count = await PDFTracker.countDocuments({
      pdf: pdf.id,
    });
    console.log('track_counts', track_count);
    console.log('pdf_title', pdf.title);
  }
};

investigate();
// investigatePDF();
