const express = require('express');

const UserCtrl = require('../controllers/user');
const MaterialThemeCtrl = require('../controllers/material_theme');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.get('/', UserCtrl.checkAuth, catchError(MaterialThemeCtrl.getAll));

router.get(
  '/newsletters',
  UserCtrl.checkAuth,
  catchError(MaterialThemeCtrl.getNewsletters)
);

router.get('/:id', UserCtrl.checkAuth, catchError(MaterialThemeCtrl.get));

router.post(
  '/set-video',
  UserCtrl.checkAuth,
  catchError(MaterialThemeCtrl.setVideo)
);

router.post(
  '/get-templates',
  UserCtrl.checkAuth,
  catchError(MaterialThemeCtrl.getTemplates)
);

router.post('/', UserCtrl.checkAuth, catchError(MaterialThemeCtrl.create));

router.post(
  '/get-template',
  UserCtrl.checkAuth,
  catchError(MaterialThemeCtrl.getTemplate)
);

router.put('/:id', UserCtrl.checkAuth, catchError(MaterialThemeCtrl.update));

router.delete('/:id', UserCtrl.checkAuth, catchError(MaterialThemeCtrl.remove));

module.exports = router;
