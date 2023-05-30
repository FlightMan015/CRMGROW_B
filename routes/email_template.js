const express = require('express');

const UserCtrl = require('../controllers/user');
const TemplateCtrl = require('../controllers/email_template');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.get('/', UserCtrl.checkAuth, catchError(TemplateCtrl.getAll));
router.post(
  '/create',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(TemplateCtrl.create)
);
router.post(
  '/createTemplate',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(TemplateCtrl.createTemplate)
);
router.get(
  '/easy-load',
  UserCtrl.checkAuth,
  catchError(TemplateCtrl.getEasyLoad)
);
router.get(
  '/load-own',
  UserCtrl.checkAuthExtension,
  catchError(TemplateCtrl.loadOwn)
);
router.get('/:id', UserCtrl.checkAuth, catchError(TemplateCtrl.get));
router.put(
  '/:id',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(TemplateCtrl.update)
);
router.delete(
  '/:id',
  UserCtrl.checkAuthExtension,
  catchError(TemplateCtrl.remove)
);
router.post('/list/own', UserCtrl.checkAuth, catchError(TemplateCtrl.loadOwn));

router.post(
  '/load-library',
  UserCtrl.checkAuth,
  catchError(TemplateCtrl.loadLibrary)
);

router.post(
  '/list/:page',
  UserCtrl.checkAuth,
  catchError(TemplateCtrl.getTemplates)
);
router.post('/remove', UserCtrl.checkAuth, catchError(TemplateCtrl.bulkRemove));
router.post('/search', UserCtrl.checkAuth, catchError(TemplateCtrl.search));
router.post(
  '/search-own',
  UserCtrl.checkAuth,
  catchError(TemplateCtrl.ownSearch)
);
router.post('/move', UserCtrl.checkAuth, catchError(TemplateCtrl.moveFile));
router.post(
  '/remove-folder',
  UserCtrl.checkAuthExtension,
  catchError(TemplateCtrl.removeFolder)
);
router.post(
  '/remove-folders',
  UserCtrl.checkAuth,
  catchError(TemplateCtrl.removeFolders)
);
router.post(
  '/download-folder',
  UserCtrl.checkAuth,
  catchError(TemplateCtrl.downloadFolder)
);
// router.get('/receive' , UserCtrl.checkAuth, catchError(EmailCtrl.receive))

module.exports = router;
