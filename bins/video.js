const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const uuidv1 = require('uuid/v1');
const extractFrames = require('ffmpeg-extract-frames');
const { createCanvas, loadImage } = require('canvas');
const pngFileStream = require('png-file-stream');
const fs = require('fs');
const GIFEncoder = require('gifencoder');
const CronJob = require('cron').CronJob;
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const config = require('../config/config');
const Video = require('../models/video');
const { DB_PORT } = require('../config/database');
const { TEMP_PATH, GIF_PATH } = require('../config/path');
const FileHelper = require('../helpers/file');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION,
});

const video_job = async () => {
  const videos = await Video.find({ converted: false, del: false }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  if (videos) {
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const file_path = video.path;
      if (file_path) {
        console.log('file_path', file_path);
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
                      Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
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
                      video['converted'] = true;
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
                    console.log(err);
                  });
              } else {
                console.log('File read was successful', data);
                console.log('file_path', file_path);
                const today = new Date();
                const year = today.getYear();
                const month = today.getMonth();
                const params = {
                  Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
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
                  video['converted'] = true;
                  video
                    .save()
                    .then(() => {
                      fs.unlinkSync(file_path);
                    })
                    .catch((err) => {
                      console.log('err', err);
                    });
                });
              }
            });
          } catch (err) {
            console.log('err', err);
            // read file
          }
        }
      }
    }
  }
};
// }, function () {
//   console.log('Convert Job finished.');
// }, false, 'US/Central'
// )

video_job();
