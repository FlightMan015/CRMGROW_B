const Activity = require('../../models/activity');
const Contact = require('../../models/contact');

const get = async (req, res) => {
  const { currentUser } = req;
  const _activity = await Activity.find({ user: currentUser.id });
  const data = [];

  for (let i = 0; i < _activity.length; i++) {
    const _contacts = await Contact.findOne({ _id: _activity[i].contacts });
    const myJSON = JSON.stringify(_activity[i]);
    const activity = JSON.parse(myJSON);
    delete activity.contacts;
    activity.contacts = _contacts;
    data.push(activity);
  }

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Activity doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const activity = new Activity({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  activity
    .save()
    .then((_res) => {
      const data = _res;
      res.send({
        status: true,
        data,
      });
    })
    .catch((e) => {
      return res.status(500).send({
        status: false,
        error: e,
      });
    });
};

const getByLastActivity = async (req, res) => {
  const { currentUser } = req;
  const contacts = await Contact.find({ user: currentUser.id });

  const data = [];

  for (let i = 0; i < contacts.length; i++) {
    const _activity = await Activity.find({
      user: currentUser.id,
      contacts: contacts[i].id,
    })
      .sort({ _id: -1 })
      .limit(1);
    const myJSON = JSON.stringify(_activity[0]);
    const activity = JSON.parse(myJSON);
    delete activity.contacts;
    activity.contacts = contacts[i];
    data.push(activity);
  }

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Activity doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

module.exports = {
  get,
  create,
  getByLastActivity,
};
