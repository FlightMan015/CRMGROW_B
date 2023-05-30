const { validationResult } = require('express-validator/check');
const User = require('../../models/user');
const Contact = require('../../models/contact');
const PDFTracker = require('../../models/pdf_tracker');
const Activity = require('../../models/activity');

const get = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.params;
  const data = await PDFTracker.find({
    user: currentUser.id,
    contact,
  });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'PDF log doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const query = { ...req.query };
  console.log('req.query', query);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }

  const pdf_tracker = new PDFTracker({
    ...req.query,
    updated_at: new Date(),
    created_at: new Date(),
  });

  const currentUser = await User.findOne({ _id: req.query.user });
  const contact = await Contact.findOne({ _id: req.query.contact });
  pdf_tracker
    .save()

    .then((_pdf_tracker) => {
      const activity = new Activity({
        content: `${contact.first_name} reviewed pdf`,
        contacts: _pdf_tracker.contact,
        user: currentUser.id,
        type: 'pdf_trackers',
        pdf_trackers: _pdf_tracker.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity.save().then((_activity) => {
        const myJSON = JSON.stringify(_pdf_tracker);
        const data = JSON.parse(myJSON);
        data.activity = _activity;
        res.send({
          status: true,
          data,
        });
      });
    })
    .catch((e) => {
      return res.status(500).send({
        status: false,
        error: e,
      });
    });
};

module.exports = {
  get,
  create,
};
