const express = require('express');

const UserCtrl = require('../controllers/user');
const FollowUpCtrl = require('../controllers/follow_up');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(FollowUpCtrl.create)
);
router.get('/', UserCtrl.checkAuth, catchError(FollowUpCtrl.get));
router.get('/date', UserCtrl.checkAuth, catchError(FollowUpCtrl.getByDate));
router.put('/:id', UserCtrl.checkAuth, catchError(FollowUpCtrl.update));
router.post(
  '/leave-comment',
  UserCtrl.checkAuth,
  catchError(FollowUpCtrl.leaveComment)
);
router.post('/load', UserCtrl.checkAuth, catchError(FollowUpCtrl.load));
router.post(
  '/completed',
  UserCtrl.checkAuth,
  catchError(FollowUpCtrl.completed)
);
router.post(
  '/checked',
  UserCtrl.checkAuth,
  catchError(FollowUpCtrl.updateChecked)
);
router.post(
  '/archived',
  UserCtrl.checkAuth,
  catchError(FollowUpCtrl.updateArchived)
);
router.post(
  '/create',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(FollowUpCtrl.bulkCreate)
);
router.post('/update', UserCtrl.checkAuth, catchError(FollowUpCtrl.bulkUpdate));
router.post('/load', UserCtrl.checkAuth, catchError(FollowUpCtrl.load));
router.post(
  '/select-all',
  UserCtrl.checkAuth,
  catchError(FollowUpCtrl.selectAll)
);

module.exports = router;
