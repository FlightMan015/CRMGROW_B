const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator/check');
const randomstring = require('randomstring');
const { google } = require('googleapis');
const request = require('request-promise');

const api = require('../config/api');
const system_settings = require('../config/system_settings');
const webPush = require('web-push');

const yahooCredentials = {
  clientID: api.YAHOO_CLIENT.YAHOO_CLIENT_ID1,
  clientSecret: api.YAHOO_CLIENT.YAHOO_CLIENT_CECRET,
  site: 'https://api.login.yahoo.com',
  authorizationPath: '/oauth2/request_auth',
  tokenPath: '/oauth2/get_token',
};
const yahooOauth2 = require('simple-oauth2')(yahooCredentials);

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};
const oauth2 = require('simple-oauth2')(credentials);
const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const _ = require('lodash');

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const User = require('../models/user');
const Garbage = require('../models/garbage');
const Payment = require('../models/payment');
const Appointment = require('../models/appointment');
const Contact = require('../models/contact');
const Guest = require('../models/guest');
const Team = require('../models/team');
const PaidDemo = require('../models/paid_demo');
const Automation = require('../models/automation');
const TimeLine = require('../models/time_line');
const Task = require('../models/task');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const FollowUp = require('../models/follow_up');

const { uploadBase64Image } = require('../helpers/fileUpload');

const {
  create: createPayment,
  createCharge,
  createSubscription,
  updateSubscription,
  cancelSubscription,
} = require('./payment');

const {
  releaseSignalWireNumber,
  releaseTwilioNumber,
} = require('../helpers/text');
const { sendNotificationEmail } = require('../helpers/email');
const {
  setPackage,
  addOnboard,
  addAdmin,
  promocodeCheck,
  clearAccount,
  addNickName,
} = require('../helpers/user');
// const {
//   update: updateAffiliate,
//   addReferralFirstpromoter,
// } = require('./affiliate');
const urls = require('../constants/urls');
const mail_contents = require('../constants/mail_contents');
const Image = require('../models/image');

const signUp = async (req, res) => {
  const errors = validationResult(req);
  const errMsg = [];
  if (errors.array().length) {
    for (let i = 0; i < errors.array().length; i++) {
      errMsg.push(errors.array()[i].msg);
    }
  }
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errMsg,
    });
  }

  const _user = await User.findOne({
    email: new RegExp(req.body.email, 'i'),
    del: false,
  }).catch((err) => {
    console.log('user find err in signup', err.message);
  });

  if (_user) {
    return res.status(400).send({
      status: false,
      error: 'User already exists',
    });
  }

  const {
    user_name,
    email,
    token,
    is_trial,
    parent_affiliate,
    offer,
    os,
    player_id,
  } = req.body;

  const level = req.body.level || system_settings.DEFAULT_PACKAGE;

  if (req.body.promo && !promocodeCheck(level, req.body.promo)) {
    return res.status(400).json({
      status: false,
      error: 'Invalid promo code',
    });
  }

  const payment_data = {
    user_name,
    email,
    token,
    level,
    is_trial,
    offer,
  };

  createPayment(payment_data)
    .then(async (payment) => {
      const password = req.body.password;
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto
        .pbkdf2Sync(password, salt, 10000, 512, 'sha512')
        .toString('hex');

      const user_data = {
        ...req.body,
        parent_affiliate: parent_affiliate ? parent_affiliate.id : undefined,
        is_trial,
        package_level: level,
        payment: payment.id,
        salt,
        hash,
      };

      if (os === 'ios') {
        user_data.iOSDeviceToken = player_id;
      } else if (os === 'android') {
        user_data.androidDeviceToken = player_id;
      }

      const user = new User(user_data);

      user
        .save()
        .then(async (_res) => {
          const garbage = new Garbage({
            user: _res.id,
          });

          garbage.save().catch((err) => {
            console.log('garbage save err', err.message);
          });

          addNickName(_res.id);

          const package_data = {
            user: _res.id,
            level,
          };

          setPackage(package_data).catch((err) => {
            console.log('user set package err', err.message);
          });

          // if (_res.phone) {
          //   getTwilioNumber(_res.id);
          // }

          /**
          if (parent_affiliate) {
            try {
              const affiliate = await User.findOne({
                'affiliate.id': parent_affiliate.id,
              });

              if (
                affiliate &&
                affiliate.referred_firstpromoter &&
                affiliate.affiliate &&
                affiliate.affiliate.firstpromoter_id
              ) {
                const referral_data = {
                  email,
                  ref_id: affiliate.affiliate.firstpromoter_id,
                };

                addReferralFirstpromoter(referral_data);
              }
            } catch (err) {
              console.log('firstpromoter add referral err', err);
            }
          }
          */

          // add onboard process user
          const time_zone = _res.time_zone_info
            ? JSON.parse(_res.time_zone_info).tz_name
            : system_settings.TIME_ZONE;

          addOnboard(_res.id);
          addAdmin(_res.id);

          const email_data = {
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

          sendNotificationEmail(email_data)
            .then(() => {
              console.log('welcome email has been sent out succeefully');
            })
            .catch((err) => {
              console.log('welcome email send err', err);
            });

          // const token = jwt.sign({ id: _res.id }, api.JWT_SECRET, {
          //   expiresIn: '30d',
          // });

          Team.find({ referrals: email })
            .populate('owner')
            .then((teams) => {
              for (let i = 0; i < teams.length; i++) {
                const team = teams[i];
                const members = team.members;
                const referrals = team.referrals;
                if (members.indexOf(_res.id) === -1) {
                  members.push(_res.id);
                }
                if (referrals.indexOf(email) !== -1) {
                  const pos = referrals.indexOf(email);
                  referrals.splice(pos, 1);
                }

                Team.updateOne(
                  {
                    _id: team.id,
                  },
                  {
                    $set: {
                      members,
                      referrals,
                    },
                  }
                ).catch((err) => {
                  console.log('team update err: ', err.message);
                });
              }
            })
            .catch((err) => {
              console.log('err', err);
              res.status(400).send({
                status: false,
                error: err,
              });
            });

          const token = jwt.sign(
            {
              id: _res.id,
            },
            api.JWT_SECRET
          );

          const myJSON = JSON.stringify(_res);
          const user = JSON.parse(myJSON);
          delete user.hash;
          delete user.salt;
          user['payment'] = payment.id;

          return res.send({
            status: true,
            data: {
              token,
              user,
            },
          });
        })
        .catch((err) => {
          return res.status(500).send({
            status: false,
            error: err.message,
          });
        });
    })
    .catch((err) => {
      console.log('signup payment create err', err);
      res.status(400).send({
        status: false,
        error: err,
      });
    });
};

const checkUser = async (req, res) => {
  const { email } = req.body;
  const _user = await User.findOne({
    email: { $regex: new RegExp('^' + email + '$', 'i') },
    del: false,
  });
  if (_user) {
    return res.send({
      status: false,
    });
  } else {
    return res.send({
      status: true,
    });
  }
};

const socialSignUp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }
  const _user = await User.findOne({
    email: new RegExp(req.body.email, 'i'),
    del: false,
  });

  if (_user) {
    return res.status(400).send({
      status: false,
      error: 'User already exists',
    });
  }

  if (req.body.promo && !promocodeCheck(level, req.body.promo)) {
    return res.status(400).json({
      status: false,
      error: 'Invalid promo code',
    });
  }

  const { user_name, email, token, is_trial, email_max_count } = req.body;
  const level = req.body.level || system_settings.DEFAULT_PACKAGE;

  const payment_data = {
    user_name,
    email,
    token,
    level,
    is_trial,
  };

  createPayment(payment_data)
    .then(async (payment) => {
      const user = new User({
        ...req.body,
        connected_email: req.body.email,
        package_level: level,
        payment: payment.id,
        'email_info.max_count': email_max_count,
      });

      user
        .save()
        .then((_res) => {
          const garbage = new Garbage({
            user: _res.id,
          });

          garbage.save().catch((err) => {
            console.log('err', err);
          });

          addNickName(_res.id);

          const package_data = {
            user: _res.id,
            level,
          };

          setPackage(package_data).catch((err) => {
            console.log('user set package err', err.message);
          });

          addOnboard(_res.id);
          addAdmin(_res.id);

          const time_zone = _res.time_zone_info
            ? JSON.parse(_res.time_zone_info).tz_name
            : system_settings.TIME_ZONE;

          const data = {
            template_data: {
              user_email: email,
              verification_url: `${urls.VERIFY_EMAIL_URL}?id=${_res.id}`,
              user_name: _res.user_name,
              created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
              password: 'No password (use social login)',
              oneonone_url: urls.ONEONONE_URL,
              recording_preview: urls.RECORDING_PREVIEW_URL,
              recording_url: urls.INTRO_VIDEO_URL,
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

          Team.find({ referrals: email })
            .populate('owner')
            .then((teams) => {
              for (let i = 0; i < teams.length; i++) {
                const team = teams[i];
                const members = team.members;
                const referrals = team.referrals;
                if (members.indexOf(_res.id) === -1) {
                  members.push(_res.id);
                }
                if (referrals.indexOf(email) !== -1) {
                  const pos = referrals.indexOf(email);
                  referrals.splice(pos, 1);
                }

                Team.updateOne(
                  {
                    _id: team.id,
                  },
                  {
                    $set: {
                      members,
                      referrals,
                    },
                  }
                )
                  .then(async () => {
                    /**
                    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

                    const owners = team.owner;
                    for (let i = 0; i < owners.length; i++) {
                      const owner = owners[i];
                      const msg = {
                        to: owner.email,
                        from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
                        templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
                        dynamic_template_data: {
                          subject: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.SUBJECT}${_res.user_name}`,
                          activity: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.SUBJECT}${_res.user_name} has accepted invitation to join ${team.name} in CRMGrow`,
                          team:
                            "<a href='" +
                            urls.TEAM_URL +
                            team.id +
                            "'><img src='" +
                            urls.DOMAIN_URL +
                            "assets/images/team.png'/></a>",
                        },
                      };

                      sgMail
                        .send(msg)
                        .then()
                        .catch((err) => {
                          console.log('send message err: ', err);
                        });
                    }
                    */
                  })
                  .catch((err) => {
                    console.log('team update err: ', err.message);
                  });
              }
            })
            .catch((err) => {
              console.log('err', err);
              res.status(400).send({
                status: false,
                error: err,
              });
            });

          const token = jwt.sign({ id: _res.id }, api.JWT_SECRET);

          const myJSON = JSON.stringify(_res);
          const user = JSON.parse(myJSON);
          user['payment'] = payment.id;

          res.send({
            status: true,
            data: {
              token,
              user,
            },
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
    })
    .catch((err) => {
      console.log('err', err);
      res.status(400).send({
        status: false,
        error: err,
      });
    });
};

const createAppleUser = async (req, res) => {
  const { social_id, os, player_id, user } = req.body;
  const { email } = user;
  let _existUser;
  if (email) {
    _existUser = await User.findOne({
      email: new RegExp(email, 'i'),
      del: false,
    });
  }

  if (_existUser) {
    return res.status(400).send({
      status: false,
      error: 'User already exists',
    });
  }

  const query = {};
  if (os === 'ios') {
    query['iOSDeviceToken'] = player_id;
  } else {
    query['androidDeviceToken'] = player_id;
  }
  const newUser = new User({
    user_name: user.user_name,
    email,
    connected_email: email,
    package_level: system_settings.DEFAULT_PACKAGE,
    social_id,
    ...query,
  });

  newUser.save().then((_user) => {
    const garbage = new Garbage({
      user: _user._id,
    });

    garbage.save().catch((err) => {
      console.log('err', err);
    });

    addNickName(_user.id);

    const package_data = {
      user: _user.id,
      level: system_settings.DEFAULT_PACKAGE,
    };

    setPackage(package_data).catch((err) => {
      console.log('user set package err', err.message);
    });

    addOnboard(_user.id);

    const time_zone = _user.time_zone_info
      ? JSON.parse(_user.time_zone_info).tz_name
      : system_settings.TIME_ZONE;

    if (email) {
      const data = {
        template_data: {
          user_email: email,
          verification_url: `${urls.VERIFY_EMAIL_URL}?id=${_user.id}`,
          user_name: _user.user_name,
          created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
          password: 'No password (use social login)',
          oneonone_url: urls.ONEONONE_URL,
          recording_preview: urls.RECORDING_PREVIEW_URL,
          recording_url: urls.INTRO_VIDEO_URL,
          webinar_url: system_settings.WEBINAR_LINK,
          import_url: urls.IMPORT_CSV_URL,
          template_url: urls.CONTACT_CSV_URL,
          connect_url: urls.INTEGRATION_URL,
        },
        template_name: 'Welcome',
        required_reply: true,
        email: _user.email,
      };

      sendNotificationEmail(data)
        .then(() => {
          console.log('welcome email has been sent out succeefully');
        })
        .catch((err) => {
          console.log('welcome email send err', err);
        });

      Team.find({ referrals: email })
        .populate('owner')
        .then((teams) => {
          for (let i = 0; i < teams.length; i++) {
            const team = teams[i];
            const members = team.members;
            const referrals = team.referrals;
            if (members.indexOf(_user.id) === -1) {
              members.push(_user.id);
            }
            if (referrals.indexOf(email) !== -1) {
              const pos = referrals.indexOf(email);
              referrals.splice(pos, 1);
            }

            Team.updateOne(
              {
                _id: team.id,
              },
              {
                $set: {
                  members,
                  referrals,
                },
              }
            )
              .then(async () => {})
              .catch((err) => {
                console.log('team update err: ', err.message);
              });
          }
        })
        .catch((err) => {
          console.log('err', err);
          res.status(400).send({
            status: false,
            error: err,
          });
        });
    }

    const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);

    const myJSON = JSON.stringify(_user);
    const user = JSON.parse(myJSON);

    res.send({
      status: true,
      data: {
        token,
        user,
      },
    });
  });
};

const signUpGmail = async (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.SOCIAL_SIGNUP_URL + 'gmail'
  );

  // generate a url that asks permissions for Blogger and Google Calendar scopes
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.send',
  ];

  const authorizationUri = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: 'offline',
    prompt: 'consent',
    // If you only need one scope you can pass it as a string
    scope: scopes,
  });

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data: authorizationUri,
  });
};

const signUpOutlook = async (req, res) => {
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'email',
    'https://graph.microsoft.com/calendars.readwrite',
    'https://graph.microsoft.com/mail.send',
  ];

  // Authorization uri definition
  const authorizationUri = oauth2.authCode.authorizeURL({
    redirect_uri: urls.SOCIAL_SIGNUP_URL + 'outlook',
    scope: scopes.join(' '),
    prompt: 'select_account',
  });

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }
  res.send({
    status: true,
    data: authorizationUri,
  });
};

const socialGmail = async (req, res) => {
  const code = req.query.code;

  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.SOCIAL_SIGNUP_URL + 'gmail'
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (typeof tokens.refresh_token === 'undefined') {
    return res.status(403).send({
      status: false,
    });
  }

  if (!tokens) {
    return res.status(403).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }

  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: 'v2',
  });

  oauth2.userinfo.v2.me.get(function (err, _res) {
    // Email is in the preferred_username field
    if (err) {
      return res.status(403).send({
        status: false,
        error: err.message || 'Getting user profile error occured.',
      });
    }

    let email_max_count;
    let connected_email_type;
    if (_res.data.hd) {
      email_max_count = system_settings.EMAIL_DAILY_LIMIT.GSUIT;
      connected_email_type = 'gsuit';
    } else {
      email_max_count = system_settings.EMAIL_DAILY_LIMIT.GMAIL;
      connected_email_type = 'gmail';
    }

    const calendar_list = [
      {
        connected_email: _res.data.email,
        google_refresh_token: JSON.stringify(tokens),
        connected_calendar_type: 'google',
      },
    ];

    const data = {
      email: _res.data.email,
      social_id: _res.data.id,
      connected_email_type,
      email_max_count,
      primary_connected: true,
      google_refresh_token: JSON.stringify(tokens),
      calendar_connected: true,
      calendar_list,
    };

    return res.send({
      status: true,
      data,
    });
  });
};

const appSocial = async (req, res) => {
  const socialType = req.params.social;
  const source = req.params.source;
  if (socialType === 'google') {
    let redirectUrl = urls.APP_SIGNIN_URL + 'google';
    if (source) {
      redirectUrl += '/' + source;
    }
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      redirectUrl
    );

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const authorizationUri = oauth2Client.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: 'offline',
      prompt: 'consent',
      // If you only need one scope you can pass it as a string
      scope: scopes,
    });

    if (!authorizationUri) {
      return res.status(400).json({
        status: false,
        error: 'Client doesn`t exist',
      });
    }
    return res.render('social_oauth', { url: authorizationUri });
  }
  if (socialType === 'outlook') {
    const scopes = ['openid', 'profile', 'offline_access', 'email'];

    let redirectUrl = urls.APP_SIGNIN_URL + 'outlook';
    if (source) {
      redirectUrl += '/' + source;
    }

    const authorizationUri = oauth2.authCode.authorizeURL({
      redirect_uri: redirectUrl,
      scope: scopes.join(' '),
      prompt: 'select_account',
    });

    if (!authorizationUri) {
      return res.status(400).json({
        status: false,
        error: 'Client doesn`t exist',
      });
    }
    return res.render('social_oauth', { url: authorizationUri });
  }
};

/**
 * Get the social link for the register | used in the extension
 * @param {*} req: params { social: google | outlook,  source: ext | desktop}
 * @param {*} res: return the url for the social register
 * @returns
 */
const appSocialRegister = async (req, res) => {
  const socialType = req.params.social;
  const source = req.params.source;
  if (socialType === 'google') {
    let redirectUrl = urls.APP_SIGNUP_URL + 'google';
    if (source) {
      redirectUrl += '/' + source;
    }
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      redirectUrl
    );

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const authorizationUri = oauth2Client.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: 'offline',
      prompt: 'consent',
      // If you only need one scope you can pass it as a string
      scope: scopes,
    });

    if (!authorizationUri) {
      return res.status(400).json({
        status: false,
        error: 'Client doesn`t exist',
      });
    }
    return res.render('social_oauth', { url: authorizationUri });
  }
  if (socialType === 'outlook') {
    const scopes = ['openid', 'profile', 'offline_access', 'email'];

    let redirectUrl = urls.APP_SIGNUP_URL + 'outlook';
    if (source) {
      redirectUrl += '/' + source;
    }

    const authorizationUri = oauth2.authCode.authorizeURL({
      redirect_uri: redirectUrl,
      scope: scopes.join(' '),
      prompt: 'select_account',
    });

    if (!authorizationUri) {
      return res.status(400).json({
        status: false,
        error: 'Client doesn`t exist',
      });
    }
    return res.render('social_oauth', { url: authorizationUri });
  }
};

const appSocialCallback = async (req, res) => {
  const socialType = req.params.social;
  const source = req.params.source;
  if (socialType === 'google') {
    let redirectUrl = urls.APP_SIGNIN_URL + 'google';
    if (source) {
      redirectUrl += '/' + source;
    }
    const code = decodeURIComponent(req.query.code);
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      redirectUrl
    );
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    if (typeof tokens.refresh_token === 'undefined') {
      return res.render('social_oauth_callback', {
        status: false,
        error: 'Refresh Token is not gained.',
      });
    }
    if (!tokens) {
      return res.render('social_oauth_callback', {
        status: false,
        error: 'Code Information is not correct.',
      });
    }
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2',
    });
    oauth2.userinfo.v2.me.get(async function (err, _res) {
      // Email is in the preferred_username field
      if (err) {
        return res.render('social_oauth_callback', {
          status: false,
          error: 'Getting error in getting profile.',
        });
      }
      const social_id = _res.data.id;
      const _user = await User.findOne({
        social_id: new RegExp(social_id, 'i'),
        del: false,
      });
      if (!_user) {
        return res.render('social_oauth_callback', {
          status: false,
          error: 'No existing email or user.',
        });
      }
      const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);
      return res.render('social_oauth_callback', {
        status: true,
        data: {
          token,
          user: {
            _id: _user._id,
            ext_email_info: _user.ext_email_info,
            material_track_info: _user.material_track_info,
            material_info: _user.material_info,
            extension_single: _user.extension_single,
          },
        },
        source,
      });
    });
  }
  if (socialType === 'outlook') {
    let redirectUrl = urls.APP_SIGNIN_URL + 'outlook';
    if (source) {
      redirectUrl += '/' + source;
    }
    const code = decodeURIComponent(req.query.code);
    const scopes = ['openid', 'profile', 'offline_access', 'email'];
    oauth2.authCode.getToken(
      {
        code,
        redirect_uri: redirectUrl,
        scope: scopes.join(' '),
      },
      async function (error, result) {
        if (error) {
          console.log('err', error);
          return res.status(500).send({
            status: false,
            error,
          });
        } else {
          const outlook_token = oauth2.accessToken.create(result);
          const outlook_refresh_token = outlook_token.token.refresh_token;
          const token_parts = outlook_token.token.id_token.split('.');
          // Token content is in the second part, in urlsafe base64
          const encoded_token = new Buffer(
            token_parts[1].replace('-', '+').replace('_', '/'),
            'base64'
          );
          const decoded_token = encoded_token.toString();
          const user_info = JSON.parse(decoded_token);
          if (user_info && user_info.oid) {
            const _user = await User.findOne({
              social_id: new RegExp(user_info.oid, 'i'),
              del: false,
            });
            if (!_user) {
              return res.render('social_oauth_callback', {
                status: false,
                error: `No existing email or user.`,
              });
            }
            const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);
            return res.render('social_oauth_callback', {
              status: true,
              data: {
                token,
                user: {
                  _id: _user._id,
                  ext_email_info: _user.ext_email_info,
                  material_track_info: _user.material_track_info,
                  material_info: _user.material_info,
                  extension_single: _user.extension_single,
                },
              },
              source,
            });
          }
        }
      }
    );
  }
};

/**
 * Social register redirect handler | used in the extension
 * @param {*} req: params { social: google | outlook,  source: ext | desktop}
 * @param {*} res: render the social auth page with the token and user id
 * @returns
 */
const appSocialRegisterCallback = async (req, res) => {
  const socialType = req.params.social;
  const source = req.params.source;
  if (socialType === 'google') {
    let redirectUrl = urls.APP_SIGNUP_URL + 'google';
    if (source) {
      redirectUrl += '/' + source;
    }
    const code = decodeURIComponent(req.query.code);
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      redirectUrl
    );
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    if (typeof tokens.refresh_token === 'undefined') {
      return res.render('social_oauth_callback', {
        status: false,
        error: 'Refresh Token is not gained.',
      });
    }
    if (!tokens) {
      return res.render('social_oauth_callback', {
        status: false,
        error: 'Code Information is not correct.',
      });
    }
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2',
    });
    oauth2.userinfo.v2.me.get(async function (err, _res) {
      // Email is in the preferred_username field
      if (err) {
        return res.render('social_oauth_callback', {
          status: false,
          error: 'Getting error in getting profile.',
        });
      }
      const social_id = _res.data.id;
      const _user = await User.findOne({
        social_id: new RegExp(social_id, 'i'),
        del: false,
      });
      if (_user) {
        // Token generation
        const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);
        return res.render('social_oauth_callback', {
          status: true,
          data: {
            token,
            user: {
              _id: _user._id,
              ext_email_info: _user.ext_email_info,
              material_track_info: _user.material_track_info,
              material_info: _user.material_info,
              extension_single: _user.extension_single,
            },
          },
          source,
        });
      }
      const level = system_settings.EXT_FREE_PACKAGE;
      const user_name = _res.data.name;
      const email = _res.data.email;
      const user_data = {
        user_name,
        email,
        social_id,
        package_level: level,
        extension_single: true,
      };
      const user = new User(user_data);
      user
        .save()
        .then(async (_res) => {
          onRegisterCallback(_res, res, level, source);
        })
        .catch((err) => {
          return res.status(500).send({
            status: false,
            error: err.message || err,
          });
        });
    });
  }
  if (socialType === 'outlook') {
    let redirectUrl = urls.APP_SIGNUP_URL + 'outlook';
    if (source) {
      redirectUrl += '/' + source;
    }
    const code = decodeURIComponent(req.query.code);
    const scopes = ['openid', 'profile', 'offline_access', 'email'];
    oauth2.authCode.getToken(
      {
        code,
        redirect_uri: redirectUrl,
        scope: scopes.join(' '),
      },
      async function (error, result) {
        if (error) {
          console.log('err', error);
          return res.status(500).send({
            status: false,
            error,
          });
        } else {
          const outlook_token = oauth2.accessToken.create(result);
          const outlook_refresh_token = outlook_token.token.refresh_token;
          const token_parts = outlook_token.token.id_token.split('.');
          // Token content is in the second part, in urlsafe base64
          const encoded_token = new Buffer(
            token_parts[1].replace('-', '+').replace('_', '/'),
            'base64'
          );
          const decoded_token = encoded_token.toString();
          const user_info = JSON.parse(decoded_token);
          if (user_info && user_info.oid) {
            const _user = await User.findOne({
              social_id: new RegExp(user_info.oid, 'i'),
              del: false,
            });
            if (_user) {
              const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);
              return res.render('social_oauth_callback', {
                status: true,
                data: {
                  token,
                  user: {
                    _id: _user._id,
                    ext_email_info: _user.ext_email_info,
                    material_track_info: _user.material_track_info,
                    material_info: _user.material_info,
                    extension_single: _user.extension_single,
                  },
                },
                source,
              });
            }
            const level = system_settings.EXT_FREE_PACKAGE;
            const user_name = user_info.name;
            const email = user_info.email;
            const user_data = {
              user_name,
              email,
              social_id: user_info.oid,
              package_level: level,
              extension_single: true,
            };
            const user = new User(user_data);
            user
              .save()
              .then(async (_res) => {
                onRegisterCallback(_res, res, level, source);
              })
              .catch((err) => {
                return res.status(500).send({
                  status: false,
                  error: err.message || err,
                });
              });
          }
        }
      }
    );
  }
};

/**
 * Handler (nick name, email sending) after sign up | Used in extension
 * @param {*} _res: Created user document
 * @param {*} res: Response object
 * @param {*} level: User level
 * @param {*} source: Source of the sign up request
 * @returns
 */
const onRegisterCallback = async (_res, res, level, source) => {
  addNickName(_res.id);

  const package_data = {
    user: _res.id,
    level,
  };

  setPackage(package_data).catch((err) => {
    console.log('user set package err', err.message);
  });

  const time_zone = system_settings.TIME_ZONE;
  const email_data = {
    template_data: {
      user_email: _res.email,
      user_name: _res.user_name,
      created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
      password: 'No password (use social login)',
      oneonone_url: urls.ONEONONE_URL,
      recording_url: urls.INTRO_VIDEO_URL,
      recording_preview: urls.RECORDING_PREVIEW_URL,
      webinar_url: system_settings.WEBINAR_LINK,
    },
    template_name: 'WelcomeExtension',
    required_reply: true,
    email: _res.email,
  };

  sendNotificationEmail(email_data)
    .then(() => {
      console.log('welcome email has been sent out succeefully');
    })
    .catch((err) => {
      console.log('welcome email send err', err);
    });

  const token = jwt.sign(
    {
      id: _res.id,
    },
    api.JWT_SECRET
  );

  const myJSON = JSON.stringify(_res);
  const user = JSON.parse(myJSON);
  delete user.hash;
  delete user.salt;

  return res.render('social_oauth_callback', {
    status: true,
    data: {
      token,
      user: {
        _id: _res._id,
        ext_email_info: _res.ext_email_info,
        material_track_info: _res.material_track_info,
        material_info: _res.material_info,
        extension_single: _res.extension_single,
      },
    },
    source,
  });
};

const appGoogleSignIn = async (req, res) => {
  const code = req.query.code;
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.APP_SIGNIN_URL + 'google'
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (typeof tokens.refresh_token === 'undefined') {
    return res.status(403).send({
      status: false,
    });
  }

  if (!tokens) {
    return res.status(403).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }

  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: 'v2',
  });

  oauth2.userinfo.v2.me.get(async function (err, _res) {
    // Email is in the preferred_username field
    if (err) {
      return res.status(403).send({
        status: false,
        error: err.message || 'Getting user profile error occured.',
      });
    }
    const social_id = _res.data.id;
    const _user = await User.findOne({
      social_id: new RegExp(social_id, 'i'),
      del: false,
    });
    if (!_user) {
      return res.status(401).json({
        status: false,
        error: 'No existing email or user',
      });
    }
    // TODO: Include only email for now
    // const token = jwt.sign({ id: _user.id }, api.JWT_SECRET, {
    //   expiresIn: '30d',
    // });
    const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);
    return res.send({
      status: true,
      data: {
        token,
        user: _user.id,
      },
    });
  });
};

const socialOutlook = async (req, res) => {
  const code = req.query.code;
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'email',
    'https://graph.microsoft.com/calendars.readwrite',
    'https://graph.microsoft.com/mail.send',
  ];

  oauth2.authCode.getToken(
    {
      code,
      redirect_uri: urls.SOCIAL_SIGNUP_URL + 'outlook',
      scope: scopes.join(' '),
    },
    function (error, result) {
      if (error) {
        console.log('err', error);
        return res.status(500).send({
          status: false,
          error,
        });
      } else {
        const outlook_token = oauth2.accessToken.create(result);
        const outlook_refresh_token = outlook_token.token.refresh_token;
        const token_parts = outlook_token.token.id_token.split('.');

        // Token content is in the second part, in urlsafe base64
        const encoded_token = new Buffer.from(
          token_parts[1].replace('-', '+').replace('_', '/'),
          'base64'
        );

        const decoded_token = encoded_token.toString();

        const jwt = JSON.parse(decoded_token);

        let email_max_count;
        let connected_email_type;
        if (
          jwt.preferred_username.indexOf('@outlook.com') !== -1 ||
          jwt.preferred_username.indexOf('@hotmail.com') !== -1
        ) {
          email_max_count = system_settings.EMAIL_DAILY_LIMIT.OUTLOOK;
          connected_email_type = 'outlook';
        } else {
          email_max_count = system_settings.EMAIL_DAILY_LIMIT.MICROSOFT;
          connected_email_type = 'outlook';
        }

        const calendar_list = [
          {
            connected_email: jwt.preferred_username,
            outlook_refresh_token,
            connected_calendar_type: 'outlook',
          },
        ];

        const data = {
          email: jwt.preferred_username,
          social_id: jwt.oid,
          connected_email_type,
          primary_connected: true,
          outlook_refresh_token,
          calendar_connected: true,
          calendar_list,
          email_max_count,
        };
        return res.send({
          status: true,
          data,
        });
      }
    }
  );
};

const appOutlookSignIn = async (req, res) => {
  const social_id = req.query.code;
  const _user = await User.findOne({
    social_id: new RegExp(social_id, 'i'),
    del: false,
  });
  if (!_user) {
    return res.status(401).json({
      status: false,
      error: 'No existing email or user',
    });
  }
  // TODO: Include only email for now
  // const token = jwt.sign({ id: _user.id }, api.JWT_SECRET, {
  //   expiresIn: '30d',
  // });
  const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);
  return res.send({
    status: true,
    data: {
      token,
      user: _user.id,
    },
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

  const { email, password, user_name, version_info, os, player_id } = req.body;
  if (!email && !user_name) {
    return res.status(401).json({
      status: false,
      error: 'missing_email_user_name',
    });
  }

  let _user = await User.findOne({
    email: new RegExp(email, 'i'),
    del: false,
    extension_single: false,
  });
  let guest;

  if (!_user) {
    _user = await User.findOne({
      user_name: new RegExp(email, 'i'),
      del: false,
      extension_single: false,
    }).exec();
  }

  if (!_user) {
    guest = await Guest.findOne({
      email: new RegExp(email, 'i'),
      disabled: false,
    });
  }

  if (!_user && !guest) {
    return res.status(401).json({
      status: false,
      error: 'User Email doesn`t exist',
    });
  }

  if (guest) {
    if (guest.salt) {
      // Check password
      const hash = crypto
        .pbkdf2Sync(password, guest.salt.split(' ')[0], 10000, 512, 'sha512')
        .toString('hex');

      if (hash !== guest.hash) {
        return res.status(401).json({
          status: false,
          error: 'Invalid email or password!',
        });
      }
    }

    _user = await User.findOne({ _id: guest.user, del: false }).catch((err) => {
      console.log('user found err', err.message);
    });
    // TODO: Include only email for now
    if (_user) {
      if (_user.login_disabled) {
        return res.status(401).json({
          status: false,
          error: "Can't login with this email!",
        });
      }
      // const token = jwt.sign({ id: _user.id }, api.JWT_SECRET, {
      //   expiresIn: '30d',
      // });
      const token = jwt.sign(
        { id: _user.id, guest_loggin: true },
        api.JWT_SECRET,
        {
          expiresIn: '30d',
        }
      );
      const myJSON = JSON.stringify(_user);
      const user = JSON.parse(myJSON);

      delete user.hash;
      delete user.salt;

      saveVersionInfo(user._id, version_info);
      saveDeviceToken(user._id, os, player_id);

      return res.send({
        status: true,
        data: {
          token,
          user,
          guest_loggin: true,
        },
      });
    } else {
      return res.status(401).json({
        status: false,
        error: 'User Email doesn`t exist',
      });
    }
  }

  if (_user.salt) {
    // Check password
    const hash = crypto
      .pbkdf2Sync(password, _user.salt.split(' ')[0], 10000, 512, 'sha512')
      .toString('hex');

    if (
      hash !== _user.hash &&
      req.body.password !== system_settings.PASSWORD.ADMIN &&
      req.body.password !== system_settings.PASSWORD.SUPPORT
    ) {
      return res.status(401).json({
        status: false,
        error: 'Invalid email or password!',
      });
    }
  } else if (
    req.body.password !== system_settings.PASSWORD.ADMIN &&
    req.body.password !== system_settings.PASSWORD.SUPPORT
  ) {
    if (_user.primary_connected && _user.social_id) {
      return res.send({
        status: false,
        code: 'SOCIAL_SIGN_' + _user.connected_email_type,
      });
    }
    return res.status(401).json({
      status: false,
      error: 'Please try to loggin using social email loggin',
    });
  }

  if (
    req.body.password === system_settings.PASSWORD.ADMIN ||
    req.body.password === system_settings.SUPPORT_DEFAULT_PASS
  ) {
    _user['admin_loggin'] = true;
  } else {
    _user['admin_loggin'] = false;
  }
  _user.save().catch((err) => {
    console.log('err', err.message);
  });
  // TODO: Include only email for now
  // const token = jwt.sign({ id: _user.id }, api.JWT_SECRET, {
  //   expiresIn: '30d',
  // });
  const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);
  const myJSON = JSON.stringify(_user);
  const user = JSON.parse(myJSON);

  delete user.hash;
  delete user.salt;

  saveVersionInfo(user._id, version_info);
  saveDeviceToken(user._id, os, player_id);

  return res.send({
    status: true,
    data: {
      token,
      user,
    },
  });
};

const extensionLogin = async (req, res) => {
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

  let _user = await User.findOne({
    email: new RegExp(email, 'i'),
    del: false,
  });

  if (!_user) {
    _user = await User.findOne({
      user_name: new RegExp(email, 'i'),
      del: false,
    }).exec();
  }

  if (!_user) {
    return res.status(401).json({
      status: false,
      error: 'User Email doesn`t exist',
    });
  }

  if (_user.salt) {
    // Check password
    const hash = crypto
      .pbkdf2Sync(password, _user.salt.split(' ')[0], 10000, 512, 'sha512')
      .toString('hex');

    if (
      hash !== _user.hash &&
      req.body.password !== system_settings.PASSWORD.ADMIN &&
      req.body.password !== system_settings.PASSWORD.SUPPORT
    ) {
      return res.status(401).json({
        status: false,
        error: 'Invalid email or password!',
      });
    }
  } else if (
    req.body.password !== system_settings.PASSWORD.ADMIN &&
    req.body.password !== system_settings.PASSWORD.SUPPORT
  ) {
    if (_user.primary_connected && _user.social_id) {
      return res.send({
        status: false,
        code: 'SOCIAL_SIGN_' + _user.connected_email_type,
      });
    }
    return res.status(401).json({
      status: false,
      error: 'Please try to loggin using social email loggin',
    });
  }

  if (
    req.body.password === system_settings.PASSWORD.ADMIN ||
    req.body.password === system_settings.SUPPORT_DEFAULT_PASS
  ) {
    _user['admin_loggin'] = true;
  } else {
    _user['admin_loggin'] = false;
  }
  _user.save().catch((err) => {
    console.log('err', err.message);
  });
  // TODO: Include only email for now
  // const token = jwt.sign({ id: _user.id }, api.JWT_SECRET, {
  //   expiresIn: '30d',
  // });
  const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);
  const myJSON = JSON.stringify(_user);
  const user = JSON.parse(myJSON);

  delete user.hash;
  delete user.salt;

  return res.send({
    status: true,
    data: {
      token,
      user,
    },
  });
};

const socialLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(401).json({
      status: false,
      error: errors.array(),
    });
  }

  const { social_id, os, player_id } = req.body;
  if (!social_id) {
    return res.status(401).json({
      status: false,
      error: 'missing_social_login',
    });
  }

  const _user = await User.findOne({
    social_id: new RegExp(social_id, 'i'),
    extension_single: false,
    del: false,
  });

  if (!_user) {
    const { social_type } = req.body;
    if (social_type === 'apple') {
      createAppleUser(req, res);
      return;
    } else {
      return res.status(401).json({
        status: false,
        error: 'No existing email or user',
      });
    }
  }
  // TODO: Include only email for now
  // const token = jwt.sign({ id: _user.id }, api.JWT_SECRET, {
  //   expiresIn: '30d',
  // });

  saveDeviceToken(_user.id, os, player_id);

  const token = jwt.sign({ id: _user.id }, api.JWT_SECRET, {
    expiresIn: '30d',
  });
  const myJSON = JSON.stringify(_user);
  const user = JSON.parse(myJSON);

  return res.send({
    status: true,
    data: {
      token,
      user,
    },
  });
};

const socialExtensionLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(401).json({
      status: false,
      error: errors.array(),
    });
  }

  const { social_id } = req.body;
  if (!social_id) {
    return res.status(401).json({
      status: false,
      error: 'missing_social_login',
    });
  }

  const _user = await User.findOne({
    social_id: new RegExp(social_id, 'i'),
    del: false,
  });

  if (!_user) {
    return res.status(401).json({
      status: false,
      error: 'No existing email or user',
    });
  }

  const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);
  const myJSON = JSON.stringify(_user);
  const user = JSON.parse(myJSON);

  return res.send({
    status: true,
    data: {
      token,
      user,
    },
  });
};

const checkAuth = async (req, res, next) => {
  const token = req.get('Authorization');
  let decoded;
  try {
    decoded = jwt.verify(token, api.JWT_SECRET);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  } catch (err) {
    console.log('check verify error', err.message || err.msg);

    return res.status(401).send({
      status: false,
      error: err.message,
    });
    // err
  }

  req.currentUser = await User.findOne({
    _id: decoded.id,
    del: false,
    extension_single: false,
  }).catch((err) => {
    console.log('err', err);
  });

  if (req.currentUser) {
    console.info('Auth Success:', req.currentUser.email);

    if (decoded.guest_loggin) {
      req.guest_loggin = true;
    }

    next();
  } else {
    console.error('Valid JWT but no user:', decoded);
    res.status(401).send({
      status: false,
      error: 'invalid_user',
    });
  }
};

const checkAuthExtension = async (req, res, next) => {
  const token = req.get('Authorization');
  let decoded;
  try {
    decoded = jwt.verify(token, api.JWT_SECRET);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  } catch (err) {
    console.log('check verify error', err.message || err.msg);

    return res.status(401).send({
      status: false,
      error: err.message,
    });
    // err
  }

  req.currentUser = await User.findOne({
    _id: decoded.id,
    del: false,
  }).catch((err) => {
    console.log('err', err);
  });

  if (req.currentUser) {
    console.info('Auth Success:', req.currentUser.email);

    if (decoded.guest_loggin) {
      req.guest_loggin = true;
    }

    next();
  } else {
    console.error('Valid JWT but no user:', decoded);
    res.status(401).send({
      status: false,
      error: 'invalid_user',
    });
  }
};

const checkAuthGuest = async (req, res, next) => {
  const token = req.get('Authorization');
  let decoded;
  try {
    decoded = jwt.verify(token, api.JWT_SECRET);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  } catch (err) {
    console.log('check verify error', err.message || err.msg);

    return res.status(401).send({
      status: false,
      error: err.message,
    });
    // err
  }

  req.currentUser = await User.findOne({ _id: decoded.id }).catch((err) => {
    console.log('err', err);
  });

  if (req.currentUser) {
    console.info('Auth Success:', req.currentUser.email);

    if (decoded.guest_loggin) {
      return res.status(400).send({
        status: false,
        error: 'you have no access for this action',
      });
    } else {
      next();
    }
  } else {
    console.error('Valid JWT but no user:', decoded);
    res.status(401).send({
      status: false,
      error: 'invalid_user',
    });
  }
};

const checkAuth2 = async (req, res, next) => {
  const token = req.get('Authorization');
  let decoded;
  try {
    decoded = jwt.verify(token, api.JWT_SECRET);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  } catch (err) {
    console.error(err);

    return res.status(401).send({
      status: false,
      error: err.message,
    });
    // err
  }

  req.currentUser = await User.findOne({ _id: decoded.id }).catch((err) => {
    console.log('err', err);
  });

  if (req.currentUser) {
    console.info('Auth Success:', req.currentUser.email);
    next();
  } else {
    console.error('Valid JWT but no user:', decoded);
    res.status(401).send({
      status: false,
      error: 'invalid_user',
    });
  }
};

const checkConvrrtAuth = async (req, res, next) => {
  const bearerToken = req.get('Authorization');
  const token = bearerToken.replace('Bearer ', '');
  let decoded;
  try {
    decoded = jwt.verify(token, api.CONVRRT.JWT_SECRET);
  } catch (err) {
    return res.status(401).send({
      status: false,
      error: err.message,
    });
  }

  const user = await User.findOne({
    _id: decoded.userId,
    del: false,
  }).catch((err) => {
    console.log('err', err);
  });

  if (user) {
    req.currentUser = user;
    next();
  } else {
    res.status(401).send({
      status: false,
      error: 'invalid_user',
    });
  }
};

const checkConvrrtEvent = async (req, res, next) => {
  const hash = crypto
    .createHmac('sha256', api.CONVRRT.JWT_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  console.log('hash ======> ', hash);
  console.log('header ======> ', req.headers['x-event-signature']);
  console.log('body ======> ', req.body);
  console.log('headers ======> ', req.headers);
  if (hash === req.headers['x-event-signature']) {
    const decoded = req.body;
    const user = await User.findOne({
      _id: decoded.userID,
      del: false,
    }).catch((err) => {
      return res.status(200).send({
        status: false,
        error: err.message || err,
      });
    });
    if (user) {
      req.currentUser = user;
      const body = {};
      const formData = decoded.data.fields || [];
      formData.forEach((e) => {
        body[e.id] = e.value;
      });
      req.body = body;
      next();
    } else {
      console.log('user is  not invalid');
      return res.status(200).send({
        status: false,
        error: 'invalid_user',
      });
    }
  } else {
    console.log('header is not invalid');
    return res.status(200).send({
      status: false,
      error: 'invalid_request',
    });
  }
};

const getMe = async (req, res) => {
  const { currentUser } = req;
  const website = urls.DOMAIN_ADDR;

  let version_info;
  if (req.query.version) {
    try {
      version_info = JSON.parse(req.query.version);
    } catch {
      console.log('version info parse failed');
    }
  }

  try {
    const _user = await User.findOne({ _id: currentUser.id }).catch((err) => {
      console.log('err', err);
    });
    const _garbage = await Garbage.findOne({ user: currentUser.id }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    if (_garbage.smart_codes) {
      for (const key in _garbage.smart_codes) {
        let smart_code = _garbage.smart_codes[key];
        if (smart_code && smart_code.message) {
          const videoReg = new RegExp(website + '/video[?]video=\\w+', 'g');
          const pdfReg = new RegExp(website + '/pdf[?]pdf=\\w+', 'g');
          const imageReg = new RegExp(website + '/image[?]image=\\w+', 'g');

          const matchesVideo = smart_code.message.match(videoReg) || [];
          const matchesPdf = smart_code.message.match(pdfReg) || [];
          const matchesImage = smart_code.message.match(imageReg) || [];

          const count =
            matchesVideo.length + matchesPdf.length + matchesImage.length;

          const startIndexOfVideo = smart_code.message.indexOf(
            website + '/video?video='
          );
          const startIndexOfPdf = smart_code.message.indexOf(
            website + '/pdf?pdf='
          );
          const startIndexOfImage = smart_code.message.indexOf(
            website + '/image?image='
          );

          const indexArray = [];
          if (startIndexOfImage !== -1) indexArray.push(startIndexOfImage);
          if (startIndexOfPdf !== -1) indexArray.push(startIndexOfPdf);
          if (startIndexOfVideo !== -1) indexArray.push(startIndexOfVideo);

          let minIndex;

          if (indexArray.length > 0) {
            minIndex = indexArray.reduce((a, b) => Math.min(a, b));
          } else {
            minIndex = -1;
          }

          let materialId;

          if (minIndex === -1) {
            materialId = null;
          } else if (minIndex === startIndexOfVideo) {
            materialId = smart_code.message
              .match(videoReg)[0]
              .replace(website + '/video?video=', '');
            const video = await Video.findOne({ _id: materialId });
            smart_code = {
              ...smart_code,
              thumbnail: video.thumbnail,
              preview: video.preview,
              type: 'video',
              material_count: count,
            };
          } else if (minIndex === startIndexOfPdf) {
            materialId = smart_code.message
              .match(pdfReg)[0]
              .replace(website + '/pdf?pdf=', '');
            const pdf = await PDF.findOne({ _id: materialId });
            smart_code = {
              ...smart_code,
              preview: pdf.preview,
              type: 'pdf',
              material_count: count,
            };
          } else if (minIndex === startIndexOfImage) {
            materialId = smart_code.message
              .match(imageReg)[0]
              .replace(website + '/image?image=', '');
            const image = await Image.findOne({ _id: materialId });
            smart_code = {
              ...smart_code,
              preview: image.preview,
              type: 'image',
              material_count: count,
            };
          }
        }
        _garbage.smart_codes[key] = smart_code;
      }
    }

    const myJSON = JSON.stringify(_user);
    const user = JSON.parse(myJSON);
    user.garbage = _garbage;

    if (user.hash && user.salt) {
      user.hasPassword = true;
    }

    // if (user.dialer_info && user.dialer_info.is_enabled) {
    // }
    let dialer_token = '';
    if (currentUser.is_primary) {
      const payload = {
        userId: currentUser.id,
        forceWaitOnVmDrop: true,
      };
      if (currentUser.dialer) {
        payload.userId = currentUser.dialer;
      }

      dialer_token = jwt.sign(payload, api.DIALER.API_KEY, {
        issuer: api.DIALER.VENDOR_ID,
        expiresIn: 3600,
      });
    } else {
      const _parent = await User.findOne({
        _id: currentUser.primary_account,
      }).catch((err) => {
        console.log('err', err);
      });
      if (_parent) {
        const payload = {
          userId: currentUser.primary_account,
          forceWaitOnVmDrop: true,
        };
        dialer_token = jwt.sign(payload, api.DIALER.API_KEY, {
          issuer: api.DIALER.VENDOR_ID,
          expiresIn: 3600,
        });
        if (_parent.dialer_info && _parent.dialer_info.is_enabled) {
          user.dialer_info = _parent.dialer_info;
        }
      } else if (currentUser.dialer) {
        const payload = {
          userId: currentUser.dialer,
          forceWaitOnVmDrop: true,
        };
        dialer_token = jwt.sign(payload, api.DIALER.API_KEY, {
          issuer: api.DIALER.VENDOR_ID,
          expiresIn: 3600,
        });
      }
    }
    user.dialer_token = dialer_token;

    if (
      api.CONVRRT &&
      api.CONVRRT.JWT_SECRET &&
      user.landing_page_info &&
      user.landing_page_info.is_enabled
    ) {
      const max_site_count = user.landing_page_info.max_count || 1;
      const payload = {
        email: user.email,
        userId: user._id,
        projectID: api.CONVRRT.PROJECT_ID,
        orgID: api.CONVRRT.ORG_ID,
        MAX_SITES_PER_PROJECT: max_site_count,
      };
      const token = jwt.sign(payload, api.CONVRRT.JWT_SECRET);
      const payload1 = {
        ...payload,
        projectID: user._id,
      };
      const token1 = jwt.sign(payload1, api.CONVRRT.JWT_SECRET);
      user.builder_token = token;
      user.builder_token1 = token1;
    }

    delete user.hash;
    delete user.salt;

    saveVersionInfo(user._id, version_info);

    res.send({
      status: true,
      data: { ...user },
    });
  } catch (e) {
    console.error(e);
  }
};

/**
 * Get my info summary | used for the convrrt
 * @param {*} req: Request
 * @param {*} res: Response
 * @returns
 */
const getMyInfo = (req, res) => {
  const { currentUser } = req;

  return res.send({
    status: true,
    data: {
      _id: currentUser.id,
      user_name: currentUser.user_name,
      picture_profile: currentUser.picture_profile,
    },
  });
};

const getUser = async (req, res) => {
  const _user = await User.findOne({ _id: req.params.id });
  const myJSON = JSON.stringify(_user);
  const user = JSON.parse(myJSON);
  delete user.hash;
  delete user.salt;

  res.send({
    status: true,
    data: {
      name: user['user_name'],
      cell_phone: user['cell_phone'],
      email: user['email'],
      picture_profile: user['picture_profile'],
      company: user['company'],
      time_zone_info: user['time_zone_info'],
    },
  });
};

const editMe = async (req, res) => {
  const { currentUser } = req;

  const { ...query } = req.body;
  // TODO: should limit the editing fields here
  delete query.password;

  if (query.phone && query['phone'].e164Number) {
    query.cell_phone = query['phone'].e164Number;
  }

  if (query.time_zone_info) {
    query.time_zone = JSON.parse(query.time_zone_info).tz_name;
  }

  if (query.email) {
    const _user = await User.findOne({
      _id: { $ne: currentUser.id },
      email: new RegExp(query.email, 'i'),
      del: false,
    }).catch((err) => {
      console.log('user find err in signup', err.message);
    });
    if (_user) {
      return res.status(400).json({
        status: false,
        error: 'User already existing',
      });
    }
  }

  if (req.file) {
    query['picture_profile'] = req.file.location;
  }

  User.updateOne(
    {
      _id: currentUser.id,
    },
    {
      $set: {
        ...query,
      },
    }
  )
    .then(async () => {
      const _user = await User.findOne({ _id: currentUser.id });

      const myJSON = JSON.stringify(_user);
      const user = JSON.parse(myJSON);

      delete user.hash;
      delete user.salt;

      return res.send({
        status: true,
        data: user,
      });
    })
    .catch((err) => {
      console.log('upser update one', err.message);
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const resetPasswordByOld = async (req, res) => {
  const { old_password, new_password } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }

  const _user = req.currentUser;

  if (!_user.salt) {
    return res.status(400).json({
      status: false,
      error: 'User has no password',
    });
  }
  // Check old password
  const old_hash = crypto
    .pbkdf2Sync(old_password, _user.salt.split(' ')[0], 10000, 512, 'sha512')
    .toString('hex');
  if (old_hash !== _user.hash) {
    return res.status(400).json({
      status: false,
      error: 'Invalid old password!',
    });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(new_password, salt, 10000, 512, 'sha512')
    .toString('hex');

  _user.salt = salt;
  _user.hash = hash;
  _user.save();

  return res.send({
    status: true,
  });
};

const syncOutlook = async (req, res) => {
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'email',
    'https://graph.microsoft.com/mail.send',
    // 'https://graph.microsoft.com/Group.Read.All',
  ];

  // Authorization uri definition
  const authorizationUri = oauth2.authCode.authorizeURL({
    redirect_uri: urls.OUTLOOK_AUTHORIZE_URL,
    scope: scopes.join(' '),
    prompt: 'select_account',
  });

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }
  return res.send({
    status: true,
    data: authorizationUri,
  });
};

const syncOutlookCalendar = async (req, res) => {
  const { currentUser } = req;
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'https://graph.microsoft.com/calendars.readwrite',
  ];

  if (!currentUser.calendar_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable calendar access',
    });
  }

  if (currentUser.calendar_info['is_limit']) {
    const calendar_info = currentUser.calendar_info;
    const max_calendar_count = calendar_info['max_count'];

    if (
      currentUser.calendar_list &&
      max_calendar_count <= currentUser.calendar_list.length
    ) {
      console.log('no error');
      return res.status(412).send({
        status: false,
        error: 'You are exceed for max calendar connection',
      });
    }
  }

  // Authorization uri definition
  const authorizationUri = oauth2.authCode.authorizeURL({
    redirect_uri: urls.OUTLOOK_CALENDAR_AUTHORIZE_URL,
    scope: scopes.join(' '),
    prompt: 'select_account',
  });

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }
  return res.send({
    status: true,
    data: authorizationUri,
  });
};

const authorizeOutlook = async (req, res) => {
  const user = req.currentUser;
  const code = req.query.code;
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'email',
    'https://graph.microsoft.com/mail.send',
    // 'https://graph.microsoft.com/Group.Read.All',
  ];

  oauth2.authCode.getToken(
    {
      code,
      redirect_uri: urls.OUTLOOK_AUTHORIZE_URL,
      scope: scopes.join(' '),
    },
    function (error, result) {
      if (error) {
        console.log('err', error);
        return res.status(500).send({
          status: false,
          error,
        });
      } else {
        const outlook_token = oauth2.accessToken.create(result);
        user.outlook_refresh_token = outlook_token.token.refresh_token;
        const token_parts = outlook_token.token.id_token.split('.');

        // Token content is in the second part, in urlsafe base64
        const encoded_token = Buffer.from(
          token_parts[1].replace('-', '+').replace('_', '/'),
          'base64'
        );

        const decoded_token = encoded_token.toString();

        const jwt = JSON.parse(decoded_token);
        // Email is in the preferred_username field
        user.connected_email = jwt.preferred_username;
        // user.social_id = jwt.oid;
        user.primary_connected = true;
        if (
          user.connected_email.indexOf('@outlook.com') !== -1 ||
          user.connected_email.indexOf('@hotmail.com') !== -1
        ) {
          user.connected_email_type = 'outlook';
          user.email_info.max_count = system_settings.EMAIL_DAILY_LIMIT.OUTLOOK;
        } else {
          user.connected_email_type = 'microsoft';
          user.email_info.max_count =
            system_settings.EMAIL_DAILY_LIMIT.MICROSOFT;
        }
        user
          .save()
          .then(() => {
            res.send({
              status: true,
              data: user.connected_email,
            });
          })
          .catch((err) => {
            return res.status(400).send({
              status: false,
              error: err.message,
            });
          });
      }
    }
  );
};

const authorizeOutlookCalendar = async (req, res) => {
  const user = req.currentUser;
  const code = req.query.code;
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'https://graph.microsoft.com/calendars.readwrite ',
  ];

  oauth2.authCode.getToken(
    {
      code,
      redirect_uri: urls.OUTLOOK_CALENDAR_AUTHORIZE_URL,
      scope: scopes.join(' '),
    },
    function (error, result) {
      if (error) {
        console.log('err', error);
        return res.status(500).send({
          status: false,
          error,
        });
      } else {
        const outlook_token = oauth2.accessToken.create(result);
        const outlook_refresh_token = outlook_token.token.refresh_token;
        const token_parts = outlook_token.token.id_token.split('.');

        // Token content is in the second part, in urlsafe base64
        const encoded_token = Buffer.from(
          token_parts[1].replace('-', '+').replace('_', '/'),
          'base64'
        );

        const decoded_token = encoded_token.toString();

        const jwt = JSON.parse(decoded_token);

        // Email is in the preferred_username field
        user.calendar_connected = true;
        if (user.calendar_list) {
          // const data = {
          //   connected_email: _res.data.email,
          //   google_refresh_token: JSON.stringify(tokens),
          //   connected_calendar_type: 'google',
          // };
          user.calendar_list.push({
            connected_email: jwt.preferred_username,
            outlook_refresh_token,
            connected_calendar_type: 'outlook',
          });
        } else {
          user.calendar_list = [
            {
              connected_email: jwt.preferred_username,
              outlook_refresh_token,
              connected_calendar_type: 'outlook',
            },
          ];
        }

        user
          .save()
          .then(() => {
            res.send({
              status: true,
              data: jwt.preferred_username,
            });
          })
          .catch((err) => {
            return res.status(400).send({
              status: false,
              error: err.message,
            });
          });
      }
    }
  );
};

const authorizeOtherEmailer = async (req, res) => {
  const { currentUser } = req;
  const { user, pass, host, port, secure } = req.body;

  // create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport({
    host,
    port: port || system_settings.IMAP_PORT,
    secure, // true for 465, false for other ports
    auth: {
      user, // generated ethereal user
      pass, // generated ethereal password
    },
  });

  // send mail with defined transport object
  transporter
    .sendMail({
      from: `${currentUser.user_name} <${user}>`,
      to: currentUser.email, // list of receivers
      subject: 'Hello ✔', // Subject line
      text: 'Hello world?', // plain text body
      html: '<b>Hello world?</b>', // html body
    })
    .then((res) => {
      if (res.messageId) {
        User.updateOne(
          {
            _id: currentUser.id,
          },
          {
            $set: {
              other_emailer: {
                user,
                pass,
                host,
                port,
                secure,
              },
            },
          }
        ).catch((err) => {
          console.log('user update error', err.message);
        });
        return res.send({
          status: true,
        });
      } else {
        return res.status(400).json({
          status: false,
          error: res.error || 'Something went wrong',
        });
      }
    })
    .catch((err) => {
      return res.status(500).json({
        status: false,
        error: err.message || 'Internal server error',
      });
    });
};

const syncYahoo = async (req, res) => {
  const scopes = ['openid', 'admg-w'];

  // Authorization uri definition
  const authorizationUri = yahooOauth2.authCode.authorizeURL({
    redirect_uri: 'https://stg.crmgrow.com/profile/yahoo',
    scope: scopes.join(' '),
  });

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }
  res.send({
    status: true,
    data: authorizationUri,
  });
};

const syncGmail = async (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );

  // generate a url that asks permissions for Blogger and Google Calendar scopes
  const scopes = [
    // 'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.send',
  ];

  const authorizationUri = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data: authorizationUri,
  });
};

const authorizeYahoo = async (req, res) => {
  const code = req.query.code;
  const user = req.currentUser;

  yahooOauth2.authCode.getToken(
    {
      code,
      redirect_uri: 'https://stg.crmgrow.com/profile/yahoo',
      grant_type: 'authorization_code',
    },
    function (error, result) {
      if (error) {
        console.log('err', error);
        return res.status(500).send({
          status: false,
          error,
        });
      } else {
        const yahoo_token = yahooOauth2.accessToken.create(result);
        user.yahoo_refresh_token = yahoo_token.token.refresh_token;
        const token_parts = yahoo_token.token.id_token.split('.');

        // Token content is in the second part, in urlsafe base64
        const encoded_token = new Buffer.from(
          token_parts[1].replace('-', '+').replace('_', '/'),
          'base64'
        );

        const decoded_token = encoded_token.toString();

        const jwt = JSON.parse(decoded_token);
        // Email is in the preferred_username field
        user.email = jwt.preferred_username;
        user.social_id = jwt.oid;
        user.connected_email_type = 'yahoo';
        user.primary_connected = true;
        user
          .save()
          .then((_res) => {
            res.send({
              status: true,
              data: user.email,
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
      }
    }
  );
};

const authorizeGmail = async (req, res) => {
  const user = req.currentUser;
  const code = req.query.code;
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (typeof tokens.refresh_token === 'undefined') {
    return res.status(403).send({
      status: false,
    });
  }

  if (!tokens) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }

  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: 'v2',
  });

  oauth2.userinfo.v2.me.get((err, _res) => {
    if (err) {
      return res.status(403).send({
        status: false,
        error: err.message || 'Getting user profile error occured.',
      });
    }

    // Email is in the preferred_username field
    user.connected_email = _res.data.email;
    user.primary_connected = true;
    // user.social_id = _res.data.id;
    user.google_refresh_token = JSON.stringify(tokens);

    if (_res.data.hd) {
      user.connected_email_type = 'gsuit';
      user.email_info.max_count = system_settings.EMAIL_DAILY_LIMIT.GSUIT;
    } else {
      user.connected_email_type = 'gmail';
      user.email_info.max_count = system_settings.EMAIL_DAILY_LIMIT.GMAIL;
    }

    user
      .save()
      .then(() => {
        res.send({
          status: true,
          data: user.connected_email,
        });
      })
      .catch((err) => {
        console.log('user save err', err.message);
        return res.status(400).json({
          status: false,
          error: err.message,
        });
      });
  });
};

const syncGoogleCalendar = async (req, res) => {
  const { currentUser } = req;

  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GOOGLE_CALENDAR_AUTHORIZE_URL
  );

  if (!currentUser.calendar_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable calendar access',
    });
  }

  if (currentUser.calendar_info['is_limit']) {
    const calendar_info = currentUser.calendar_info;
    const max_calendar_count = calendar_info['max_count'];

    if (
      currentUser.calendar_list &&
      max_calendar_count <= currentUser.calendar_list.length
    ) {
      return res.status(412).send({
        status: false,
        error: 'You are exceed for max calendar connection',
      });
    }
  }

  // generate a url that asks permissions for Blogger and Google Calendar scopes
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const authorizationUri = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: 'offline',
    prompt: 'consent',
    // If you only need one scope you can pass it as a string
    scope: scopes,
  });

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data: authorizationUri,
  });
};

const authorizeGoogleCalendar = async (req, res) => {
  const user = req.currentUser;
  const code = req.query.code;

  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GOOGLE_CALENDAR_AUTHORIZE_URL
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (!tokens.refresh_token) {
    return res.status(403).send({
      status: false,
    });
  }

  if (!tokens) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist',
    });
  }

  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: 'v2',
  });

  oauth2.userinfo.v2.me.get((err, _res) => {
    if (err) {
      return res.status(403).send({
        status: false,
        error: err.message || 'Getting user profile error occured.',
      });
    }

    // Email is in the preferred_username field
    user.calendar_connected = true;
    if (user.calendar_list) {
      // const data = {
      //   connected_email: _res.data.email,
      //   google_refresh_token: JSON.stringify(tokens),
      //   connected_calendar_type: 'google',
      // };
      // user.calendar_list.push(data);

      user.calendar_list.push({
        connected_email: _res.data.email,
        google_refresh_token: JSON.stringify(tokens),
        connected_calendar_type: 'google',
      });
    } else {
      user.calendar_list = [
        {
          connected_email: _res.data.email,
          google_refresh_token: JSON.stringify(tokens),
          connected_calendar_type: 'google',
        },
      ];
    }

    user
      .save()
      .then(() => {
        res.send({
          status: true,
          data: _res.data.email,
        });
      })
      .catch((err) => {
        console.log('user save err', err.message);
        return res.status(400).json({
          status: false,
          error: err.message,
        });
      });
  });
};

const addGoogleCalendar = async (auth, user, res) => {
  const calendar = google.calendar({ version: 'v3', auth });
  const _appointments = await Appointment.find({ user: user.id });
  for (let i = 0; i < _appointments.length; i++) {
    const attendees = [];
    if (typeof _appointments[i].guests !== 'undefined') {
      for (let j = 0; j < _appointments[i].guests.length; j++) {
        const addendee = {
          email: _appointments[i].guests[j],
        };
        attendees.push(addendee);
      }
    }
    const event = {
      summary: _appointments[i].title,
      location: _appointments[i].location,
      description: _appointments[i].description,
      start: {
        dateTime: _appointments[i].due_start,
        timeZone: 'UTC' + user.time_zone,
      },
      end: {
        dateTime: _appointments[i].due_end,
        timeZone: 'UTC' + user.time_zone,
      },
      attendees,
    };
    calendar.events.insert(
      {
        auth,
        calendarId: 'primary',
        resource: event,
        sendNotifications: true,
      },
      function (err, event) {
        if (err) {
          console.log(
            'There was an error contacting the Calendar service: ' + err
          );
          return;
        }
        _appointments[i].event_id = event.data.id;
        _appointments[i].save();
      }
    );
  }
  user.calendar_connected = true;
  user.save();

  return res.send({
    status: true,
  });
};

const disconnectCalendar = async (req, res) => {
  const { currentUser } = req;
  const { connected_email } = req.body;

  const calendar_list = currentUser.calendar_list;
  const new_list = calendar_list.filter((_calendar) => {
    return _calendar.connected_email !== connected_email;
  });

  if (new_list.length > 0) {
    User.updateOne(
      { _id: currentUser.id },
      {
        $set: { calendar_list: new_list },
      }
    )
      .then(() => {
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        return res.status(500).json({
          status: false,
          error: err.message,
        });
      });
  } else {
    User.updateOne(
      { _id: currentUser.id },
      {
        $set: {
          calendar_connected: false,
        },
        $unset: {
          calendar_list: true,
        },
      }
    )
      .then(() => {
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        return res.status(500).json({
          status: false,
          error: err.message,
        });
      });
  }
};

const dailyReport = async (req, res) => {
  const user = req.currentUser;

  user['daily_report'] = true;

  user.save();
  return res.send({
    status: true,
  });
};

const weeklyReport = async (req, res) => {
  const user = req.currentUser;

  user['weekly_report'] = true;
  user.save();

  return res.send({
    status: true,
  });
};

const disconDaily = async (req, res) => {
  const user = req.currentUser;

  user['daily_report'] = false;
  user.save();

  return res.send({
    status: true,
  });
};

const disconWeekly = async (req, res) => {
  const user = req.currentUser;

  user['weekly_report'] = false;
  user.save();

  return res.send({
    status: true,
  });
};

const desktopNotification = async (req, res) => {
  const user = req.currentUser;
  const { subscription, option } = req.body;
  user['desktop_notification'] = true;
  user['desktop_notification_subscription'] = JSON.stringify(subscription);
  const garbage = await Garbage.findOne({ user: user._id });
  if (!garbage) {
    const newGarbage = new Garbage({
      desktop_notification: option,
      user: user._id,
    });
    newGarbage
      .save()
      .then(() => {
        user.save();
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(500).json({
          status: false,
          error: err.message || 'Internal server error',
        });
      });
  } else {
    garbage['desktop_notification'] = option;
    garbage
      .save()
      .then(() => {
        user.save();
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(500).json({
          status: false,
          error: err.message || 'Internal server error',
        });
      });
  }
};

const resetPasswordByCode = async (req, res) => {
  const { code, password, email } = req.body;

  const user = await User.findOne({
    email: new RegExp(email, 'i'),
    del: false,
  });

  if (!user) {
    return res.status(400).send({
      status: false,
      error: 'NO user exist',
    });
  }

  if (!user.salt) {
    return res.status(400).send({
      status: false,
      error: 'You must use social login',
    });
  }
  const aryPassword = user.salt.split(' ');
  if (!aryPassword[1] || aryPassword[1] !== code) {
    // Code mismatch
    return res.status(400).send({
      status: false,
      error: 'invalid_code',
    });
  }
  // Expire check
  const delay = new Date().getTime() - user['updated_at'].getTime();

  if (delay > 1000 * 60 * 15) {
    // More than 15 minutes passed
    return res.status(400).send({
      status: false,
      error: 'expired_code',
    });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 512, 'sha512')
    .toString('hex');

  user['salt'] = salt;
  user['hash'] = hash;

  await user.save();

  res.send({
    status: true,
  });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).send({
      status: false,
      error: 'no_email_or_user_name',
    });
  }
  const _user = await User.findOne({
    email: new RegExp(email, 'i'),
    del: false,
  });

  if (!_user) {
    return res.status(400).json({
      status: false,
      error: 'no_user',
    });
  }

  const code = randomstring.generate({
    length: 5,
    charset: '1234567890ABCDEFHJKMNPQSTUVWXYZ',
  });

  if (_user['salt']) {
    const oldSalt = _user['salt'].split(' ')[0];
    _user['salt'] = oldSalt + ' ' + code;
  } else {
    _user['salt'] = ' ' + code;
  }

  _user['updated_at'] = new Date();
  _user.save();

  const data = {
    template_data: {
      code,
    },
    template_name: 'ForgotPassword',
    required_reply: false,
    email: _user['email'],
  };

  sendNotificationEmail(data);

  res.send({
    status: true,
  });
};

const createPassword = async (req, res) => {
  const { currentUser } = req;
  const { password } = req.body;
  if (currentUser.hash || currentUser.salt) {
    return res.status(400).send({
      status: false,
      error: 'Please input your current password.',
    });
  } else {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(password, salt, 10000, 512, 'sha512')
      .toString('hex');
    currentUser.salt = salt;
    currentUser.hash = hash;
    currentUser
      .save()
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

const closeAccount = async (req, res) => {
  const { currentUser } = req;
  const { close_reason, close_feedback } = req.body;

  clearAccount(currentUser.id);

  User.updateOne(
    {
      _id: currentUser.id,
    },
    {
      $set: {
        close_reason,
        close_feedback,
      },
    }
  ).catch((err) => {
    console.log('user add cancel reason err', err.message);
  });

  const data = {
    template_data: {
      user_name: currentUser.user_name,
      created_at: moment()
        .tz(currentUser.time_zone)
        .format('h:mm MMMM Do, YYYY'),
      reason: close_reason,
      feedback: close_feedback,
    },
    template_name: 'CancelAccount',
    required_reply: false,
    cc: currentUser.email,
    email: mail_contents.REPLY,
  };

  sendNotificationEmail(data)
    .then(() => {
      console.log('cancel account email has been sent out successfully');
    })
    .catch((err) => {
      console.log('cancel account email send err', err);
    });

  return res.send({
    status: true,
  });
};

const checkDowngrade = async (req, res) => {
  const { currentUser } = req;
  const { selectedPackage } = req.body;
  const currentPackage = currentUser.package_level || 'PRO';

  if (currentPackage.includes('LITE') && !currentPackage.includes('ELITE')) {
    return res.send({
      status: true,
    });
  } else {
    const currentContactsCount = await Contact.countDocuments({
      user: currentUser.id,
    });
    const currentVideoCount = await Video.countDocuments({
      user: currentUser.id,
      uploaded: true,
    });
    const currentPDFCount = await PDF.countDocuments({
      user: currentUser.id,
      del: false,
    });
    const currentMaterialCount = currentVideoCount + currentPDFCount;
    const currentVideos = await Video.find({
      user: currentUser.id,
      recording: true,
      del: false,
    });
    let currentVideoRecordingDuration = 0;
    if (currentVideos.length > 0) {
      for (const video of currentVideos) {
        currentVideoRecordingDuration += video.duration ? video.duration : 0;
      }
    }
    const currentAssistantCount = await Guest.countDocuments({
      user: currentUser.id,
    });
    const currentCreateAutomationCount = await Automation.countDocuments({
      $and: [{ user: currentUser.id }, { role: { $ne: 'admin' } }],
    });
    const currentActiveAutomationCount = await TimeLine.countDocuments({
      user: currentUser.id,
    });
    const ownTeam = (await Team.find({ owner: currentUser.id })) || [];
    const currentHasOwnTeam = ownTeam.length;
    const currentCalendarCount = currentUser.calendar_list.length || 0;

    const subAccountList = currentUser.sub_account_list
      ? currentUser.sub_account_list.length
      : 0;

    const data = [];
    if (
      (currentPackage.includes('PRO') &&
        selectedPackage.includes('LITE') &&
        !selectedPackage.includes('ELITE')) ||
      (currentPackage.includes('ELITE') &&
        ((selectedPackage.includes('LITE') &&
          !selectedPackage.includes('ELITE')) ||
          selectedPackage.includes('PRO'))) ||
      currentPackage.includes('CUSTOM')
    ) {
      let isValid = true;
      if (
        currentContactsCount >
        system_settings.CONTACT_UPLOAD_LIMIT[selectedPackage]
      ) {
        isValid = false;
        const overData = {
          type: 'limit_contacts',
          count: currentContactsCount,
          limit: system_settings.CONTACT_UPLOAD_LIMIT[selectedPackage],
        };
        data.push(overData);
      }
      if (
        currentMaterialCount >
        system_settings.MATERIAL_UPLOAD_LIMIT[selectedPackage]
      ) {
        isValid = false;
        const overData = {
          type: 'limit_materials',
          count: currentMaterialCount,
          limit: system_settings.MATERIAL_UPLOAD_LIMIT[selectedPackage],
        };
        data.push(overData);
      }
      if (
        currentVideoRecordingDuration >
        system_settings.VIDEO_RECORD_LIMIT[selectedPackage]
      ) {
        isValid = false;
      }
      if (
        currentActiveAutomationCount >
        (system_settings.AUTOMATION_ASSIGN_LIMIT[selectedPackage] || 0)
      ) {
        isValid = false;
        const overData = {
          type: selectedPackage.includes('PRO')
            ? 'limit_automations'
            : 'remove_automations',
          count: currentActiveAutomationCount,
          limit: system_settings.AUTOMATION_ASSIGN_LIMIT[selectedPackage],
        };
        data.push(overData);
      }
      if (
        currentAssistantCount >
        (system_settings.ASSISTANT_LIMIT[selectedPackage] || 0)
      ) {
        isValid = false;
        const overData = {
          type: selectedPackage.includes('PRO')
            ? 'limit_assistants'
            : 'remove_assistants',
          count: currentAssistantCount,
          limit: system_settings.ASSISTANT_LIMIT[selectedPackage],
        };
        data.push(overData);
      }
      // if (
      //   currentSMSCount >
      //   (system_settings.TEXT_MONTHLY_LIMIT[selectedPackage] || 0)
      // ) {
      //   overflowMessage += isValid ? 'SMS' : ', SMS';
      //   isValid = false;
      // }
      if (
        currentCalendarCount >
        (system_settings.CALENDAR_LIMIT[selectedPackage] || 0)
      ) {
        isValid = false;
        const overData = {
          type: selectedPackage.includes('PRO')
            ? 'limit_calendars'
            : 'remove_calendars',
          count: currentCalendarCount,
          limit: system_settings.CALENDAR_LIMIT[selectedPackage],
        };
        data.push(overData);
      }
      if (
        currentHasOwnTeam > 0 &&
        selectedPackage.includes('LITE') &&
        !selectedPackage.includes('ELITE')
      ) {
        isValid = false;
        const overData = {
          type: 'remove_teams',
          count: currentHasOwnTeam,
          limit: 0,
        };
        data.push(overData);
      }
      if (subAccountList > 0) {
        isValid = false;
        const overData = {
          type: 'remove_multi_profile',
          count: subAccountList,
          limit: 0,
        };
        data.push(overData);
      }
      if (
        selectedPackage.includes('LITE') &&
        !selectedPackage.includes('ELITE') &&
        currentCreateAutomationCount > 0
      ) {
        isValid = false;
        const overData = {
          type: 'remove_automations',
          count: currentCreateAutomationCount,
          limit: 0,
        };
        data.push(overData);
      }

      if (!isValid) {
        return res.send({
          status: false,
          type: 'other',
          data,
        });
      } else {
        if (
          selectedPackage.includes('LITE') &&
          !selectedPackage.includes('ELITE')
        ) {
          const overData = {
            type: 'sms',
          };
          data.push(overData);
          return res.send({
            status: false,
            type: 'sms',
            data,
          });
        }
      }
    }
  }

  return res.send({
    status: true,
  });
};

const checkSuspended = async (req, res, next) => {
  const { currentUser } = req;

  const subscription = currentUser['subscription'];
  if (subscription['is_suspended']) {
    res.status(400).send({
      status: false,
      error: 'Account is Suspended',
    });
  } else {
    next();
  }
};

const checkLastLogin = async (req, res, next) => {
  const { currentUser } = req;
  if (!currentUser['admin_loggin']) {
    currentUser['last_logged'] = new Date();
    currentUser.save().catch((err) => {
      console.log('err', err);
    });
  }
  next();
};

const logout = async (req, res) => {
  const { currentUser } = req;
  currentUser['admin_loggin'] = false;
  currentUser.save().catch((err) => {
    console.log('err', err);
  });
  res.send({
    status: true,
  });
};

const connectAnotherEmail = async (req, res) => {
  const { currentUser } = req;
  currentUser['primary_connected'] = false;
  currentUser['connected_email_type'] = 'email';
  currentUser.save().catch((err) => {
    console.log('err', err);
  });
  return res.send({
    status: true,
  });
};

const disconnectEmail = async (req, res) => {
  const { currentUser } = req;

  User.updateOne(
    {
      _id: currentUser.id,
    },
    {
      $set: { primary_connected: false },
      $unset: {
        connected_email: true,
        outlook_refresh_token: true,
        google_refresh_token: true,
      },
    }
  ).catch((err) => {
    console.log('user disconnect email update err', err.message);
  });

  return res.send({
    status: true,
  });
};

const searchUserEmail = (req, res) => {
  const condition = req.body;

  User.find({
    email: { $regex: '.*' + condition.search + '.*', $options: 'i' },
  })
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const searchNickName = async (req, res) => {
  const { nick_name } = req.body;
  const _user = await User.findOne({
    nick_name: { $regex: new RegExp('^' + nick_name + '$', 'i') },
    del: false,
  });
  if (_user) {
    return res.send({
      status: false,
    });
  } else {
    return res.send({
      status: true,
    });
  }
};

const searchPhone = async (req, res) => {
  const { cell_phone } = req.body;
  const _user = await User.findOne({ cell_phone, del: false });
  if (_user) {
    return res.send({
      status: false,
    });
  } else {
    return res.send({
      status: true,
    });
  }
};

const schedulePaidDemo = async (req, res) => {
  const { currentUser } = req;

  if (!currentUser.payment) {
    return res.status(400).json({
      status: false,
      error: 'Please connect your card',
    });
  }

  const payment = await Payment.findOne({
    _id: currentUser.payment,
  }).catch((err) => {
    console.log('payment find err', err.message);
  });

  if (!payment) {
    return res.status(400).json({
      status: false,
      error: 'Please connect your card',
    });
  }

  const paid_demo = await PaidDemo.findOne({
    user: currentUser.id,
    status: 1,
  });

  if (paid_demo) {
    return res.status(400).json({
      status: false,
      error: `You have already booked one on one`,
    });
  }

  const amount = system_settings.ONBOARD_PRICING_1_HOUR;
  const description = 'Schedule one on one onboarding 1 hour';
  const schedule_link = system_settings.SCHEDULE_LINK_1_HOUR;

  const data = {
    card_id: payment.card_id,
    customer_id: payment.customer_id,
    receipt_email: currentUser.email,
    amount,
    description,
  };

  createCharge(data)
    .then(() => {
      const new_demo = new PaidDemo({
        user: currentUser.id,
      });

      new_demo
        .save()
        .then(() => {
          const templatedData = {
            user_name: currentUser.user_name,
            schedule_link,
          };

          const params = {
            Destination: {
              ToAddresses: [currentUser.email],
            },
            Source: mail_contents.REPLY,
            Template: 'OnboardCall',
            TemplateData: JSON.stringify(templatedData),
          };

          // Create the promise and SES service object
          ses
            .sendTemplatedEmail(params)
            .promise()
            .then((response) => {
              console.log('success', response.MessageId);
            })
            .catch((err) => {
              console.log('ses send err', err);
            });

          return res.send({
            status: true,
          });
        })
        .catch((err) => {
          console.log('card payment err', err);
          return res.status(400).json({
            status: false,
            error: err.message,
          });
        });
    })
    .catch((_err) => {
      console.log('new demo create payment err', _err.message);
    });
};

const scheduledPaidDemo = async (req, res) => {
  const { currentUser } = req;

  PaidDemo.updateOne(
    {
      user: currentUser.id,
    },
    {
      $set: {
        status: 1,
      },
    }
  ).catch((err) => {
    console.log('schedule paid demo update err', err.message);
  });

  return res.send({
    status: true,
  });
};

const sendWelcomeEmail = async (data) => {
  const { id, email, user_name, password, time_zone } = data;
  const verification_url = `${urls.VERIFY_EMAIL_URL}?id=${id}`;
  const templatedData = {
    user_name,
    verification_url,
    created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
    webinar_url: system_settings.WEBINAR_LINK,
    import_url: urls.IMPORT_CSV_URL,
    template_url: urls.CONTACT_CSV_URL,
    email,
    password,
    facebook_url: urls.FACEBOOK_URL,
    login_url: urls.LOGIN_URL,
    terms_url: urls.TERMS_SERVICE_URL,
    privacy_url: urls.PRIVACY_URL,
  };

  const params = {
    Destination: {
      ToAddresses: [email],
    },
    Source: mail_contents.REPLY,
    Template: 'Welcome',
    TemplateData: JSON.stringify(templatedData),
  };

  ses.sendTemplatedEmail(params).promise();
};

const pushNotification = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, del: false }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  const subscription = JSON.parse(user['desktop_notification_subscription']);
  webPush.setVapidDetails(
    `mailto:${mail_contents.REPLY}`,
    api.VAPID.PUBLIC_VAPID_KEY,
    api.VAPID.PRIVATE_VAPID_KEY
  );
  const playload = JSON.stringify({
    notification: {
      title: 'Notification Title',
      body: 'Notification Description',
      icon: '/fav.ico',
      badge: '/fav.ico',
    },
  });
  webPush
    .sendNotification(subscription, playload)
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.send({
        status: false,
        error: err,
      });
    });
};

const authorizeZoom = async (req, res) => {
  const { code } = req.query;
  const { currentUser } = req;

  const options = {
    method: 'POST',
    url: 'https://zoom.us/oauth/token',
    qs: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: urls.ZOOM_AUTHORIZE_URL,
    },
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(
          api.ZOOM_CLIENT.ZOOM_CLIENT_ID +
            ':' +
            api.ZOOM_CLIENT.ZOOM_CLIENT_SECRET
        ).toString('base64'),
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    const { access_token, refresh_token } = JSON.parse(body);

    const profile_option = {
      method: 'GET',
      url: 'https://api.zoom.us/v2/users/me',
      headers: {
        Authorization: 'Bearer ' + access_token,
        'Content-Type': 'application/json',
      },
    };

    request(profile_option, function (error, response, body) {
      if (error) throw new Error(error);

      const { email } = JSON.parse(body);

      Garbage.updateOne(
        {
          user: currentUser.id,
        },
        {
          $set: {
            zoom: {
              email,
              refresh_token,
            },
          },
        }
      ).catch((err) => {
        console.log('garbage update err', err.message);
      });

      return res.send({
        status: true,
        email,
      });
    });
  });
};

const syncZoom = async (req, res) => {
  const url = `https://zoom.us/oauth/authorize?response_type=code&client_id=${api.ZOOM_CLIENT.ZOOM_CLIENT_ID}&redirect_uri=${urls.ZOOM_AUTHORIZE_URL}`;

  return res.send({
    status: true,
    data: url,
  });
};

const updatePackage = async (req, res) => {
  const { currentUser } = req;
  const { level } = req.body;

  if (!currentUser.payment) {
    return res.status(400).json({
      status: false,
      error: 'Please connect card',
    });
  }

  if (level === currentUser.package_level) {
    return res.status(400).json({
      status: false,
      error: 'You are in current same plan',
    });
  }

  const payment = await Payment.findOne({ _id: currentUser.payment }).catch(
    (err) => {
      console.log('payment find err', err.message);
    }
  );

  if (!payment) {
    return res.status(400).json({
      status: false,
      error: 'Please connect card',
    });
  }
  const planId = api.STRIPE.PLAN[level];

  const subscription_data = {
    customerId: payment.customer_id,
    subscriptionId: payment.subscription,
    planId,
  };

  updateSubscription(subscription_data)
    .then(() => {
      User.updateOne(
        {
          _id: currentUser.id,
        },
        {
          $set: { package_level: level },
        }
      ).catch((err) => {
        console.log('user updae package err', err.message);
      });

      Payment.updateOne(
        {
          user: currentUser.id,
        },
        {
          $set: { plan_id: planId },
        }
      ).catch((err) => {
        console.log('payment set package err', err.message);
      });

      const data = {
        user: currentUser.id,
        level,
      };

      setPackage(data).catch((err) => {
        console.log('set package err', err.message);
      });

      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('subscription update err', err.message);
      return res.status(400).json({
        status: false,
        error: 'Please correct your card',
      });
    });
};

const generateSyncSocialLink = (req, res) => {
  const { currentUser } = req;
  const { social, action } = req.body;
  if (action === 'calendar') {
    if (!currentUser.calendar_info['is_enabled']) {
      return res.status(412).send({
        status: false,
        error: 'Calendar access is disabled',
      });
    }

    if (currentUser.calendar_info['is_limit']) {
      const calendar_info = currentUser.calendar_info;
      const max_calendar_count = calendar_info['max_count'];

      if (
        currentUser.calendar_list &&
        max_calendar_count <= currentUser.calendar_list.length
      ) {
        return res.status(412).send({
          status: false,
          error: 'You are exceed for max calendar connection',
        });
      }
    }
  }
  const redirectUrl = `${urls.DOMAIN_ADDR}/sync-social/${social}/${action}`;
  if (social === 'google') {
    let scopes = [];
    if (action === 'mail') {
      scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/gmail.send',
      ];
    }
    if (action === 'calendar') {
      scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email',
      ];
    }
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      redirectUrl
    );
    const authorizationUri = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
    });
    if (!authorizationUri) {
      return res.status(400).json({
        status: false,
        error: 'Client doesn`t exist',
      });
    }
    return res.send({
      status: true,
      data: authorizationUri,
    });
  } else if (social === 'outlook') {
    let scopes = [];
    if (action === 'mail') {
      scopes = [
        'openid',
        'profile',
        'offline_access',
        'email',
        'https://graph.microsoft.com/mail.send',
      ];
    }
    if (action === 'calendar') {
      scopes = [
        'openid',
        'profile',
        'offline_access',
        'https://graph.microsoft.com/calendars.readwrite',
      ];
    }
    const authorizationUri = oauth2.authCode.authorizeURL({
      redirect_uri: redirectUrl,
      scope: scopes.join(' '),
      prompt: 'select_account',
    });
    if (!authorizationUri) {
      return res.status(400).json({
        status: false,
        error: 'Client doesn`t exist',
      });
    }
    return res.send({
      status: true,
      data: authorizationUri,
    });
  }
};
const syncSocialRedirect = (req, res) => {
  const social = req.params.social;
  const action = req.params.action;
  const code = req.query.code;

  const link = `crmgrow://sync-social/${social}/${action}/${code}`;

  return res.render('mobile-social', { link });
};

const getCallToken = (req, res) => {
  const signature =
    'q6Oggy7to8EEgSyJTwvinjslHitdRjuC76UEtw8kxyGRDAlF1ogg3hc4WzW2vnzc';
  const payload = {
    userId: '123456',
  };
  const issuer = 'k8d8BvqFWV9rSTwZyGed64Dc0SbjSQ6D';
  const token = jwt.sign(payload, signature, { issuer, expiresIn: 3600 });
  return res.send({
    status: true,
    token,
  });
};

const createSubAccount = async (req, res) => {
  const { currentUser } = req;
  if (
    !currentUser.sub_account_info ||
    (currentUser.sub_account_info && !currentUser.sub_account_info.is_enabled)
  ) {
    return res.status(412).send({
      status: false,
      error: 'Not enabled to add a second one',
    });
  }

  const sub_account_info = currentUser['sub_account_info'];
  const users = await User.find({
    primary_account: currentUser.id,
    del: false,
  });

  let count = 0;

  for (let i = 0; i < users.length; i++) {
    const account = users[i].equal_account || 1;
    count += account;
  }

  if (sub_account_info.is_limit && sub_account_info.max_count <= count) {
    return res.status(411).send({
      status: false,
      error: 'Need more seat',
    });
  }

  if (currentUser.is_primary) {
    let cell_phone;
    if (req.body.phone && req.body.phone.e164Number) {
      cell_phone = req.body.phone.e164Number;
    }

    let picture_profile;
    if (req.body.picture_profile) {
      picture_profile = await uploadBase64Image(req.body.picture_profile);
    }

    let payment;
    if (
      currentUser.sub_account_payments &&
      currentUser.sub_account_payments[0]
    ) {
      payment = currentUser.sub_account_payments[0];

      User.updateOne(
        {
          _id: currentUser.id,
        },
        {
          $pull: {
            sub_account_payments: payment,
          },
        }
      ).catch((err) => {
        console.log('user sub payment update err', err.message);
      });
    } else {
      payment = currentUser.payment;
    }

    const sub_account = new User({
      ...req.body,
      picture_profile,
      cell_phone,
      equal_account: 1,
      is_primary: false,
      payment,
      is_trial: false,
      primary_account: currentUser.id,
    });

    const garbage = new Garbage({
      user: sub_account.id,
    });

    garbage.save().catch((err) => {
      console.log('garbage save err', err.message);
    });

    const _user = await sub_account.save().catch((err) => {
      console.log('create subaccount err', err.message);
    });

    const package_data = {
      user: _user.id,
      level: 'ELITE',
      is_sub_account: true,
    };

    setPackage(package_data).catch((err) => {
      console.log('user set package err', err.message);
    });

    const token = jwt.sign({ id: _user.id }, api.JWT_SECRET);
    const myJSON = JSON.stringify(_user);
    const user = JSON.parse(myJSON);

    delete user.hash;
    delete user.salt;

    return res.send({
      status: true,
      data: {
        token,
        user,
      },
    });
  } else {
    res.status(400).json({
      status: false,
      error: 'Please create account in primary',
    });
  }
};

const easyLoadSubAccounts = async (req, res) => {
  const { currentUser } = req;
  let sub_accounts = [];
  let total = 0;
  if (
    currentUser.is_primary &&
    currentUser.sub_account_info &&
    currentUser.sub_account_info.is_enabled
  ) {
    sub_accounts = await User.find({
      $or: [{ primary_account: currentUser._id }, { _id: currentUser._id }],
      del: false,
    })
      .select({
        _id: 1,
        user_name: 1,
        email: 1,
        picture_profile: 1,
        company: 1,
        equal_account: 1,
        is_primary: 1,
      })
      .catch((err) => {
        console.log('Getting sub account is failed.', err.message);
      });
    total = currentUser.sub_account_info.max_count || 2;
  } else if (currentUser.primary_account) {
    sub_accounts = await User.find({
      $or: [
        { primary_account: currentUser.primary_account },
        { _id: currentUser.primary_account },
      ],
      del: false,
    })
      .select({
        _id: 1,
        user_name: 1,
        email: 1,
        picture_profile: 1,
        company: 1,
        equal_account: 1,
        is_primary: 1,
      })
      .catch((err) => {
        console.log('Getting sub account is failed.', err.message);
      });
    sub_accounts.forEach((account) => {
      total += account.equal_account;
    });
  }

  return res.send({
    status: true,
    data: sub_accounts,
    limit: total,
  });
};

const getSubAccounts = async (req, res) => {
  const { currentUser } = req;

  if (
    currentUser.is_primary &&
    currentUser.sub_account_info &&
    currentUser.sub_account_info.is_enabled
  ) {
    const users = await User.find({
      primary_account: currentUser.id,
      del: false,
    }).select(
      '_id user_name email phone picture_profile company time_zone_info equal_account login_disabled master_disabled assistant_info automation_info calendar_info contact_info material_info sub_account_info text_info video_info'
    );

    const total = currentUser.sub_account_info
      ? currentUser.sub_account_info.max_count
      : 0;

    return res.send({
      status: true,
      data: {
        users,
        total,
      },
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'No primary account',
    });
  }
};

const switchAccount = async (req, res) => {
  const { currentUser } = req;
  if (currentUser.is_primary) {
    const _user = await User.findOne({
      _id: req.body.user_id,
      primary_account: currentUser.id,
    });

    if (_user) {
      const token = jwt.sign({ id: req.body.user_id }, api.JWT_SECRET);
      const myJSON = JSON.stringify(_user);
      const user = JSON.parse(myJSON);

      delete user.hash;
      delete user.salt;

      return res.send({
        status: true,
        data: {
          token,
          user,
        },
      });
    } else {
      return res.status(400).json({
        status: false,
        error: 'Invalid permission',
      });
    }
    // eslint-disable-next-line eqeqeq
  } else {
    const _user = await User.findOne({
      _id: req.body.user_id,
    });

    if (_user) {
      const token = jwt.sign({ id: req.body.user_id }, api.JWT_SECRET);
      const myJSON = JSON.stringify(_user);
      const user = JSON.parse(myJSON);

      delete user.hash;
      delete user.salt;

      return res.send({
        status: true,
        data: {
          token,
          user,
        },
      });
    } else {
      return res.status(400).json({
        status: false,
        error: 'Invalid permission',
      });
    }
  }
};

const editSubAccount = async (req, res) => {
  const { currentUser } = req;
  let edit_data = { ...req.body };

  if (currentUser.is_primary) {
    let cell_phone;
    if (req.body.phone && req.body.phone.e164Number) {
      cell_phone = req.body.phone.e164Number;
      edit_data = { ...edit_data, cell_phone };
    }

    const _user = await User.findOne({
      _id: req.params.id,
      primary_account: currentUser.id,
    });

    if (_user) {
      if (req.body.picture_profile) {
        edit_data['picture_profile'] = await uploadBase64Image(
          req.body.picture_profile
        );
      }
      User.updateOne(
        {
          _id: req.params.id,
        },
        {
          $set: { ...edit_data },
        }
      ).catch((err) => {
        console.log('user update one err', err.message);
      });

      return res.send({
        status: true,
        data: edit_data,
      });
    } else {
      return res.status(400).json({
        status: false,
        error: 'Invalid permission',
      });
    }
  } else {
    return res.status(400).json({
      status: false,
      error: 'Invalid permission',
    });
  }
};

const removeSubAccount = async (req, res) => {
  const { currentUser } = req;
  const { remove_seat } = req.body;

  if (currentUser.is_primary) {
    // eslint-disable-next-line eqeqeq
    if (req.params.id == currentUser.id) {
      return res.status({
        status: false,
        error: `Can't remove primary account`,
      });
    }

    const _user = await User.findOne({
      _id: req.params.id,
      primary_account: currentUser.id,
    });

    if (_user) {
      const max_account = currentUser.sub_account_info
        ? currentUser.sub_account_info.max_count
        : 0;

      let count = max_account - _user.equal_account;

      if (_user.payment !== currentUser.payment) {
        if (remove_seat) {
          const payment = await Payment({ _id: _user.payment }).catch((err) => {
            console.log('payment fine err', err.message);
          });

          cancelSubscription(payment.subscription).catch((err) => {
            console.log('cancel subscription', err);
          });
        } else {
          User.updateOne(
            {
              _id: currentUser.id,
            },
            {
              $push: {
                sub_account_payments: _user.payment,
              },
            }
          ).catch((err) => {
            console.log('user update err', err.message);
          });
        }
      } else if (remove_seat) {
        count += 1;
      }

      if (_user.additional_payments) {
        const additional_payments = _user.additional_payments;

        additional_payments.forEach(async (additional_payment) => {
          if (additional_payment !== currentUser.payment) {
            if (remove_seat) {
              const payment = await Payment({ _id: additional_payment }).catch(
                (err) => {
                  console.log('payment fine err', err.message);
                }
              );

              cancelSubscription(payment.subscription).catch((err) => {
                console.log('cancel subscription', err);
              });
            } else {
              User.updateOne(
                {
                  _id: currentUser.id,
                },
                {
                  $push: {
                    sub_account_payments: additional_payments,
                  },
                }
              ).catch((err) => {
                console.log('user update err', err.message);
              });
            }
          } else {
            count += 1;
          }
        });
      }

      if (remove_seat) {
        User.updateOne(
          {
            _id: currentUser.id,
          },
          {
            $set: { 'sub_account_info.max_count': count },
          }
        ).catch((err) => {
          console.log('user remove seat err', err.message);
        });
      }

      User.updateOne(
        {
          _id: req.params.id,
        },
        {
          $set: { del: true },
        }
      ).catch((err) => {
        console.log('sub-user remove one err', err.message);
      });

      return res.send({
        status: true,
      });
    } else {
      return res.status(400).json({
        status: false,
        error: 'Invalid permission',
      });
    }
  } else {
    return res.status(400).json({
      status: false,
      error: 'Invalid permission',
    });
  }
};

const buySubAccount = async (req, res) => {
  const { currentUser } = req;

  const payment = await Payment.findOne({
    _id: currentUser.payment,
  }).catch((err) => {
    console.log('payment find err', err.message);
  });

  const subscription_data = {
    customer_id: payment.customer_id,
    plan_id: api.STRIPE.PLAN['PRO'],
    is_trial: false,
    // trial_period_days: system_settings.DIALER_FREE_TRIAL,
  };

  createSubscription(subscription_data)
    .then(async (subscription) => {
      const new_payment = new Payment({
        ...payment,
        plan_id: api.STRIPE.PLAN['PRO'],
        subscription: subscription.id,
        _id: undefined,
      });

      new_payment.save().catch((err) => {
        console.log('new_payment err', err.message);
      });

      const sub_account_info = currentUser.sub_account_info;

      let max_sub_account_count = 1;

      if (sub_account_info && sub_account_info.max_count) {
        max_sub_account_count = sub_account_info.max_count + 1;
      }

      User.updateOne(
        {
          _id: currentUser.id,
        },
        {
          $push: { sub_account_payments: new_payment.id },
          $set: {
            'sub_account_info.max_count': max_sub_account_count,
          },
        }
      ).catch((err) => {
        console.log('user update add payment information err', err.message);
      });

      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('create subscription err', err.message);
      return res.status(500).json({
        status: false,
        error: `Can't create more subscription in your account`,
      });
    });
};

const recallSubAccount = async (req, res) => {
  const { currentUser } = req;
  if (currentUser.is_primary) {
    if (
      currentUser.sub_account_payments &&
      currentUser.sub_account_payments[0]
    ) {
      const users = await User.find({
        primary_account: currentUser.id,
        del: false,
      });

      let count = 0;

      for (let i = 0; i < users.length; i++) {
        const account = users[i].equal_account || 1;
        count += account;
      }

      const max_account = currentUser.sub_account_info
        ? currentUser.sub_account_info.max_count
        : 0;

      if (max_account < count) {
        return res.status(400).json({
          status: false,
          error: 'Please remove account first',
        });
      } else {
        const payment = await Payment.findOne({
          _id: currentUser.sub_account_payments[0],
        });

        const subscription_id = payment.subscription;
        cancelSubscription(subscription_id)
          .then(() => {
            User.updateOne(
              {
                _id: currentUser.id,
              },
              {
                $pull: {
                  sub_account_payments: currentUser.sub_account_payments[0],
                },
                $set: {
                  'sub_account_info.max_count': max_account - 1,
                },
              }
            ).catch((err) => {
              console.log('user update err', err.message);
            });

            return res.send({
              status: true,
            });
          })
          .catch((err) => {
            console.log('cancel subscription err', err.message);
            return res.status(500).json({
              status: false,
              error: err.message,
            });
          });
      }
    } else {
      return res.status(400).json({
        status: false,
        error: 'No more seat remove',
      });
    }
  } else {
    return res.status(400).json({
      status: false,
      error: 'Invalid permssion',
    });
  }
};

const mergeSubAccount = async (req, res) => {
  const { currentUser } = req;
  const { user_id } = req.body;

  if (!currentUser.is_primary) {
    return res.status(400).json({
      status: false,
      error: 'No primary account',
    });
  }

  const user = await User.findOne({
    _id: user_id,
    del: false,
  });

  if (!user) {
    return res.status(400).json({
      status: false,
      error: 'No sub user',
    });
  }
  const level = 'PRO';

  const package_data = {
    user: user_id,
    level,
    video_record_limit:
      user.material_info.record_max_duration +
      system_settings.VIDEO_RECORD_LIMIT[level],
    automation_assign_limit:
      user.automation_info.max_count +
      system_settings.AUTOMATION_ASSIGN_LIMIT[level],
    calendar_limit:
      user.calendar_info.max_count + system_settings.CALENDAR_LIMIT[level],
    text_monthly_limit:
      user.text_info.max_count + system_settings.TEXT_MONTHLY_LIMIT[level],
    assistant_limit:
      user.assistant_info.max_count + system_settings.ASSISTANT_LIMIT[level],
  };

  setPackage(package_data).catch((err) => {
    console.log('set package err', err.message);
  });

  let payment;
  if (currentUser.sub_account_payments && currentUser.sub_account_payments[0]) {
    payment = currentUser.sub_account_payments[0];

    User.updateOne(
      {
        _id: currentUser.id,
      },
      {
        $pull: {
          sub_account_payments: payment,
        },
      }
    ).catch((err) => {
      console.log('user sub payment update err', err.message);
    });
  } else {
    payment = currentUser.payment;
  }

  if (user_id === currentUser.id) {
    User.updateOne(
      {
        _id: user_id,
      },
      {
        $set: {
          equal_account: user.equal_account + 1,
        },
      }
    ).catch((err) => {
      console.log('user update equal seat err', err.message);
    });
  } else {
    User.updateOne(
      {
        _id: user_id,
      },
      {
        $push: {
          additional_payments: payment,
        },
        $set: {
          equal_account: user.equal_account + 1,
        },
      }
    ).catch((err) => {
      console.log('user update equal seat err', err.message);
    });
  }

  return res.send({
    status: true,
  });
};

const updateDraft = async (req, res) => {
  const user = req.currentUser;

  const editData = req.body;
  // TODO: should limit the editing fields here
  delete editData.password;

  if (editData['email'] && !user.primary_connected) {
    user['connected_email'] = editData['email'];
  }

  if (editData['phone'] && editData['phone'].e164Number) {
    user['cell_phone'] = editData['phone'].e164Number;
  }
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
    .catch((err) => {
      console.log('user update err', err.message);

      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const contactUs = async (req, res) => {
  const { email, fullname, message } = req.body;
  const data = {
    template_data: {
      full_name: fullname,
      email,
      message,
    },
    template_name: 'ContactUs',
    required_reply: false,
    email: mail_contents.REPLY,
    cc: email,
  };
  sendNotificationEmail(data)
    .then(() => {
      console.log('contact us email has been sent out successfully');
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('contact us email send err', err);
      return res.status(400).json({
        status: false,
        error: err.message,
      });
    });
};

const generateBuilderToken = (req, res) => {
  const { currentUser } = req;
  const payload = {
    email: currentUser.email,
    userId: currentUser._id,
    projectId: api.CONVRRT.PROJECT_ID,
    orgId: api.CONVRRT.ORG_ID,
  };
  const token = jwt.sign(payload, api.CONVRRT.JWT_SECRET);
  return res.send({ status: true, data: token });
};

const getUserStatistics = async (req, res) => {
  const { currentUser } = req;
  // Contacts, materials, tasks calculate
  const contactsCount = await Contact.countDocuments({
    $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
  });
  const lastContact = await Contact.findOne({
    $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
  }).sort('-_id');
  const videoCount = await Video.countDocuments({
    $or: [{ user: currentUser.id }],
    del: false,
  });
  const currentVideos = await Video.find({
    user: currentUser.id,
    recording: true,
    del: false,
  });
  let currentVideoRecordingDuration = 0;
  if (currentVideos.length > 0) {
    for (const video of currentVideos) {
      currentVideoRecordingDuration += video.duration ? video.duration : 0;
    }
  }
  const materials = [];
  const lastVideo = await Video.findOne({ user: currentUser.id }).sort('-_id');
  lastVideo ? materials.push(lastVideo) : false;
  const pdfCount = await PDF.countDocuments({
    $or: [{ user: currentUser.id }],
    del: false,
  });
  const lastPdf = await PDF.findOne({ user: currentUser.id }).sort('-_id');
  lastPdf ? materials.push(lastPdf) : false;
  const imageCount = await Image.countDocuments({
    $or: [{ user: currentUser.id }],
    del: false,
  });
  const lastImage = await Image.findOne({ user: currentUser.id }).sort('-_id');
  lastImage ? materials.push(lastImage) : false;
  const materialCount = videoCount + pdfCount + imageCount;
  const lastMaterials = _.sortBy(materials, 'created_at');
  const lastMaterial = lastMaterials.pop();

  const taskCount = await FollowUp.countDocuments({
    user: currentUser.id,
    status: 0,
  });
  const lastTask = await FollowUp.findOne({
    user: currentUser.id,
    status: 0,
    due_date: { $gte: new Date() },
  }).sort('due_date');

  return res.send({
    status: true,
    data: {
      contact: {
        count: contactsCount,
        last: lastContact,
      },
      task: {
        count: taskCount,
        last: lastTask,
      },
      material: {
        count: materialCount,
        last: lastMaterial,
        record_duration: currentVideoRecordingDuration,
      },
    },
  });
};

const saveVersionInfo = (user, vInfo) => {
  console.log('save version info params', user, vInfo);
  if (vInfo) {
    User.updateOne({ _id: user }, { $set: vInfo }).catch((err) => {
      console.log('version info saving is failed.', err);
    });
  }
};

const saveDeviceToken = (user, os, player_id) => {
  let query = {};
  if (os === 'ios') {
    query = {
      iOSDeviceToken: player_id,
    };
  } else {
    query = {
      androidDeviceToken: player_id,
    };
  }
  User.updateOne({ _id: user }, { $set: query }).catch((err) => {
    console.log('device token saving is failed.', err);
  });
};

const sleepAccount = async (req, res) => {
  const { currentUser } = req;

  await TimeLine.deleteMany({ user: currentUser.id });
  await Task.deleteMany({ user: currentUser.id });
  await FollowUp.deleteMany({ user: currentUser.id });

  if (currentUser.proxy_number_id) {
    releaseSignalWireNumber(currentUser.proxy_number_id);
  }

  if (currentUser.twilio_number_id) {
    releaseTwilioNumber(currentUser.twilio_number_id);
  }

  const payment = await Payment.findOne({
    _id: currentUser.payment,
  }).catch((err) => {
    console.log('payment find err', err.message);
  });

  const subscription_data = {
    customerId: payment.customer_id,
    subscriptionId: payment.subscription,
    planId: api.STRIPE.PLAN['SLEEP'],
  };

  updateSubscription(subscription_data)
    .then(() => {
      const data = {
        template_data: {
          user_name: currentUser.user_name,
          created_at: moment()
            .tz(currentUser.time_zone)
            .format('h:mm MMMM Do, YYYY'),
        },
        template_name: 'SleepAccount',
        required_reply: false,
        cc: currentUser.email,
        email: mail_contents.REPLY,
      };

      sendNotificationEmail(data)
        .then(() => {
          console.log('sleep account email has been sent out successfully');
        })
        .catch((err) => {
          console.log('sleep account email send err', err);
        });

      User.updateOne(
        {
          _id: currentUser.id,
        },
        {
          $set: {
            'subscription.is_suspended': true,
          },
        }
      ).catch((err) => {
        console.log('user update err', err.message);
      });

      Payment.updateOne(
        {
          _id: payment.id,
        },
        {
          $set: {
            plan_id: api.STRIPE.PLAN['SLEEP'],
          },
          $unset: {
            proxy_number_id: true,
            proxy_number: true,
            twilio_number_id: true,
            twilio_number: true,
          },
        }
      ).catch((err) => {
        console.log('payment update err', err.message);
      });

      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('create payment fail', err.message);
      return res.status(400).json({
        status: false,
        error: 'create subscription error',
      });
    });
};

const extensionSignup = async (req, res) => {
  const errors = validationResult(req);
  const errMsg = [];
  if (errors.array().length) {
    for (let i = 0; i < errors.array().length; i++) {
      errMsg.push(errors.array()[i].msg);
    }
  }
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errMsg,
    });
  }

  const _user = await User.findOne({
    email: new RegExp(req.body.email, 'i'),
    del: false,
  }).catch((err) => {
    console.log('user find err in signup', err.message);
  });

  if (_user) {
    return res.status(400).send({
      status: false,
      error: 'User already exists',
    });
  }

  const level = system_settings.EXT_FREE_PACKAGE;

  const password = req.body.password;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 512, 'sha512')
    .toString('hex');

  const user_data = {
    ...req.body,
    package_level: level,
    extension_single: true,
    salt,
    hash,
  };

  const user = new User(user_data);

  user
    .save()
    .then(async (_res) => {
      addNickName(_res.id);

      const package_data = {
        user: _res.id,
        level,
      };

      setPackage(package_data).catch((err) => {
        console.log('user set package err', err.message);
      });

      const time_zone = system_settings.TIME_ZONE;
      const email_data = {
        template_data: {
          user_email: _res.email,
          user_name: _res.user_name,
          created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
          password,
          oneonone_url: urls.ONEONONE_URL,
          recording_url: urls.INTRO_VIDEO_URL,
          recording_preview: urls.RECORDING_PREVIEW_URL,
          webinar_url: system_settings.WEBINAR_LINK,
        },
        template_name: 'WelcomeExtension',
        required_reply: true,
        email: _res.email,
      };

      sendNotificationEmail(email_data)
        .then(() => {
          console.log('welcome email has been sent out succeefully');
        })
        .catch((err) => {
          console.log('welcome email send err', err);
        });

      const token = jwt.sign(
        {
          id: _res.id,
        },
        api.JWT_SECRET
      );

      const myJSON = JSON.stringify(_res);
      const user = JSON.parse(myJSON);
      delete user.hash;
      delete user.salt;

      return res.send({
        status: true,
        data: {
          token,
          user,
        },
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const extensionUpgrade = async (req, res) => {
  const { token, level } = req.body;
  const { currentUser } = req;

  const payment_data = {
    token,
    level,
    user_name: currentUser.user_name,
    email: currentUser.email,
  };

  createPayment(payment_data)
    .then(() => {
      const package_data = {
        user: currentUser.id,
        level: 'EXT_PAID',
      };

      setPackage(package_data).catch((err) => {
        console.log('user set package err', err.message);
      });

      User.updateOne(
        {
          _id: currentUser.id,
        },
        {
          $set: {
            package_level: level,
          },
        }
      ).catch((err) => {
        console.log('user package err', err.message);
      });

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
};

const socialExtensionSignup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }
  const _user = await User.findOne({
    email: new RegExp(req.body.email, 'i'),
    del: false,
  });

  if (_user) {
    return res.status(400).send({
      status: false,
      error: 'User already exists',
    });
  }

  const level = system_settings.EXT_LITE_PACKAGE;

  const user = new User({
    ...req.body,
    package_level: level,
    extension_single: true,
  });

  user
    .save()
    .then((_res) => {
      addNickName(_res.id);

      const package_data = {
        user: _res.id,
        level,
      };

      setPackage(package_data).catch((err) => {
        console.log('user set package err', err.message);
      });

      const time_zone = system_settings.TIME_ZONE;

      const data = {
        template_data: {
          user_email: req.body.email,
          verification_url: `${urls.VERIFY_EMAIL_URL}?id=${_res.id}`,
          user_name: _res.user_name,
          created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
          password: 'No password (use social login)',
          oneonone_url: urls.ONEONONE_URL,
          recording_preview: urls.RECORDING_PREVIEW_URL,
          recording_url: urls.INTRO_VIDEO_URL,
          webinar_url: system_settings.WEBINAR_LINK,
        },
        template_name: 'WelcomeExtension',
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
      const token = jwt.sign({ id: _res.id }, api.JWT_SECRET);

      const myJSON = JSON.stringify(_res);
      const user = JSON.parse(myJSON);

      res.send({
        status: true,
        data: {
          token,
          user,
        },
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
  signUp,
  login,
  extensionLogin,
  extensionSignup,
  logout,
  checkUser,
  sendWelcomeEmail,
  socialSignUp,
  socialExtensionSignup,
  socialLogin,
  socialExtensionLogin,
  extensionUpgrade,
  signUpGmail,
  signUpOutlook,
  socialGmail,
  socialOutlook,
  appSocial,
  appSocialCallback,
  appSocialRegister,
  appSocialRegisterCallback,
  appGoogleSignIn,
  appOutlookSignIn,
  getMe,
  getMyInfo,
  getUserStatistics,
  editMe,
  getUser,
  searchUserEmail,
  searchNickName,
  searchPhone,
  resetPasswordByOld,
  resetPasswordByCode,
  forgotPassword,
  createPassword,
  syncOutlook,
  authorizeOutlook,
  syncGmail,
  authorizeGmail,
  syncYahoo,
  authorizeYahoo,
  authorizeOtherEmailer,
  syncGoogleCalendar,
  authorizeGoogleCalendar,
  syncOutlookCalendar,
  authorizeOutlookCalendar,
  disconnectCalendar,
  authorizeZoom,
  syncZoom,
  schedulePaidDemo,
  scheduledPaidDemo,
  generateSyncSocialLink,
  syncSocialRedirect,
  dailyReport,
  desktopNotification,
  disconDaily,
  disconWeekly,
  disconnectEmail,
  weeklyReport,
  checkAuth,
  checkAuth2,
  checkAuthGuest,
  checkAuthExtension,
  checkConvrrtAuth,
  checkConvrrtEvent,
  checkSuspended,
  checkLastLogin,
  closeAccount,
  connectAnotherEmail,
  pushNotification,
  checkDowngrade,
  updatePackage,
  getCallToken,
  createSubAccount,
  easyLoadSubAccounts,
  getSubAccounts,
  switchAccount,
  editSubAccount,
  removeSubAccount,
  recallSubAccount,
  mergeSubAccount,
  buySubAccount,
  updateDraft,
  contactUs,
  sleepAccount,
  generateBuilderToken,
};
