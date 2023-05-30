const crypto = require('crypto');
const User = require('../models/user');
const Guest = require('../models/guest');
const urls = require('../constants/urls');
const system_settings = require('../config/system_settings');
const { sendNotificationEmail } = require('../helpers/email');

const load = async (req, res) => {
  const { currentUser } = req;
  const guests = await Guest.find({ user: currentUser._id }).catch((err) => {
    return res.status(500).send({
      status: false,
      err,
    });
  });
  return res.send({
    status: true,
    data: guests,
  });
};

const get = async (req, res) => {
  const data = await Guest.find({ _id: req.params.id });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Guest find err',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  const { email } = req.body;

  let count = 0;
  let max_upload_count = 0;

  count = Guest.countDocuments({
    user: currentUser.id,
  });

  if (!currentUser.assistant_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable assistant access',
    });
  }

  const exist = await Guest.findOne({ email }).catch((err) => {
    console.log('Guest finding is failed.');
  });
  if (exist) {
    if (exist.user === currentUser._id) {
      return res.status(400).send({
        status: false,
        error: 'There is an assistant with same email already.',
      });
    } else {
      return res.status(400).send({
        status: false,
        error: 'Other user has an assistant with same email already.',
      });
    }
  }

  max_upload_count =
    currentUser.assistant_info.max_count || system_settings.ASSISTANT_LIMIT.PRO;

  if (currentUser.assistant_info['is_limit'] && max_upload_count <= count) {
    return res.status(412).send({
      status: false,
      error: 'Exceed max assistant access',
    });
  }

  const _user = await User.findOne({ email: req.body.email, del: false });

  if (_user) {
    return res.status(400).json({
      status: false,
      error: 'Already existing user',
    });
  }

  const _guest = await Guest.findOne({ email: req.body.email });

  if (_guest) {
    return res.status(400).json({
      status: false,
      error: 'Already existing guest',
    });
  }

  const password = req.body.password;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 512, 'sha512')
    .toString('hex');

  const guest = new Guest({
    ...req.body,
    salt,
    hash,
    user: currentUser.id,
  });

  guest
    .save()
    .then((_res) => {
      const data = {
        template_data: {
          user_name: currentUser.user_name,
          password: req.body.password,
          url: urls.LOGIN_URL,
        },
        template_name: 'CreateAssistant',
        required_reply: false,
        email: _res.email,
      };

      sendNotificationEmail(data)
        .then(() => {
          console.log('assistant invite email has been sent out successfully');
        })
        .catch((err) => {
          console.log('assistant invite email send err', err);
        });

      return res.send({
        status: true,
        data: _res,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message || 'Internal server error',
      });
    });
};

const edit = async (req, res) => {
  const { currentUser } = req;

  const editData = req.body;
  const guest = await Guest.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('err', err.message);
  });

  if (!guest) {
    return res.status(404).send({
      status: false,
      error: 'invalid permission',
    });
  }

  for (const key in editData) {
    guest[key] = editData[key];
  }

  if (editData['password']) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(editData['password'], salt, 10000, 512, 'sha512')
      .toString('hex');
    guest['salt'] = salt;
    guest['hash'] = hash;
  }

  guest
    .save()
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message || 'Internal server error',
      });
    });
};

const remove = async (req, res) => {
  const { currentUser } = req;

  const _id = req.params.id;
  await Guest.deleteOne({ _id, user: currentUser.id }).catch((err) => {
    console.log('err', err.message);
  });
  return res.send({
    status: true,
  });
};

module.exports = {
  load,
  get,
  create,
  edit,
  remove,
};
