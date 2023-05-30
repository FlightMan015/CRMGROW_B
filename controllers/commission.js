const api = require('../config/api');
const affiliateHelper = require('../helpers/affiliate');
const User = require('../models/user');
const request = require('request-promise');

const get = async (req, res) => {
  const { currentUser } = req;

  const users = await User.find({
    del: false,
  });
  for (let i = 0; i < users.length; i++) {
    var user = JSON.parse(JSON.stringify(users[i]));
    if (user.affiliate && user.affiliate.id) {
      const referrals = await affiliateHelper.getReferrals(
        user.affiliate.id,
        1
      );
      const charge = await affiliateHelper.charge(referrals);
      user.charge = charge.data;
    }
  }
  res.send({
    status: true,
    data: users,
  });
};

const mark = async (req, res) => {
  const { _id } = req.body;
  const _user = await User.findById(_id);
  _user.paid_commission = _user.due_commission;
  _user.due_commission = 0;
  _user.save().then((user) => {
    res
      .send({
        status: true,
        data: user,
      })
      .catch((err) => {
        console.log('Error', err.message);
      });
  });
};

const markAll = async (req, res) => {
  const users = await User.find({
    del: false,
  });
  for (let i = 0; i < users.length; i++) {
    var _user = users[i];
    _user.paid_commission = _user.due_commission;
    _user.due_commission = 0;
    users[i] = _user;
    await _user.save();
  }
  res.send({
    status: true,
    data: users,
  });
};

module.exports = {
  get,
  mark,
  markAll,
};
