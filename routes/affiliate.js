const express = require('express');

const UserCtrl = require('../controllers/user');
const AffiliateCtrl = require('../controllers/affiliate');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(AffiliateCtrl.create));
router.get('/', UserCtrl.checkAuth, catchError(AffiliateCtrl.get));
router.get('/referrals', UserCtrl.checkAuth, catchError(AffiliateCtrl.getAll));
router.get('/charge', UserCtrl.checkAuth, catchError(AffiliateCtrl.getCharge));
router.put('/', UserCtrl.checkAuth, catchError(AffiliateCtrl.updatePaypal));
router.post('/event', catchError(AffiliateCtrl.eventListener));

module.exports = router;
