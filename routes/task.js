const express = require('express');

const UserCtrl = require('../controllers/user');
const TaskCtrl = require('../controllers/task');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(TaskCtrl.create)
);
router.get('/', UserCtrl.checkAuth, catchError(TaskCtrl.get));
router.get(
  '/mass-tasks',
  UserCtrl.checkAuth,
  catchError(TaskCtrl.getMassTasks)
);
router.post(
  '/create',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(TaskCtrl.bulkCreate)
);
router.put('/:id', UserCtrl.checkAuth, catchError(TaskCtrl.update));
router.delete('/:id', UserCtrl.checkAuth, catchError(TaskCtrl.remove));

module.exports = router;
