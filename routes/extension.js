const express = require('express');

const UserCtrl = require('../controllers/user');
const ExtensionCtrl = require('../controllers/extension');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuthExtension,
  UserCtrl.checkSuspended,
  catchError(ExtensionCtrl.sendActivity)
);
router.post(
  '/load',
  UserCtrl.checkAuthExtension,
  catchError(ExtensionCtrl.getActivities)
);
router.get(
  '/:id',
  UserCtrl.checkAuthExtension,
  catchError(ExtensionCtrl.getActivityDetail)
);

module.exports = router;
