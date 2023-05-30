const express = require('express');

const UserCtrl = require('../../controllers/user');
const CommissionCtrl = require('../../controllers/commission');
const { catchError } = require('../../controllers/error');

const router = express.Router();

router.get('/', UserCtrl.checkAuth, catchError(CommissionCtrl.get));
router.post('/', UserCtrl.checkAuth, catchError(CommissionCtrl.mark));
router.post('/all', UserCtrl.checkAuth, catchError(CommissionCtrl.markAll));
module.exports = router;
