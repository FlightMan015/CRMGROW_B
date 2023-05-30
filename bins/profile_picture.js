const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const fs = require('fs');
const sharp = require('sharp');
const { FILES_PATH, ENV_PATH } = require('../config/path');
const User = require('../models/user');
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

const profile_job = async () => {
  const users = await User.find({ del: false }).catch((err) => {
    console.log('err', err.message);
  });
  for (let i = 1; i < users.length; i++) {
    const user = users[i];
    if (user.picture_profile && user.picture_profile !== '') {
      const file_name = user.picture_profile
        .slice(33)
        .replace('?resize=true', '');
      console.log('file_name', file_name);
      if (fs.existsSync(FILES_PATH + file_name)) {
        fs.readFile(FILES_PATH + file_name, (err, data) => {
          if (err) {
            console.log('file read err', err);
          } else {
            console.log('File read was successful', data);
            const today = new Date();
            const year = today.getYear();
            const month = today.getMonth();
            const params = {
              Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
              Key: 'profile' + year + '/' + month + '/' + file_name,
              Body: data,
              ACL: 'public-read',
            };
            s3.upload(params, async (s3Err, upload) => {
              if (s3Err) {
                console.log('upload s3 error', s3Err);
              } else {
                console.log(`File uploaded successfully at ${upload.Location}`);
                user['picture_profile'] = upload.Location;
                user.save().catch((err) => {
                  console.log('user save error', err.message);
                });
              }
            });
          }
        });

        sharp(FILES_PATH + file_name)
          .resize(100, 100)
          .toBuffer()
          .then((data) => {
            console.log('data', data);
            const today = new Date();
            const year = today.getYear();
            const month = today.getMonth();
            const params = {
              Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
              Key: 'profile' + year + '/' + month + '/' + file_name + '-resize',
              Body: data,
              ACL: 'public-read',
            };

            s3.upload(params, async (s3Err, upload) => {
              if (s3Err) {
                console.log('upload s3 error', s3Err);
              } else {
                console.log(`File uploaded successfully at ${upload.Location}`);
              }
            });
          });
      }
    }
  }
};

profile_job();
