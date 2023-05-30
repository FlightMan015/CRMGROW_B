const express = require('express');

const UserCtrl = require('../controllers/user');
const MailListCtrl = require('../controllers/mail_list');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(MailListCtrl.create)
);

router.post(
  '/add-contacts',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(MailListCtrl.addContacts)
);

router.post(
  '/remove-contacts',
  UserCtrl.checkAuth,
  catchError(MailListCtrl.removeContacts)
);
router.post(
  '/move-top',
  UserCtrl.checkAuth,
  catchError(MailListCtrl.moveTopContacts)
);
router.get('/', UserCtrl.checkAuth, catchError(MailListCtrl.getAll));
router.get('/:id', UserCtrl.checkAuth, catchError(MailListCtrl.get));

router.delete(
  '/:id',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(MailListCtrl.remove)
);
router.post('/delete', UserCtrl.checkAuth, catchError(MailListCtrl.bulkRemove));
router.put('/:id', UserCtrl.checkAuth, catchError(MailListCtrl.update));
router.post(
  '/contacts',
  UserCtrl.checkAuth,
  catchError(MailListCtrl.getContacts)
);
router.post(
  '/get-all',
  UserCtrl.checkAuth,
  catchError(MailListCtrl.getAllContacts)
);
module.exports = router;
