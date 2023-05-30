const express = require('express');

const UserCtrl = require('../controllers/user');
const TeamCallCtrl = require('../controllers/team_call');
const { catchError } = require('../controllers/error');

const router = express.Router();

// Team call for 3 way

router.get(
  '/call',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.getInquireCall)
);

router.get(
  '/nth-call/:id',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.getInquireCall)
);

router.get(
  '/call/:id',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.getDetailInquireCall)
);

router.get(
  '/call-planned',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.getPlannedCall)
);
router.get(
  '/call-planned/:id',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.getPlannedCall)
);

router.get(
  '/call-finished',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.getFinishedCall)
);
router.get(
  '/call-finished/:id',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.getFinishedCall)
);

router.post(
  '/request-call',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.requestCall)
);

router.post(
  '/accept-call',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.acceptCall)
);

router.post(
  '/reject-call',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.rejectCall)
);

router.put(
  '/call/:id',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.updateCall)
);
router.delete(
  '/call/:id',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.removeCall)
);
router.delete('/call', UserCtrl.checkAuth, catchError(TeamCallCtrl.removeCall));

router.post(
  '/load-call',
  UserCtrl.checkAuth,
  catchError(TeamCallCtrl.loadCalls)
);

module.exports = router;
