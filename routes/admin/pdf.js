const express = require('express');
const fs = require('fs');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const mime = require('mime-types');
const uuidv1 = require('uuid/v1');

const PDFCtrl = require('../../controllers/admin/pdf');
const UserCtrl = require('../../controllers/admin/user');
const { catchError } = require('../../controllers/error');
const api = require('../../config/api');

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
    cb(null, 'pdf ' + year + '/' + month + '/' + file.originalname);
  },
});

const upload = multer({
  storage,
});

// Upload a pdf
router.post(
  '/',
  UserCtrl.checkAuth,
  upload.single('pdf'),
  catchError(PDFCtrl.create)
);

// Upload a preview and detail info
router.put('/:id', UserCtrl.checkAuth, catchError(PDFCtrl.updateDetail));

// Upload a preview and detail info
router.get(
  '/preview/:name',
  UserCtrl.checkAuth,
  catchError(PDFCtrl.getPreview)
);

// Get a pdf
router.get('/:id', UserCtrl.checkAuth, catchError(PDFCtrl.get));

// Get all pdf
router.get('/', UserCtrl.checkAuth, catchError(PDFCtrl.getAll));

// Send PDF
router.post('/send', UserCtrl.checkAuth, catchError(PDFCtrl.sendPDF));

// Delete a pdf
router.delete('/:id', UserCtrl.checkAuth, catchError(PDFCtrl.remove));

router.get('/list/:page', UserCtrl.checkAuth, catchError(PDFCtrl.getPdfs));

// Get all pdfs by user
router.post('/user/:id', UserCtrl.checkAuth, catchError(PDFCtrl.getPdfsByUser));

module.exports = router;
