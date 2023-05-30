const express = require('express');

const UserCtrl = require('../controllers/user');
const DealStageCtrl = require('../controllers/deal_stage');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(DealStageCtrl.create)
);

router.get('/init', UserCtrl.checkAuth, catchError(DealStageCtrl.init));

router.get(
  '/easy-load',
  UserCtrl.checkAuth,
  catchError(DealStageCtrl.getStages)
);

router.get(
  '/with-contact',
  UserCtrl.checkAuth,
  catchError(DealStageCtrl.getStageWithContact)
);

router.get('/', UserCtrl.checkAuth, catchError(DealStageCtrl.getAll));

router.put('/:id', UserCtrl.checkAuth, catchError(DealStageCtrl.edit));

router.post('/remove', UserCtrl.checkAuth, catchError(DealStageCtrl.remove));

router.post('/load', UserCtrl.checkAuth, catchError(DealStageCtrl.load));

router.post(
  '/change-order',
  UserCtrl.checkAuth,
  catchError(DealStageCtrl.changeOrder)
);

router.post(
  '/easy-load',
  UserCtrl.checkAuth,
  catchError(DealStageCtrl.getEasyLoad)
);
router.get(
  '/easy-load',
  UserCtrl.checkAuth,
  catchError(DealStageCtrl.getEasyLoad)
);
router.get('/:id', UserCtrl.checkAuth, catchError(DealStageCtrl.getStage));

module.exports = router;
