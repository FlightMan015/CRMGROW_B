const express = require('express');

const UserCtrl = require('../controllers/user');
const AutomationCtrl = require('../controllers/automation');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.get('/', UserCtrl.checkAuth, catchError(AutomationCtrl.getAll));

router.get('/load-own', UserCtrl.checkAuth, catchError(AutomationCtrl.load));

router.post('/search', UserCtrl.checkAuth, catchError(AutomationCtrl.search));

router.post(
  '/search-contact',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.searchContact)
);

router.post(
  '/search-deal',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.searchDeal)
);

router.post(
  '/get-titles',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.getTitles)
);

router.post(
  '/load-library',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.loadLibrary)
);

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(AutomationCtrl.create)
);
router.post(
  '/download',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(AutomationCtrl.download)
);
router.put(
  '/:id',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(AutomationCtrl.update)
);

router.delete('/:id', UserCtrl.checkAuth, catchError(AutomationCtrl.remove));

router.get('/list/own', UserCtrl.checkAuth, catchError(AutomationCtrl.loadOwn));

router.get(
  '/list/:page',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.getPage)
);

router.post(
  '/detail/:id',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.getStatus)
);

router.get(
  '/easy-load',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.getEasyLoad)
);

router.get(
  '/assigned-contacts/:id',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.getAssignedContacts)
);

router.post(
  '/contact-detail',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.getContactDetail)
);

router.post('/get-detail', UserCtrl.checkAuth, catchError(AutomationCtrl.get));

// Update existing automation
router.post(
  '/update-old',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.updateExistingContacts)
);

// Default Video Edit
router.post(
  '/remove',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.bulkRemove)
);
router.post(
  '/update-admin',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(AutomationCtrl.updateDefault)
);

router.post('/move', UserCtrl.checkAuth, catchError(AutomationCtrl.moveFile));
router.post(
  '/remove-folder',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.removeFolder)
);
router.post(
  '/remove-folders',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.removeFolders)
);
router.post(
  '/download-folder',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.downloadFolder)
);
module.exports = router;
