const express = require('express');
const uuidv1 = require('uuid/v1');
const mime = require('mime-types');
const fs = require('fs');
const multer = require('multer');
const FileCtrl = require('../controllers/file');
const UserCtrl = require('../controllers/user');
const { catchError } = require('../controllers/error');
const { FILES_PATH } = require('../config/path');

const router = express.Router();

const fileStorage = multer.diskStorage({
  destination: function fn(req, file, cb) {
    if (!fs.existsSync(FILES_PATH)) {
      fs.mkdirSync(FILES_PATH);
    }
    cb(null, FILES_PATH);
  },
  filename: (req, file, cb) => {
    cb(null, uuidv1() + '.' + mime.extension(file.mimetype));
  },
});

const upload = multer({ storage: fileStorage });

// Upload a file
router.post(
  '/',
  UserCtrl.checkAuth,
  upload.single('photo'),
  catchError(FileCtrl.create)
);

// Upload attached file
router.post('/upload', upload.single('file'), catchError(FileCtrl.upload));

router.get('/load-all', UserCtrl.checkAuth, catchError(FileCtrl.loadAll));

// Get a file
router.get('/:name', catchError(FileCtrl.get));

// Delete a file
router.delete('/:id', UserCtrl.checkAuth, catchError(FileCtrl.remove));

router.post(
  '/upload_base64',
  UserCtrl.checkAuth,
  catchError(FileCtrl.uploadBase64)
);

module.exports = router;
