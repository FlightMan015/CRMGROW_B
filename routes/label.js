const express = require('express');

const UserCtrl = require('../controllers/user');
const LabelCtrl = require('../controllers/label');
const { catchError } = require('../controllers/error');

const router = express.Router();

// Create label
router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(LabelCtrl.create)
);

// Create label
router.post(
  '/bulk-create',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(LabelCtrl.bulkCreate)
);

router.post(
  '/contacts',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(LabelCtrl.getLabelDetails)
);
// Get all labels
router.get('/', UserCtrl.checkAuth, catchError(LabelCtrl.getAll));
router.get('/load', UserCtrl.checkAuth, catchError(LabelCtrl.loadLabels));
// Update label by id
router.put('/:id', UserCtrl.checkAuth, catchError(LabelCtrl.update));
// Remove label by id
router.delete('/:id', UserCtrl.checkAuth, catchError(LabelCtrl.remove));
// Change Label orders
router.post('/order', UserCtrl.checkAuth, catchError(LabelCtrl.changeOrder));
router.get(
  '/shared-contacts',
  UserCtrl.checkAuth,
  catchError(LabelCtrl.getSharedAll)
);
router.post(
  '/contact-label',
  UserCtrl.checkAuth,
  catchError(LabelCtrl.getContactLabel)
);

module.exports = router;
