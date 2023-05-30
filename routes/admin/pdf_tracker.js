const express = require('express');

const UserCtrl = require('../../controllers/admin/user');
const PDFTrackerCtrl = require('../../controllers/pdf_tracker');
const { catchError } = require('../../controllers/error');

const router = express.Router();

router.post('/', catchError(PDFTrackerCtrl.create));
router.get('/:contact', UserCtrl.checkAuth, catchError(PDFTrackerCtrl.get));

module.exports = router;
