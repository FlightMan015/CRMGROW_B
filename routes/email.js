const express = require('express');

const UserCtrl = require('../controllers/user');
const EmailCtrl = require('../controllers/email');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/bulk-email',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(EmailCtrl.bulkEmail)
);
router.post(
  '/bulk-outlook',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(EmailCtrl.bulkOutlook)
);
router.post(
  '/bulk-gmail',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(EmailCtrl.bulkGmail)
);
router.post('/bulk-yahoo', UserCtrl.checkAuth, catchError(EmailCtrl.bulkYahoo));
router.get('/gmail/:id', UserCtrl.checkAuth, catchError(EmailCtrl.getGmail));
router.get('/list-gmail', UserCtrl.checkAuth, catchError(EmailCtrl.listGmail));
router.post('/receive', catchError(EmailCtrl.receiveEmailSendGrid));
// router.get('/track1/:id', catchError(EmailCtrl.openTrack));

router.get('/opened/:id', catchError(EmailCtrl.receiveEmail));
router.get('/opened1/:id', catchError(EmailCtrl.receiveEmailExtension));
router.get('/unsubscribe/:id', catchError(EmailCtrl.unSubscribeEmail));
router.get('/resubscribe/:id', catchError(EmailCtrl.reSubscribeEmail));

router.post(
  '/share-platform',
  UserCtrl.checkAuth,
  catchError(EmailCtrl.sharePlatform)
);
router.post(
  '/send-email',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(EmailCtrl.sendEmail)
);
module.exports = router;
