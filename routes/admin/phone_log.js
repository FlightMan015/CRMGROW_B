const express = require('express');

const UserCtrl = require('../../controllers/user');
const PhoneLogCtrl = require('../../controllers/phone_log');
const { catchError } = require('../../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(PhoneLogCtrl.create));
router.get('/:contact', UserCtrl.checkAuth, catchError(PhoneLogCtrl.get));

module.exports = router;
