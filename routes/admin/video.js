const express = require('express');
const fs = require('fs');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const mime = require('mime-types');
const uuidv1 = require('uuid/v1');

const VideoCtrl = require('../../controllers/admin/video');
const UserCtrl = require('../../controllers/admin/user');
const { catchError } = require('../../controllers/error');
const api = require('../../config/api');
const { TEMP_PATH } = require('../../config/path');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const router = express.Router();

const fileStorage = multer.diskStorage({
  destination: function fn(req, file, cb) {
    if (!fs.existsSync(TEMP_PATH)) {
      fs.mkdirSync(TEMP_PATH);
    }
    cb(null, TEMP_PATH);
  },
  filename: (req, file, cb) => {
    cb(null, uuidv1() + '.' + mime.extension(file.mimetype));
  },
});

const upload = multer({ storage: fileStorage });

// Upload a video
router.post(
  '/',
  UserCtrl.checkAuth,
  upload.single('video'),
  catchError(VideoCtrl.create)
);

// Upload a thumbnail and detail info
router.put('/:id', UserCtrl.checkAuth, catchError(VideoCtrl.updateDetail));

// Upload a thumbnail and detail info
router.get(
  '/thumbnail/:name',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.getThumbnail)
);

// Get all video
router.get('/list/:page', UserCtrl.checkAuth, catchError(VideoCtrl.getVideos));
// // Get a video
// router.get('/:id', catchError(VideoCtrl.get))

// Get all video by user
router.post(
  '/user/:id',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.getVideosByUser)
);
// // Get a video
// router.get('/:id', catchError(VideoCtrl.get))

// Send Video
router.post('/send', UserCtrl.checkAuth, catchError(VideoCtrl.sendVideo));

// Delete a video
router.delete('/:id', UserCtrl.checkAuth, catchError(VideoCtrl.remove));

module.exports = router;
