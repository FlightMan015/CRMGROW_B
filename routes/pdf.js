const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const PDFCtrl = require('../controllers/pdf');
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
    cb(null, 'pdf' + year + '/' + month + '/' + file.originalname);
  },
});

const upload = multer({
  storage,
});

// Upload a pdf
router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  upload.single('pdf'),
  catchError(PDFCtrl.create)
);

// PDF Creating new one from existing one
router.post(
  '/create',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(PDFCtrl.createPDF)
);
// Upload a preview and detail info
router.put(
  '/:id',
  UserCtrl.checkAuthExtension,
  catchError(PDFCtrl.updateDetail)
);

// Upload a preview and detail info
router.get('/preview/:name', catchError(PDFCtrl.getPreview));

// Get easy load pdf
router.get('/easy-load', UserCtrl.checkAuth, catchError(PDFCtrl.getEasyLoad));

router.get(
  '/download/:id',
  UserCtrl.checkAuth,
  catchError(PDFCtrl.downloadPDF)
);

router.get(
  '/analytics/:id',
  UserCtrl.checkAuth,
  catchError(PDFCtrl.getAnalytics)
);

// Get all pdf
router.get('/', UserCtrl.checkAuth, catchError(PDFCtrl.getAll));

// Get a pdf
router.get('/:id', catchError(PDFCtrl.get));

// Default PDF Edit
router.post(
  '/update-admin',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(PDFCtrl.updateDefault)
);

// Send PDF
router.post('/send', UserCtrl.checkAuth, catchError(PDFCtrl.sendPDF));

// Send Video on text
router.post('/send-text', UserCtrl.checkAuth, catchError(PDFCtrl.sendText));

// Bulk videos
router.post('/bulk-email', UserCtrl.checkAuth, catchError(PDFCtrl.bulkEmail));

// Bulk texts
router.post('/bulk-text', UserCtrl.checkAuth, catchError(PDFCtrl.bulkText));

// Sms Content Generate
router.post(
  '/sms-content',
  UserCtrl.checkAuth,
  catchError(PDFCtrl.createSmsContent)
);
// Bulk Gmail
router.post('/bulk-gmail', UserCtrl.checkAuth, catchError(PDFCtrl.bulkGmail));

// Bulk Outlook
router.post(
  '/bulk-outlook',
  UserCtrl.checkAuth,
  catchError(PDFCtrl.bulkOutlook)
);

// Delete a pdf
router.delete('/:id', UserCtrl.checkAuthExtension, catchError(PDFCtrl.remove));

module.exports = router;
