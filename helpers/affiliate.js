const User = require('../models/user');
const system_settings = require('../config/system_settings');
const { template } = require('lodash');

let referrals = [];

const getReferrals = async (id, deep) => {
  if (deep === 1) {
    referrals = [];
  }
  const users = await User.find({ parent_affiliate_id: id });

  for (let i = 0; i < users.length; i++) {
    var user = JSON.parse(JSON.stringify(users[i]));
    user.tier = deep;
    referrals.push(user);

    if (
      user.affiliate &&
      user.affiliate.id &&
      deep < system_settings.REFERRAL_DEEP
    ) {
      await getReferrals(user.affiliate.id, user.tier + 1);
    } else continue;
  }
  return referrals;
};

const charge = async (users) => {
  let tem;
  let charge = 0;
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    user.is_calc = true;
    user.child_calc = true;
    if (
      tem &&
      tem.affiliate.id === user.parent_affiliate_id &&
      tem.child_calc === false
    ) {
      user.is_calc = false;
      user.child_calc = false;
      continue;
    }
    if (
      user.del === true ||
      user.is_trial === true ||
      user.subscription.is_failed === true ||
      user.subscription.is_suspended === true
    ) {
      user.is_calc = false;
    }
    if (user.user_version === 1 && user.tier >= 2) {
      // find all child and not include in calcuation
      user.is_calc = false;
      user.child_calc = false;
    }
    tem = user;
  }
  for (let j = 0; j < users.length; j++) {
    if (users[j].is_calc === true) {
      const user = users[j];
      const package_amount = system_settings.PACKAGE_LEVEL[user.package_level];
      const mlm = system_settings.MLM_LEVEL[user.tier];
      charge += package_amount * mlm;
    }
  }
  return charge.toFixed(2);
};

// const getReferral = async (affiliate_id) => {
//   const auth = Buffer.from(api.REWARDFUL_API_KEY + ':').toString('base64');
//   const res = await request({
//     method: 'GET',
//     uri: `https://api.getrewardful.com/v1/referrals?affiliate_id=${affiliate_id}&conversion_state[]=visitor&conversion_state[]=conversion&conversion_state[]=conversion`,
//     headers: {
//       Authorization: `Basic ${auth}`,
//       'Content-Type': 'application/json',
//     },
//     json: true,
//   });
//   return res;
// };

module.exports = {
  getReferrals,
  charge,
};
