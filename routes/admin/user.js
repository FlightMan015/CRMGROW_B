const express = require('express');

const { body, query } = require('express-validator/check');

const UserCtrl = require('../../controllers/admin/user');
const { catchError } = require('../../controllers/error');

const router = express.Router();

// SignUp
router.post(
  '/',
  [
    body('email').isEmail(),
    body('user_name')
      .isLength({ min: 3 })
      .withMessage('user_name must be at least 3 chars long'),
    // :TODO phone number regexp should be used
    body('cell_phone')
      .isLength({ min: 9 })
      .matches(/^[\+\d]?(?:[\d-.\s()]*)$/)
      .withMessage('cell_phone must be a valid phone number!'),
  ],
  catchError(UserCtrl.signUp)
);

// Create a new user
router.post(
  '/create',
  [
    body('email').isEmail(),
    body('user_name')
      .isLength({ min: 3 })
      .withMessage('user_name must be at least 3 chars long'),
  ],
  catchError(UserCtrl.create)
);

// Login
router.post(
  '/login',
  [
    body('email').optional().isLength({ min: 3 }),
    body('user_name').optional().isLength({ min: 3 }),
    body('password').isLength({ min: 1 }),
  ],
  catchError(UserCtrl.login)
);

// Get own profile
router.get('/me', UserCtrl.checkAuth, catchError(UserCtrl.editMe));

// Edit own profile
router.put('/me', UserCtrl.checkAuth, catchError(UserCtrl.editMe));

// Get the Specific User Profile
router.get('/profile/:id', UserCtrl.checkAuth, catchError(UserCtrl.getProfile));

// Update User
router.put(
  '/update-user/:id',
  UserCtrl.checkAuth,
  catchError(UserCtrl.updateUser)
);

// Set the Specific User Profile
router.get(
  '/disable/:id',
  UserCtrl.checkAuth,
  catchError(UserCtrl.disableUser)
);

// Set the Specific User Profile
router.get(
  '/suspend/:id',
  UserCtrl.checkAuth,
  catchError(UserCtrl.suspendUser)
);

// Set the Specific User Profile
router.get(
  '/activate/:id',
  UserCtrl.checkAuth,
  catchError(UserCtrl.activateUser)
);

// Get the Specific User Profile
router.delete('/:id', UserCtrl.checkAuth, catchError(UserCtrl.closeAccount));

// Get the disabled Users Profile
router.post(
  '/disabled/:page',
  UserCtrl.checkAuth,
  catchError(UserCtrl.disableUsers)
);

// Get Page users
router.post('/list/:page', UserCtrl.checkAuth, catchError(UserCtrl.getAll));

// New Password by old one
router.post(
  '/reset-password',
  UserCtrl.checkAuth,
  catchError(UserCtrl.resetPassword)
);

// Get Active Users for page
router.post(
  '/active-last',
  UserCtrl.checkAuth,
  catchError(UserCtrl.getActiveUsers)
);

// Get All Active Users
router.get(
  '/get-all-active',
  UserCtrl.checkAuth,
  catchError(UserCtrl.getAllActiveUsers)
);

// Get Disable Users for page
router.post(
  '/disable-last',
  UserCtrl.checkAuth,
  catchError(UserCtrl.getDisableUsers)
);

// Get All Disable Users
router.get(
  '/get-all-disable',
  UserCtrl.checkAuth,
  catchError(UserCtrl.getAllDisableUsers)
);

router.post(
  '/export-users',
  UserCtrl.checkAuth,
  catchError(UserCtrl.exportUsers)
);

module.exports = router;
