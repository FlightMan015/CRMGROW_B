const express = require('express');

const UserCtrl = require('../../controllers/user');
const AppointmentCtrl = require('../../controllers/appointment');
const { catchError } = require('../../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(AppointmentCtrl.create)
);
router.get('/', UserCtrl.checkAuth, catchError(AppointmentCtrl.get));

// Update appointment by id
router.put('/:id', UserCtrl.checkAuth, catchError(AppointmentCtrl.edit));

module.exports = router;
