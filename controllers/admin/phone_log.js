const { validationResult } = require('express-validator/check');
const PhoneLog = require('../../models/phone_log');
const Activity = require('../../models/activity');

const get = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.params;
  const data = await PhoneLog.find({ user: currentUser.id, contact });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Phone log doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }

  const phone_log = new PhoneLog({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });
  phone_log
    .save()
    .then((_phone_log) => {
      const activity = new Activity({
        content: `${currentUser.user_name} added phone log`,
        contacts: _phone_log.contact,
        user: currentUser.id,
        type: 'phone_logs',
        phone_logs: _phone_log.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity.save().then((_activity) => {
        const myJSON = JSON.stringify(_phone_log);
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
        console.log('e.errors', e.errors);
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
