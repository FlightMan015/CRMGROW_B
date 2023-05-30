const express = require('express');

const UserCtrl = require('../controllers/user');
const NotificationCtrl = require('../controllers/notification');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(NotificationCtrl.create));
router.get('/', UserCtrl.checkAuth, catchError(NotificationCtrl.get));
router.get(
  '/get-delivery',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.getDelivery)
);
router.post(
  '/bulk-read',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.bulkRead)
);
router.post(
  '/bulk-unread',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.bulkUnread)
);
router.post(
  '/bulk-remove',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.bulkRemove)
);

router.post(
  '/queue-task',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.loadQueueTask)
);

router.post(
  '/remove-email-task',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.removeEmailTask)
);

router.post(
  '/remove-email-contact',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.removeEmailContact)
);

router.post(
  '/load-queue-contact',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.loadEmailQueueContacts)
);

router.post(
  '/load-task-contact',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.loadEmailTaskContacts)
);

router.get(
  '/list/:page',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.getPage)
);
router.get(
  '/load/all',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.getAll)
);

router.get(
  '/load/:skip',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.loadNotifications)
);

router.get(
  '/status',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.getStatus)
);

router.post(
  '/make-notification',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.makeNotification)
);

router.get(
  '/check-task-count',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.checkTaskCount)
);

router.get(
  '/queue/texts',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.loadTextQueues)
);

router.get(
  '/queue/emails',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.loadEmailQueues)
);

router.get(
  '/queue/automations',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.loadAutomationQueues)
);

router.put(
  '/update-task/:id',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.updateTaskQueue)
);

router.post(
  '/reschedule-task',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.rescheduleTaskQueue)
);

router.post(
  '/update-task-status',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.updateTaskQueueStatus)
);

router.get(
  '/unread-texts',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.loadUnreadTexts)
);

router.get(
  '/all-tasks',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.loadTasks)
);

router.get(
  '/unread-count',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.loadUnreadCount)
);

router.get(
  '/remove-task/:id',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.removeTask)
);

module.exports = router;
