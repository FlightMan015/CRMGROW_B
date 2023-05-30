const express = require('express');

const UserCtrl = require('../controllers/user');
const FilterCtrl = require('../controllers/filter');
const { catchError } = require('../controllers/error');

const router = express.Router();

// Create fitler
router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(FilterCtrl.create)
);
// Get all fitlers
router.get('/', UserCtrl.checkAuth, catchError(FilterCtrl.getAll));
// Update fitler by id
router.put('/:id', UserCtrl.checkAuth, catchError(FilterCtrl.update));
// Remove fitler by id
router.delete('/:id', UserCtrl.checkAuth, catchError(FilterCtrl.remove));

module.exports = router;
