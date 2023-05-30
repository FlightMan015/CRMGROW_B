const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const fs = require('fs');
const sharp = require('sharp');
const { TEMP_PATH, ENV_PATH } = require('../config/path');
const Video = require('../models/video');
require('dotenv').config({ path: ENV_PATH });
const config = require('../config/config');

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION,
});
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const url_job = async () => {
  const videos = await Video.findOne({
    _id: mongoose.Types.ObjectId('5e5982106ec2d73427e6dbf7'),
  }).catch((err) => {
    console.log('videos err', err.message);
  });
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    if (video['url']) {
      const file_name = video['url'].slice(39);
      console.log('path', file_name);
      if (fs.existsSync(TEMP_PATH + file_name)) {
        fs.readFile(TEMP_PATH + file_name, (err, data) => {
          if (err) {
            console.log('file read err', err);
          } else {
            console.log('File read was successful', data);
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
              if (s3Err) {
                console.log('upload s3 error', s3Err);
              } else {
                console.log(`File uploaded successfully at ${upload.Location}`);

                video['url'] = upload.Location;
                video['converted'] = true;
                video.save().catch((err) => {
                  console.log('video save error', err.message);
                });
              }
            });
          }
        });

        //  sharp(THUMBNAILS_PATH+file_name)
        //  .resize(250, 140)
        //  .toBuffer()
        //  .then(data => {
        //     console.log('data', data)
        //     const today = new Date()
        //     const year = today.getYear()
        //     const month = today.getMonth()
        //     const params = {
        //        Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
        //        Key: 'thumbnail' +  year + '/' + month + '/' + file_name + '-resize',
        //        Body: data,
        //        ACL: 'public-read'
        //      };

        //      s3.upload(params, async (s3Err, upload)=>{
        //       if (s3Err){
        //         console.log('upload s3 error', s3Err)
        //       } else {
        //         console.log(`File uploaded successfully at ${upload.Location}`)
        //       }
        //     })
        //  });
      }
    }
  }
};

function readFileStream(fileName, cb, options) {
  return new Promise(function (resolve, reject) {
    const readable = fs.createReadStream(fileName, options);

    readable.on('data', function (data) {
      cb(data);
    });

    readable.on('end', function () {
      resolve();
    });

    readable.on('error', function (err) {
      return reject(err);
    });
  });
}

function printDataAsItComesIn(data) {
  // Data will be null when it reaches the end.
  if (!data) return;

  // type of data = Buffer
  const stringData = data.toString('utf8', 0, data.length);
  console.log(stringData.length);
}

const large_job = async () => {
  const video = await Video.findOne({
    _id: mongoose.Types.ObjectId('5e5982106ec2d73427e6dbf7'),
  }).catch((err) => {
    console.log('videos err', err.message);
  });
  if (video['url']) {
    const file_name = video['url'].slice(39);
    console.log('path', file_name);
    if (fs.existsSync(TEMP_PATH + file_name)) {
      fs.readFile(TEMP_PATH + file_name, (err, data) => {
        if (err) {
          console.log('file read err', err);
        } else {
          console.log('File read was successful', data);
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
            if (s3Err) {
              console.log('upload s3 error', s3Err);
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`);

              video['url'] = upload.Location;
              video['converted'] = true;
              video.save().catch((err) => {
                console.log('video save error', err.message);
              });
            }
          });
        }
      });
    }
  }
};
large_job();
