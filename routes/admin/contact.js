const express = require('express');

const UserCtrl = require('../../controllers/user');
const ContactCtrl = require('../../controllers/contact');
const { catchError } = require('../../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(ContactCtrl.create));
router.get('/', UserCtrl.checkAuth, catchError(ContactCtrl.getAll));

// Get a pull contact info for profile page
router.get('/:id', UserCtrl.checkAuth, catchError(ContactCtrl.get));

// Edit contact by id
router.put('/:id', UserCtrl.checkAuth, catchError(ContactCtrl.edit));

// Remove contact and its all related info (activity, followup) by id
router.delete('/:id', UserCtrl.checkAuth, catchError(ContactCtrl.remove));

// Send Batch email to contact lists
router.post('/batch', UserCtrl.checkAuth, catchError(ContactCtrl.sendBatch));

module.exports = router;
