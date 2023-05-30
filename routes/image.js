const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const ImageCtrl = require('../controllers/image');
const UserCtrl = require('../controllers/user');
const { catchError } = require('../controllers/error');
const api = require('../config/api');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const router = express.Router();

const storage = multerS3({
  s3,
  bucket: api.AWS.AWS_S3_BUCKET_NAME,
  acl: 'public-read',
  metadata(req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key(req, file, cb) {
    const today = new Date();
    const year = today.getYear();
    const month = today.getMonth();
    cb(null, 'image' + year + '/' + month + '/' + file.originalname);
  },
});

const upload = multer({
  storage,
});

// Upload a image
router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  upload.array('image'),
  catchError(ImageCtrl.create)
);

// Image Creating new one from existing one
router.post(
  '/create',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ImageCtrl.createImage)
);

// Upload a preview and detail info
router.put(
  '/:id',
  UserCtrl.checkAuthExtension,
  catchError(ImageCtrl.updateDetail)
);

// Upload a preview and detail info
router.get('/preview/:name', catchError(ImageCtrl.getPreview));

// Get all image
router.get('/easy-load', UserCtrl.checkAuth, catchError(ImageCtrl.getEasyLoad));

router.get(
  '/download/:id',
  UserCtrl.checkAuth,
  catchError(ImageCtrl.downloadImage)
);

router.get(
  '/analytics/:id',
  UserCtrl.checkAuth,
  catchError(ImageCtrl.getAnalytics)
);

// Get all image
router.get('/', UserCtrl.checkAuth, catchError(ImageCtrl.getAll));

// Get a image
router.get('/:id', catchError(ImageCtrl.get));

// Send image
router.post(
  '/send',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ImageCtrl.sendImage)
);

// Send image on text
router.post(
  '/send-text',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ImageCtrl.sendText)
);

// Bulk email images
router.post(
  '/bulk-email',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ImageCtrl.bulkEmail)
);

// Bulk texts
router.post(
  '/bulk-text',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ImageCtrl.bulkText)
);

// Sms Content
router.post(
  '/sms-content',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ImageCtrl.createSmsContent)
);
// Bulk images
router.post(
  '/bulk-outlook',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ImageCtrl.bulkOutlook)
);

// Bulk images
router.post(
  '/bulk-gmail',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ImageCtrl.bulkGmail)
);

// Default Image Edit
router.post(
  '/update-admin',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ImageCtrl.updateDefault)
);

// Delete a image
router.delete(
  '/:id',
  UserCtrl.checkAuthExtension,
  catchError(ImageCtrl.remove)
);

module.exports = router;
