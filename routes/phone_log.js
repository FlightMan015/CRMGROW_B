const express = require('express');
const multer = require('multer');

const UserCtrl = require('../controllers/user');
const PhoneLogCtrl = require('../controllers/phone_log');
const { catchError } = require('../controllers/error');

const upload = multer();

const router = express.Router();

// Ringless VM Endpoints
router.post(
  '/rvm',
  UserCtrl.checkAuth,
  upload.any(),
  catchError(PhoneLogCtrl.createRVM)
);
router.get('/rvm', UserCtrl.checkAuth, catchError(PhoneLogCtrl.loadRVM));
router.post('/rvm/drop', UserCtrl.checkAuth, catchError(PhoneLogCtrl.sendRVM));

router.post('/', UserCtrl.checkAuth, catchError(PhoneLogCtrl.create));
router.get(
  '/customer',
  UserCtrl.checkAuth,
  catchError(PhoneLogCtrl.loadCustomer)
);
router.get('/:contact', UserCtrl.checkAuth, catchError(PhoneLogCtrl.get));
router.post('/event', catchError(PhoneLogCtrl.handleEvent));
router.post(
  '/recording',
  UserCtrl.checkAuth,
  catchError(PhoneLogCtrl.loadRecording)
);
router.post('/deal', UserCtrl.checkAuth, catchError(PhoneLogCtrl.saveDealCall));
router.put('/:id', UserCtrl.checkAuth, catchError(PhoneLogCtrl.edit));

module.exports = router;
