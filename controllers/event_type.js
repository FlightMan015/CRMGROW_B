const EventType = require('../models/event_type');

const get = async (req, res) => {
  const { currentUser } = req;

  const data = await EventType.findOne({
    user: currentUser.id,
    _id: req.params.id,
  });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Event type doesn`t exist or not permission',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const getAll = async (req, res) => {
  const { currentUser } = req;

  const data = await EventType.find({ user: currentUser.id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'EventType doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const scheduler_info = currentUser.scheduler_info;

  if (scheduler_info && scheduler_info['is_limit']) {
    const scheduler_count = await EventType.countDocuments({
      user: currentUser.id,
    });

    if (scheduler_count >= scheduler_info.max_count) {
      console.log('no error');
      return res.status(412).send({
        status: false,
        error: 'You reach out max scheduler count',
      });
    }
  }

  const event_type = new EventType({
    ...req.body,
    user: currentUser.id,
  });

  event_type
    .save()
    .then((_event_type) => {
      return res.send({
        status: true,
        data: _event_type,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const remove = (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;

  EventType.deleteOne({ user: currentUser._id, _id: id })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

const update = (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;
  const data = req.body;

  EventType.updateOne({ user: currentUser._id, _id: id }, { $set: data })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

const searchByLink = async (req, res) => {
  const { link } = req.body;
  const event_type = await EventType.findOne({ link }).populate(
    'user',
    'user_name picture_profile time_zone_info subscription del'
  );

  if (event_type) {
    const currentUser = event_type.user;
    if (currentUser.del || currentUser.subscription.is_suspended) {
      return res.status(400).json({
        status: false,
        error: `scheduler expired`,
      });
    }
  }

  return res.send({
    status: true,
    data: event_type,
  });
};

module.exports = {
  get,
  getAll,
  create,
  remove,
  update,
  searchByLink,
};
