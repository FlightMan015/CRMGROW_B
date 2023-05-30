const express = require('express');

const UserCtrl = require('../../controllers/user');
const NoteCtrl = require('../../controllers/note');
const { catchError } = require('../../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(NoteCtrl.create));
router.get('/', UserCtrl.checkAuth, catchError(NoteCtrl.get));

module.exports = router;
