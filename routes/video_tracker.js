const express = require('express');

const UserCtrl = require('../controllers/user');
const VideoTrackerCtrl = require('../controllers/video_tracker');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', catchError(VideoTrackerCtrl.createbyDesktop));
router.get('/:contact', UserCtrl.checkAuth, catchError(VideoTrackerCtrl.get));

module.exports = router;
