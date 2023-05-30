const express = require('express');

const UserCtrl = require('../../controllers/user');
const FollowUpCtrl = require('../../controllers/follow_up');
const { catchError } = require('../../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(FollowUpCtrl.create)
);

router.get('/', UserCtrl.checkAuth, catchError(FollowUpCtrl.get));
router.get('/date', UserCtrl.checkAuth, catchError(FollowUpCtrl.getByDate));

router.put(
  '/checked/:id',
  UserCtrl.checkAuth,
  catchError(FollowUpCtrl.updateChecked)
);

module.exports = router;
