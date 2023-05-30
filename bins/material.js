const mongoose = require('mongoose');
const Garbage = require('../models/garbage');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => {
    Garbage.find({}).then((_garbages) => {
      _garbages.forEach((_garbage) => {
        const capture_forms = _garbage.capture_forms;
        const user = _garbage.user;
        for (const material in capture_forms) {
          const form = capture_forms[material];
          Video.updateOne(
            { _id: material, user },
            { $set: { capture_form: form, enabled_capture: true } }
          ).then(() => {
            console.log('video update');
          });
          PDF.updateOne(
            { _id: material, user },
            { $set: { capture_form: form, enabled_capture: true } }
          ).then(() => {
            console.log('pdf update');
          });
          Image.updateOne(
            { _id: material, user },
            { $set: { capture_form: form, enabled_capture: true } }
          ).then(() => {
            console.log('image update');
          });
        }
      });
    });
  })
  .catch((err) => console.error('Could not connect to mongo DB', err));
