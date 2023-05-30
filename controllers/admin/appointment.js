const Appointment = require('../../models/appointment');
const Activity = require('../../models/activity');
const Contact = require('../../models/contact');

const get = async (req, res) => {
  const { currentUser } = req;
  const data = await Appointment.find({ user: currentUser.id });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Appointment doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const appointment = new Appointment({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  appointment
    .save()
    .then((_appointment) => {
      const activity = new Activity({
        content: `${currentUser.user_name} added appointment`,
        contacts: _appointment.contact,
        appointments: _appointment.id,
        user: currentUser.id,
        type: 'appointments',
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity.save().then((_activity) => {
        Contact.findByIdAndUpdate(_appointment.contact, {
          $set: { last_activity: activity.id },
        }).catch((err) => {
          console.log('err', err);
        });
        const myJSON = JSON.stringify(_appointment);
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

const edit = async (req, res) => {
  const { currentUser } = req;
  const editData = req.body;
  const appointment = await Appointment.find({
    user: currentUser.id,
    _id: req.params.id,
  });

  if (!editData) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }

  for (const key in editData) {
    appointment[key] = editData[key];
  }

  appointment.updated_at = new Date();

  appointment.save().then((_appointment) => {
    res.send({
      status: true,
      data: _appointment,
    });
  });
};

module.exports = {
  get,
  create,
  edit,
};
