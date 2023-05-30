const express = require('express');

const UserCtrl = require('../controllers/user');
const GuestCtrl = require('../controllers/guest');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.get('/load', UserCtrl.checkAuth, catchError(GuestCtrl.load));
router.post('/', UserCtrl.checkAuth, catchError(GuestCtrl.create));
router.get('/', UserCtrl.checkAuth, catchError(GuestCtrl.get));
router.put('/:id', UserCtrl.checkAuth, catchError(GuestCtrl.edit));
router.delete('/:id', UserCtrl.checkAuth, catchError(GuestCtrl.remove));

module.exports = router;
