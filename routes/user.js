const express = require('express');
const { body, query } = require('express-validator/check');
const UserCtrl = require('../controllers/user');
const { catchError } = require('../controllers/error');

const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const mime = require('mime-types');
const api = require('../config/api');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const bucketStorage = multerS3({
  s3,
  bucket: api.AWS.AWS_S3_BUCKET_NAME,
  acl: 'public-read',
  key: (req, file, cb) => {
    const fileKey =
      'avatar/' + req.currentUser._id + '.' + mime.extension(file.mimetype);
    cb(null, fileKey);
  },
});
const s3Upload = multer({
  storage: bucketStorage,
});

const router = express.Router();

// SignUp
router.post(
  '/',
  [
    body('email').isEmail(),
    body('user_name')
      .isLength({ min: 3 })
      .withMessage('user_name must be at least 3 chars long'),
    // password must be at least 5 chars long
    body('password')
      .isLength({ min: 5 })
      .withMessage('password must be at least 5 chars long'),
    // :TODO phone number regexp should be used
    body('cell_phone')
      .isLength({ min: 9 })
      .matches(/^[\+\d]?(?:[\d-.\s()]*)$/)
      .withMessage('cell_phone must be a valid phone number!'),
  ],
  catchError(UserCtrl.signUp)
);

// SignUp
router.post(
  '/extension-signup',
  [
    body('email').isEmail(),
    body('user_name')
      .isLength({ min: 3 })
      .withMessage('user_name must be at least 3 chars long'),
    // password must be at least 5 chars long
    body('password')
      .isLength({ min: 5 })
      .withMessage('password must be at least 5 chars long'),
    // :TODO phone number regexp should be used
  ],
  catchError(UserCtrl.extensionSignup)
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

router.post('/check', catchError(UserCtrl.checkUser));

router.post('/logout', UserCtrl.checkAuth, catchError(UserCtrl.logout));

// Edit own profile
router.get(
  '/convrrt/me',
  UserCtrl.checkConvrrtAuth,
  catchError(UserCtrl.getMyInfo)
);
router.get('/me', UserCtrl.checkAuth, catchError(UserCtrl.getMe));
router.get(
  '/statistics',
  UserCtrl.checkAuth,
  catchError(UserCtrl.getUserStatistics)
);

// Edit own profile
router.put(
  '/me',
  UserCtrl.checkAuthGuest,
  s3Upload.single('avatar'),
  catchError(UserCtrl.editMe)
);

// New Password by old one
router.post(
  '/new-password',
  UserCtrl.checkAuth,
  [
    body('old_password').isLength({ min: 5 }),
    body('new_password').isLength({ min: 5 }),
  ],
  catchError(UserCtrl.resetPasswordByOld)
);

router.post(
  '/create-password',
  UserCtrl.checkAuth,
  catchError(UserCtrl.createPassword)
);

// Forgot password
router.post('/forgot-password', catchError(UserCtrl.forgotPassword));

// Rest own profile
router.post('/reset-password', catchError(UserCtrl.resetPasswordByCode));

router.post(
  '/sync-social',
  UserCtrl.checkAuth,
  catchError(UserCtrl.generateSyncSocialLink)
);

// Synchronize with outlook email
router.get(
  '/sync-outlook',
  UserCtrl.checkAuth,
  catchError(UserCtrl.syncOutlook)
);

// Synchronize with gmail
router.get('/sync-gmail', UserCtrl.checkAuth, catchError(UserCtrl.syncGmail));

// Disconnect with gmail
router.get(
  '/discon-email',
  UserCtrl.checkAuth,
  catchError(UserCtrl.disconnectEmail)
);

// Synchronize with yahoo
router.get('/sync-yahoo', UserCtrl.checkAuth, catchError(UserCtrl.syncYahoo));

// Outlook Email authorization
router.get(
  '/authorize-outlook',
  UserCtrl.checkAuth,
  catchError(UserCtrl.authorizeOutlook)
);

// Synchorinze other mailer
router.post(
  '/authorize-mailer',
  UserCtrl.checkAuth,
  catchError(UserCtrl.authorizeOtherEmailer)
);

// Gmail authorized
router.get(
  '/authorize-gmail',
  UserCtrl.checkAuth,
  catchError(UserCtrl.authorizeGmail)
);

// Yahoo authorized
router.get(
  '/authorize-yahoo',
  UserCtrl.checkAuth,
  catchError(UserCtrl.authorizeYahoo)
);

// Zoom authorized
router.get(
  '/authorize-zoom',
  UserCtrl.checkAuth,
  catchError(UserCtrl.authorizeZoom)
);

// Zoom authorized
router.get('/sync-zoom', UserCtrl.checkAuth, catchError(UserCtrl.syncZoom));

/**
 * Calendar
 */

// Synchronize calendar with connected outlook email
router.get(
  '/sync-google-calendar',
  UserCtrl.checkAuth,
  catchError(UserCtrl.syncGoogleCalendar)
);

// Synchronize calendar with connected outlook email
router.get(
  '/sync-outlook-calendar',
  UserCtrl.checkAuth,
  catchError(UserCtrl.syncOutlookCalendar)
);

// Synchronize calendar with connected outlook email
router.get(
  '/authorize-google-calendar',
  UserCtrl.checkAuth,
  catchError(UserCtrl.authorizeGoogleCalendar)
);

// Synchronize calendar with connected outlook email
router.get(
  '/authorize-outlook-calendar',
  UserCtrl.checkAuth,
  catchError(UserCtrl.authorizeOutlookCalendar)
);

// Daily Report
router.get(
  '/daily-report',
  UserCtrl.checkAuth,
  catchError(UserCtrl.dailyReport)
);

// Disconnect Daily Report
router.get(
  '/discon-daily',
  UserCtrl.checkAuth,
  catchError(UserCtrl.disconDaily)
);

// Daily Report
router.get(
  '/weekly-report',
  UserCtrl.checkAuth,
  catchError(UserCtrl.weeklyReport)
);

// Disconnect Weekly Report
router.get(
  '/discon-weekly',
  UserCtrl.checkAuth,
  catchError(UserCtrl.disconWeekly)
);

// Desktop Notification
router.post(
  '/desktop-notification',
  UserCtrl.checkAuth,
  catchError(UserCtrl.desktopNotification)
);

// Text Notification
router.get(
  '/text-notification',
  UserCtrl.checkAuth,
  catchError(UserCtrl.textNotification)
);

// Disconnect Google Calendar
router.post(
  '/discon-calendar',
  UserCtrl.checkAuth,
  catchError(UserCtrl.disconnectCalendar)
);

// Signup Gmail
router.get('/signup-gmail', catchError(UserCtrl.signUpGmail));

// Signup Outlook
router.get('/signup-outlook', catchError(UserCtrl.signUpOutlook));

// Social google profile
router.get('/social-gmail', catchError(UserCtrl.socialGmail));

// Edit outlook profile
router.get('/social-outlook', catchError(UserCtrl.socialOutlook));

// Edit own profile
router.post('/social-login', catchError(UserCtrl.socialLogin));

// Social signup
router.post('/social-signup', catchError(UserCtrl.socialSignUp));

// Social extrension signup
router.post('/social-signup', catchError(UserCtrl.socialExtensionSignup));

router.get('/app-google-signin', catchError(UserCtrl.appGoogleSignIn));

router.get('/app-outlook-signin', catchError(UserCtrl.appOutlookSignIn));

// Extension login
router.post('/extension-login', catchError(UserCtrl.extensionLogin));

// Extension social profile
router.post(
  '/social-extension-login',
  catchError(UserCtrl.socialExtensionLogin)
);

router.post(
  '/extension-upgrade',
  UserCtrl.checkAuthExtension,
  catchError(UserCtrl.extensionUpgrade)
);

// Connect Another Email Service
router.get(
  '/another-con',
  UserCtrl.checkAuth,
  catchError(UserCtrl.connectAnotherEmail)
);

// Search user email
router.post('/search-email', catchError(UserCtrl.searchUserEmail));

// Search nickname
router.post('/search-nickname', catchError(UserCtrl.searchNickName));

// Search Phonenumber
router.post('/search-phone', catchError(UserCtrl.searchPhone));

// update package
router.post(
  '/update-package',
  UserCtrl.checkAuth,
  catchError(UserCtrl.updatePackage)
);
// Schedule a paid demo
router.get(
  '/schedule-demo',
  UserCtrl.checkAuth,
  catchError(UserCtrl.schedulePaidDemo)
);

// Schedule a paid demo
router.get(
  '/scheduled-demo',
  UserCtrl.checkAuth,
  catchError(UserCtrl.scheduledPaidDemo)
);

router.get('/push-notification/:id', catchError(UserCtrl.pushNotification));

// Cancel account
router.post(
  '/cancel-account',
  UserCtrl.checkAuth,
  catchError(UserCtrl.closeAccount)
);

router.get(
  '/sleep-account',
  UserCtrl.checkAuth,
  catchError(UserCtrl.sleepAccount)
);

router.get('/get-call-token', UserCtrl.getCallToken);

router.get(
  '/easy-sub-accounts',
  UserCtrl.checkAuth,
  catchError(UserCtrl.easyLoadSubAccounts)
);

// Get sub accounts
router.get(
  '/sub-accounts',
  UserCtrl.checkAuth,
  catchError(UserCtrl.getSubAccounts)
);

router.post(
  '/sub-account',
  UserCtrl.checkAuth,
  catchError(UserCtrl.createSubAccount)
);

router.get(
  '/builder-token',
  UserCtrl.checkAuth,
  catchError(UserCtrl.generateBuilderToken)
);

router.put(
  '/sub-account/:id',
  UserCtrl.checkAuth,
  catchError(UserCtrl.editSubAccount)
);

router.delete(
  '/sub-account/:id',
  UserCtrl.checkAuth,
  catchError(UserCtrl.removeSubAccount)
);

router.post(
  '/switch-account',
  UserCtrl.checkAuth,
  catchError(UserCtrl.switchAccount)
);

router.post(
  '/recall-account',
  UserCtrl.checkAuth,
  catchError(UserCtrl.recallSubAccount)
);

router.post(
  '/merge-account',
  UserCtrl.checkAuth,
  catchError(UserCtrl.mergeSubAccount)
);

router.post(
  '/buy-account',
  UserCtrl.checkAuth,
  catchError(UserCtrl.buySubAccount)
);

// Edit own profile
router.get('/:id', UserCtrl.checkAuth, catchError(UserCtrl.getUser));

// Get overflow plan status
router.post(
  '/check-downgrade',
  UserCtrl.checkAuth,
  catchError(UserCtrl.checkDowngrade)
);

router.put(
  '/update-draft',
  UserCtrl.checkAuthGuest,
  catchError(UserCtrl.updateDraft)
);

router.post('/contact_us', catchError(UserCtrl.contactUs));

module.exports = router;
