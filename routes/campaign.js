const express = require('express');

const UserCtrl = require('../controllers/user');
const CampaignCtrl = require('../controllers/campaign');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(CampaignCtrl.create)
);

router.get('/', UserCtrl.checkAuth, catchError(CampaignCtrl.getAll));
router.get(
  '/await-campaign',
  UserCtrl.checkAuth,
  catchError(CampaignCtrl.getAwaitingCampaigns)
);

router.get(
  '/day-status',
  UserCtrl.checkAuth,
  catchError(CampaignCtrl.getDayStatus)
);

router.get('/:id', UserCtrl.checkAuth, catchError(CampaignCtrl.get));

router.put('/:id', UserCtrl.checkAuth, catchError(CampaignCtrl.update));

router.post(
  '/sessions',
  UserCtrl.checkAuth,
  catchError(CampaignCtrl.loadSessions)
);

router.post(
  '/activities',
  UserCtrl.checkAuth,
  catchError(CampaignCtrl.loadActivities)
);

router.post(
  '/remove-session',
  UserCtrl.checkAuth,
  catchError(CampaignCtrl.removeSession)
);

router.post(
  '/remove-contact',
  UserCtrl.checkAuth,
  catchError(CampaignCtrl.removeContact)
);

router.post('/publish', UserCtrl.checkAuth, catchError(CampaignCtrl.publish));

router.post(
  '/save-draft',
  UserCtrl.checkAuth,
  catchError(CampaignCtrl.saveDraft)
);

router.post('/remove', UserCtrl.checkAuth, catchError(CampaignCtrl.remove));

router.post(
  '/load-draft',
  UserCtrl.checkAuth,
  catchError(CampaignCtrl.loadDraft)
);

router.post(
  '/load-contacts',
  UserCtrl.checkAuth,
  catchError(CampaignCtrl.loadDraftContacts)
);

module.exports = router;
