const Garbage = require('../models/garbage');
const Contact = require('../models/contact');
const Template = require('../models/email_template');
const Task = require('../models/task');
const { removeFile } = require('../helpers/fileUpload');
const urls = require('../constants/urls');
const system_settings = require('../config/system_settings');

const get = async (req, res) => {
  const data = await Garbage.find({ _id: req.params.id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Garbage doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const garbage = new Garbage({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });
  garbage
    .save()
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message || 'Internal server error',
      });
    });
};

const edit = async (req, res) => {
  const user = req.currentUser;

  if (user && !user.capture_enabled) {
    return res.status(412).json({
      status: false,
      error: 'Disable Lead capture.',
    });
  }

  const editData = req.body;
  delete editData['_id'];
  const garbage = await Garbage.findOne({ user: user._id });
  if (!garbage) {
    const newGarbage = new Garbage({
      ...editData,
      user: user._id,
    });

    newGarbage
      .save()
      .then(() => {
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err.message);
        return res.status(500).json({
          status: false,
          error: err.message || 'Internal server error',
        });
      });
  } else {
    for (const key in editData) {
      if (key === 'additional_fields') {
        let oldField = '';
        let newField = '';
        garbage[key].forEach((oldData, i) => {
          if (
            editData[key][i] &&
            editData[key][i].name &&
            oldData.name !== editData[key][i].name
          ) {
            oldField = garbage[key][i].name;
            newField = editData[key][i].name;
          }
        });
        const contacts = await Contact.find({ user: user._id });
        contacts.forEach((e) => {
          if (e.additional_field !== undefined) {
            const additionalData = {};
            Object.keys(e.additional_field).forEach((fKey) => {
              if (fKey === oldField) {
                if (newField !== '')
                  additionalData[newField] = e.additional_field[fKey];
              } else {
                additionalData[fKey] = e.additional_field[fKey];
              }
            });
            Contact.updateOne(
              { _id: e._id },
              {
                $set: { additional_field: additionalData },
              }
            ).catch((err) => {
              console.log('err', err);
            });
          }
        });
      }
      garbage[key] = editData[key];
    }

    garbage
      .save()
      .then(() => {
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(500).json({
          status: false,
          error: err.message || 'Internal server error',
        });
      });
  }
};

const uploadIntroVideo = async (req, res) => {
  const { currentUser } = req;
  const introVideoObject = req.file;
  const introVideo = introVideoObject.location;
  try {
    const currentGarbage = await Garbage.findOne({ user: currentUser._id });
    if (currentGarbage) {
      if (currentGarbage.intro_video) {
        try {
          const key = currentGarbage.intro_video.slice(
            urls.STORAGE_BASE.length + 1
          );
          await removeFile(key);
        } catch (err) {
          console.log('Remove the Intro Video: ', err);
        }
      }
      currentGarbage.intro_video = introVideo;
      Garbage.updateOne(
        { user: currentUser._id },
        { $set: { intro_video: introVideo } }
      )
        .then(() => {
          return res.send({
            status: true,
            data: { intro_video: introVideo },
          });
        })
        .catch((err) => {
          return res.status(500).send({
            status: false,
            data: err.message,
          });
        });
    } else {
      const newGarbage = new Garbage({
        intro_video: introVideo,
        user: currentUser._id,
      });
      newGarbage.save().then((_garbage) => {
        return res.send({
          status: true,
          data: _garbage,
        });
      });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ status: false, error: err.message || 'Internal server error' });
  }
};

const loadDefaults = async (req, res) => {
  const { currentUser } = req;
  const currentGarbage = await Garbage.findOne({ user: currentUser._id });
  if (!currentGarbage) {
    return res.send({
      status: true,
      data: {
        email: null,
        sms: null,
      },
    });
  }
  let defaultEmail;
  let defaultSms;
  if (
    currentGarbage &&
    currentGarbage['canned_message'] &&
    currentGarbage['canned_message']['email']
  ) {
    defaultEmail = await Template.findOne({
      _id: currentGarbage['canned_message']['email'],
    });
  }
  if (
    currentGarbage &&
    currentGarbage['canned_message'] &&
    currentGarbage['canned_message']['sms']
  ) {
    defaultSms = await Template.findOne({
      _id: currentGarbage['canned_message']['sms'],
    });
  }
  return res.send({
    status: true,
    data: {
      email: defaultEmail,
      sms: defaultSms,
    },
  });
};

const terminateAutoSetting = async (req, res) => {
  const { currentUser } = req;
  const { auto_setting } = req.body;
  switch (auto_setting) {
    case 'auto_follow_up2': {
      Task.deleteMany({
        user: currentUser.id,
        type: 'auto_follow_up2',
      }).catch((err) => {
        console.log('task delete err', err.message);
      });
      break;
    }
    case 'auto_resend1': {
      Task.deleteMany({
        user: currentUser.id,
        type: { $in: ['resend_email_video1', 'resend_text_video1'] },
      }).catch((err) => {
        console.log('task delete err', err.message);
      });
      break;
    }
    case 'auto_resend2': {
      Task.deleteMany({
        user: currentUser.id,
        type: { $in: ['resend_email_video2', 'resend_text_video2'] },
      }).catch((err) => {
        console.log('task delete err', err.message);
      });
      break;
    }
  }
};

module.exports = {
  get,
  create,
  edit,
  uploadIntroVideo,
  loadDefaults,
  terminateAutoSetting,
};
