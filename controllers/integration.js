const User = require('../models/user');
const Garbage = require('../models/garbage');
const request = require('request-promise');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const api = require('../config/api');
const randomstring = require('randomstring');
const { ZOOM: MESSAGE } = require('../constants/message');
const { refreshToken } = require('../helpers/zoom');

const checkAuthCalendly = async (req, res) => {
  const { token } = req.body;
  const { currentUser } = req;
  request({
    method: 'GET',
    uri: `https://calendly.com/api/v1/echo`,
    headers: {
      'Content-Type': 'application/json',
      'X-TOKEN': token,
    },
    json: true,
  })
    .then((response) => {
      const calendly = {
        token,
        email: response.email,
      };

      Garbage.updateOne({ user: currentUser.id }, { $set: { calendly } }).catch(
        (err) => {
          console.log('garbage update error', err.message);
        }
      );

      return res.send({
        status: true,
        data: {
          calendly,
        },
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(400).json({
        status: false,
        error: 'UnAuthorized',
      });
    });
};

const getCalendly = async (req, res) => {
  const { currentUser } = req;
  const garbage = await Garbage.findOne({ user: currentUser.id }).catch(
    (err) => {
      console.log('garbage found err');
    }
  );

  const { calendly } = garbage;

  if (calendly && calendly.token) {
    request({
      method: 'GET',
      uri: `https://calendly.com/api/v1/users/me/event_types`,
      headers: {
        'Content-Type': 'application/json',
        'X-TOKEN': calendly.token,
      },
      json: true,
    })
      .then((response) => {
        return res.send({
          status: true,
          data: response.data,
        });
      })
      .catch((err) => {
        return res.status(400).json({
          status: false,
          error: 'UnAuthorized',
        });
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Please connect Calendly first',
    });
  }
};

const setEventCalendly = async (req, res) => {
  const { currentUser } = req;
  Garbage.updateOne(
    {
      user: currentUser.id,
    },
    {
      $set: {
        'calendly.id': req.body.id,
        'calendly.link': req.body.link + '?embed_type=Inline',
      },
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('garbage update err', err.message);
      return res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

const connectSMTP = async (req, res) => {
  const { currentUser } = req;
  const { host, port, user, pass, secure } = req.body;

  const smtpTransporter = nodemailer.createTransport({
    port,
    host,
    secure,
    auth: {
      user,
      pass,
    },
    debug: true,
  });

  // verify connection configuration
  smtpTransporter.verify(function (error, success) {
    if (error) {
      console.log(error);
      return res.status(400).json({
        status: false,
        error: error.response ? error.response : 'Invalid user or password!',
      });
    } else {
      console.log('Server is ready to take our messages');
      Garbage.updateOne(
        {
          user: currentUser.id,
        },
        {
          $set: { smtp_info: { ...req.body } },
        }
      ).catch((err) => {
        console.log('garbage update err', err.message);
      });

      User.updateOne(
        { _id: currentUser.id },
        {
          $set: {
            smtp_connected: true,
            smtp_verified: false,
          },
        }
      ).catch((err) => {
        console.log('smtp update err', err.message);
      });

      return res.send({
        status: true,
      });
    }
  });
};

const verifySMTP = async (req, res) => {
  const { currentUser } = req;
  const { email } = req.body;

  const garbage = await Garbage.findOne({ user: currentUser._id }).catch(
    (err) => {
      console.log('garbage getting failed to verify smtp email address');
    }
  );

  if (!garbage || !garbage.smtp_info) {
    return res.status(400).send({
      status: false,
      error: 'Please connect the smtp with your account.',
    });
  }

  const {
    port,
    host,
    secure,
    user,
    pass,
    email: original_email,
  } = garbage.smtp_info;

  const smtpTransporter = nodemailer.createTransport({
    port,
    host,
    secure,
    auth: {
      user,
      pass,
    },
    debug: true,
  });

  // verify connection configuration
  smtpTransporter.verify(function (error, success) {
    if (error) {
      console.log(error);
      return res.status(400).json({
        status: false,
        error: error.response ? error.response : 'Invalid user or password!',
      });
    } else {
      const code = randomstring.generate({
        length: 6,
        charset: '1234567890',
      });
      const message = {
        to: currentUser.email,
        from: `${currentUser.user_name} <${email}>`,
        subject: 'Please verify your code for CRMGrow SMTP connection.',
        html: `Please use this code in you app: <span style="font-size:24; font-weight:bold; color:blue">${code}</span> to verify SMTP connection.`,
      };

      smtpTransporter.sendMail(message, function (err, info) {
        if (err) {
          console.log('verify smtp is failed.', err);
          return res.status(400).json({
            status: false,
            error: err,
          });
        } else {
          const data = {
            port,
            host,
            secure,
            user,
            pass,
            email,
            verification_code: code,
          };
          Garbage.updateOne(
            {
              user: currentUser.id,
            },
            {
              $set: { smtp_info: { ...data } },
            }
          ).catch((err) => {
            console.log('garbage update err', err.message);
          });
          if (original_email !== email) {
            User.updateOne(
              { _id: currentUser.id },
              {
                $set: {
                  smtp_verified: false,
                },
              }
            ).catch((err) => {
              console.log('smtp update err', err.message);
            });
          }
          res.send({
            data,
            status: true,
          });
        }
      });
    }
  });
};

const verifySMTPCode = async (req, res) => {
  const { currentUser } = req;
  const { code } = req.body;
  const garbage = await Garbage.findOne({ user: currentUser._id }).catch(
    (err) => {
      console.log('Getting garbage failed to verify smtp code.', err.message);
      return res.status(400).send({
        status: false,
        error: 'Could not find garbage for the current user.',
      });
    }
  );

  if (!garbage || !garbage.smtp_info) {
    return res.status(400).send({
      status: false,
      error: 'Please connect the smtp with your account.',
    });
  }

  const { verification_code } = garbage.smtp_info;
  if (verification_code === code) {
    // Update the User
    User.updateOne(
      { _id: currentUser.id },
      {
        $set: {
          smtp_verified: true,
        },
      }
    ).catch((err) => {
      console.log('smtp update err', err.message);
    });

    return res.send({
      status: true,
    });
  } else {
    return res.status(400).send({
      status: false,
      error: 'Your verification code is invalid.',
    });
  }
};

const disconnectCalendly = async (req, res) => {
  const { currentUser } = req;
  Garbage.updateOne(
    {
      user: currentUser.id,
    },
    {
      $unset: { calendly: true },
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('garbage update err', err.message);
      return res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

const addDialer = async (req, res) => {
  const { currentUser } = req;
  const { level } = req.body;

  /**
  const payment = await Payment.findOne({
    _id: currentUser.payment,
  }).catch((err) => {
    console.log('payment find err', err.message);
  });

  const subscription_data = {
    customer_id: payment.customer_id,
    plan_id: api.STRIPE.DIALER[level],
    is_trial: true,
    trial_period_days: system_settings.DIALER_FREE_TRIAL,
  };

  createSubscription(subscription_data).then((subscription) => {
    */
  let subscriptions;

  if (level === 'PREV') {
    subscriptions = {
      previewLine: true,
    };
  } else if (level === 'SINGLE') {
    subscriptions = {
      single: true,
    };
  } else if (level === 'MULTI') {
    subscriptions = {
      multi: true,
    };
  }

  const body = {
    id: currentUser.id,
    email: currentUser.email,
    firstName: currentUser.user_name.split(' ')[0],
    lastName: currentUser.user_name.split(' ')[1] || '',
    subscriptions,
  };
  /**
    const new_payment = new Payment({
      customer_id: payment.customer_id,
      plan_id: api.STRIPE.DIALER[level],
      subscription: subscription.id,
      type: 'dialer',
    });

    new_payment.save().catch((err) => {
      console.log('new_payment err', err.message);
    });
 */
  const dialer_info = {
    is_enabled: true,
    level,
    // payment: new_payment.id,
  };

  User.updateOne(
    {
      _id: currentUser.id,
    },
    {
      $set: {
        dialer_info,
      },
    }
  ).catch((err) => {
    console.log('user dialer info updaet err', err.message);
  });

  const options = {
    method: 'POST',
    url: 'https://app.stormapp.com/api/customers',
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: api.DIALER.VENDOR_ID,
      password: api.DIALER.API_KEY,
    },
    body,
    json: true,
  };

  request(options, function (error, response, data) {
    if (error) throw new Error(error);
    const payload = {
      userId: currentUser.id,
    };

    const token = jwt.sign(payload, api.DIALER.API_KEY, {
      issuer: api.DIALER.VENDOR_ID,
      expiresIn: 3600,
    });

    return res.send({
      status: true,
      data: token,
    });
  });
  // });
};

const getDialerToken = async (req, res) => {
  const { currentUser } = req;

  if (currentUser.dialer_info && currentUser.dialer_info.is_enabled) {
    const payload = {
      userId: currentUser.id,
    };

    const token = jwt.sign(payload, api.DIALER.API_KEY, {
      issuer: api.DIALER.VENDOR_ID,
      expiresIn: 3600,
    });

    return res.send({
      status: true,
      data: token,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Dialer is not enabled in your account',
    });
  }
};

const createMeetingZoom = async (req, res) => {
  const { currentUser } = req;
  const garbage = await Garbage.findOne({ user: currentUser._id }).catch(
    (err) => {
      return res.status(400).send({
        status: false,
        error: 'Could not find garbage for the current user.',
      });
    }
  );
  if (!garbage.zoom) {
    return res.status(400).json({
      status: false,
      error: MESSAGE['NO_ACCOUNT'],
    });
  }

  const { refresh_token: old_refresh_token } = garbage.zoom;

  let auth_client;

  await refreshToken(old_refresh_token)
    .then((response) => {
      auth_client = response;
    })
    .catch((err) => {
      console.log('zoom refresh token err', err);
    });

  const { refresh_token, access_token } = auth_client;

  if (!access_token) {
    return res.status(412).json({
      status: false,
      error: MESSAGE['TOKEN_EXPIRED'],
    });
  }

  Garbage.updateOne(
    {
      user: currentUser.id,
    },
    {
      $set: {
        'zoom.refresh_token': refresh_token,
      },
    }
  ).catch((err) => {
    console.log('garbage zoom update err', err.message);
  });

  const options = {
    method: 'POST',
    url: 'https://api.zoom.us/v2/users/me/meetings',
    headers: {
      Authorization: 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
    body: req.body,
    json: true,
  };

  request(options)
    .then((response) => {
      return res.send({
        status: true,
        data: response.join_url,
      });
    })
    .catch((err) => {
      console.log('zoom meeting create err', err.message);
    });
};

const updateMeetingZoom = async (req, res) => {
  const { currentUser } = req;
  const garbage = await Garbage.findOne({ user: currentUser._id }).catch(
    (err) => {
      return res.status(400).send({
        status: false,
        error: 'Could not find garbage for the current user.',
      });
    }
  );
  if (!garbage.zoom) {
    return res.status(400).json({
      status: false,
      error: MESSAGE['NO_ACCOUNT'],
    });
  }

  const { refresh_token: old_refresh_token } = garbage.zoom;

  let auth_client;

  await refreshToken(old_refresh_token)
    .then((response) => {
      auth_client = response;
    })
    .catch((err) => {
      console.log('zoom refresh token err', err);
    });

  const { refresh_token, access_token } = auth_client;

  if (!access_token) {
    return res.staus(412).json({
      status: false,
      error: MESSAGE['TOKEN_EXPIRED'],
    });
  }

  Garbage.updateOne(
    {
      user: currentUser.id,
    },
    {
      $set: {
        'zoom.refresh_token': refresh_token,
      },
    }
  ).catch((err) => {
    console.log('garbage zoom update err', err.message);
  });

  const options = {
    method: 'PUT',
    url: 'https://api.zoom.us/v2/users/me/meetings',
    headers: {
      /** The credential below is a sample base64 encoded credential. Replace it with "Authorization: 'Basic ' + Buffer.from(your_app_client_id + ':' + your_app_client_secret).toString('base64')"
       * */
      Authorization: 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
    body: req.body,
    json: true,
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    return res.send({
      status: true,
      data: response.join_url,
    });
  });
};

module.exports = {
  checkAuthCalendly,
  setEventCalendly,
  getCalendly,
  getDialerToken,
  disconnectCalendly,
  connectSMTP,
  verifySMTP,
  verifySMTPCode,
  addDialer,
  createMeetingZoom,
  updateMeetingZoom,
};
