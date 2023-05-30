const AWS = require('aws-sdk');
const Note = require('../models/note');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const ActivityHelper = require('../helpers/activity');
const api = require('../config/api');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const get = async (req, res) => {
  const { currentUser } = req;
  const query = { ...req.query };
  const contact = query['contact'];

  const data = await Note.find({ user: currentUser.id, contact });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Note doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const file = req.file;
  let location;
  if (file) {
    location = file.location;
  }

  const note = new Note({
    ...req.body,
    user: currentUser.id,
    audio: location,
  });

  note
    .save()
    .then((_note) => {
      let detail_content = 'added note';
      if (req.guest_loggin) {
        detail_content = ActivityHelper.assistantLog(detail_content);
      }

      const activity = new Activity({
        content: detail_content,
        contacts: _note.contact,
        user: currentUser.id,
        type: 'notes',
        notes: _note.id,
      });

      activity
        .save()
        .then((_activity) => {
          Contact.updateOne(
            { _id: _note.contact },
            { $set: { last_activity: _activity.id } }
          ).catch((err) => {
            console.log('err', err);
          });
        })
        .catch((err) => {
          console.log('err', err);
        });
      const data = { ..._note._doc };
      data.activity = activity;
      res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const bulkCreate = async (req, res) => {
  const { currentUser } = req;
  const file = req.file;
  let location;
  if (file) {
    location = file.location;
  }

  let contacts = [];
  let content = '';
  if (req.body.data) {
    const data = JSON.parse(req.body.data);
    contacts = data.contacts || [];
    content = data.content || '';
  } else {
    contacts = req.body.contacts || [];
    content = req.body.content || '';
  }

  let detail_content = 'added note';
  if (req.guest_loggin) {
    detail_content = ActivityHelper.assistantLog(detail_content);
  }

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    console.log('contact', contact);
    const note = new Note({
      content,
      contact: [contact],
      user: currentUser.id,
      audio: location,
    });

    console.log('note', note);

    note
      .save()
      .then((_note) => {
        const activity = new Activity({
          content: detail_content,
          contacts: _note.contact,
          user: currentUser.id,
          type: 'notes',
          notes: _note.id,
        });

        activity
          .save()
          .then((_activity) => {
            Contact.updateOne(
              { _id: _note.contact },
              {
                $set: { last_activity: _activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
          })
          .catch((err) => {
            return res.status().send({
              status: false,
              error: err,
            });
          });
      })
      .catch((e) => {
        console.log('note creating Error');
      });
  }
  return res.send({
    status: true,
  });
};

/**
 * Delete note
 * @param {*} req: params { id }
 * @param {*} res: Response
 */
const remove = async (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;
  const { contact } = req.body;

  Note.findOne({
    user: currentUser._id,
    _id: id,
  })
    .then(async (_note) => {
      if (!_note) {
        return res.status(400).send({
          status: false,
          error: 'not_found',
        });
      }
      if (_note.audio) {
        removeAudioFromS3(_note.audio);
      }
      await Note.deleteOne({ user: currentUser._id, _id: id });
      await Activity.deleteOne({
        type: 'notes',
        notes: id,
      }).catch((err) => {
        console.log('activity remove err', err.message);
      });

      const last_activities = await ActivityHelper.updateLastActivity([
        contact,
      ]);
      const last_activity = last_activities[0][contact];

      return res.send({
        status: true,
        lastActivity: last_activity,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || err,
      });
    });
};

/**
 * Update the note.
 * @param {*} req: params: { id }, body: { content, audio }, file: audio file s3 location
 * @param {*} res: Response
 * @returns
 */
const update = async (req, res) => {
  const { currentUser, file } = req;
  const id = req.params.id;
  const data = req.body;
  const editData = {};
  if (file) {
    editData['audio'] = file.location;
  }
  editData['content'] = data['content'];

  const note = await Note.findOne({ user: currentUser._id, _id: id }).catch(
    (err) => {
      console.log('not_found_note', err);
    }
  );
  await Note.updateOne({ user: currentUser._id, _id: id }, { $set: editData });
  if (note.audio) {
    removeAudioFromS3(note.audio);
  }

  return res.send({
    status: true,
    data: editData,
  });
};

/**
 * Remove the audio file from s3
 * @param {*} file: audio file path to remove
 */
const removeAudioFromS3 = async (file) => {
  const count = await Note.countDocuments({ audio: file });
  if (!count) {
    // Remove audio file
    const key = file.replace(
      'https://teamgrow.s3.us-east-2.amazonaws.com/',
      ''
    );
    s3.deleteObject(
      {
        Bucket: api.AWS.AWS_S3_BUCKET_NAME,
        Key: key,
      },
      function (err, data) {
        console.log('transcoded video removing error', err);
      }
    );
  }
};

module.exports = {
  get,
  create,
  bulkCreate,
  remove,
  update,
};
