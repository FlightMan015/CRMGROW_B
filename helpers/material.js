const fs = require('fs');
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const api = require('../config/api');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const Garbage = require('../models/garbage');
const Team = require('../models/team');
const { emptyBucket } = require('../controllers/material');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const removeMaterials = async (user) => {
  const videos = await Video.find({
    user,
    del: false,
  }).catch((err) => {
    console.log('video find err', err.message);
  });

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];

    if (video['default_edited']) {
      Garbage.updateOne(
        { user: user.id },
        {
          $pull: { edited_video: { $in: [video.default_video] } },
        }
      ).catch((err) => {
        console.log('default video remove err', err.message);
      });
    }
    if (video['shared_video']) {
      Video.updateOne(
        {
          _id: video.shared_video,
          user: user.id,
        },
        {
          $unset: { shared_video: true },
          has_shared: false,
        }
      ).catch((err) => {
        console.log('default video remove err', err.message);
      });
    }
    if (video.role === 'team') {
      Team.updateOne(
        { videos: video.id },
        {
          $pull: { videos: { $in: [video.id] } },
        }
      ).catch((err) => {
        console.log('err', err.message);
      });
    }

    Video.updateOne({ _id: video.id }, { $set: { del: true } })
      .then(async () => {
        let hasSameVideo = false;
        if (video['bucket']) {
          const sameVideos = await Video.find({
            del: false,
            key: video['key'],
          }).catch((err) => {
            console.log('same video getting error');
          });
          if (sameVideos && sameVideos.length) {
            hasSameVideo = true;
          }
        } else {
          const sameVideos = await Video.find({
            del: false,
            url: video['url'],
          }).catch((err) => {
            console.log('same video getting error');
          });
          if (sameVideos && sameVideos.length) {
            hasSameVideo = true;
          }
        }
        if (!hasSameVideo) {
          if (video['bucket']) {
            s3.deleteObject(
              {
                Bucket: video['bucket'],
                Key: 'transcoded/' + video['key'] + '.mp4',
              },
              function (err, data) {
                console.log('transcoded video removing error', err);
              }
            );
            emptyBucket(
              video['bucket'],
              'streamd/' + video['key'] + '/',
              (err) => {
                if (err) {
                  console.log('Removing files error in bucket');
                }
              }
            );
          } else {
            const url = video['url'];
            if (url.indexOf('teamgrow.s3') > 0) {
              s3.deleteObject(
                {
                  Bucket: api.AWS.AWS_S3_BUCKET_NAME,
                  Key: url.slice(44),
                },
                function (err, data) {
                  console.log('err', err);
                }
              );
            } else {
              try {
                const file_path = video.path;
                if (file_path) {
                  fs.unlinkSync(file_path);
                }
              } catch (err) {
                console.log('err', err);
              }
            }
          }
        }
      })
      .catch((err) => {
        console.log('video update err', err.message);
      });
  }
  const pdfs = await PDF.find({
    user,
    del: false,
  }).catch((err) => {
    console.log('pdf find err', err.message);
  });

  for (let i = 0; i < pdfs.length; i++) {
    const pdf = pdfs[i];

    if (pdf['default_edited']) {
      Garbage.updateOne(
        { user: user.id },
        {
          $pull: { edited_pdf: { $in: [pdf.default_pdf] } },
        }
      ).catch((err) => {
        console.log('default pdf remove err', err.message);
      });
    }
    if (pdf['shared_pdf']) {
      PDF.updateOne(
        {
          _id: pdf.shared_pdf,
          user: user.id,
        },
        {
          $unset: { shared_pdf: true },
          has_shared: false,
        }
      ).catch((err) => {
        console.log('default pdf remove err', err.message);
      });
    }
    if (pdf.role === 'team') {
      Team.updateOne(
        { pdfs: pdf.id },
        {
          $pull: { pdfs: { $in: [pdf.id] } },
        }
      ).catch((err) => {
        console.log('err', err.message);
      });
    }

    PDF.updateOne({ _id: pdf.id }, { $set: { del: true } })
      .then(async () => {
        let hasSamePdf = false;
        const samePdfs = await PDF.find({
          del: false,
          url: pdf['url'],
        }).catch((err) => {
          console.log('same video getting error');
        });
        if (samePdfs && samePdfs.length) {
          hasSamePdf = true;
        }
        if (!hasSamePdf) {
          s3.deleteObject(
            {
              Bucket: api.AWS.AWS_S3_BUCKET_NAME,
              Key: pdf['key'],
            },
            function (err, data) {
              console.log('err', err);
            }
          );
        }
      })
      .catch((err) => {
        console.log('video update err', err.message);
      });
  }
};
const createVideo = async (ids, user) => {
  const videosList = [];
  for (let i = 0; i < ids.length; i++) {
    const videoId = ids[i];
    const data = await Video.aggregate([
      {
        $match: { _id: mongoose.Types.ObjectId(videoId) },
      },
      { $project: { _id: 0, role: 0, created_at: 0, updated_at: 0 } },
    ]).catch((err) => {
      console.log('err', err);
    });
    const query = {
      ...data[0],
      user: user.id,
    };
    const check_number = await Video.find(query).count();
    if (check_number === 0) {
      const video = new Video({
        ...data[0],
        user: user.id,
      });
      const tempVideo = await video.save();
      const item = { origin: ids[i], new: tempVideo._id };
      videosList.push(item);
    } else {
      const video = await Video.findOne(query);
      const item = { origin: ids[i], new: video._id };
      videosList.push(item);
    }
  }
  return videosList;
};
const createImage = async (ids, user) => {
  const imagesList = [];
  for (let i = 0; i < ids.length; i++) {
    const imageId = ids[i];
    const data = await Image.aggregate([
      {
        $match: { _id: mongoose.Types.ObjectId(imageId) },
      },
      { $project: { _id: 0, role: 0, created_at: 0, updated_at: 0 } },
    ]).catch((err) => {
      console.log('err', err);
    });
    const query = {
      ...data[0],
      user: user.id,
    };
    const check_number = await Image.find(query).count();
    if (check_number === 0) {
      const image = new Image({
        ...data[0],
        user: user.id,
      });
      const tempImage = await image.save();
      const item = { origin: ids[i], new: tempImage._id };
      imagesList.push(item);
    } else {
      const image = await Image.findOne(query);
      const item = { origin: ids[i], new: image._id };
      imagesList.push(item);
    }
  }
  return imagesList;
};
const createPdf = async (ids, user) => {
  const pdfsList = [];
  for (let i = 0; i < ids.length; i++) {
    const pdfId = ids[i];
    const data = await PDF.aggregate([
      {
        $match: { _id: mongoose.Types.ObjectId(pdfId) },
      },
      { $project: { _id: 0, role: 0, created_at: 0, updated_at: 0 } },
    ]).catch((err) => {
      console.log('err', err);
    });
    const query = {
      ...data[0],
      user: user.id,
    };
    const check_number = await PDF.find(query).count();
    if (check_number === 0) {
      const pdf = new PDF({
        ...data[0],
        user: user.id,
      });
      const tempPdf = await pdf.save();
      const item = { origin: ids[i], new: tempPdf._id };
      pdfsList.push(item);
    } else {
      const pdf = await PDF.findOne(query);
      const item = { origin: ids[i], new: pdf._id };
      pdfsList.push(item);
    }
  }
  return pdfsList;
};

module.exports = {
  createVideo,
  createImage,
  createPdf,
  removeMaterials,
};
