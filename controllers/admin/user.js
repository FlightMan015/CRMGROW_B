const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator/check');
const moment = require('moment-timezone');

const User = require('../../models/user');
const Garbage = require('../../models/garbage');
const Payment = require('../../models/payment');
const Contact = require('../../models/contact');
const Tag = require('../../models/tag');
const Appointment = require('../../models/appointment');
const Activity = require('../../models/activity');
const Reminder = require('../../models/reminder');
const FollowUp = require('../../models/follow_up');
const TimeLine = require('../../models/time_line');
const Team = require('../../models/team');
const Notification = require('../../models/notification');
const Task = require('../../models/task');

const {
  cancelCustomer,
  cancelSubscription,
  updateSubscription,
} = require('../payment');
const { removeMaterials } = require('../../helpers/material');

const api = require('../../config/api');
const system_settings = require('../../config/system_settings');
const urls = require('../../constants/urls');

const mail_contents = require('../../constants/mail_contents');
const { releaseSignalWireNumber } = require('../../helpers/text');
const { sendNotificationEmail } = require('../../helpers/email');
const {
  setPackage,
  addOnboard,
  addAdmin,
  clearAccount,
} = require('../../helpers/user');

const signUp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }

  const { password } = req.body;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 512, 'sha512')
    .toString('hex');
  const user = new User({
    ...req.body,
    salt,
    hash,
    role: 'admin',
  });

  user
    .save()
    .then((_res) => {
      const myJSON = JSON.stringify(_res);
      const data = JSON.parse(myJSON);
      delete data.hash;
      delete data.salt;
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

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(401).json({
      status: false,
      error: errors.array(),
    });
  }

  const { email, password, user_name } = req.body;
  if (!email && !user_name) {
    return res.status(401).json({
      status: false,
      error: 'missing_email_user_name',
    });
  }

  let _user = await User.findOne({ email, role: 'admin' }).exec();

  if (!_user) {
    _user = await User.findOne({ user_name, role: 'admin' }).exec();
  }

  if (!_user) {
    return res.status(401).json({
      status: false,
      error: 'Invalid email or password!',
    });
  }

  // Check password
  const hash = crypto
    .pbkdf2Sync(password, _user.salt, 10000, 512, 'sha512')
    .toString('hex');
  if (hash !== _user.hash) {
    return res.status(401).json({
      status: false,
      error: 'Invalid email or password!',
    });
  }

  // TODO: Include only email for now
  const token = jwt.sign({ id: _user.id }, api.JWT_SECRET, {
    expiresIn: '30d',
  });
  const myJSON = JSON.stringify(_user);
  const user = JSON.parse(myJSON);
  delete user.hash;
  delete user.salt;

  // prevent user's password to be returned
  delete user.password;
  return res.send({
    status: true,
    data: {
      token,
      user,
    },
  });
};

const editMe = async (req, res) => {
  const user = req.currentUser;

  const editData = req.body;
  // TODO: should limit the editing fields here
  delete editData.password;

  for (const key in editData) {
    user[key] = editData[key];
  }

  user
    .save()
    .then((_res) => {
      const myJSON = JSON.stringify(_res);
      const data = JSON.parse(myJSON);
      delete data.hash;
      delete data.salt;
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

const getAll = async (req, res) => {
  const { page } = req.params;
  const search = { ...req.body };
  const skip = (page - 1) * 15;
  const _users = await User.find({
    $and: [
      {
        $or: [
          { user_name: { $regex: `.*${search.search}.*`, $options: 'i' } },
          { email: { $regex: `.*${search.search}.*`, $options: 'i' } },
          {
            cell_phone: { $regex: `.*${search.search}.*`, $options: 'i' },
          },
        ],
      },
      {
        del: false,
      },
    ],
  })
    .skip(skip)
    .limit(15)
    .select({ salt: 0, hash: 0 })
    .populate('payment');
  const total = await User.countDocuments({
    $and: [
      {
        $or: [
          { user_name: { $regex: `.*${search.search}.*`, $options: 'i' } },
          { email: { $regex: `.*${search.search}.*`, $options: 'i' } },
          {
            cell_phone: { $regex: `.*${search.search}.*`, $options: 'i' },
          },
        ],
      },
      {
        del: false,
      },
    ],
  });
  if (!_users) {
    return res.status(400).json({
      status: false,
      error: 'Users doesn`t exist',
    });
  }
  return res.send({
    status: true,
    data: _users,
    total,
  });
};

const disableUsers = async (req, res) => {
  const { page } = req.params;
  const search = { ...req.body };
  const skip = (page - 1) * 15;
  const _users = await User.find({
    $and: [
      {
        $or: [
          { user_name: { $regex: `.*${search.search}.*`, $options: 'i' } },
          { email: { $regex: `.*${search.search}.*`, $options: 'i' } },
          {
            cell_phone: { $regex: `.*${search.search}.*`, $options: 'i' },
          },
        ],
      },
      {
        del: true,
      },
    ],
  })
    .skip(skip)
    .limit(15)
    .select({ salt: 0, hash: 0 })
    .populate('payment');

  const total = await User.countDocuments({
    $and: [
      {
        $or: [
          { user_name: { $regex: `.*${search.search}.*`, $options: 'i' } },
          { email: { $regex: `.*${search.search}.*`, $options: 'i' } },
          {
            cell_phone: { $regex: `.*${search.search}.*`, $options: 'i' },
          },
        ],
      },
      {
        del: true,
      },
    ],
  });
  if (!_users) {
    return res.status(400).json({
      status: false,
      error: 'Users doesn`t exist',
    });
  }
  return res.send({
    status: true,
    data: _users,
    total,
  });
};

const exportUsers = async (req, res) => {
  const { ids } = req.body;
  let _users;
  if (ids && ids.length) {
    _users = await User.find({
      _id: { $in: ids },
      del: true,
    }).select({
      email: true,
      user_name: true,
      cell_phone: true,
      learn_more: true,
      twilio_number: true,
      location: true,
    });
  } else {
    _users = await User.find({
      del: true,
    }).select({
      email: true,
      user_name: true,
      cell_phone: true,
      learn_more: true,
      twilio_number: true,
      location: true,
    });
  }
  if (!_users) {
    return res.status(400).json({
      status: false,
      error: 'Users doesn`t exist',
    });
  }
  return res.send({
    status: true,
    data: _users,
  });
};

const getProfile = async (req, res) => {
  const { id } = req.params;
  const user = await User.findOne({ _id: id })
    .populate('payment')
    .catch((err) => {
      return res.status(400).json({
        status: false,
        error: 'User doesn`t exist',
      });
    });

  res.send({
    status: true,
    data: user,
  });
};

const checkAuth = async (req, res, next) => {
  const token = req.get('Authorization');
  let decoded;
  try {
    decoded = jwt.verify(token, api.JWT_SECRET);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.info('Auth Success:', decoded);
  } catch (err) {
    console.error(err);
    return res.status(401).send({
      status: false,
      error: 'invalid_auth',
    });
    // err
  }

  req.currentUser = await User.findOne({
    _id: decoded.id,
    role: 'admin',
    del: false,
  });

  if (req.currentUser) {
    next();
  } else {
    console.error('Valid JWT but no user:', decoded);
    res.send({
      status: false,
      error: 'invalid_user',
    });
  }
};

const resetPassword = async (req, res) => {
  const { user_id, new_password } = req.body;
  console.log('user_id', user_id);
  const _user = await User.findOne({ _id: user_id });

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(new_password, salt, 10000, 512, 'sha512')
    .toString('hex');

  _user.salt = salt;
  _user.hash = hash;
  _user
    .save()
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(400).json({
        status: false,
        error: err,
      });
    });
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }

  const _user = await User.findOne({
    email: req.body.email,
    del: false,
  });

  if (_user != null) {
    res.status(400).send({
      status: false,
      error: 'User already exists',
    });
  }

  const { email, level } = req.body;

  const password = req.body.password || system_settings.PASSWORD.USER;

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 512, 'sha512')
    .toString('hex');

  const user = new User({
    ...req.body,
    is_free: true,
    package_level: level,
    salt,
    hash,
  });

  user
    .save()
    .then((_res) => {
      const garbage = new Garbage({
        user: _res.id,
      });

      garbage.save().catch((err) => {
        console.log('garbage save err', err.message);
      });

      const package_data = {
        user: _res.id,
        level,
      };

      setPackage(package_data).catch((err) => {
        console.log('user set package err', err.message);
      });

      addOnboard(_res.id);
      addAdmin(_res.id, ['free']);

      const time_zone = _res.time_zone_info
        ? JSON.parse(_res.time_zone_info).tz_name
        : system_settings.TIME_ZONE;

      const data = {
        template_data: {
          user_email: email,
          verification_url: `${urls.VERIFY_EMAIL_URL}?id=${_res.id}`,
          user_name: _res.user_name,
          created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
          password,
          oneonone_url: urls.ONEONONE_URL,
          recording_url: urls.INTRO_VIDEO_URL,
          recording_preview: urls.RECORDING_PREVIEW_URL,
          webinar_url: system_settings.WEBINAR_LINK,
          import_url: urls.IMPORT_CSV_URL,
          template_url: urls.CONTACT_CSV_URL,
          connect_url: urls.INTEGRATION_URL,
        },
        template_name: 'Welcome',
        required_reply: true,
        email: _res.email,
      };

      sendNotificationEmail(data)
        .then(() => {
          console.log('welcome email has been sent out succeefully');
        })
        .catch((err) => {
          console.log('welcome email send err', err);
        });

      const myJSON = JSON.stringify(_res);
      const user = JSON.parse(myJSON);
      delete user.hash;
      delete user.salt;

      return res.send({
        status: true,
        data: {
          user,
        },
      });
    })
    .catch((e) => {
      console.log('e', e);
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

const closeAccount = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id }).catch((err) => {
    console.log('err', err);
  });

  if (user) {
    await Contact.deleteMany({ user: user.id });
    await Activity.deleteMany({ user: user.id });
    await FollowUp.deleteMany({ user: user.id });
    await Appointment.deleteMany({ user: user.id });
    await Tag.deleteMany({ user: user.id });
    await Team.deleteMany({ user: user.id });
    await Notification.deleteMany({ user: user.id });
    await Task.deleteMany({ user: user.id });

    Team.updateMany(
      { members: user.id },
      {
        $pull: { members: { $in: [user.id] } },
      }
    );
    removeMaterials(user.id);

    if (user.proxy_number_id) {
      releaseSignalWireNumber(user.proxy_number_id);
    }

    if (user.payment) {
      cancelCustomer(user.payment).catch((err) => {
        console.log('err', err);
      });
    }
    user.del = true;
    user.save().catch((err) => {
      console.log('err', err);
    });

    return res.send({
      status: true,
    });
  }
};

const updateUser = async (req, res) => {
  const query = { ...req.body };

  if (query.package_level) {
    let { package_level: level } = query;
    const user = await User.findById(req.params.id);

    if (user.payment) {
      const payment = await Payment.findOne({ _id: user.payment }).catch(
        (err) => {
          console.log('payment find err', err.message);
        }
      );

      if (query.is_minimal) {
        level = system_settings.MINIMAL_PACKAGE;
      }

      const planId = api.STRIPE.PLAN[level];
      const subscription_data = {
        customerId: payment.customer_id,
        subscriptionId: payment.subscription,
        planId,
      };

      updateSubscription(subscription_data).catch((err) => {
        Payment.updateOne(
          {
            user: req.params.id,
          },
          {
            $set: { plan_id: planId },
          }
        ).catch((err) => {
          console.log('payment set package err', err.message);
        });

        console.log('subscription update err', err.message);
        return res.status(400).json({
          status: false,
          error: 'Please correct your card',
        });
      });
    }

    const data = {
      user: req.params.id,
      level: query.package_level,
    };

    setPackage(data).catch((err) => {
      console.log('set package err', err.message);
    });
  }

  if (query.phone) {
    query.cell_phone = query['phone'];
  }

  User.updateOne(
    {
      _id: req.params.id,
    },
    {
      $set: {
        ...query,
        is_minimal: !!query.is_minimal,
      },
    }
  ).catch((err) => {
    console.log('user updae package err', err.message);
  });

  return res.send({
    status: true,
  });
};

const disableUser = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id }).catch((err) => {
    console.log('user found err', err.message);
  });
  if (user['payment']) {
    cancelCustomer(user['payment'])
      .then(() => {
        if (user.proxy_number_id) {
          releaseSignalWireNumber(user.proxy_number_id);
        }
        User.updateOne(
          { _id: req.params.id },
          {
            $set: { del: true, updated_at: new Date() },
            $unset: {
              proxy_number: true,
              proxy_number_id: true,
            },
          }
        )
          .then(async () => {
            await Contact.deleteMany({ user: user.id });
            await Activity.deleteMany({ user: user.id });
            await FollowUp.deleteMany({ user: user.id });
            await Appointment.deleteMany({ user: user.id });
            await Tag.deleteMany({ user: user.id });
            await TimeLine.deleteMany({ user: user.id });
            await Team.deleteMany({ user: user.id });
            Team.updateMany(
              { members: user.id },
              {
                $pull: { members: { $in: [user.id] } },
              }
            );

            removeMaterials(user.id);

            return res.send({
              status: true,
            });
          })
          .catch((err) => {
            return res
              .status(500)
              .send({
                status: false,
                error: err,
              })
              .catch((err) => {
                return res.status(500).send({
                  status: false,
                  error: err,
                });
              });
          });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(400).send({
          status: false,
          error: `User's Payment infomation is not correct. Please cancel in stripe manually`,
        });
      });
  } else {
    if (user.proxy_number_id) {
      releaseSignalWireNumber(user.proxy_number_id);
    }
    User.updateOne(
      { _id: req.params.id },
      {
        $set: { del: true, updated_at: new Date() },
        $unset: {
          proxy_number: true,
          proxy_number_id: true,
        },
      }
    )
      .then(async () => {
        await Contact.deleteMany({ user: user.id });
        await Activity.deleteMany({ user: user.id });
        await FollowUp.deleteMany({ user: user.id });
        await Appointment.deleteMany({ user: user.id });
        await Tag.deleteMany({ user: user.id });
        await TimeLine.deleteMany({ user: user.id });
        await Team.deleteMany({ user: user.id });
        Team.updateMany(
          { members: user.id },
          {
            $pull: { members: { $in: [user.id] } },
          }
        );
        removeMaterials(user.id);

        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        return res
          .status(500)
          .send({
            status: false,
            error: err,
          })
          .catch((err) => {
            return res.status(500).send({
              status: false,
              error: err,
            });
          });
      });
  }
};

const suspendUser = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id }).catch((err) => {
    console.log('supsend user found error', err);
  });

  if (user.proxy_number_id) {
    releaseSignalWireNumber(user.proxy_number_id);
  }

  if (user['payment']) {
    const payment = await Payment.findOne({ _id: user.payment }).catch(
      (err) => {
        console.log('payment found err', err);
      }
    );

    cancelSubscription(payment['subscription']).catch((err) => {
      console.log('cancel subscription err', err.message);
      return res.status(400).send({
        status: false,
        error: err.message || 'cancel subscription err',
      });
    });

    User.updateOne(
      { _id: req.params.id },
      {
        $set: { 'subscription.is_suspended': true, is_free: false },
      }
    )
      .then(() => {
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        return res.status(500).send({
          status: false,
          error: err.message,
        });
      });
  } else {
    User.updateOne(
      { _id: req.params.id },
      { $set: { 'subscription.is_suspended': true, is_free: false } }
    )
      .then(() => {
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        return res.status(500).send({
          status: false,
          error: err.message,
        });
      });
  }
};

const activateUser = async (req, res) => {
  User.updateOne(
    { _id: req.params.id },
    {
      'subscription.is_suspended': false,
      del: false,
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    });
};

const getActiveUsers = async (req, res) => {
  const { currentUser } = req;
  let { field, dir } = req.body;
  const { limit, page, search } = req.body;
  const skip = (page - 1) * limit;

  dir = dir ? 1 : -1;
  if (field === 'last_logged') {
    field = 'last_logged';
    dir *= -1;
  } else if (field === 'alpha_up') {
    field = 'user_name';
    dir = -1;
  } else if (field === 'alpha_down') {
    field = 'user_name';
    dir = 1;
  } else if (field === 'payment') {
    field = 'payment';
  } else {
    field = 'created_at';
  }

  const users = await User.find({
    $and: [
      {
        $or: [
          { user_name: { $regex: `.*${search}.*`, $options: 'i' } },
          { email: { $regex: `.*${search}.*`, $options: 'i' } },
          {
            cell_phone: { $regex: `.*${search}.*`, $options: 'i' },
          },
        ],
      },
      {
        del: false,
      },
    ],
  })
    .sort({ [field]: dir })
    .skip(skip)
    .limit(limit)
    .catch((err) => {
      console.log('users loading is failed', err.message);
    });

  const total = await User.countDocuments({
    $and: [
      {
        $or: [
          { user_name: { $regex: `.*${search}.*`, $options: 'i' } },
          { email: { $regex: `.*${search}.*`, $options: 'i' } },
          {
            cell_phone: { $regex: `.*${search}.*`, $options: 'i' },
          },
        ],
      },
      {
        del: false,
      },
    ],
  });

  return res.send({
    status: true,
    data: {
      users,
      total,
    },
  });
};

const getAllActiveUsers = async (req, res) => {
  const { currentUser } = req;

  const users = await User.find({ del: false }).select({
    _id: 1,
    first_name: 1,
    last_name: 1,
    email: 1,
    cell_phone: 1,
  });
  return res.send({
    status: true,
    data: users,
  });
};

const getDisableUsers = async (req, res) => {
  const { currentUser } = req;
  let { field, dir } = req.body;
  const { limit, page, search } = req.body;
  const skip = (page - 1) * limit;

  dir = dir ? 1 : -1;
  if (field === 'last_logged') {
    field = 'last_logged';
    dir *= -1;
  } else if (field === 'alpha_up') {
    field = 'user_name';
    dir = -1;
  } else if (field === 'alpha_down') {
    field = 'user_name';
    dir = 1;
  } else if (field === 'payment') {
    field = 'payment';
  } else {
    field = 'created_at';
  }

  const users = await User.find({
    $and: [
      {
        $or: [
          { user_name: { $regex: `.*${search}.*`, $options: 'i' } },
          { email: { $regex: `.*${search}.*`, $options: 'i' } },
          {
            cell_phone: { $regex: `.*${search}.*`, $options: 'i' },
          },
        ],
      },
      {
        del: true,
      },
    ],
  })
    .sort({ [field]: dir })
    .skip(skip)
    .limit(limit)
    .catch((err) => {
      console.log('users loading is failed', err.message);
    });

  const total = await User.countDocuments({
    $and: [
      {
        $or: [
          { user_name: { $regex: `.*${search}.*`, $options: 'i' } },
          { email: { $regex: `.*${search}.*`, $options: 'i' } },
          {
            cell_phone: { $regex: `.*${search}.*`, $options: 'i' },
          },
        ],
      },
      {
        del: true,
      },
    ],
  });

  return res.send({
    status: true,
    data: {
      users,
      total,
    },
  });
};

const getAllDisableUsers = async (req, res) => {
  const { currentUser } = req;

  const users = await User.find({ del: true }).select({
    _id: 1,
    first_name: 1,
    last_name: 1,
    email: 1,
    cell_phone: 1,
  });
  return res.send({
    status: true,
    data: users,
  });
};

module.exports = {
  signUp,
  login,
  editMe,
  getAll,
  getProfile,
  resetPassword,
  checkAuth,
  create,
  updateUser,
  disableUser,
  disableUsers,
  suspendUser,
  activateUser,
  closeAccount,
  getActiveUsers,
  getAllActiveUsers,
  getDisableUsers,
  getAllDisableUsers,
  exportUsers,
};
