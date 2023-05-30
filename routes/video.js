const express = require('express');
const fs = require('fs');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const mime = require('mime-types');
const uuidv1 = require('uuid/v1');
const VideoCtrl = require('../controllers/video');
const UserCtrl = require('../controllers/user');
const { catchError } = require('../controllers/error');
const api = require('../config/api');
const { TEMP_PATH } = require('../config/path');

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
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: fileStorage });

const bucketStorage = multerS3({
  s3,
  bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
  key: (req, file, cb) => {
    const fileKey =
      'sources/' +
      new Date().getTime() +
      '-' +
      uuidv1() +
      '.' +
      mime.extension(file.mimetype);
    cb(null, fileKey);
  },
});
const s3Upload = multer({
  storage: bucketStorage,
});

const rawBucketStorage = multerS3({
  s3,
  bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
  key: (req, file, cb) => {
    const fileKey = 'raws/' + req.params.id + '/' + file.originalname;
    cb(null, fileKey);
  },
});
const s3RawUpload = multer({
  storage: rawBucketStorage,
});
const chunkBucketStorage = multerS3({
  s3,
  bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
  key: (req, file, cb) => {
    const fileKey = 'chunks/' + req.params.id + '/' + file.originalname;
    cb(null, fileKey);
  },
});
const chunkRawUpload = multer({
  storage: chunkBucketStorage,
});

const singleChunkStorage = multerS3({
  s3,
  bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
  key: (req, file, cb) => {
    const fileKey = 'sources/' + req.params.id;
    cb(null, fileKey);
  },
});
const singleUpload = multer({
  storage: singleChunkStorage,
});

router.post(
  '/create',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(VideoCtrl.createVideo)
);

// Upload a video
router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  upload.single('video'),
  catchError(VideoCtrl.create)
);

// Upload a thumbnail and detail info when upload a video at first
router.put(
  '/detail/:id',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.updateDetail)
);

router.put(
  '/converting/:id',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.updateConvertStatus)
);

// Upload a thumbnail and detail info
router.put('/:id', UserCtrl.checkAuthExtension, catchError(VideoCtrl.update));

// Upload a thumbnail and detail info
router.get('/thumbnail/:name', catchError(VideoCtrl.getThumbnail));

router.post(
  '/publish/:id',
  UserCtrl.checkAuthExtension,
  catchError(VideoCtrl.publish)
);
router.get('/trash/:id', UserCtrl.checkAuth, catchError(VideoCtrl.trash));

// V1: Bulk videos
router.post('/bulk-email', UserCtrl.checkAuth, catchError(VideoCtrl.bulkEmail));

// V1: Bulk videos
router.post(
  '/bulk-outlook',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.bulkOutlook)
);

// V1: Bulk videos
router.post('/bulk-gmail', UserCtrl.checkAuth, catchError(VideoCtrl.bulkGmail));

// V1: Bulk texts
router.post(
  '/bulk-text',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(VideoCtrl.bulkText)
);

// Sms Content
router.post(
  '/sms-content',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.createSmsContent)
);

// Default Video Edit
router.post(
  '/update-admin',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.updateDefault)
);

// Streaming video
router.get('/pipe/:name', catchError(VideoCtrl.pipe));

// Get Conver progress of a video
router.post(
  '/convert-status',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.getConvertStatus)
);

// Get Convert progress of a video
router.post('/convert-status1', catchError(VideoCtrl.getConvertStatus));

router.get(
  '/latest-sent/:id',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.getContactsByLatestSent)
);

router.get(
  '/analytics/:id',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.getAnalytics)
);

// Get easy load video
router.get('/easy-load', UserCtrl.checkAuth, catchError(VideoCtrl.getEasyLoad));

// Download video
router.get(
  '/download/:id',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.downloadVideo)
);

// Play video
router.get('/play/:id', catchError(VideoCtrl.downloadVideo));

// Get all video
router.get('/', UserCtrl.checkAuth, catchError(VideoCtrl.getAll));

router.get(
  '/download/:id',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.downloadVideo)
);

router.get('/:id', UserCtrl.checkAuth, catchError(VideoCtrl.get));

// Delete a video
router.delete(
  '/:id',
  UserCtrl.checkAuthExtension,
  catchError(VideoCtrl.remove)
);

// Remove videos
router.post('/remove', UserCtrl.checkAuth, catchError(VideoCtrl.bulkRemove));

router.post(
  '/upload',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  s3Upload.single('video'),
  catchError(VideoCtrl.uploadVideo)
);

/**
 * Inititalize the recording. Get the available time limit
 */
router.post(
  '/init-record',
  UserCtrl.checkAuthExtension,
  UserCtrl.checkSuspended,
  catchError(VideoCtrl.initRecord)
);

/**
 * Upload the recorded video chunks to aws
 */
router.post(
  '/upload-chunk/:id',
  UserCtrl.checkAuth,
  s3RawUpload.array('file'),
  catchError(VideoCtrl.uploadChunk)
);

/**
 * Complete the recording: save or cancel
 */
router.post(
  '/complete-record',
  UserCtrl.checkAuthExtension,
  UserCtrl.checkSuspended,
  catchError(VideoCtrl.completeRecord)
);

/**
 * Get video converting status
 */
router.post(
  '/get-convert-status',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.getConvertStatus2)
);

/**
 * Uploading the video chunks for large file
 */
router.post(
  '/upload-split/:id',
  UserCtrl.checkAuth,
  chunkRawUpload.single('file'),
  catchError(VideoCtrl.uploadChunk)
);

router.post(
  '/upload-single/:id',
  UserCtrl.checkAuth,
  singleUpload.single('file'),
  catchError(VideoCtrl.uploadSingle)
);

router.post(
  '/merge-chunks',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.mergeFiles)
);

router.post('/update-status', catchError(VideoCtrl.updateStatus));

module.exports = router;
