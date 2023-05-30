const Draft = require('../models/draft');

const get = async (req, res) => {
  const { currentUser } = req;

  const query = { ...req.body };
  const data = await Draft.findOne({
    user: currentUser.id,
    ...query,
  });

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const note = new Draft({
    ...req.body,
    user: currentUser.id,
  });

  note
    .save()
    .then((_note) => {
      return res.send({
        status: true,
        data: _note,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;

  await Draft.deleteOne({ user: currentUser._id, _id: id });

  Draft.deleteOne({
    type: 'notes',
    notes: id,
  }).catch((err) => {
    console.log('activity remove err', err.message);
  });

  return res.send({
    status: true,
  });
};

const update = async (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;
  const data = req.body;

  Draft.updateOne({ user: currentUser._id, _id: id }, { $set: data }).catch(
    (err) => {
      console.log('draft update err', err.message);
    }
  );

  return res.send({
    status: true,
  });
};

module.exports = {
  get,
  create,
  remove,
  update,
};
