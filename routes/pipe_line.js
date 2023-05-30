const express = require('express');

const UserCtrl = require('../controllers/user');
const PipeLineCtrl = require('../controllers/pipe_line');

const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(PipeLineCtrl.create)
);
router.get('/', UserCtrl.checkAuth, catchError(PipeLineCtrl.get));

router.put('/:id', UserCtrl.checkAuth, catchError(PipeLineCtrl.update));
router.delete('/:id', UserCtrl.checkAuth, catchError(PipeLineCtrl.remove));
router.post(
  '/delete',
  UserCtrl.checkAuth,
  catchError(PipeLineCtrl.deletePipeline)
);

module.exports = router;
