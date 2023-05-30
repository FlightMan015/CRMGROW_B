const express = require('express');

const UserCtrl = require('../controllers/user');
const ActivityCtrl = require('../controllers/activity');
const ExtensionCtrl = require('../controllers/extension');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/remove-all',
  UserCtrl.checkAuth,
  catchError(ActivityCtrl.removeAll)
);
router.post('/remove', UserCtrl.checkAuth, catchError(ActivityCtrl.removeBulk));
router.post(
  '/load',
  UserCtrl.checkAuth,
  catchError(ActivityCtrl.contactActivity)
);
router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ActivityCtrl.create)
);
router.post('/get', UserCtrl.checkAuth, catchError(ActivityCtrl.load));
router.post('/update', UserCtrl.checkAuth, catchError(ActivityCtrl.update));
router.get('/', UserCtrl.checkAuth, catchError(ActivityCtrl.get));
router.get(
  '/:id',
  UserCtrl.checkAuth,
  UserCtrl.checkLastLogin,
  catchError(ActivityCtrl.get)
);
router.post('/get', UserCtrl.checkAuth, catchError(ActivityCtrl.load));
router.post(
  '/sent',
  UserCtrl.checkAuth,
  catchError(ExtensionCtrl.sendActivity)
);

module.exports = router;
