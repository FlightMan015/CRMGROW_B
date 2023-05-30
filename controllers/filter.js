const Filter = require('../models/filter');

const create = async (req, res) => {
  const { currentUser } = req;

  const filter = new Filter({
    ...req.body,
    user: currentUser.id,
  });

  try {
    const newFilter = await filter.save();
    return res.send({ status: true, data: newFilter });
  } catch (err) {
    return res.status(500).send({
      status: false,
      error: err.message || 'Filter creating failed.',
    });
  }
};

const getAll = async (req, res) => {
  const { currentUser } = req;

  const data = await Filter.find({
    user: currentUser.id,
  });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Saved filter doesn`t exist',
    });
  } else {
    return res.send({
      status: true,
      data,
    });
  }
};

const update = async (req, res) => {
  const data = req.body;
  const { currentUser } = req;
  Filter.updateOne(
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
        error: err.message || 'Filter Update Error',
      });
    });
};

const remove = (req, res) => {
  const { currentUser } = req;

  Filter.deleteOne({
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
        error: err.message || 'Filter Delete Error',
      });
    });
};

module.exports = {
  create,
  getAll,
  update,
  remove,
};
