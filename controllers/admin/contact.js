const { validationResult } = require('express-validator/check');
const sgMail = require('@sendgrid/mail');
const Contact = require('../../models/contact');
const Activity = require('../../models/activity');
const FollowUp = require('../../models/follow_up');
const Appointment = require('../../models/appointment');
const api = require('../../config/api');

const getAll = async (req, res) => {
  const { currentUser } = req;
  const data = await Contact.find({ user: currentUser.id });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Contact doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const get = async (req, res) => {
  const { currentUser } = req;
  const _contact = await Contact.findOne({
    user: currentUser.id,
    _id: req.params.id,
  });

  if (!_contact) {
    return res.status(400).json({
      status: false,
      error: 'Contact doesn`t exist',
    });
  }

  const _follow_up = await FollowUp.find({
    user: currentUser.id,
    contact: req.params.id,
  }).sort({ due_date: 1 });
  const _activity_list = await Activity.find({
    user: currentUser.id,
    contacts: req.params.id,
  });
  const _activity_detail_list = [];

  for (let i = 0; i < _activity_list.length; i++) {
    const _activity_detail = await Activity.aggregate([
      {
        $lookup: {
          from: _activity_list[i].type,
          localField: _activity_list[i].type,
          foreignField: '_id',
          as: 'activity_detail',
        },
      },
      {
        $match: { _id: _activity_list[i]._id },
      },
    ]);

    _activity_detail_list.push(_activity_detail[0]);
  }

  const myJSON = JSON.stringify(_contact);
  const contact = JSON.parse(myJSON);
  const data = await Object.assign(
    contact,
    { follow_up: _follow_up },
    { activity: _activity_detail_list }
  );

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const contact = new Contact({
    ...req.body,
    user: currentUser.id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  contact
    .save()
    .then((_contact) => {
      const activity = new Activity({
        content: `${currentUser.user_name} added contact`,
        contacts: _contact.id,
        user: currentUser.id,
        type: 'contacts',
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity.save().then((_activity) => {
        const myJSON = JSON.stringify(_contact);
        const data = JSON.parse(myJSON);
        data.activity = _activity;
        res.send({
          status: true,
          data,
        });
      });
    })
    .catch((e) => {
      console.log(e);
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

const remove = async (req, res) => {
  const { currentUser } = req;
  const data = await Contact.findOne({
    user: currentUser.id,
    _id: req.params.id,
  });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }

  await Contact.deleteOne({ _id: req.params.id });
  await Activity.deleteMany({ contacts: req.params.id });
  await FollowUp.deleteMany({ contact: req.params.id });
  await Appointment.deleteMany({ contact: req.params.id });
};

const edit = async (req, res) => {
  const { currentUser } = req;
  const editData = req.body;
  const contact = await Contact.findOne({
    user: currentUser.id,
    _id: req.params.id,
  });

  if (!contact) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }

  for (const key in editData) {
    contact[key] = editData[key];
  }

  contact.updated_at = new Date();

  contact
    .save()
    .then((_res) => {
      const myJSON = JSON.stringify(_res);
      const data = JSON.parse(myJSON);
      delete data.password;
      res.send({
        status: true,
        data,
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

const sendBatch = async (req, res) => {
  sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

  const { currentUser } = req;
  const { email_list, subject, content } = req.body;
  const promisall = [];

  email_list.forEach((email) => {
    const msg = {
      to: email,
      from: currentUser.email,
      subject,
      text: content,
      html: content,
    };

    // Send msg to each email
    promisall.push(
      new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then((res) => {
            console.log('mailres.errorcode', res[0].statusCode);
            if (res[0].statusCode >= 200 && res[0].statusCode < 400) {
              resolve(`Successful send to ${msg.to}`);
            } else {
              reject(res[0].statusCode);
            }
          })
          .catch((error) => {
            reject(error);
          });
      })
    );
  });

  Promise.all(promisall)
    .then((data) => {
      res.send({
        status: true,
        data,
      });
    })
    .catch((e) => {
      console.log(e);
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
  getAll,
  get,
  create,
  remove,
  edit,
  sendBatch,
};
