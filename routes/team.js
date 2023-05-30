const express = require('express');

const UserCtrl = require('../controllers/user');
const TeamCtrl = require('../controllers/team');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(TeamCtrl.create));
router.get('/load', UserCtrl.checkAuth, catchError(TeamCtrl.getAll));
router.get(
  '/load-leaders',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getLeaders)
);
router.get(
  '/load-invited',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getInvitedTeam)
);
router.get(
  '/load-requested',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getRequestedTeam)
);
router.post(
  '/get-all',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getAllSharedContacts)
);

router.get('/user/:id', UserCtrl.checkAuth, catchError(TeamCtrl.getTeam));
router.post(
  '/request',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(TeamCtrl.requestTeam)
);

router.post(
  '/cancel-request/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.cancelRequest)
);

router.post(
  '/bulk-invite/:id',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(TeamCtrl.bulkInvites)
);

router.post(
  '/cancel-invite/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.cancelInvite)
);

router.post(
  '/accept/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.acceptInviation)
);

router.post(
  '/decline/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.declineInviation)
);

router.post(
  '/admin-accept',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.acceptRequest)
);

router.post(
  '/admin-decline',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.declineRequest)
);

// router.post(
//   '/share-videos',
//   UserCtrl.checkAuth,
//   catchError(TeamCtrl.shareVideos)
// );
// router.post('/share-pdfs', UserCtrl.checkAuth, catchError(TeamCtrl.sharePdfs));
// router.post(
//   '/share-images',
//   UserCtrl.checkAuth,
//   catchError(TeamCtrl.shareImages)
// );
router.post(
  '/share-materials',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.shareMaterials)
);

router.post(
  '/share-team-materials',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.shareTeamMaterials)
);

router.post(
  '/share-automations',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.shareAutomations)
);
router.post(
  '/share-templates',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.shareEmailTemplates)
);

router.post(
  '/remove-videos/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removeVideos)
);
router.post(
  '/remove-pdfs/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removePdfs)
);
router.post(
  '/remove-images/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removeImages)
);
router.post(
  '/remove-folder/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removeFolders)
);
router.post(
  '/remove-templates/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removeEmailTemplates)
);
router.post(
  '/remove-automations/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removeAutomations)
);
router.post(
  '/search-team',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.searchTeam)
);
router.post('/update', UserCtrl.checkAuth, catchError(TeamCtrl.updateTeam));

router.post(
  '/shared-contacts',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getSharedContacts)
);

router.post(
  '/search-contact',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.searchContact)
);

router.post(
  '/share-folders',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.shareFolders)
);

router.post(
  '/unshare-folders',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.unshareFolders)
);

router.post(
  '/unshare-templates',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.unshareTemplates)
);

router.post(
  '/unshare-automations',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.unshareAutomations)
);

router.post(
  '/unshare-materials',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.unshareMaterials)
);

router.post(
  '/shared-teams',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.loadSharedTeams)
);

router.post('/stop-share', UserCtrl.checkAuth, catchError(TeamCtrl.stopShare));

router.get(
  '/material/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.loadMaterial)
);
router.get(
  '/automation/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.loadAutomation)
);
router.get(
  '/template/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.loadTemplate)
);
router.put('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.update));
router.get('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.get));
router.delete('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.remove));

module.exports = router;
