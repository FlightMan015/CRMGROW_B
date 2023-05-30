const api = require('../config/api');
const affiliateHelper = require('../helpers/affiliate');
const request = require('request-promise');
const User = require('../models/user');

const get = async (req, res) => {
  const { currentUser } = req;
  if (currentUser.affiliate && currentUser.affiliate.id) {
    const auth = Buffer.from(api.REWARDFUL.API_KEY + ':').toString('base64');
    request({
      method: 'GET',
      uri: `https://api.getrewardful.com/v1/affiliates/${currentUser.affiliate.id}`,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      json: true,
    })
      .then((response) => {
        return res.send({
          status: true,
          data: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          error: err.details,
        });
      });
  } else {
    res.send({
      status: true,
      data: {},
    });
  }
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  if (currentUser.affiliate && currentUser.affiliate.id) {
    const auth = Buffer.from(api.REWARDFUL.API_KEY + ':').toString('base64');
    request({
      method: 'GET',
      uri: `https://api.getrewardful.com/v1/referrals?affiliate_id=${currentUser.affiliate.id}&limit=100&conversion_state[]=lead&conversion_state[]=conversion`,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      json: true,
    })
      .then((response) => {
        const visitors = response.data;
        const customers = [];
        for (let i = 0; i < visitors.length; i++) {
          const visitor = visitors[i];
          if (visitor.customer) {
            customers.push(visitor.customer);
          }
        }
        return res.send({
          status: true,
          data: response.data,
          pagination: response.pagination,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          error: err.details[0],
        });
      });
  } else {
    res.status(400).json({
      status: false,
      error: `Can't find affilate id`,
    });
  }
};

const getAllByMLM = async (req, res) => {
  const { currentUser } = req;
  if (currentUser.affiliate && currentUser.affiliate.id) {
    const affiliate_id = currentUser.affiliate.id;
    const referrals = await affiliateHelper.getReferrals(affiliate_id, 1);
    const charge = await affiliateHelper.charge(referrals);
    res.status(200).json({
      status: true,
      data: referrals,
    });
  } else {
    res.status(400).json({
      status: false,
      error: `Can't find affilate id`,
    });
  }
};

const getCharge = async (req, res) => {
  const { currentUser } = req;
  const users = await User.find({
    $and: [
      { del: false },
      { is_trial: false },
      { 'subscription.is_failed': false },
      { 'subscription.is_suspended': false },
    ],
  });
  for (let i = 0; i < users.length; i++) {
    var user = JSON.parse(JSON.stringify(users[i]));
    const referrals = await affiliateHelper.getReferrals(user.affiliate.id, 1);
    const charge = await affiliateHelper.charge(referrals);
    user.charge = charge;
  }
  res.send({
    status: true,
    data: users,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  const { paypal } = req.body;

  const old_user = await User.findOne({
    email: currentUser.email,
    del: true,
  });

  const auth = Buffer.from(api.REWARDFUL.API_KEY + ':').toString('base64');

  if (old_user && old_user.affiliate && old_user.affiliate.id) {
    request({
      method: 'GET',
      uri: `https://api.getrewardful.com/v1/affiliates/${old_user.affiliate.id}`,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      json: true,
    })
      .then((response) => {
        const affiliate = {
          id: response.id,
          link: response.links[0].url,
          paypal,
        };

        User.updateOne(
          {
            _id: currentUser.id,
          },
          {
            $set: { affiliate },
          }
        ).catch((err) => {
          console.log('user update err', err.message);
        });

        /**
        if (currentUser.referred_firstpromoter) {
          const affiliate_data = {
            first_name: currentUser.user_name.split(' ')[0],
            last_name:
              currentUser.user_name.split(' ')[1] ||
              currentUser.user_name.split(' ')[0],
            email: currentUser.email,
            user_id: currentUser.id,
          };

          createFirstpromoterAffiliate(affiliate_data);
        }
        */

        return res.send({
          status: true,
          data: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          error: err.details,
        });
      });
  } else {
    request({
      method: 'POST',
      uri: 'https://api.getrewardful.com/v1/affiliates',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: {
        first_name: currentUser.user_name.split(' ')[0],
        last_name:
          currentUser.user_name.split(' ')[1] ||
          currentUser.user_name.split(' ')[0],
        email: currentUser.email,
        paypal,
      },
      json: true,
    })
      .then((response) => {
        const affiliate = {
          id: response.id,
          link: response.links[0].url,
          paypal,
        };

        if (currentUser.referred_firstpromoter) {
          const affiliate_data = {
            first_name: currentUser.user_name.split(' ')[0],
            last_name:
              currentUser.user_name.split(' ')[1] ||
              currentUser.user_name.split(' ')[0],
            email: currentUser.email,
            user_id: currentUser.id,
          };

          createFirstpromoterAffiliate(affiliate_data);
        }

        User.updateOne(
          {
            _id: currentUser.id,
          },
          {
            $set: {
              affiliate,
            },
          }
        ).catch((err) => {
          console.log('affiliate update err', err.message);
        });

        res.send({
          status: true,
          data: response,
        });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({
          status: false,
          error: err.error.details[0],
        });
      });
  }
};

const updatePaypal = async (req, res) => {
  const { currentUser } = req;
  const { paypal } = req.body;
  if (currentUser.affiliate && currentUser.affiliate.id) {
    const auth = Buffer.from(api.REWARDFUL.API_KEY + ':').toString('base64');
    request({
      method: 'PUT',
      uri: `https://api.getrewardful.com/v1/affiliates/${currentUser.affiliate.id}`,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: {
        first_name: currentUser.user_name.split(' ')[0],
        last_name: currentUser.user_name.split(' ')[1] || ' ',
        email: currentUser.email,
        paypal_email: paypal,
      },
      json: true,
    })
      .then((response) => {
        const affiliate = {
          id: response.id,
          link: response.links[0].url,
          paypal,
        };

        currentUser.affiliate = affiliate;
        currentUser.save();

        res.send({
          status: true,
          data: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          error: err.error.details[0],
        });
      });
  } else {
    res.status(400).json({
      status: false,
      error: `Can't find affilate id`,
    });
  }
};

const update = async (id, data) => {
  const auth = Buffer.from(api.REWARDFUL.API_KEY + ':').toString('base64');
  return request({
    method: 'PUT',
    uri: `https://api.getrewardful.com/v1/affiliates/${id}`,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: {
      ...data,
    },
    json: true,
  });
};

const createFirstpromoterAffiliate = (data) => {
  const { user_id } = data;
  request({
    method: 'POST',
    uri: 'https://firstpromoter.com/api/v1/promoters/create',
    headers: {
      'x-api-key': api.FIRSTPROMOTER.API_KEY,
      'Content-Type': 'application/json',
    },
    body: {
      ...data,
    },
    json: true,
  })
    .then((response) => {
      User.updateOne(
        {
          _id: user_id,
        },
        {
          $set: {
            'affiliate.firstpromoter_id': response.default_ref_id,
          },
        }
      ).catch((err) => {
        console.log('user firstpromoter set err', err.message);
      });
    })
    .catch((err) => {
      console.log('user firstpromoter set err', err.message);
    });
};

const addReferralFirstpromoter = (data) => {
  request({
    method: 'POST',
    uri: 'https://firstpromoter.com/api/v1/track/signup',
    headers: {
      'x-api-key': api.FIRSTPROMOTER.API_KEY,
      'Content-Type': 'application/json',
    },
    body: {
      ...data,
    },
    json: true,
  }).catch((err) => {
    console.log('user firstpromoter set err', err.message);
  });
};

const eventListener = async (req, res) => {
  const { event, data } = req.body;
  if (event && event.type === 'promoter_accepted') {
    const { promoter, promotion, state } = data;
    if (state === 'accepted') {
      const promoter_id = promoter.id;
      const referral_link = promotion.referral_link;
      const user_id = promoter.cust_id;

      User.updateOne(
        {
          _id: user_id,
        },
        {
          $set: {
            'affiliate.id': promoter_id,
            'affiliate.link': referral_link,
          },
        }
      ).catch((err) => {
        console.log('user affiliate update err', err.message);
      });
    }
  }
  return res.send({
    status: true,
  });
};

const cancelAffiliate = (id) => {
  request({
    method: 'DELETE',
    uri: 'https://firstpromoter.com/api/v1/promoters/delete',
    headers: {
      'x-api-key': api.FIRSTPROMOTER.API_KEY,
      'Content-Type': 'application/json',
    },
    body: {
      id,
    },
    json: true,
  }).catch((err) => {
    console.log('user firstpromoter set err', err.message);
  });
};

module.exports = {
  get,
  getAll,
  create,
  addReferralFirstpromoter,
  update,
  updatePaypal,
  getAllByMLM,
  getCharge,
  eventListener,
  cancelAffiliate,
};
