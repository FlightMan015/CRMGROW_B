const express = require('express');

const UserCtrl = require('../controllers/user');
const PageCtrl = require('../controllers/page');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/create', UserCtrl.checkAuth, catchError(PageCtrl.create));
router.put('/:id', UserCtrl.checkAuth, catchError(PageCtrl.update));
router.delete('/:id', UserCtrl.checkAuth, catchError(PageCtrl.delete));
router.get('/list/:page', UserCtrl.checkAuth, catchError(PageCtrl.load));
router.post(
  '/bulk-remove',
  UserCtrl.checkAuth,
  catchError(PageCtrl.bulkRemove)
);
router.search('/search', UserCtrl.checkAuth, catchError(PageCtrl.search));
router.get('/defaults', UserCtrl.checkAuth, catchError(PageCtrl.loadDefault));
router.get('/:id', UserCtrl.checkAuth, catchError(PageCtrl.read));

module.exports = router;
