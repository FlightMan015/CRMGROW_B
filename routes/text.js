const express = require('express');

const UserCtrl = require('../controllers/user');
const TextCtrl = require('../controllers/text');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/receive', catchError(TextCtrl.receive));
router.post('/receive1', catchError(TextCtrl.receive1));

router.post('/receive-signalwire', catchError(TextCtrl.receiveTextSignalWire));
router.post('/receive-twilio', catchError(TextCtrl.receiveTextTwilio));

router.get('/', UserCtrl.checkAuth, catchError(TextCtrl.getAll));

router.post(
  '/get-messages-count',
  UserCtrl.checkAuth,
  catchError(TextCtrl.getContactMessageOfCount)
);

router.post('/get-messages', UserCtrl.checkAuth, catchError(TextCtrl.get));

router.post('/load-files', UserCtrl.checkAuth, catchError(TextCtrl.loadFiles));
router.post(
  '/search-numbers',
  UserCtrl.checkAuth,
  catchError(TextCtrl.searchNumbers)
);
router.post(
  '/buy-numbers',
  UserCtrl.checkAuth,
  catchError(TextCtrl.buyNumbers)
);

router.post(
  '/buy-credit',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(TextCtrl.buyCredit)
);

router.put(
  '/mark-read/:id',
  UserCtrl.checkAuth,
  catchError(TextCtrl.markAsRead)
);

router.post('/send/:id', UserCtrl.checkAuth, catchError(TextCtrl.send));

module.exports = router;
