const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const mime = require('mime-types');
const uuidv1 = require('uuid/v1');

const UserCtrl = require('../controllers/user');
const DealCtrl = require('../controllers/deal');
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
  catchError(DealCtrl.create)
);
router.get('/', UserCtrl.checkAuth, catchError(DealCtrl.getAll));

router.post(
  '/get-activity',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getActivity)
);

router.post('/add-note', UserCtrl.checkAuth, catchError(DealCtrl.createNote));
router.post('/edit-note', UserCtrl.checkAuth, catchError(DealCtrl.editNote));

router.post(
  '/v2/add-note',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  s3Upload.single('audio'),
  catchError(DealCtrl.createNote)
);
router.post(
  '/v2/edit-note',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  s3Upload.single('audio'),
  catchError(DealCtrl.editNote)
);

router.post('/get-note', UserCtrl.checkAuth, catchError(DealCtrl.getNotes));
router.post(
  '/remove-note',
  UserCtrl.checkAuth,
  catchError(DealCtrl.removeNote)
);

router.post(
  '/add-follow',
  UserCtrl.checkAuth,
  catchError(DealCtrl.createFollowUp)
);

router.post(
  '/update-follow',
  UserCtrl.checkAuth,
  catchError(DealCtrl.updateFollowUp)
);
router.post(
  '/complete-follow',
  UserCtrl.checkAuth,
  catchError(DealCtrl.completeFollowUp)
);
router.post(
  '/remove-follow',
  UserCtrl.checkAuth,
  catchError(DealCtrl.removeFollowUp)
);

router.post(
  '/move-deal',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(DealCtrl.moveDeal)
);

router.post('/send-email', UserCtrl.checkAuth, catchError(DealCtrl.sendEmails));
router.post('/get-email', UserCtrl.checkAuth, catchError(DealCtrl.getEmails));
router.post('/send-text', UserCtrl.checkAuth, catchError(DealCtrl.sendTexts));

router.post(
  '/create-appointment',
  UserCtrl.checkAuth,
  catchError(DealCtrl.createAppointment)
);
router.post(
  '/get-appointments',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getAppointments)
);
router.post(
  '/update-appointment',
  UserCtrl.checkAuth,
  catchError(DealCtrl.updateAppointment)
);
router.post(
  '/remove-appointment',
  UserCtrl.checkAuth,
  catchError(DealCtrl.removeAppointment)
);

router.post(
  '/create-team-call',
  UserCtrl.checkAuth,
  catchError(DealCtrl.createTeamCall)
);
router.post(
  '/get-team-calls',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getTeamCalls)
);

router.post(
  '/update-contact/:id',
  UserCtrl.checkAuth,
  catchError(DealCtrl.updateContact)
);

router.get(
  '/material-activity/:id',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getMaterialActivity)
);

router.get(
  '/get-timelines/:id',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getTimeLines)
);

router.get(
  '/get-all-timelines',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getAllTimeLines)
);

router.post(
  '/bulk-create',
  UserCtrl.checkAuth,
  catchError(DealCtrl.bulkCreate)
);

router.post(
  '/set-primary-contact',
  UserCtrl.checkAuth,
  catchError(DealCtrl.setPrimaryContact)
);

router.delete('/:id', UserCtrl.checkAuth, catchError(DealCtrl.remove));
router.delete(
  '/only/:id',
  UserCtrl.checkAuth,
  catchError(DealCtrl.removeOnlyDeal)
);
router.put('/:id', UserCtrl.checkAuth, catchError(DealCtrl.edit));
router.get(
  '/siblings/:id',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getSiblings)
);
router.get('/:id', UserCtrl.checkAuth, catchError(DealCtrl.getDetail));

module.exports = router;
