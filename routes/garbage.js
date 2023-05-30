const express = require('express');
const aws = require('aws-sdk');
const multer = require('multer');
var multerS3 = require('multer-s3');
const api = require('../config/api');
const UserCtrl = require('../controllers/user');
const GarbageCtrl = require('../controllers/garbage');
const { catchError } = require('../controllers/error');
const mime = require('mime-types');

const router = express.Router();

var s3 = new aws.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

var upload = multer({
  storage: multerS3({
    s3,
    bucket: api.AWS.AWS_S3_BUCKET_NAME,
    acl: 'public-read',
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      cb(
        null,
        `quickvideos/${Date.now().toString()}.${mime.extension(file.mimetype)}`
      );
    },
  }),
});

router.get(
  '/load-default',
  UserCtrl.checkAuth,
  catchError(GarbageCtrl.loadDefaults)
);
router.post('/', UserCtrl.checkAuth, catchError(GarbageCtrl.create));
router.get('/', UserCtrl.checkAuth, catchError(GarbageCtrl.get));
router.put('/', UserCtrl.checkAuth, catchError(GarbageCtrl.edit));
router.post(
  '/terminate-auto_setting',
  UserCtrl.checkAuth,
  catchError(GarbageCtrl.terminateAutoSetting)
);
router.post(
  '/intro_video',
  UserCtrl.checkAuth,
  upload.single('video'),
  catchError(GarbageCtrl.uploadIntroVideo)
);

module.exports = router;
