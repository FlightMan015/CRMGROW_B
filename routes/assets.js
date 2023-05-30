const express = require('express');
var aws = require('aws-sdk');
const mime = require('mime-types');

const AssetsCtrl = require('../controllers/assets');
const UserCtrl = require('../controllers/user');
const api = require('../config/api');
const multer = require('multer');
var multerS3 = require('multer-s3');
const uuidv1 = require('uuid/v1');

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
        'assets/' +
          uuidv1() +
          '-' +
          Date.now().toString() +
          '.' +
          mime.extension(file.mimetype)
      );
    },
  }),
});

router.get('/load/:page', UserCtrl.checkAuth, AssetsCtrl.load);
router.post('/update', UserCtrl.checkAuth, AssetsCtrl.update);
router.post('/create', UserCtrl.checkAuth, AssetsCtrl.create);
router.post('/replace', UserCtrl.checkAuth, AssetsCtrl.replace);
router.post('/delete', UserCtrl.checkAuth, AssetsCtrl.remove);
router.post(
  '/upload',
  UserCtrl.checkAuth,
  upload.array('assets'),
  AssetsCtrl.bulkCreate
);

module.exports = router;
