const express = require('express');

const UserCtrl = require('../controllers/user');
const AppointmentCtrl = require('../controllers/appointment');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(AppointmentCtrl.create)
);

router.get('/', UserCtrl.checkAuth, catchError(AppointmentCtrl.getAll));

// Update appointment by id
router.put(
  '/:id',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(AppointmentCtrl.edit)
);

// Update appointment by id
router.post('/accept', UserCtrl.checkAuth, catchError(AppointmentCtrl.accept));

// Update appointment by id
router.post(
  '/decline',
  UserCtrl.checkAuth,
  catchError(AppointmentCtrl.decline)
);

// Get calendar list
router.get(
  '/calendar',
  UserCtrl.checkAuth,
  catchError(AppointmentCtrl.getCalendarList)
);

router.post(
  '/detail',
  UserCtrl.checkAuth,
  catchError(AppointmentCtrl.getEventById)
);

// Remove contact and its all related info (activity, followup) by id
router.post('/delete', UserCtrl.checkAuth, catchError(AppointmentCtrl.remove));

// Remove contact from appointment
router.post(
  '/delete-contact',
  UserCtrl.checkAuth,
  catchError(AppointmentCtrl.removeContact)
);

router.get('/:id', UserCtrl.checkAuth, catchError(AppointmentCtrl.get));

module.exports = router;
