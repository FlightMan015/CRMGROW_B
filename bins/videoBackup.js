const mongoose = require('mongoose');

const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });

const { DB_PORT } = require('../config/database');
const VideoTracker = require('../models/video_tracker');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const PDFTracker = require('../models/pdf_tracker');
const Activity = require('../models/activity');
const Email = require('../models/email');

const ADMIN_VIDEO = {
  key: 'u6035a9da27952a3187d07276-1629738010079-3831',
};

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(async () => {
    console.log('database is connected');
    // Activity.aggregate([
    //   {
    //     $match: {
    //       videos: {
    //         $elemMatch: {
    //           $in: [mongoose.Types.ObjectId('61f85adee25a509d46b2d3ef')],
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: '$user',
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: 'users',
    //       localField: '_id',
    //       foreignField: '_id',
    //       as: 'user',
    //     },
    //   },
    //   {
    //     $unwind: '$user',
    //   },
    //   {
    //     $match: { 'user.del': false },
    //   },
    //   {
    //     $project: { 'user.email': true, 'user._id': true, _id: true },
    //   },
    // ]).then(async (_activities) => {
    //   const oldVideoId = mongoose.Types.ObjectId('61f85adee25a509d46b2d3ef');
    //   for (let i = 0; i < _activities.length; i++) {
    //     const _activity = _activities[i];
    //     console.log('activity', _activity);
    //     const newVideo = await Video.findOne({
    //       key: ADMIN_VIDEO['key'],
    //       user: _activity._id,
    //       del: false,
    //     });
    //     if (newVideo) {
    //       await Activity.updateMany(
    //         {
    //           videos: { $elemMatch: { $in: [oldVideoId] } },
    //           user: _activity._id,
    //         },
    //         {
    //           $push: { videos: newVideo._id },
    //         }
    //       );
    //       await Activity.updateMany(
    //         {
    //           videos: { $elemMatch: { $in: [oldVideoId] } },
    //           user: _activity._id,
    //         },
    //         {
    //           $pull: { videos: { $in: [oldVideoId] } },
    //         }
    //       );
    //     } else {
    //       const newVideo = { ...ADMIN_VIDEO };
    //       delete newVideo.role;
    //       delete newVideo._id;
    //       newVideo.user = _activity._id;
    //       const newVideoDoc = await new Video(newVideo).save().catch(() => {});
    //       const newVideoId = newVideoDoc._id;
    //       await Activity.updateMany(
    //         {
    //           videos: { $elemMatch: { $in: [oldVideoId] } },
    //           user: _activity._id,
    //         },
    //         {
    //           $push: { videos: newVideoId },
    //         }
    //       );
    //       await Activity.updateMany(
    //         {
    //           videos: { $elemMatch: { $in: [oldVideoId] } },
    //           user: _activity._id,
    //         },
    //         {
    //           $pull: { videos: { $in: [oldVideoId] } },
    //         }
    //       );
    //     }
    //   }
    //   console.log('ended');
    // });

    // VideoTracker.aggregate([
    //   { $match: { video: mongoose.Types.ObjectId(ADMIN_VIDEO['_id']) } },
    //   {
    //     $group: {
    //       _id: '$user',
    //     },
    //   },
    //   {
    //     $unwind: '$_id',
    //   },
    //   {
    //     $lookup: {
    //       from: 'users',
    //       localField: '_id',
    //       foreignField: '_id',
    //       as: 'user',
    //     },
    //   },
    //   {
    //     $unwind: '$user',
    //   },
    //   {
    //     $match: { 'user.del': false },
    //   },
    //   {
    //     $project: { 'user.email': true, 'user._id': true, _id: true },
    //   },
    // ]).then(async (_users) => {
    //   console.log('users count', _users.length);
    //   let newCount = 0;
    //   let updateCount = 0;
    //   const oldVideoId = mongoose.Types.ObjectId(ADMIN_VIDEO['_id']);
    //   for (let i = 0; i < _users.length; i++) {
    //     const _user = _users[i];
    //     let newVideoId;
    //     let status;
    //     // check current video is downloaded
    //     const currentOne = await Video.findOne({
    //       key: ADMIN_VIDEO['key'],
    //       user: _user._id,
    //       title: ADMIN_VIDEO['title'],
    //       del: false,
    //     }).catch(() => {});
    //     if (currentOne) {
    //       newVideoId = currentOne['_id'];
    //       updateCount++;
    //       // update the current trackers with this video id
    //       status = 'update';
    //     } else {
    //       newCount++;
    //       // Create new video and update video id with these one
    //       const newVideo = { ...ADMIN_VIDEO };
    //       delete newVideo.role;
    //       delete newVideo._id;
    //       newVideo.user = _user._id;
    //       newVideo.original_id = oldVideoId;
    //       const newVideoDoc = await new Video(newVideo).save().catch(() => {});
    //       newVideoId = newVideoDoc._id;
    //       status = 'create';
    //     }
    //     await VideoTracker.updateMany(
    //       { video: oldVideoId, user: _user._id },
    //       { $set: { video: newVideoId } }
    //     );
    //     await Activity.updateMany(
    //       {
    //         videos: { $elemMatch: { $in: [oldVideoId] } },
    //         user: _user._id,
    //       },
    //       {
    //         $push: { videos: newVideoId },
    //       }
    //     );
    //     await Activity.updateMany(
    //       {
    //         videos: { $elemMatch: { $in: [oldVideoId] } },
    //         user: _user._id,
    //       },
    //       {
    //         $pull: { videos: { $in: [oldVideoId] } },
    //       }
    //     );

    //     const data = {
    //       user: _user._id,
    //       old: ADMIN_VIDEO['_id'],
    //       new: newVideoId,
    //       status,
    //     };
    //     console.log('data', data);
    //     if (updateCount + newCount === _users.length) {
    //       console.log('ended');
    //     }
    //   }
    // });

    const userVideos = await Video.aggregate([
      {
        $match: {
          key: 'u6035a9da27952a3187d07276-1629738010079-3831',
          del: false,
        },
      },
      {
        $group: { _id: '$user', videos: { $push: '$_id' }, count: { $sum: 1 } },
      },
      { $unwind: '$_id' },
    ]);
    const userRelatedTable = {};
    for (let i = 0; i < userVideos.length; i++) {
      const userVideo = userVideos[i];
      const userId = userVideo._id + '';
      const videos = userVideo.videos;
      const videoIds = videos.map((e) => e + '');
      userRelatedTable[userId] = videoIds;
    }
    VideoTracker.aggregate([
      { $group: { _id: { user: '$user', video: '$video' } } },
      {
        $lookup: {
          from: 'videos',
          localField: '_id.video',
          foreignField: '_id',
          as: 'video',
        },
      },
      {
        $match: {
          'video.key': 'u6035a9da27952a3187d07276-1629738010079-3831',
          'video.del': false,
        },
      },
      {
        $group: {
          _id: '$_id.user',
          videos: { $push: '$_id.video' },
        },
      },
      {
        $unwind: '$_id',
      },
    ]).then(async (_trackers) => {
      for (let i = 0; i < _trackers.length; i++) {
        const _tracker = _trackers[i];
        console.log('_tracker inforamtion', _tracker);
        const userId = _tracker._id;
        if (!userId) {
          console.log('user is not available');
          continue;
        }
        const videos = _tracker.videos;
        const userVideos = userRelatedTable[userId + ''];
        if (!userVideos || !userVideos.length) {
          console.log('video is not created');
          continue;
        }
        const userVideo = userVideos[0];
        for (let j = 0; j < videos.length; j++) {
          const videoId = videos[j];
          if (!userVideos.includes(videoId + '')) {
            console.log('update with new', videoId);
            // replace the video trackers
            await VideoTracker.updateMany(
              {
                user: userId,
                video: videoId,
              },
              { $set: { video: userVideo } }
            );
            await Activity.updateMany(
              {
                videos: { $elemMatch: { $in: [videoId] } },
                user: userId,
              },
              {
                $push: { videos: mongoose.Types.ObjectId(userVideo) },
              }
            );
            await Activity.updateMany(
              {
                videos: { $elemMatch: { $in: [videoId] } },
                user: userId,
              },
              {
                $pull: { videos: { $in: [videoId] } },
              }
            );
          }
        }
      }
    });
  })
  .catch((err) => console.error('Could not connect to mongo DB', err));
