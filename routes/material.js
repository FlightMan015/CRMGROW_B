const express = require('express');

const UserCtrl = require('../controllers/user');
const MaterialCtrl = require('../controllers/material');
const TrackerCtrl = require('../controllers/tracker');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/bulk-email',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(MaterialCtrl.bulkEmail)
);

router.post(
  '/bulk-text',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(MaterialCtrl.bulkText)
);

router.post(
  '/register-token',
  UserCtrl.checkAuth,
  catchError(MaterialCtrl.registerSendToken)
);

router.post('/social-share', catchError(MaterialCtrl.socialShare));
router.post('/thumbs-up', catchError(MaterialCtrl.thumbsUp));
router.post(
  '/update-folders',
  UserCtrl.checkAuth,
  catchError(MaterialCtrl.updateFolders)
);
router.post(
  '/remove-folders',
  UserCtrl.checkAuth,
  catchError(MaterialCtrl.removeFolders)
);
router.get(
  '/convrrt/list',
  UserCtrl.checkConvrrtAuth,
  catchError(MaterialCtrl.easyLoadMaterials)
);
router.get(
  '/convrrt/load',
  UserCtrl.checkConvrrtAuth,
  catchError(MaterialCtrl.loadFolderVideos)
);
router.post(
  '/list-own',
  UserCtrl.checkAuth,
  catchError(MaterialCtrl.listOwnMaterials)
);
router.post(
  '/list-library',
  UserCtrl.checkAuth,
  catchError(MaterialCtrl.listLibraryMaterials)
);
router.post(
  '/load-library',
  UserCtrl.checkAuth,
  catchError(MaterialCtrl.loadLibrary)
);
router.get(
  '/load-own',
  UserCtrl.checkAuthExtension,
  catchError(MaterialCtrl.load)
);
router.post(
  '/folder',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(MaterialCtrl.createFolder)
);
router.put(
  '/folder/:id',
  UserCtrl.checkAuthExtension,
  catchError(MaterialCtrl.editFolder)
);
router.post(
  '/remove-folder',
  UserCtrl.checkAuthExtension,
  catchError(MaterialCtrl.removeFolder)
);
router.post('/remove', UserCtrl.checkAuth, catchError(MaterialCtrl.bulkRemove));
router.post(
  '/move-material',
  UserCtrl.checkAuth,
  catchError(MaterialCtrl.moveMaterials)
);

router.post(
  '/lead-capture',
  UserCtrl.checkAuth,
  catchError(MaterialCtrl.leadCapture)
);

router.post(
  '/download-folder',
  UserCtrl.checkAuth,
  catchError(MaterialCtrl.downloadFolder)
);

router.post('/track-pdf', catchError(TrackerCtrl.createPDF));

router.put('/track-pdf-update/:id', catchError(TrackerCtrl.updatePDF));

router.post('/track-image', catchError(TrackerCtrl.createImage));

module.exports = router;
