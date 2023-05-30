const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const mime = require('mime-types');
const uuidv1 = require('uuid/v1');

const UserCtrl = require('../controllers/user');
const NoteCtrl = require('../controllers/note');
const { catchError } = require('../controllers/error');
const api = require('../config/api');

const router = express.Router();

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});
const audioStorage = multerS3({
  s3,
  bucket: api.AWS.AWS_S3_BUCKET_NAME,
  key: (req, file, cb) => {
    const fileKey =
      'audios/' +
      new Date().getTime() +
      '-' +
      uuidv1() +
      '.' +
      mime.extension(file.mimetype);
    cb(null, fileKey);
  },
  acl: 'public-read',
});
const s3Upload = multer({
  storage: audioStorage,
});

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(NoteCtrl.create)
);
router.get('/', UserCtrl.checkAuth, catchError(NoteCtrl.get));
router.post(
  '/v2/create',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  s3Upload.single('audio'),
  catchError(NoteCtrl.create)
);
router.post(
  '/v2/bulk-create',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  s3Upload.single('audio'),
  catchError(NoteCtrl.bulkCreate)
);
router.post(
  '/create',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(NoteCtrl.bulkCreate)
);
router.put(
  '/v2/:id',
  UserCtrl.checkAuth,
  s3Upload.single('audio'),
  catchError(NoteCtrl.update)
);
router.put('/:id', UserCtrl.checkAuth, catchError(NoteCtrl.update));
router.post('/:id', UserCtrl.checkAuth, catchError(NoteCtrl.remove));

module.exports = router;
