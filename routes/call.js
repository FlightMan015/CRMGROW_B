const express = require('express');

const CallCtrl = require('../controllers/call');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/forward-twilio', catchError(CallCtrl.forwardCallTwilio));

router.post('/forward-signalwire', catchError(CallCtrl.forwardCallSignalWire));

module.exports = router;
