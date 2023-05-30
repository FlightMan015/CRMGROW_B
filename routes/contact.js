const express = require('express');
const fs = require('fs');
const multer = require('multer');
const UserCtrl = require('../controllers/user');
const ContactCtrl = require('../controllers/contact');
const { catchError } = require('../controllers/error');
const { FILES_PATH } = require('../config/path');

const router = express.Router();

const fileStorage = multer.diskStorage({
  destination(req, file, cb) {
    if (!fs.existsSync(FILES_PATH)) {
      fs.mkdirSync(FILES_PATH);
    }
    cb(null, FILES_PATH);
  },
});

const upload = multer({ storage: fileStorage });

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ContactCtrl.create)
);
router.get('/', UserCtrl.checkAuth, catchError(ContactCtrl.getAll));

// Edit contact by id
router.put('/:id', UserCtrl.checkAuth, catchError(ContactCtrl.update));

// Remove contact and its all related info (activity, followup) by id
router.delete('/:id', UserCtrl.checkAuth, catchError(ContactCtrl.remove));

// Remove contacts and their relative info
router.post('/remove', UserCtrl.checkAuth, catchError(ContactCtrl.bulkRemove));

router.post('/lead', catchError(ContactCtrl.leadContact));
router.post(
  '/convrrt-lead',
  UserCtrl.checkConvrrtEvent,
  catchError(ContactCtrl.leadContact)
);
router.post('/interest', catchError(ContactCtrl.interestSubmitContact));
router.post('/interest-submit', catchError(ContactCtrl.interestContact));

// Import contact list as file
router.post(
  '/import-csv',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  upload.single('csv'),
  catchError(ContactCtrl.importCSV)
);

router.post(
  '/import-contacts',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(ContactCtrl.importContacts)
);

router.post(
  '/overwrite-csv',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  upload.single('csv'),
  catchError(ContactCtrl.overwriteCSV)
);

// Download contact list as csv file
router.post(
  '/export-csv',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.exportCSV)
);

// Get a search contact info for profile page
router.post('/search', UserCtrl.checkAuth, catchError(ContactCtrl.search));

// Get a easy search contact info for profile page
router.post(
  '/search-easy',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.searchEasy)
);

// Advanced Search
router.post(
  '/advance-search',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.advanceSearch)
);

router.post(
  '/advance-search/:action',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.advanceSearch)
);

router.post(
  '/search-by-custom',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.additionalFieldSearch)
);
router.post(
  '/field-count',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.additionalFields)
);

// Verify Email
// router.post('/verify-email', catchError(ContactCtrl.verifyEmail));

// Verify Phone number
router.post('/verify-phone', catchError(ContactCtrl.verifyPhone));

// Get contacts by All last activity
router.get(
  '/all',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.getAllByLastActivity)
);

// Get contacts by last activity
router.get(
  '/last',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.getByLastActivity)
);

// Get contacts by last activity
router.post(
  '/last/:id',
  UserCtrl.checkAuth,
  UserCtrl.checkLastLogin,
  catchError(ContactCtrl.getByLastActivity)
);

router.get(
  '/select-all',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.selectAllContacts)
);
// Get a Brokerage data
router.get(
  '/brokerage',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.getBrokerages)
);

// Get Source data
router.get('/sources', UserCtrl.checkAuth, catchError(ContactCtrl.getSources));

// Get City data
router.get('/cities', UserCtrl.checkAuth, catchError(ContactCtrl.getCities));

// Get a Contact data with ID
router.get('/get/:id', UserCtrl.checkAuth, catchError(ContactCtrl.getById));

// Load Duplicated Contacts
router.get(
  '/load-duplication',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.loadDuplication)
);

// Get All Contacts
router.get(
  '/get-all',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.getAllContacts)
);

// Get Contacts data with ID array
router.post('/get', UserCtrl.checkAuth, catchError(ContactCtrl.getByIds));

// Bulk Edit the contacts Label
router.post(
  '/bulk-label',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.bulkEditLabel)
);

// Load Follows
router.post(
  '/follows',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.loadFollows)
);

// Load Timelines
router.post(
  '/timelines',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.loadTimelines)
);

// Bulk Edit(update) the contacts
router.post(
  '/bulk-update',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.bulkUpdate)
);

// Get the Nth Contact
router.get(
  '/nth-get/:id',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.getNthContact)
);

// Check the Email
router.post(
  '/check-email',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.checkEmail)
);
// Check the Phone
router.post(
  '/check-phone',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.checkPhone)
);

// Check the Merge
router.post(
  '/merge',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.mergeContacts)
);

router.post(
  '/bulk-create',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.bulkCreate)
);

router.post(
  '/resubscribe',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.resubscribe)
);

router.post('/filter', UserCtrl.checkAuth, catchError(ContactCtrl.filter));

// Get a contact in team leader's view
router.get(
  '/team-shared/:id',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.getSharedContact)
);

router.post(
  '/contact-merge',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.mergeContact)
);

router.post(
  '/update-contact',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.updateContact)
);

// Share contact
router.post(
  '/share-contact',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.shareContacts)
);

// Stop Share contact
router.post(
  '/stop-share',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.stopShare)
);

router.post(
  '/load-by-emails',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.loadByEmails)
);

router.post(
  '/get-detail/:id',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.getDetail)
);

router.post(
  '/get-activities/:id',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.getActivities)
);

router.post(
  '/remove-task',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.removeFromTask)
);

// Get a pull contact info for profile page
router.post('/:id', UserCtrl.checkAuth, catchError(ContactCtrl.get));

router.get(
  '/load-notes/:id',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.loadNotes)
);

router.get(
  '/get-timeline/:id',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.getTimeline)
);

router.get(
  '/get-tasks/:id',
  UserCtrl.checkAuth,
  catchError(ContactCtrl.getTasks)
);

module.exports = router;
