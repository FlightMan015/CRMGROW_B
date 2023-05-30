const express = require('express');

const UserCtrl = require('../controllers/user');
const EventTypeCtrl = require('../controllers/event_type');
const SchedulerEventCtrl = require('../controllers/scheduler_event');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/event-type',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(EventTypeCtrl.create)
);
router.get('/event-type', UserCtrl.checkAuth, catchError(EventTypeCtrl.getAll));

router.get(
  '/event-type/:id',
  UserCtrl.checkAuth,
  catchError(EventTypeCtrl.get)
);

router.put(
  '/event-type/:id',
  UserCtrl.checkAuth,
  catchError(EventTypeCtrl.update)
);

router.delete(
  '/event-type/:id',
  UserCtrl.checkAuth,
  catchError(EventTypeCtrl.remove)
);

router.post('/search-link', catchError(EventTypeCtrl.searchByLink));
router.post('/scheduler-event', catchError(SchedulerEventCtrl.create));
router.post('/load-conflicts', catchError(SchedulerEventCtrl.loadConflicts));

router.post('/load-events', catchError(SchedulerEventCtrl.loadEvents));

module.exports = router;
