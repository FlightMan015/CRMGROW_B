const { validationResult } = require('express-validator/check');
const Tag = require('../../models/tag');

const get = async (req, res) => {
  const { currentUser } = req;
  const data = await Tag.find({ user: currentUser.id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Tag doesn`t exist',
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

  const tag = new Tag({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });
  console.log('req.body', req.body);
  tag
    .save()
    .then((_res) => {
      const data = _res;
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

module.exports = {
  get,
  create,
};
