const Label = require('../models/label');
const garbageHelper = require('../helpers/garbage');
const mongoose = require('mongoose');
const Contact = require('../models/contact');
const system_settings = require('../config/system_settings');

const create = async (req, res) => {
  const { currentUser } = req;

  const label = new Label({
    ...req.body,
    user: currentUser.id,
  });

  try {
    const newLabel = await label.save();
    return res.send({ status: true, data: newLabel });
  } catch (err) {
    return res.status(500).send({
      status: false,
      error: err.message || 'Label creating failed.',
    });
  }
};

const bulkCreate = async (req, res) => {
  const { currentUser } = req;

  const { labels } = req.body;
  const promise_array = [];

  if (labels.length > system_settings.LABEL_LIMIT) {
    return res.status(400).json({
      status: false,
      error: 'Label max limit',
    });
  }

  for (let i = 0; i < labels.length; i++) {
    let promise;
    const _label = await Label.findOne({
      name: labels[i],
      $or: [
        {
          user: currentUser.id,
        },
        {
          role: 'admin',
        },
      ],
    });

    if (!_label) {
      const label = new Label({
        name: labels[i],
        user: currentUser.id,
      });

      promise = new Promise(async (resolve) => {
        const new_label = await label.save().catch((err) => {
          console.log('label save err', err.message);
        });
        resolve(new_label);
      });
    } else {
      promise = new Promise((resolve) => {
        resolve(_label);
      });
    }
    promise_array.push(promise);
  }

  Promise.all(promise_array)
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(500).json({
        status: false,
      });
    });
};

const getAll = async (req, res) => {
  const { currentUser } = req;

  const garbage = await garbageHelper.get(currentUser);

  if (!garbage) {
    return res.status(400).send({
      status: false,
      error: `Couldn't get the Garbage`,
    });
  }

  let editedLabels = [];
  if (garbage && garbage['edited_label']) {
    editedLabels = garbage['edited_label'];
  }

  const company = currentUser.company || 'eXp Realty';
  const _label_list = await Label.find({
    user: currentUser.id,
  }).sort({ priority: -1 });

  const _label_admin = await Label.find({
    role: 'admin',
    _id: { $nin: editedLabels },
  }).sort({ priority: 1 });

  Array.prototype.push.apply(_label_list, _label_admin);

  if (!_label_list) {
    return res.status(400).json({
      status: false,
      error: 'Label doesn`t exist',
    });
  }

  res.send({
    status: true,
    data: _label_list,
  });
};

const getSharedAll = async (req, res) => {
  const { currentUser } = req;

  const _contacts = await Contact.find({
    shared_members: currentUser.id,
    user: { $nin: currentUser.id },
  });

  const _users = _contacts.map((e) => e.user[0]);
  console.log('_users', _users);

  const _label_list = await Label.find({ user: { $in: _users } });

  res.send({
    status: true,
    data: _label_list,
  });
};

const update = async (req, res) => {
  const data = req.body;
  const { currentUser } = req;
  Label.updateOne(
    {
      _id: req.params.id,
      user: currentUser.id,
    },
    { $set: data }
  )
    .then(() => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(500).json({
        status: false,
        error: err.message || 'Label Update Error',
      });
    });
};

const remove = (req, res) => {
  const { currentUser } = req;

  Label.deleteOne({
    _id: req.params.id,
    user: currentUser.id,
  })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Label Delete Error',
      });
    });
};

const changeOrder = async (req, res) => {
  const { data } = req.body;
  const { currentUser } = req;

  for (let i = 0; i < data.length; i++) {
    await Label.updateOne(
      { _id: data[i]._id, user: currentUser._id },
      { $set: { priority: i } }
    );
  }

  return res.send({
    status: true,
  });
};

const getLabelDetails = async (req, res) => {
  const { currentUser } = req;
  const { label, page, pageSize, searchStr } = req.body;
  const search = searchStr.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  const data = await Contact.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(currentUser.id),
        label: mongoose.Types.ObjectId(label),
        $or: [
          {
            first_name: {
              $regex: search,
              $options: 'i',
            },
          },
          {
            last_name: {
              $regex: search,
              $options: 'i',
            },
          },
        ],
      },
    },
    {
      $skip: (page - 1) * pageSize,
    },
    {
      $limit: pageSize,
    },
    {
      $sort: { first_name: 1 },
    },
    {
      $project: { first_name: 1, last_name: 1, _id: 1 },
    },
  ]);
  const total = await Contact.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(currentUser.id),
        label: mongoose.Types.ObjectId(label),
        $or: [
          {
            first_name: {
              $regex: search,
              $options: 'i',
            },
          },
          {
            last_name: {
              $regex: search,
              $options: 'i',
            },
          },
        ],
      },
    }
  ]);

  res.send({
    status: true,
    data,
    total: total.length,
  });
};

const loadLabels = async (req, res) => {
  const { currentUser } = req;

  const data = await Contact.aggregate([
    {
      $match: { user: mongoose.Types.ObjectId(currentUser.id) },
    },
    {
      $group: {
        _id: '$label',
        count: { $sum: 1 },
      },
    },
  ]);
  // Add 'No tags' tag to last element.( set id to -1 )
  res.send({
    status: true,
    data,
  });
};

const getContactLabel = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.body;
  const garbage = await garbageHelper.get(contact);

  if (!garbage) {
    return res.status(400).send({
      status: false,
      error: `Couldn't get the Garbage of contact`,
    });
  }

  let editedLabels = [];
  if (garbage && garbage['edited_label']) {
    editedLabels = garbage['edited_label'];
  }

  const company = currentUser.company || 'eXp Realty';
  const _label_list = await Label.find({
    user: currentUser.id,
  }).sort({ priority: -1 });

  const _label_admin = await Label.find({
    role: 'admin',
    _id: { $nin: editedLabels },
  }).sort({ priority: 1 });

  Array.prototype.push.apply(_label_list, _label_admin);

  if (!_label_list) {
    return res.status(400).json({
      status: false,
      error: 'Label doesn`t exist of contact',
    });
  } else {
    res.send({
      status: true,
      data: _label_list,
    });
  }
};

module.exports = {
  create,
  bulkCreate,
  getAll,
  update,
  remove,
  changeOrder,
  getLabelDetails,
  loadLabels,
  getSharedAll,
  getContactLabel,
};
