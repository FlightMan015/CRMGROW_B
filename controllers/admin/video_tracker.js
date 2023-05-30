const { validationResult } = require('express-validator/check');
const User = require('../../models/user');
const Contact = require('../../models/contact');
const VideoTracker = require('../../models/video_tracker');
const Activity = require('../../models/activity');

const get = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.params;
  const data = await VideoTracker.find({
    user: currentUser.id,
    contact,
  });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Video log doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const query = { ...req.query };
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }

  const video_tracker = new VideoTracker({
    ...req.query,
    updated_at: new Date(),
    created_at: new Date(),
  });

  const currentUser = await User.findOne({ _id: req.query.user });
  const contact = await Contact.findOne({ _id: req.query.contact });
  video_tracker
    .save()

    .then((_video_tracker) => {
      const activity = new Activity({
        content: `${contact.first_name} checked video`,
        contacts: _video_tracker.contact,
        user: currentUser.id,
        type: 'video_trackers',
        video_trackers: _video_tracker.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity.save().then((_activity) => {
        const myJSON = JSON.stringify(_video_tracker);
        const data = JSON.parse(myJSON);
        data.activity = _activity;
        res.send({
          status: true,
          data,
        });
      });
    })
    .catch((e) => {
      let errors;
      if (e.errors) {
        errors = e.errors.map((err) => {
          delete err.instance;
          return err;
        });
      }
      return res.status(500).send({
        status: false,
        error: errors || e,
      });
    });
};

module.exports = {
  get,
  create,
};
