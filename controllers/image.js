const path = require('path');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');
const base64Img = require('base64-img');
const mime = require('mime-types');
const uuidv1 = require('uuid/v1');
const phone = require('phone');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const EmailTemplate = require('../models/email_template');
const Automation = require('../models/automation');

var graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const { google } = require('googleapis');
const Base64 = require('js-base64').Base64;

const makeBody = (to, from, subject, message) => {
  var str = [
    'Content-Type: text/html; charset="UTF-8"\n',
    'MIME-Version:1.0\n',
    'Content-Transfer-Encoding: 7bit\n',
    'to: ',
    to,
    '\n',
    'from: ',
    from,
    '\n',
    'subject: ',
    subject,
    '\n\n',
    message,
  ].join('');
  var encodedMail = Base64.encodeURI(str);
  return encodedMail;
};

const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
const mail_contents = require('../constants/mail_contents');
const api = require('../config/api');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const { PREVIEW_PATH } = require('../config/path');
const ImageTracker = require('../models/image_tracker');
const Image = require('../models/image');
const Folder = require('../models/folder');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const User = require('../models/user');
const Team = require('../models/team');
const Garbage = require('../models/garbage');
const TimeLine = require('../models/time_line');
const textHelper = require('../helpers/text');
const emailHelper = require('../helpers/email');
const garbageHelper = require('../helpers/garbage');
const ActivityHelper = require('../helpers/activity');

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};
const oauth2 = require('simple-oauth2')(credentials);

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);
const { uploadBase64Image, removeFile } = require('../helpers/fileUpload');

const { RestClient } = require('@signalwire/node');
const { url } = require('inspector');

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});

const play = async (req, res) => {
  const image_id = req.query.image;
  const sender_id = req.query.user;
  const image = await Image.findOne({ _id: image_id, del: false });
  const user = await User.findOne({ _id: sender_id, del: false });

  let capture_dialog = true;
  let capture_delay = 0;
  let capture_field = [];
  // let additional_fields = [];

  if (user && image) {
    const garbage = await Garbage.findOne({ user: user._id }).catch((err) => {
      console.log('err', err);
    });
    let theme = 'theme2';
    let logo;
    let highlights = [];
    let brands = [];
    let intro_video = '';
    let calendly;
    let capture_tags = [];
    let capture_automation = '';

    if (garbage) {
      const themeSetting = garbage.material_themes;
      // additional_fields = garbage.additional_fields;
      if (!image.enabled_capture) {
        capture_dialog = false;
      } else {
        if (image.capture_form) {
          let selectForm;
          const allForms = Object.keys(garbage.capture_field);
          if (allForms.indexOf(image.capture_form) !== -1) {
            selectForm = image.capture_form;
          } else {
            selectForm = 'default';
          }
          capture_delay = garbage['capture_field'][selectForm]['capture_delay'];
          capture_field = garbage['capture_field'][selectForm]['fields'];
          intro_video = garbage['capture_field'][selectForm]['capture_video'];
          capture_tags = garbage['capture_field'][selectForm]['tags'];
          capture_automation =
            garbage['capture_field'][selectForm]['automation'];
        } else {
          capture_delay =
            garbage['capture_field'][garbage.capture_form]['capture_delay'];
          capture_field =
            garbage['capture_field'][garbage.capture_form]['fields'];
          intro_video =
            garbage['capture_field'][garbage.capture_form]['capture_video'];
          capture_tags = garbage['capture_field'][garbage.capture_form]['tags'];
          capture_automation =
            garbage['capture_field'][garbage.capture_form]['automation'];
        }
      }
      theme =
        (themeSetting && themeSetting[image_id]) ||
        garbage['material_theme'] ||
        theme;
      logo = garbage['logo'] || urls.DEFAULT_TEMPLATE_PAGE_LOGO;
      highlights = garbage['highlights'] || [];
      brands = garbage['brands'] || [];

      if (garbage['calendly'] && garbage['calendly'].link) {
        calendly = garbage['calendly'].link;
      }
    } else {
      capture_dialog = false;
    }
    let social_link = {};
    const pattern = /^((http|https|ftp):\/\/)/;

    if (!pattern.test(user.learn_more)) {
      user.learn_more = 'http://' + user.learn_more;
    }
    if (user.social_link) {
      social_link = user.social_link || {};
      if (social_link.facebook && !pattern.test(social_link.facebook)) {
        social_link.facebook = 'http://' + social_link.facebook;
      }
      if (social_link.twitter && !pattern.test(social_link.twitter)) {
        social_link.twitter = 'http://' + social_link.twitter;
      }
      if (social_link.linkedin && !pattern.test(social_link.linkedin)) {
        social_link.linkedin = 'http://' + social_link.linkedin;
      }
    }

    res.render('lead_material_' + theme, {
      material: image,
      material_type: 'image',
      user,
      capture_dialog,
      capture_delay,
      capture_field: capture_field || [],
      social_link: {},
      calendly,
      capture_tags,
      capture_automation,
      setting: {
        logo,
        highlights,
        brands,
        intro_video,
      },
    });
  } else {
    res.send(
      'Sorry! This image link is expired for some reason. Please try ask to sender to send again.'
    );
  }
};

const playUserImage = async (req, res) => {
  const imageId = req.params.id;
  const image = await Image.findOne({ _id: imageId, del: false }).populate({
    path: 'user',
  });
  if (image) {
    if (
      image.user &&
      !image.user.del &&
      image.user.subscription &&
      !image.user.subscription.is_suspended
    ) {
      const user = image.user;

      let capture_dialog = true;
      let capture_delay = 0;
      let capture_field = [];
      const garbage = await Garbage.findOne({ user: image.user._id }).catch(
        (err) => {
          console.log('err', err);
        }
      );
      let theme = 'theme2';
      let logo;
      let highlights = [];
      let brands = [];
      let intro_video = '';
      let calendly;
      let capture_tags = [];
      let capture_automation = '';
      if (garbage) {
        const themeSetting = garbage.material_themes;
        if (!image.enabled_capture) {
          capture_dialog = false;
        } else {
          if (image.capture_form) {
            let selectForm;
            const allForms = Object.keys(garbage.capture_field);
            if (allForms.indexOf(image.capture_form) !== -1) {
              selectForm = image.capture_form;
            } else {
              selectForm = 'default';
            }
            capture_delay =
              garbage['capture_field'][selectForm]['capture_delay'];
            capture_field = garbage['capture_field'][selectForm]['fields'];
            intro_video = garbage['capture_field'][selectForm]['capture_video'];
            capture_tags = garbage['capture_field'][selectForm]['tags'];
            capture_automation =
              garbage['capture_field'][selectForm]['automation'];
          } else {
            capture_delay =
              garbage['capture_field'][garbage.capture_form]['capture_delay'];
            capture_field =
              garbage['capture_field'][garbage.capture_form]['fields'];
            intro_video =
              garbage['capture_field'][garbage.capture_form]['capture_video'];
            capture_tags =
              garbage['capture_field'][garbage.capture_form]['tags'];
            capture_automation =
              garbage['capture_field'][garbage.capture_form]['automation'];
          }
        }
        theme =
          (themeSetting && themeSetting[imageId]) ||
          garbage['material_theme'] ||
          theme;
        logo = garbage['logo'] || urls.DEFAULT_TEMPLATE_PAGE_LOGO;
        highlights = garbage['highlights'] || [];
        brands = garbage['brands'] || [];
        if (garbage['calendly'] && garbage['calendly'].link) {
          calendly = garbage['calendly'].link;
        }
      } else {
        capture_dialog = false;
      }

      const pattern = /^((http|https|ftp):\/\/)/;
      let social_link = {};
      if (!pattern.test(user.learn_more)) {
        user.learn_more = 'http://' + user.learn_more;
      }
      if (user.social_link) {
        social_link = user.social_link || {};
        if (social_link.facebook && !pattern.test(social_link.facebook)) {
          social_link.facebook = 'http://' + social_link.facebook;
        }
        if (social_link.twitter && !pattern.test(social_link.twitter)) {
          social_link.twitter = 'http://' + social_link.twitter;
        }
        if (social_link.linkedin && !pattern.test(social_link.linkedin)) {
          social_link.linkedin = 'http://' + social_link.linkedin;
        }
      }
      return res.render('lead_material_' + theme, {
        material: image,
        material_type: 'image',
        user,
        capture_dialog,
        capture_delay,
        capture_field: capture_field || [],
        social_link,
        calendly,
        capture_tags,
        capture_automation,
        setting: {
          logo,
          highlights,
          brands,
          intro_video,
        },
      });
    } else {
      return res.send(
        'Sorry! This video link is expired for some reason. Please try ask to sender to send again.'
      );
    }
  } else {
    return res.send('Sorry! not found this video.');
  }
};

const play1 = async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id })
    .populate([{ path: 'user' }, { path: 'images' }])
    .catch((err) => {
      console.log('err', err);
    });

  if (activity) {
    const data = activity['user'];
    const myJSON = JSON.stringify(data);
    const user = JSON.parse(myJSON);
    delete user.hash;
    delete user.salt;
    delete user.payment;

    let image;
    if (activity['images'] instanceof Array) {
      image = activity['images'][0];
    } else {
      image = activity['images'];
    }

    const pattern = /^((http|https|ftp):\/\/)/;
    let social_link = {};
    if (!pattern.test(user.learn_more)) {
      user.learn_more = 'http://' + user.learn_more;
    }
    if (user.social_link) {
      social_link = user.social_link || {};
      if (social_link.facebook && !pattern.test(social_link.facebook)) {
        social_link.facebook = 'http://' + social_link.facebook;
      }
      if (social_link.twitter && !pattern.test(social_link.twitter)) {
        social_link.twitter = 'http://' + social_link.twitter;
      }
      if (social_link.linkedin && !pattern.test(social_link.linkedin)) {
        social_link.linkedin = 'http://' + social_link.linkedin;
      }
    }
    const garbage = await Garbage.findOne({ user: data._id }).catch((err) => {
      console.log('err', err);
    });
    let theme = 'theme2';
    let logo;
    let highlights = [];
    let brands = [];
    let calendly;

    if (garbage) {
      const themeSetting = garbage.material_themes;
      theme =
        (themeSetting && themeSetting[image._id]) ||
        garbage['material_theme'] ||
        theme;
      logo = garbage['logo'] || urls.DEFAULT_TEMPLATE_PAGE_LOGO;
      highlights = garbage['highlights'] || [];
      brands = garbage['brands'] || [];

      if (garbage['calendly'] && garbage['calendly'].link) {
        calendly = garbage['calendly'].link;
      }
    }

    res.render('material_' + theme, {
      material: image,
      material_type: 'image',
      user,
      contact: activity['contacts'],
      activity: activity.id,
      social_link,
      calendly,
      setting: {
        logo,
        highlights,
        brands,
      },
    });
  }
};

const playTrackableImage = async (image_id, uuid, res) => {
  const activity = await Activity.findOne({ send_uuid: uuid })
    .populate([{ path: 'user' }, { path: 'images' }])
    .catch((err) => {
      console.log('err', err);
    });

  if (activity) {
    if (!activity.user) {
      return res.send(
        'Sorry! This image link is expired for some reason. Please try ask to sender to send again.1'
      );
    }

    const data = activity['user'];
    const myJSON = JSON.stringify(data);
    const user = JSON.parse(myJSON);
    delete user.hash;
    delete user.salt;
    delete user.payment;

    const image = await Image.findOne({ _id: image_id });

    const pattern = /^((http|https|ftp):\/\/)/;
    let social_link = {};
    if (!pattern.test(user.learn_more)) {
      user.learn_more = 'http://' + user.learn_more;
    }
    if (user.social_link) {
      social_link = user.social_link || {};
      if (social_link.facebook && !pattern.test(social_link.facebook)) {
        social_link.facebook = 'http://' + social_link.facebook;
      }
      if (social_link.twitter && !pattern.test(social_link.twitter)) {
        social_link.twitter = 'http://' + social_link.twitter;
      }
      if (social_link.linkedin && !pattern.test(social_link.linkedin)) {
        social_link.linkedin = 'http://' + social_link.linkedin;
      }
    }
    const garbage = await Garbage.findOne({ user: data._id }).catch((err) => {
      console.log('err', err);
    });
    let theme = 'theme2';
    let logo;
    let highlights = [];
    let brands = [];
    let calendly;

    if (garbage) {
      const themeSetting = garbage.material_themes;
      theme =
        (themeSetting && themeSetting[image._id]) ||
        garbage['material_theme'] ||
        theme;
      logo = garbage['logo'] || urls.DEFAULT_TEMPLATE_PAGE_LOGO;
      highlights = garbage['highlights'] || [];
      brands = garbage['brands'] || [];

      if (garbage['calendly'] && garbage['calendly'].link) {
        calendly = garbage['calendly'].link;
      }
    }

    res.render('material_' + theme, {
      material: image,
      material_type: 'image',
      user,
      contact: activity['contacts'],
      activity: activity.id,
      social_link,
      calendly,
      setting: {
        logo,
        highlights,
        brands,
      },
    });
  }
};
const playUuidImage = async (req, res) => {
  const uuid = req.params.id;
  const activity = await Activity.findOne({ send_uuid: uuid });
  if (activity) {
    playTrackableImage(activity.images[0], uuid, res);
  } else {
    return res.send(
      'Sorry! This video link is expired for some reason. Please try ask to sender to send again.3'
    );
  }
};
const playExtensionImage = async (req, res) => {
  const uuid = req.query.activity;
  const image_id = req.query.image;
  playTrackableImage(image_id, uuid, res);
};

const playDirectSmsImage = async (req, res) => {
  const uuid = req.query.token;
  const image_id = req.query.image;
  Activity.findOne({ images: [image_id], send_uuid: uuid }).then(
    (_activity) => {
      if (_activity) {
        req.params = { id: _activity._id };
        play1(req, res);
      } else {
        playTrackableImage(image_id, uuid, res);
      }
    }
  );
};

const create = async (req, res) => {
  if (req.files) {
    const files = req.files;
    const url = [];
    const key = [];
    for (let i = 0; i < files.length; i++) {
      url.push(files[i].location);
      key.push(files[i].key);
    }

    const image = new Image({
      user: req.currentUser.id,
      type: files[0].mimetype,
      url,
      key,
      role: 'user',
      created_at: new Date(),
    });
    image.save().then((data) => {
      return res.send({
        status: true,
        data,
      });
    });
  }
};

const updateDetail = async (req, res) => {
  const { currentUser } = req;
  const editData = { ...req.body };
  delete editData.preview;

  const image = await Image.findOne({
    user: currentUser.id,
    _id: req.params.id,
  });

  if (!image) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }

  if (req.body.preview) {
    // base 64 image
    const today = new Date();
    const year = today.getYear();
    const month = today.getMonth();

    const preview_image = await uploadBase64Image(
      req.body.preview,
      'preview' + year + '/' + month
    );
    image['preview'] = preview_image;
  }

  for (const key in editData) {
    image[key] = editData[key];
  }

  if (editData['folder']) {
    await Folder.updateOne(
      { _id: editData['folder'], user: currentUser._id },
      { $addToSet: { images: { $each: [image['_id']] } } }
    );
  }
  if (editData['theme']) {
    await Garbage.updateOne(
      { user: currentUser._id },
      { $set: { ['material_themes.' + image._id]: editData['theme'] } }
    ).catch((err) => {
      console.log('saving theme(image) is failed.', err.message);
    });
  }
  image['updated_at'] = new Date();
  image.save().then((data) => {
    return res.send({
      status: true,
      data,
    });
  });
};

const get = async (req, res) => {
  const image = await Image.findOne({ _id: req.params.id }).catch((err) => {
    console.log('err', err);
  });
  const user = await User.findOne({ _id: image.user }).catch((err) => {
    console.log('err', err);
  });
  if (!image) {
    return res.status(400).json({
      status: false,
      error: 'Image doesn`t exist',
    });
  }
  const myJSON = JSON.stringify(image);
  const data = JSON.parse(myJSON);
  Object.assign(data, { user });

  res.send({
    status: true,
    data,
  });
};

const getPreview = (req, res) => {
  const filePath = PREVIEW_PATH + req.params.name;

  if (fs.existsSync(filePath)) {
    if (req.query.resize) {
      const readStream = fs.createReadStream(filePath);
      let transform = sharp();
      transform = transform.resize(250, 140);
      return readStream.pipe(transform).pipe(res);
    } else {
      const contentType = mime.contentType(path.extname(req.params.name));
      res.set('Content-Type', contentType);
      return res.sendFile(filePath);
    }
  } else {
    res.status(404).send({
      status: false,
      error: 'Preview does not exist',
    });
  }
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const _image_list = await Image.find({
    user: currentUser.id,
    del: false,
  }).sort({ created_at: 1 });

  const company = currentUser.company || 'eXp Realty';
  const _image_admin = await Image.find({
    role: 'admin',
    del: false,
    company,
  }).sort({
    created_at: 1,
  });
  Array.prototype.push.apply(_image_list, _image_admin);

  const teams = await Team.find({
    $or: [{ members: currentUser.id }, { owner: currentUser.id }],
  }).populate('images');

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(_image_list, team.images);
    }
  }

  if (!_image_list) {
    return res.status(400).json({
      status: false,
      error: 'Image doesn`t exist',
    });
  }
  const data = [];

  for (let i = 0; i < _image_list.length; i++) {
    // const _pdf_detail = await PDFTracker.aggregate([
    //     {
    //       $lookup:
    //         {
    //         from:  'pdfs',
    //         localField: 'pdf',
    //         foreignField: '_id',
    //         as: "pdf_detail"
    //         }
    //     },
    //     {
    //       $match: {
    //                 "pdf": _pdf_list[i]._id,
    //                 "user": currentUser._id
    //               }
    //     }
    // ])

    const view = await ImageTracker.countDocuments({
      image: _image_list[i]._id,
      user: currentUser._id,
    });

    const myJSON = JSON.stringify(_image_list[i]);
    const _image = JSON.parse(myJSON);
    const image_detail = await Object.assign(_image, { views: view });
    data.push(image_detail);
  }

  res.send({
    status: true,
    data,
  });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  try {
    const image = await Image.findOne({
      _id: req.params.id,
      user: currentUser.id,
    });
    if (image) {
      const urls = image.url;
      const error_message = [];
      const automations = await Automation.find({
        user: currentUser.id,
        automations: {
          $elemMatch: {
            'action.images': { $elemMatch: { $in: [image.id] } },
          },
        },
      }).catch((err) => {
        console.log('err', err.message);
      });

      if (automations.length > 0) {
        error_message.push({
          reason: 'automations',
          automations,
        });
      }

      const templates = await EmailTemplate.find({
        user: currentUser.id,
        image_ids: image.id,
      }).catch((err) => {
        console.log('err', err.message);
      });

      if (templates.length > 0) {
        error_message.push({
          reason: 'templates',
          templates,
        });
      }

      const shared_teams = await Team.find({
        images: image.id,
      }).catch((err) => {
        console.log('err', err.message);
      });

      if (shared_teams.length > 0) {
        error_message.push({
          reason: 'teams',
          shared_teams,
        });
      }

      if (error_message.length > 0) {
        return res.json({
          status: true,
          failed: [
            {
              material: {
                id: image.id,
                title: image.title,
                type: 'image',
                thumbnail: image.thumbnail,
                preview: image.preview,
              },
              error_message,
            },
          ],
        });
      }

      // if (image['shared_image']) {
      //   Image.updateOne(
      //     {
      //       _id: image.shared_image,
      //       user: currentUser.id,
      //     },
      //     {
      //       $unset: { shared_image: true },
      //       $set: { has_shared: false },
      //     }
      //   ).catch((err) => {
      //     console.log('default image remove err', err.message);
      //   });
      // } else {
      //   if (image.key) {
      //     const keys = image.key;

      //     for (let i = 0; i < keys.length; i++) {
      //       const key = keys[i];
      //       s3.deleteObject(
      //         {
      //           Bucket: api.AWS.AWS_S3_BUCKET_NAME,
      //           Key: key,
      //         },
      //         function (err, data) {
      //           console.log('err', err);
      //         }
      //       );
      //     }
      //   } else {
      //     for (let i = 0; i < urls.length; i++) {
      //       const url = urls[i];
      //       s3.deleteObject(
      //         {
      //           Bucket: api.AWS.AWS_S3_BUCKET_NAME,
      //           Key: url.slice(44),
      //         },
      //         function (err, data) {
      //           console.log('err', err);
      //         }
      //       );
      //     }
      //   }
      // }

      if (image.role === 'team') {
        Team.updateOne(
          { images: req.params.id },
          {
            $pull: { images: { $in: [req.params.id] } },
          }
        ).catch((err) => {
          console.log('team update err', err);
        });
      }

      image['del'] = true;
      image.save();

      res.send({
        status: true,
      });
    } else {
      res.status(400).send({
        status: false,
        error: 'invalid permission',
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).send({
      status: false,
      error: 'internal_server_error',
    });
  }
};

const bulkEmail = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, images, contacts } = req.body;
  const promise_array = [];
  const error = [];

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }

    let email_count = currentUser['email_info']['count'] || 0;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    let detail_content = 'sent image using email';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
      let promise;
      let image_titles = '';
      let image_descriptions = '';
      let image_objects = '';
      let image_subject = subject;
      let image_content = content;
      const activities = [];
      let activity;

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        promise = new Promise(async (resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            error: 'contact email not found or unsubscribed',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      const email_info = currentUser['email_info'];
      if (email_info['is_limit'] && email_count > max_email_count) {
        promise = new Promise((resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            error: 'email daily limit exceed!',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      for (let j = 0; j < images.length; j++) {
        const image = images[j];

        if (!image_content) {
          image_content = '';
        }

        image_subject = image_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        image_content = image_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'images',
          images: image._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: image_subject,
          description: image_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

        if (images.length >= 2) {
          image_titles = mail_contents.IMAGE_TITLE;
        } else {
          image_titles = `${image.title}`;
        }

        if (j < images.length - 1) {
          image_descriptions += `${image.description}, `;
        } else {
          image_descriptions += image.description;
        }
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/>${image.description}<br/><br/><a href="${image_link}"><img src="${image.preview}?resize=true"/></a><br/></p>`
        const image_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${image.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${image_link}"><img src="${image.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        image_objects += image_object;
        activities.push(activity.id);
      }

      if (image_subject === '') {
        image_subject = 'Image: ' + image_titles;
      } else {
        image_subject = image_subject.replace(/{image_title}/gi, image_titles);
        image_subject = image_subject.replace(
          /{material_title}/gi,
          image_titles
        );
      }

      if (image_content.search(/{image_object}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_object}/gi,
          image_objects
        );
      } else {
        image_content = image_content + '<br/>' + image_objects;
      }

      if (content.search(/{image_title}/gi) !== -1) {
        image_content = image_content.replace(/{image_title}/gi, image_titles);
      }

      if (content.search(/{image_description}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_description}/gi,
          image_descriptions
        );
      }

      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
        replyTo: currentUser.connected_email,
        subject: image_subject,
        html:
          '<html><head><title>PDF Invitation</title></head><body><table><tbody>' +
          image_content +
          '</tbody></table>' +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          emailHelper.generateUnsubscribeLink(activity.id) +
          '</body></html>',
        text: image_content,
      };

      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then((_res) => {
            console.log('mailres.errorcode', _res[0].statusCode);
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              email_count += 1;
              console.log('status', _res[0].statusCode);
              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
              });
              resolve();
            } else {
              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('err', err.message);
              });
              console.log('email sending err', msg.to + res[0].statusCode);
              error.push({
                contact: {
                  first_name: _contact.first_name,
                  email: _contact.email,
                },
                error: _res[0].statusCode,
              });
              resolve();
            }
          })
          .catch((err) => {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err.message);
            });
            console.log('email sending err', msg.to);
            console.error(err);
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err,
            });
            resolve();
          });
      });

      promise_array.push(promise);
    }

    Promise.all(promise_array)
      .then(() => {
        currentUser['email_info']['count'] = email_count;
        currentUser.save().catch((err) => {
          console.log('current user save err', err.message);
        });
        if (error.length > 0) {
          return res.status(405).json({
            status: false,
            error,
          });
        }
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(400).json({
          status: false,
          error: err,
        });
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const bulkText = async (req, res) => {
  const { currentUser } = req;
  const { content, images, contacts } = req.body;
  const promise_array = [];
  const error = [];

  let detail_content = 'sent image using sms';
  if (req.guest_loggin) {
    detail_content = ActivityHelper.assistantLog(detail_content);
  }

  if (contacts) {
    if (contacts.length > system_settings.TEXT_ONE_TIME) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.TEXT_ONE_TIME} contacts at a time`,
      });
    }

    for (let i = 0; i < contacts.length; i++) {
      await textHelper.sleep(1000);
      const _contact = await Contact.findOne({ _id: contacts[i] }).catch(
        (err) => {
          console.log('err', err);
        }
      );
      let image_titles = '';
      let image_descriptions = '';
      let image_objects = '';
      let image_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < images.length; j++) {
        const image = images[j];

        if (!image_content) {
          image_content = '';
        }

        image_content = image_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'images',
          images: image._id,
          send_type: 1,
          created_at: new Date(),
          updated_at: new Date(),
          description: image_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

        if (j < images.length - 1) {
          image_titles = image_titles + image.title + ', ';
          image_descriptions += `${image.description}, `;
        } else {
          image_titles += image.title;
          image_descriptions += image.description;
        }
        const image_object = `\n${image.title}:\n\n${image_link}\n`;
        image_objects += image_object;
        activities.push(activity);
      }

      if (image_content.search(/{image_object}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_object}/gi,
          image_objects
        );
      } else {
        image_content = image_content + '\n' + image_objects;
      }

      if (image_content.search(/{image_title}/gi) !== -1) {
        image_content = image_content.replace(/{image_title}/gi, image_titles);
      }

      if (image_content.search(/{image_description}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_description}/gi,
          image_descriptions
        );
      }

      let fromNumber = currentUser['proxy_number'];
      let promise;

      if (fromNumber) {
        fromNumber = await textHelper.getSignalWireNumber(currentUser.id);

        promise = new Promise(async (resolve, reject) => {
          const e164Phone = phone(_contact.cell_phone)[0];
          if (!e164Phone) {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            error.push({
              contact: {
                first_name: _contact.first_name,
                cell_phone: _contact.cell_phone,
              },
              error: 'Invalid phone number',
            });
            resolve(); // Invalid phone number
          }

          client.messages
            .create({
              from: fromNumber,
              to: e164Phone,
              body: image_content,
            })
            .then((message) => {
              if (message.status === 'queued' || message.status === 'sent') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  image_content
                );

                const now = moment();
                const due_date = now.add(1, 'minutes');
                const timeline = new TimeLine({
                  user: currentUser.id,
                  status: 'active',
                  action: {
                    type: 'bulk_sms',
                    message_sid: message.sid,
                    activities,
                  },
                  due_date,
                });
                timeline.save().catch((err) => {
                  console.log('time line save err', err.message);
                });

                Activity.updateMany(
                  { _id: { $in: activities } },
                  {
                    $set: { status: 'pending' },
                  }
                ).catch((err) => {
                  console.log('activity err', err.message);
                });

                // ============ Notification Creator =============
                // {
                //   user: currentUser.id,
                //   message_sid: message.sid,
                //   contact: _contact.id,
                //   activities,
                //   criteria: 'bulk_sms',
                //   status: 'pending',
                // }
                resolve();
              } else if (message.status === 'delivered') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  image_content
                );
                Contact.updateOne(
                  { _id: contacts[i] },
                  {
                    $set: { last_activity: activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve();
              } else {
                Activity.deleteMany({ _id: { $in: activities } }).catch(
                  (err) => {
                    console.log('err', err);
                  }
                );
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    cell_phone: _contact.cell_phone,
                  },
                  error: message.error_message,
                });
                resolve();
              }
            })
            .catch((err) => {
              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('err', err);
              });
              error.push({
                contact: {
                  first_name: _contact.first_name,
                  cell_phone: _contact.cell_phone,
                },
                err,
              });
              resolve();
            });
        });
      } else if (currentUser['twilio_number']) {
        fromNumber = currentUser['twilio_number'];
        promise = new Promise((resolve) => {
          const e164Phone = phone(_contact.cell_phone)[0];
          if (!e164Phone) {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            error.push({
              contact: {
                first_name: _contact.first_name,
                cell_phone: _contact.cell_phone,
              },
              error: 'Invalid phone number',
            });
            resolve(); // Invalid phone number
          }

          textHelper.sleep(1000);
          twilio.messages
            .create({
              from: fromNumber,
              body:
                image_content + '\n\n' + textHelper.generateUnsubscribeLink(),
              to: e164Phone,
            })
            .then((message) => {
              if (
                message.status === 'accepted' ||
                message.status === 'sending' ||
                message.status === 'queued' ||
                message.status === 'sent'
              ) {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  image_content
                );

                const now = moment();
                const due_date = now.add(1, 'minutes');
                const timeline = new TimeLine({
                  user: currentUser.id,
                  status: 'active',
                  action: {
                    type: 'bulk_sms',
                    message_sid: message.sid,
                    activities,
                    service: 'twilio',
                  },
                  due_date,
                });
                timeline.save().catch((err) => {
                  console.log('time line save err', err.message);
                });

                Activity.updateMany(
                  { _id: { $in: activities } },
                  {
                    $set: { status: 'pending' },
                  }
                ).catch((err) => {
                  console.log('activity err', err.message);
                });

                // ============ Notification Creator =============
                resolve();
              } else if (message.status === 'delivered') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  image_content
                );
                Contact.updateOne(
                  { _id: contacts[i] },
                  {
                    $set: { last_activity: activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve();
              } else {
                Activity.deleteMany({ _id: { $in: activities } }).catch(
                  (err) => {
                    console.log('err', err);
                  }
                );
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    cell_phone: _contact.cell_phone,
                  },
                  error: message.error_message,
                });
                resolve();
              }
            })
            .catch((err) => {
              console.log('send sms error: ', err);
            });
        });
      } else {
        fromNumber = api.SIGNALWIRE.DEFAULT_NUMBER;
        promise = new Promise((resolve) => {
          const e164Phone = phone(_contact.cell_phone)[0];
          if (!e164Phone) {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            error.push({
              contact: {
                first_name: _contact.first_name,
                cell_phone: _contact.cell_phone,
              },
              error: 'Invalid phone number',
            });
            resolve(); // Invalid phone number
          }

          textHelper.sleep(1000);
          client.messages
            .create({
              from: fromNumber,
              to: e164Phone,
              body:
                image_content + '\n\n' + textHelper.generateUnsubscribeLink(),
            })
            .then((message) => {
              if (message.status === 'queued' || message.status === 'sent') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  image_content
                );

                const now = moment();
                const due_date = now.add(1, 'minutes');
                const timeline = new TimeLine({
                  user: currentUser.id,
                  status: 'active',
                  action: {
                    type: 'bulk_sms',
                    message_sid: message.sid,
                    activities,
                    service: 'signalwire',
                  },
                  due_date,
                });
                timeline.save().catch((err) => {
                  console.log('time line save err', err.message);
                });

                Activity.updateMany(
                  { _id: { $in: activities } },
                  {
                    $set: { status: 'pending' },
                  }
                ).catch((err) => {
                  console.log('activity err', err.message);
                });

                // ============ Notification Creator =============
                resolve();
              } else if (message.status === 'delivered') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  image_content
                );
                Contact.updateOne(
                  { _id: contacts[i] },
                  {
                    $set: { last_activity: activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve();
              } else {
                Activity.deleteMany({ _id: { $in: activities } }).catch(
                  (err) => {
                    console.log('err', err);
                  }
                );
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    cell_phone: _contact.cell_phone,
                  },
                  error: message.error_message,
                });
                resolve();
              }
            })
            .catch((err) => {
              console.log('video message send err', err);
              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('err', err);
              });
              error.push({
                contact: {
                  first_name: _contact.first_name,
                  cell_phone: _contact.cell_phone,
                },
                err,
              });
              resolve();
            });
        });
      }
      promise_array.push(promise);
    }

    Promise.all(promise_array)
      .then(() => {
        if (error.length > 0) {
          return res.status(405).json({
            status: false,
            error,
          });
        }
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(400).json({
          status: false,
          error: err,
        });
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const createSmsContent = async (req, res) => {
  const { currentUser } = req;
  const { content, images, contacts } = req.body;

  const _contact = await Contact.findOne({ _id: contacts[0] }).catch((err) => {
    console.log('err', err);
  });
  let image_titles = '';
  let image_descriptions = '';
  let image_objects = '';
  let image_content = content;
  let activity;

  for (let j = 0; j < images.length; j++) {
    const image = images[j];

    if (!image_content) {
      image_content = '';
    }

    image_content = image_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    const _activity = new Activity({
      content: 'sent image using sms',
      contacts: contacts[0],
      user: currentUser.id,
      type: 'images',
      images: image._id,
      created_at: new Date(),
      updated_at: new Date(),
      description: image_content,
    });

    const activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });

    const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

    if (j < images.length - 1) {
      image_titles = image_titles + image.title + ', ';
      image_descriptions += `${image.description}, `;
    } else {
      image_titles += image.title;
      image_descriptions += image.description;
    }
    const image_object = `\n${image.title}:\n${image_link}\n`;
    image_objects += image_object;
  }

  if (image_content.search(/{image_object}/gi) !== -1) {
    image_content = image_content.replace(/{image_object}/gi, image_objects);
  } else {
    console.log('image_objects', image_objects);
    image_content += image_objects;
  }

  if (image_content.search(/{image_title}/gi) !== -1) {
    image_content = image_content.replace(/{image_title}/gi, image_titles);
  }

  if (image_content.search(/{image_description}/gi) !== -1) {
    image_content = image_content.replace(
      /{image_description}/gi,
      image_descriptions
    );
  }

  return res.send({
    status: true,
    data: image_content,
  });
};

const bulkGmail = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, images, contacts } = req.body;
  const promise_array = [];
  const error = [];

  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );
  const token = JSON.parse(currentUser.google_refresh_token);
  oauth2Client.setCredentials({ refresh_token: token.refresh_token });
  await oauth2Client.getAccessToken().catch((err) => {
    console.log('get access err', err);
    return res.status(406).send({
      status: false,
      error: 'not connected',
    });
  });

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_ONE_TIME) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_ONE_TIME} contacts at a time`,
      });
    }

    let email_count = currentUser['email_info']['count'] || 0;
    let no_connected = false;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    let detail_content = 'sent image using email';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
      let image_titles = '';
      let image_descriptions = '';
      let image_objects = '';
      let image_subject = subject;
      let image_content = content;
      let activity;
      const activities = [];
      let promise;
      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        promise = new Promise(async (resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            error: 'contact email not found or unsubscribed',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      const email_info = currentUser['email_info'];
      if (email_info['is_limit'] && email_count > max_email_count) {
        promise = new Promise((resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            error: 'email daily limit exceed!',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      for (let j = 0; j < images.length; j++) {
        const image = images[j];

        if (!image_content) {
          image_content = '';
        }

        image_subject = image_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        image_content = image_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'images',
          images: image._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: image_subject,
          description: image_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        activities.push(activity.id);

        const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

        if (images.length >= 2) {
          image_titles = mail_contents.IMAGE_TITLE;
        } else {
          image_titles = `${image.title}`;
        }

        if (j < images.length - 1) {
          image_descriptions += `${image.description}, `;
        } else {
          image_descriptions += image.description;
        }
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/>${image.description}<br/><br/><a href="${image_link}"><img src="${image.preview}?resize=true"/></a><br/></p>`
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/><br/><a href="${image_link}"><img src="${image.preview}?resize=true"/></a><br/></p>`;
        const image_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${image.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${image_link}"><img src="${image.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        image_objects += image_object;
      }

      if (image_titles === '') {
        image_subject = 'Image: ' + image_subject;
      } else {
        image_subject = image_subject.replace(/{image_title}/gi, image_titles);
        image_subject = image_subject.replace(
          /{material_title}/gi,
          image_titles
        );
      }

      if (image_content.search(/{image_object}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_object}/gi,
          image_objects
        );
      } else {
        image_content = image_content + '<br/>' + image_objects;
      }

      if (content.search(/{image_title}/gi) !== -1) {
        image_content = image_content.replace(/{image_title}/gi, image_titles);
      }

      if (content.search(/{image_description}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_description}/gi,
          image_descriptions
        );
      }

      // const email_content =
      //   '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
      //   image_content +
      //   '<br/>Thank you,<br/>' +
      //   currentUser.email_signature +
      //   emailHelper.generateUnsubscribeLink(activity.id) +
      //   '</body></html>';

      const email_content =
        '<html><head><title>Image Invitation</title></head><body><table><tbody>' +
        image_content +
        '</tbody></table>' +
        '<br/>Thank you,<br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';
      // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, image_subject, email_content );

      promise = new Promise((resolve, reject) => {
        // gmail.users.messages.send({
        //   'userId': currentUser.email,
        //   'resource': {
        //     raw: rawContent
        //   }
        // }, (err, response) => {
        //   if(err) {
        //     Activity.deleteOne({_id: activity.id}).catch(err=>{
        //       console.log('err', err)
        //     })
        //     console.log('err', err)
        //     error.push({
        //       contact: {
        //         first_name: _contact.first_name,
        //         email: _contact.email
        //       },
        //       error: err
        //     })
        //     resolve();
        //   }
        //   else {
        //     Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
        //       console.log('err', err)
        //     })
        //     resolve();
        //   }
        // })
        try {
          const body = createBody({
            headers: {
              To: _contact.email,
              From: `${currentUser.user_name} <${currentUser.connected_email}>`,
              Subject: image_subject,
            },
            textHtml: email_content,
            textPlain: email_content,
          });
          request({
            method: 'POST',
            uri: 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
            headers: {
              Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
              'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
            },
            body,
          })
            .then(() => {
              Contact.updateOne(
                { _id: contacts[i] },
                { $set: { last_activity: activity.id } }
              ).catch((err) => {
                console.log('err', err);
              });
              email_count += 1;
              resolve();
            })
            .catch((err) => {
              console.log('gmail send err', err);
              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('err', err.message);
              });

              if (err.statusCode === 403) {
                no_connected = true;
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    email: _contact.email,
                  },
                  error: 'No Connected Gmail',
                });
              } else if (err.statusCode === 400) {
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    email: _contact.email,
                  },
                  error: err.message,
                });
              } else {
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    email: _contact.email,
                  },
                  error: 'Recipient address required',
                });
              }
              resolve();
            });
        } catch (err) {
          console.log('err', err);
          Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
            console.log('err', err.message);
          });

          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            error: err.message || 'Unknown Error',
          });
          resolve();
        }
      });

      promise_array.push(promise);
    }

    Promise.all(promise_array)
      .then(() => {
        currentUser['email_info']['count'] = email_count;
        currentUser.save().catch((err) => {
          console.log('current user save err', err.message);
        });
        if (no_connected) {
          return res.status(406).send({
            status: false,
            error: 'no connected',
          });
        }
        if (error.length > 0) {
          return res.status(405).json({
            status: false,
            error,
          });
        }
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(400).json({
          status: false,
          error: err,
        });
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const bulkOutlook = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, images, contacts } = req.body;
  const promise_array = [];
  const error = [];

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_ONE_TIME) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_ONE_TIME} contacts at a time`,
      });
    }

    let email_count = currentUser['email_info']['count'] || 0;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });

    let detail_content = 'sent image using email';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
      let accessToken;
      let promise;

      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error.message);
          } else {
            resolve(result.token);
          }
        });
      })
        .then((token) => {
          accessToken = token.access_token;
        })
        .catch((error) => {
          console.log('outlook token grant error', error);
          return res.status(406).send({
            status: false,
            error: 'not connected',
          });
        });

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        promise = new Promise(async (resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            error: 'contact email not found or unsubscribed',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      const email_info = currentUser['email_info'];
      if (email_info['is_limit'] && email_count > max_email_count) {
        promise = new Promise((resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            error: 'email daily limit exceed!',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      let image_titles = '';
      let image_descriptions = '';
      let image_objects = '';
      let image_subject = subject;
      let image_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < images.length; j++) {
        const image = images[j];

        if (!image_content) {
          image_content = '';
        }

        image_subject = image_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        image_content = image_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'images',
          images: image._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: image_subject,
          description: image_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

        if (images.length >= 2) {
          image_titles = mail_contents.IMAGE_TITLE;
        } else {
          image_titles = `${image.title}`;
        }

        if (j < images.length - 1) {
          image_descriptions += `${image.description}, `;
        } else {
          image_descriptions += image.description;
        }
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/>${image.description}<br/><br/><a href="${image_link}"><img src="${image.preview}?resize=true"/></a><br/></p>`
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/><br/><a href="${image_link}"><img src="${image.preview}?resize=true"/></a><br/></p>`;
        const image_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${image.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${image_link}"><img src="${image.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        image_objects += image_object;
        activities.push(activity.id);
      }

      if (image_subject === '') {
        image_subject = 'Image: ' + image_titles;
      } else {
        image_subject = image_subject.replace(/{image_title}/gi, image_titles);
        image_subject = image_subject.replace(
          /{material_title}/gi,
          image_titles
        );
      }

      if (image_content.search(/{image_object}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_object}/gi,
          image_objects
        );
      } else {
        image_content = image_content + '<br/>' + image_objects;
      }

      if (content.search(/{image_title}/gi) !== -1) {
        image_content = image_content.replace(/{image_title}/gi, image_titles);
      }

      if (content.search(/{image_description}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_description}/gi,
          image_descriptions
        );
      }

      const email_content =
        '<html><head><title>Image Invitation</title></head><body><table><tbody>' +
        image_content +
        '</tbody></table>' +
        '<br/>Thank you,<br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';

      const sendMail = {
        message: {
          subject: image_subject,
          body: {
            contentType: 'HTML',
            content: email_content,
          },
          toRecipients: [
            {
              emailAddress: {
                address: _contact.email,
              },
            },
          ],
        },
        saveToSentItems: 'true',
      };

      promise = new Promise((resolve, reject) => {
        client
          .api('/me/sendMail')
          .post(sendMail)
          .then(() => {
            email_count += 1;
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            resolve();
          })
          .catch((err) => {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err.message);
            });
            console.log('err', err);
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err,
            });
            resolve();
          });
      });
      promise_array.push(promise);
    }

    Promise.all(promise_array)
      .then(() => {
        currentUser['email_info']['count'] = email_count;
        currentUser.save().catch((err) => {
          console.log('current user save err', err.message);
        });

        if (error.length > 0) {
          return res.status(405).json({
            status: false,
            error,
          });
        }
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(400).json({
          status: false,
          error: err,
        });
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const getEasyLoad = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const images = await Image.find({
    $or: [
      {
        user: mongoose.Types.ObjectId(currentUser.id),
        del: false,
      },
      {
        role: 'admin',
        company,
        del: false,
      },
      {
        shared_members: currentUser.id,
      },
    ],
  });

  return res.send({
    status: true,
    data: images,
  });
};

const createImage = async (req, res) => {
  let preview;
  const { currentUser } = req;
  if (req.body.preview && req.body.preview.indexOf('teamgrow.s3') === -1) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      preview = await uploadBase64Image(
        req.body.preview,
        'preview' + year + '/' + month
      );
    } catch (error) {
      console.error('Upload Preview Image', error);
    }
  } else {
    preview = req.body.preview;
  }

  const image = new Image({
    ...req.body,
    preview,
    user: currentUser.id,
  });

  if (req.body.shared_image) {
    Image.updateOne(
      {
        _id: req.body.shared_image,
      },
      {
        $set: {
          has_shared: true,
          shared_image: image.id,
        },
      }
    ).catch((err) => {
      console.log('image update err', err.message);
    });
  } else if (req.body.default_edited) {
    // Update Garbage
    const garbage = await garbageHelper.get(currentUser);
    if (!garbage) {
      return res.status(400).send({
        status: false,
        error: `Couldn't get the Garbage`,
      });
    }

    if (garbage['edited_image']) {
      garbage['edited_image'].push(req.body.default_image);
    } else {
      garbage['edited_image'] = [req.body.default_image];
    }
  }

  const _image = await image
    .save()
    .then()
    .catch((err) => {
      console.log('err', err);
    });

  const response = { ..._image._doc };
  if (req.body.folder) {
    const updateResult = await Folder.updateOne(
      { _id: req.body['folder'], user: currentUser._id },
      { $addToSet: { images: { $each: [image['_id']] } } }
    );
    if (updateResult && updateResult.nModified) {
      response['folder'] = req.body.folder;
    }
  }
  if (req.body.theme) {
    await Garbage.updateOne(
      { user: currentUser._id },
      { $set: { ['material_themes.' + image['_id']]: req.body.theme } }
    ).catch((err) => {
      console.log('saving theme is failed.', err.message);
    });
  }

  res.send({
    status: true,
    data: response,
  });
};

const updateDefault = async (req, res) => {
  const { image, id } = req.body;
  let preview_path;
  const { currentUser } = req;

  const defaultImage = await Image.findOne({ _id: id, role: 'admin' }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  if (!defaultImage) {
    return res.status(400).json({
      status: false,
      error: 'This Default Image does not exist',
    });
  }
  // Update Garbage
  const garbage = await garbageHelper.get(currentUser);
  if (!garbage) {
    return res.status(400).send({
      status: false,
      error: `Couldn't get the Garbage`,
    });
  }

  if (garbage['edited_image']) {
    garbage['edited_image'].push(id);
  } else {
    garbage['edited_image'] = [id];
  }

  await garbage.save().catch((err) => {
    return res.status(400).json({
      status: false,
      error: 'Update Garbage Error.',
    });
  });

  for (const key in image) {
    defaultImage[key] = image[key];
  }

  if (image.preview) {
    // base 64 image
    const file_name = uuidv1();

    if (!fs.existsSync(PREVIEW_PATH)) {
      fs.mkdirSync(PREVIEW_PATH);
    }

    preview_path = base64Img.imgSync(image.preview, PREVIEW_PATH, file_name);
    if (fs.existsSync(preview_path)) {
      fs.readFile(preview_path, (err, data) => {
        if (err) {
          console.log('File read error', err.message || err.msg);
        } else {
          console.log('File read done successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'preview' + year + '/' + month + '/' + file_name,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) {
              console.log('upload s3 error', s3Err);
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`);

              preview_path = upload.Location;
              if (preview_path) {
                defaultImage['preview'] = preview_path;
              }

              defaultImage['updated_at'] = new Date();
              const defaultImageJSON = JSON.parse(JSON.stringify(defaultImage));
              delete defaultImageJSON['_id'];
              delete defaultImageJSON['role'];

              const newImage = new Image({
                ...defaultImageJSON,
                user: currentUser._id,
                default_image: id,
                default_edited: true,
              });

              const _image = await newImage
                .save()
                .then()
                .catch((err) => {
                  console.log('image new creating err', err.message);
                });

              return res.send({
                status: true,
                data: _image,
              });
            }
          });
        }
      });
    } else {
      console.log('preview writting server error');
      return res.status(400).json({
        status: false,
        error: 'preview writing server error.',
      });
    }
  } else {
    defaultImage['updated_at'] = new Date();
    const defaultPdfJSON = JSON.parse(JSON.stringify(defaultImage));
    delete defaultPdfJSON['_id'];
    delete defaultPdfJSON['role'];

    const newImage = new Image({
      ...defaultPdfJSON,
      user: currentUser._id,
      default_pdf: id,
      default_edited: true,
    });

    const _image = await newImage
      .save()
      .then()
      .catch((err) => {
        console.log('image save err', err);
      });

    return res.send({
      status: true,
      data: _image,
    });
  }
};

const downloadImage = async (req, res) => {
  const { currentUser } = req;
  const image = await Image.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!image) {
    return res.status(400).json({
      status: false,
      error: 'Invalid permission',
    });
  }

  if (!image.url) {
    return res.status(400).json({
      status: false,
      error: 'URL not found',
    });
  }
  const options = {
    Bucket: api.AWS.AWS_S3_BUCKET_NAME,
    Key: image.url.slice(44),
  };

  try {
    res.attachment(image.url.slice(44));
    const fileStream = s3.getObject(options).createReadStream();
    fileStream.pipe(res);
  } catch (err) {
    console.log('err', err);
  }
};

const getAnalytics = async (req, res) => {
  const { currentUser } = req;

  const image = await Image.findOne({ _id: req.params.id });
  const sent_activity = await Activity.countDocuments({
    images: req.params.id,
    user: currentUser.id,
    type: 'images',
  });

  const watched_activity = await ImageTracker.find({
    image: req.params.id,
    user: currentUser.id,
  }).populate('contact');

  const watched_contacts = await ImageTracker.aggregate([
    {
      $match: {
        image: mongoose.Types.ObjectId(req.params.id),
        user: mongoose.Types.ObjectId(currentUser.id),
      },
    },
    {
      $group: {
        _id: { contact: '$contact' },
        count: { $sum: 1 },
      },
    },
  ]);
  const track_activity = await Activity.find({
    images: req.params.id,
    user: currentUser.id,
    type: 'images',
    content: 'generated link',
  })
    .populate('contacts')
    .populate('image_trackers');
  return res.send({
    status: true,
    data: {
      image,
      sent_activity,
      watched_activity,
      watched_contacts,
      track_activity,
    },
  });
};

module.exports = {
  play,
  play1,
  playExtensionImage,
  playUuidImage,
  playDirectSmsImage,
  playUserImage,
  create,
  createImage,
  updateDetail,
  updateDefault,
  get,
  getEasyLoad,
  getAll,
  getPreview,
  getAnalytics,
  bulkEmail,
  bulkText,
  createSmsContent,
  bulkGmail,
  bulkOutlook,
  remove,
  downloadImage,
};
