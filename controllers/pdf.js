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
const Garbage = require('../models/garbage');
const garbageHelper = require('../helpers/garbage');
var graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const { google } = require('googleapis');
const Base64 = require('js-base64').Base64;
const { uploadBase64Image, removeFile } = require('../helpers/fileUpload');

const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
const mail_contents = require('../constants/mail_contents');
const api = require('../config/api');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const { PREVIEW_PATH } = require('../config/path');
const PDFTracker = require('../models/pdf_tracker');
const PDF = require('../models/pdf');
const Folder = require('../models/folder');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const User = require('../models/user');
const Team = require('../models/team');
const TimeLine = require('../models/time_line');
const Video = require('../models/video');
const EmailTemplate = require('../models/email_template');
const Automation = require('../models/automation');

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);

const { RestClient } = require('@signalwire/node');

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};
const oauth2 = require('simple-oauth2')(credentials);

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
const textHelper = require('../helpers/text');
const emailHelper = require('../helpers/email');
const ActivityHelper = require('../helpers/activity');

const play = async (req, res) => {
  const pdf_id = req.query.pdf;
  const sender_id = req.query.user;
  const pdf = await PDF.findOne({ _id: pdf_id, del: false });
  const user = await User.findOne({ _id: sender_id, del: false });

  let capture_dialog = true;
  let capture_delay = 0;
  let capture_field = [];

  if (user && pdf) {
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
      if (!pdf.enabled_capture) {
        capture_dialog = false;
      } else {
        if (pdf.capture_form) {
          let selectForm;
          const allForms = Object.keys(garbage.capture_field);
          if (allForms.indexOf(pdf.capture_form) !== -1) {
            selectForm = pdf.capture_form;
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
        (themeSetting && themeSetting[pdf_id]) ||
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
      material: pdf,
      material_type: 'pdf',
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
      'Sorry! This pdf link is expired for some reason. Please try ask to sender to send again.'
    );
  }
};

const playUserPdf = async (req, res) => {
  const pdfId = req.params.id;
  const pdf = await PDF.findOne({ _id: pdfId, del: false }).populate({
    path: 'user',
  });
  if (pdf) {
    if (
      pdf.user &&
      !pdf.user.del &&
      pdf.user.subscription &&
      !pdf.user.subscription.is_suspended
    ) {
      const user = pdf.user;

      let capture_dialog = true;
      let capture_delay = 0;
      let capture_field = [];
      const garbage = await Garbage.findOne({ user: pdf.user._id }).catch(
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
        if (!pdf.enabled_capture) {
          capture_dialog = false;
        } else {
          if (pdf.capture_form) {
            let selectForm;
            const allForms = Object.keys(garbage.capture_field);
            if (allForms.indexOf(pdf.capture_form) !== -1) {
              selectForm = pdf.capture_form;
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
          (themeSetting && themeSetting[pdfId]) ||
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
        material: pdf,
        material_type: 'pdf',
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
    .populate([{ path: 'user' }, { path: 'pdfs' }])
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

    let pdf;
    if (activity['pdfs'] instanceof Array) {
      pdf = activity['pdfs'][0];
    } else {
      pdf = activity['pdfs'];
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
      const themeSetting = garbage['material_themes'];
      theme =
        (themeSetting && themeSetting[pdf._id]) ||
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
      material: pdf,
      material_type: 'pdf',
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
const playUuidPdf = async (req, res) => {
  const uuid = req.params.id;
  const activity = await Activity.findOne({ send_uuid: uuid });
  if (activity) {
    playTrackablePdf(activity.pdfs[0], uuid, res);
  } else {
    return res.send(
      'Sorry! This video link is expired for some reason. Please try ask to sender to send again.3'
    );
  }
};

const playTrackablePdf = async (pdf_id, uuid, res) => {
  const activity = await Activity.findOne({ send_uuid: uuid })
    .populate([{ path: 'user' }, { path: 'pdfs' }])
    .catch((err) => {
      console.log('err', err);
    });

  if (activity) {
    if (!activity.user) {
      return res.send(
        'Sorry! This pdf link is expired for some reason. Please try ask to sender to send again.1'
      );
    }

    const data = activity['user'];
    const myJSON = JSON.stringify(data);
    const user = JSON.parse(myJSON);
    delete user.hash;
    delete user.salt;
    delete user.payment;

    const pdf = await PDF.findOne({ _id: pdf_id });

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
      const themeSetting = garbage['material_themes'];
      theme =
        (themeSetting && themeSetting[pdf._id]) ||
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
      material: pdf,
      material_type: 'pdf',
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

const playExtensionPdf = async (req, res) => {
  const uuid = req.query.activity;
  const pdf_id = req.query.pdf;
  playTrackablePdf(pdf_id, uuid, res);
};

const playDirectSmsPdf = async (req, res) => {
  const uuid = req.query.token;
  const pdf_id = req.query.pdf;
  Activity.findOne({ pdfs: [pdf_id], send_uuid: uuid }).then((_activity) => {
    if (_activity) {
      req.params = { id: _activity._id };
      play1(req, res);
    } else {
      playTrackablePdf(pdf_id, uuid, res);
    }
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  let count = 0;
  let max_upload_count = 0;

  if (!currentUser.material_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable create pdf',
    });
  }

  if (currentUser.material_info['is_limit']) {
    const userVideoCount = await Video.countDocuments({
      user: currentUser.id,
      uploaded: true,
    });
    const userPDFCount = await PDF.countDocuments({
      user: currentUser.id,
      del: false,
    });
    count = userVideoCount + userPDFCount;
    max_upload_count =
      currentUser.material_info.upload_max_count ||
      system_settings.MATERIAL_UPLOAD_LIMIT.PRO;
  }

  if (currentUser.material_info['is_limit'] && max_upload_count <= count) {
    return res.status(412).send({
      status: false,
      error: 'Exceed upload max materials',
    });
  }

  if (req.file) {
    if (req.currentUser) {
      const pdf = new PDF({
        user: req.currentUser.id,
        type: req.file.mimetype,
        url: req.file.location,
        key: req.file.key,
        role: 'user',
        created_at: new Date(),
      });

      pdf.save().then((_pdf) => {
        res.send({
          status: true,
          data: _pdf,
        });
      });
    }
  }
};

const updateDetail = async (req, res) => {
  const editData = { ...req.body };
  delete editData.preview;
  const { currentUser } = req;
  const pdf = await PDF.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('pdf found err', err.message);
  });

  if (!pdf) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }
  if (req.body.preview) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      const preview_image = await uploadBase64Image(
        req.body.preview,
        'preview' + year + '/' + month
      );
      pdf['preview'] = preview_image;
    } catch (error) {
      console.error('Upload PDF Preview Image', error);
    }
  }

  for (const key in editData) {
    pdf[key] = editData[key];
  }

  if (editData['folder']) {
    await Folder.updateOne(
      { _id: editData['folder'], user: currentUser._id },
      { $addToSet: { pdfs: { $each: [pdf['_id']] } } }
    );
  }
  if (editData['theme']) {
    await Garbage.updateOne(
      { user: currentUser._id },
      { $set: { ['material_themes.' + pdf._id]: editData['theme'] } }
    ).catch((err) => {
      console.log('saving theme(pdf) is failed.', err.message);
    });
  }

  pdf['updated_at'] = new Date();
  pdf
    .save()
    .then((_pdf) => {
      return res.send({
        status: true,
        data: _pdf,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message,
      });
    });
};

const updateDefault = async (req, res) => {
  const { pdf, id } = req.body;
  let preview_path;
  const { currentUser } = req;

  const defaultPDF = await PDF.findOne({ _id: id, role: 'admin' }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  if (!defaultPDF) {
    return res.status(400).json({
      status: false,
      error: 'This Default PDF does not exist',
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

  if (garbage['edited_pdf']) {
    garbage['edited_pdf'].push(id);
  } else {
    garbage['edited_pdf'] = [id];
  }

  await garbage.save().catch((err) => {
    return res.status(400).json({
      status: false,
      error: 'Update Garbage Error.',
    });
  });

  for (const key in pdf) {
    defaultPDF[key] = pdf[key];
  }

  if (pdf.preview) {
    // base 64 image
    const file_name = uuidv1();

    if (!fs.existsSync(PREVIEW_PATH)) {
      fs.mkdirSync(PREVIEW_PATH);
    }

    preview_path = base64Img.imgSync(pdf.preview, PREVIEW_PATH, file_name);
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
                defaultPDF['preview'] = preview_path;
              }

              defaultPDF['updated_at'] = new Date();
              const defaultPdfJSON = JSON.parse(JSON.stringify(defaultPDF));
              delete defaultPdfJSON['_id'];
              delete defaultPdfJSON['role'];

              const newPDF = new PDF({
                ...defaultPdfJSON,
                user: currentUser._id,
                default_pdf: id,
                default_edited: true,
              });

              const _pdf = await newPDF
                .save()
                .then()
                .catch((err) => {
                  console.log('pdf new creating err', err.message);
                });

              return res.send({
                status: true,
                data: _pdf,
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
    defaultPDF['updated_at'] = new Date();
    const defaultPdfJSON = JSON.parse(JSON.stringify(defaultPDF));
    delete defaultPdfJSON['_id'];
    delete defaultPdfJSON['role'];

    const newPDF = new PDF({
      ...defaultPdfJSON,
      user: currentUser._id,
      default_pdf: id,
      default_edited: true,
    });

    const _pdf = await newPDF
      .save()
      .then()
      .catch((err) => {
        console.log('pdf save err', err);
      });

    return res.send({
      status: true,
      data: _pdf,
    });
  }
};

const get = async (req, res) => {
  const pdf = await PDF.findOne({ _id: req.params.id });
  const user = await User.findOne({ _id: pdf.user });
  if (!pdf) {
    return res.status(400).json({
      status: false,
      error: 'PDF doesn`t exist',
    });
  }
  const myJSON = JSON.stringify(pdf);
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
  const garbage = await garbageHelper.get(currentUser);
  let editedPDFs = [];
  if (garbage && garbage['edited_pdf']) {
    editedPDFs = garbage['edited_pdf'];
  }

  const company = currentUser.company || 'eXp Realty';
  const _pdf_list = await PDF.find({ user: currentUser.id, del: false }).sort({
    created_at: 1,
  });
  const _pdf_admin = await PDF.find({
    role: 'admin',
    del: false,
    _id: { $nin: editedPDFs },
    company,
  }).sort({
    created_at: 1,
  });
  Array.prototype.push.apply(_pdf_list, _pdf_admin);

  const teams = await Team.find({
    $or: [{ members: currentUser.id }, { owner: currentUser.id }],
  }).populate('pdfs');

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(_pdf_list, team.pdfs);
    }
  }

  if (!_pdf_list) {
    return res.status(400).json({
      status: false,
      error: 'PDF doesn`t exist',
    });
  }
  const _pdf_detail_list = [];

  for (let i = 0; i < _pdf_list.length; i++) {
    const _pdf_detail = await PDFTracker.aggregate([
      {
        $lookup: {
          from: 'pdfs',
          localField: 'pdf',
          foreignField: '_id',
          as: 'pdf_detail',
        },
      },
      {
        $match: {
          pdf: _pdf_list[i]._id,
          user: currentUser._id,
        },
      },
    ]);

    // const view = await PDFTracker.countDocuments({
    //   pdf: _pdf_list[i]._id,
    //   user: currentUser._id,
    // });

    const myJSON = JSON.stringify(_pdf_list[i]);
    const _pdf = JSON.parse(myJSON);
    const pdf_detail = await Object.assign(_pdf, { views: _pdf_detail.length });
    _pdf_detail_list.push(pdf_detail);
  }

  return res.send({
    status: true,
    data: _pdf_detail_list,
  });
};

const sendPDF = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, pdf, pdf_title, pdf_prview, contacts } = req.body;

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }

    for (let i = 0; i < contacts.length; i++) {
      const _contact = await Contact.findOne({ _id: contacts[i] });
      const sendContent = content.replace(
        /{first_name}/gi,
        _contact.first_name
      );
      const _activity = new Activity({
        content: 'sent pdf using email',
        contacts: contacts[i],
        user: currentUser.id,
        type: 'pdfs',
        pdfs: pdf,
        created_at: new Date(),
        updated_at: new Date(),
        subject,
        description: sendContent,
      });
      const activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });
      Contact.updateOne(
        { _id: contacts[i] },
        {
          $set: { last_activity: activity.id },
        }
      ).catch((err) => {
        console.log('err', err);
      });
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;
      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${currentUser.connected_email}>`,
        subject: subject || pdf_title,
        html:
          '<html><head><title>PDF Invitation</title></head><body><p style="white-space: pre-wrap; max-width: 800px;">' +
          sendContent +
          '</p><a href="' +
          pdf_link +
          '">' +
          '<img src=' +
          pdf_prview +
          '?resize=true"></img>' +
          '</a><br/><br/>Thank you<br/><br/>' +
          currentUser.email_signature +
          '</body></html>',
      };

      sgMail
        .send(msg)
        .then((_res) => {
          console.log('mailres.errorcode', _res[0].statusCode);
          if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
            console.log('status', _res[0].statusCode);
          } else {
            console.log('email sending err', msg.to + res[0].statusCode);
          }
        })
        .catch((e) => {
          console.error(e);
        });
    }
    return res.send({
      status: true,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const sendText = async (req, res) => {
  const { currentUser } = req;
  const { content, pdf, pdf_title, contacts } = req.body;

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }

    for (let i = 0; i < contacts.length; i++) {
      const _contact = await Contact.findOne({ _id: contacts[i] });
      const sendContent = content.replace(
        /{first_name}/gi,
        _contact.first_name
      );
      const cell_phone = _contact.cell_phone;
      const _activity = new Activity({
        content: 'sent pdf using sms',
        contacts: contacts[i],
        user: currentUser.id,
        type: 'pdfs',
        pdfs: pdf,
        created_at: new Date(),
        updated_at: new Date(),
        description: sendContent,
      });

      const activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });
      Contact.updateOne(
        { _id: contacts[i] },
        {
          $set: { last_activity: activity.id },
        }
      ).catch((err) => {
        console.log('err', err);
      });

      const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;
      const e164Phone = phone(cell_phone)[0];
      if (!e164Phone) {
        const error = {
          error: 'Invalid Phone Number',
        };

        throw error; // Invalid phone number
      }

      let fromNumber = currentUser['proxy_number'];

      if (!fromNumber) {
        const areaCode = currentUser.cell_phone.substring(1, 4);

        const data = await twilio.availablePhoneNumbers('US').local.list({
          areaCode,
        });

        let number = data[0];

        if (typeof number === 'undefined') {
          const areaCode1 = currentUser.cell_phone.substring(1, 3);

          const data1 = await twilio.availablePhoneNumbers('US').local.list({
            areaCode: areaCode1,
          });
          number = data1[0];
        }

        if (typeof number !== 'undefined') {
          const proxy_number = await twilio.incomingPhoneNumbers.create({
            phoneNumber: number.phoneNumber,
            smsUrl: urls.SMS_RECEIVE_URL,
          });

          console.log('proxy_number', proxy_number);
          currentUser['proxy_number'] = proxy_number.phoneNumber;
          fromNumber = currentUser['proxy_number'];
          currentUser.save().catch((err) => {
            console.log('err', err);
          });
        } else {
          fromNumber = api.TWILIO.TWILIO_NUMBER;
        }
      }
      console.info(`Send SMS: ${fromNumber} -> ${cell_phone} :`, content);

      const body = sendContent + '\n\n' + pdf_title + '\n\n' + pdf_link;

      twilio.messages
        .create({ from: fromNumber, body, to: e164Phone })
        .then(() => {
          console.info(`Send SMS: ${fromNumber} -> ${cell_phone} :`, content);
        })
        .catch((err) => {
          console.log('err', err);
        });
    }
    return res.send({
      status: true,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const remove = async (req, res) => {
  const { currentUser } = req;
  try {
    const pdf = await PDF.findOne({ _id: req.params.id, user: currentUser.id });

    if (pdf) {
      const error_message = [];
      const automations = await Automation.find({
        user: currentUser.id,
        automations: {
          $elemMatch: {
            'action.pdfs': { $elemMatch: { $in: [pdf.id] } },
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
        pdf_ids: pdf.id,
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
        pdfs: pdf.id,
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
                id: pdf.id,
                title: pdf.title,
                type: 'pdf',
                thumbnail: pdf.thumbnail,
                preview: pdf.preview,
              },
              error_message,
            },
          ],
        });
      }

      if (pdf.role === 'team') {
        Team.updateOne(
          { pdfs: req.params.id },
          {
            $pull: { pdfs: { $in: [req.params.id] } },
          }
        ).catch((err) => {
          console.log('err', err.message);
        });
      }

      PDF.updateOne(
        {
          _id: req.params.id,
        },
        {
          $set: { del: true },
        }
      )
        .then(async () => {
          let hasSamePdf = false;
          const samePdfs = await PDF.find({
            del: false,
            url: pdf['url'],
          }).catch((err) => {
            console.log('same video getting error');
          });
          if (samePdfs && samePdfs.length) {
            hasSamePdf = true;
          }
          if (!hasSamePdf) {
            s3.deleteObject(
              {
                Bucket: api.AWS.AWS_S3_BUCKET_NAME,
                Key: pdf.key,
              },
              function (err, data) {
                console.log('err', err);
              }
            );
          }
        })
        .catch((err) => {
          console.log('pdf update err', err.message);
        });

      return res.send({
        status: true,
      });
    } else {
      return res.status(400).send({
        status: false,
        error: 'invalid permission',
      });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).send({
      status: false,
      error: 'internal_server_error',
    });
  }
};

const getHistory = async (req, res) => {
  const { currentUser } = req;
  const _activity_list = await Activity.aggregate([
    {
      $lookup: {
        from: 'contacts',
        localField: 'contacts',
        foreignField: '_id',
        as: 'pdf_detail',
      },
    },
    {
      $match: { pdf: req.params.id, user: currentUser.id },
    },
  ]);
  for (let i = 0; i < _activity_list.length; i++) {
    const _pdf_tracker = PDFTracker.find({
      contact: _activity_list[i].contact,
      pdf: req.params.id,
      user: currentUser.id,
    });
    _activity_list[i].pdf_tracker = _pdf_tracker;
  }
  if (_activity_list) {
    res.send({
      status: true,
      data: {
        data: _activity_list,
      },
    });
  } else {
    res.status(404).send({
      status: false,
      error: 'Activity not found',
    });
  }
};

const bulkEmail = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, pdfs, contacts } = req.body;
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

    let detail_content = 'sent pdf using email';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
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

      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_subject = subject;
      let pdf_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_subject = pdf_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        pdf_content = pdf_content
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
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: pdf_subject,
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.PDF_TITLE;
        } else {
          pdf_titles = `${pdf.title}`;
        }

        if (j < pdfs.length - 1) {
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_descriptions += pdf.description;
        }
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`
        const pdf_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${pdf.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${pdf_link}"><img src="${pdf.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        pdf_objects += pdf_object;
        activities.push(activity.id);
      }

      if (pdf_subject === '') {
        pdf_subject = 'PDF: ' + pdf_titles;
      } else {
        pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
        pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '<br/>' + pdf_objects;
      }

      if (pdf_content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
        replyTo: currentUser.connected_email,
        subject: pdf_subject,
        html:
          '<html><head><title>PDF Invitation</title></head><body><table><tbody>' +
          pdf_content +
          '</tbody></table>' +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          emailHelper.generateUnsubscribeLink(activity.id) +
          '</body></html>',
        text: pdf_content,
      };

      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then((_res) => {
            console.log('mailres.errorcode', _res[0].statusCode);
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              console.log('status', _res[0].statusCode);
              email_count += 1;
              Contact.updateOne(
                {
                  _id: contacts[i],
                },
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
        if (err) {
          return res.status(400).json({
            status: false,
            error: err,
          });
        }
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
  const { content, pdfs, contacts } = req.body;
  const promise_array = [];
  const error = [];

  let detail_content = 'sent pdf using sms';
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
      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_content = content;
      const activities = [];
      let activity;

      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_content = pdf_content
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
          type: 'pdfs',
          pdfs: pdf._id,
          send_type: 1,
          created_at: new Date(),
          updated_at: new Date(),
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (j < pdfs.length - 1) {
          pdf_titles = pdf_titles + pdf.title + ', ';
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_titles += pdf.title;
          pdf_descriptions += pdf.description;
        }
        const pdf_object = `\n${pdf.title}:\n\n${pdf_link}\n`;
        pdf_objects += pdf_object;
        activities.push(activity);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '\n' + pdf_objects;
      }

      if (pdf_content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      let promise;
      let fromNumber = currentUser['proxy_number'];

      if (fromNumber) {
        promise = new Promise((resolve, reject) => {
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
              body: pdf_content,
            })
            .then((message) => {
              if (message.status === 'queued' || message.status === 'sent') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  pdf_content
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

                // ========= Notification Creator ========
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
                  pdf_content
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
              body: pdf_content + '\n\n' + textHelper.generateUnsubscribeLink(),
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
                  pdf_content
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

                // ========= Notification Creator ========
                resolve();
              } else if (message.status === 'delivered') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  pdf_content
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
              body: pdf_content + '\n\n' + textHelper.generateUnsubscribeLink(),
            })
            .then((message) => {
              if (message.status === 'queued' || message.status === 'sent') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  pdf_content
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

                // ========= Notification Creator ========
                resolve();
              } else if (message.status === 'delivered') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  pdf_content
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
  const { content, pdfs, contacts } = req.body;

  const _contact = await Contact.findOne({ _id: contacts[0] }).catch((err) => {
    console.log('err', err);
  });
  let pdf_titles = '';
  let pdf_descriptions = '';
  let pdf_objects = '';
  let pdf_content = content;
  let activity;

  for (let j = 0; j < pdfs.length; j++) {
    const pdf = pdfs[j];

    if (typeof pdf_content === 'undefined') {
      pdf_content = '';
    }

    pdf_content = pdf_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    const _activity = new Activity({
      content: 'sent pdf using sms',
      contacts: contacts[0],
      user: currentUser.id,
      type: 'pdfs',
      pdfs: pdf._id,
      created_at: new Date(),
      updated_at: new Date(),
      description: pdf_content,
    });

    const activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });

    const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

    if (j < pdfs.length - 1) {
      pdf_titles = pdf_titles + pdf.title + ', ';
      pdf_descriptions += `${pdf.description}, `;
    } else {
      pdf_titles += pdf.title;
      pdf_descriptions += pdf.description;
    }
    const pdf_object = `\n${pdf.title}:\n${pdf_link}\n`;
    pdf_objects += pdf_object;
  }

  if (pdf_content.search(/{pdf_object}/gi) !== -1) {
    pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
  } else {
    pdf_content += pdf_objects;
  }

  if (pdf_content.search(/{pdf_title}/gi) !== -1) {
    pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
  }

  if (pdf_content.search(/{pdf_description}/gi) !== -1) {
    pdf_content = pdf_content.replace(/{pdf_description}/gi, pdf_descriptions);
  }

  return res.send({
    status: true,
    data: pdf_content,
  });
};

const bulkOutlook = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, pdfs, contacts } = req.body;
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

    let detail_content = 'sent pdf using email';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
      let accessToken;
      let promise;

      await new Promise((resolve, reject) => {
        token.refresh((error, result) => {
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

      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_subject = subject;
      let pdf_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_subject = pdf_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        pdf_content = pdf_content
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
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: pdf_subject,
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.PDF_TITLE;
        } else {
          pdf_titles = `${pdf.title}`;
        }

        if (j < pdfs.length - 1) {
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_descriptions += pdf.description;
        }
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`;
        const pdf_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${pdf.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${pdf_link}"><img src="${pdf.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        pdf_objects += pdf_object;
        activities.push(activity.id);
      }

      if (subject === '') {
        pdf_subject = 'PDF: ' + pdf_titles;
      } else {
        pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
        pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '<br/>' + pdf_objects;
      }

      if (content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      const email_content =
        '<html><head><title>PDF Invitation</title></head><body><table><tbody>' +
        pdf_content +
        '</tbody></table>' +
        '<br/>Thank you,<br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';

      const sendMail = {
        message: {
          subject: pdf_subject,
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
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            email_count += 1;
            resolve();
          })
          .catch((err) => {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err);
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
        if (err) {
          return res.status(400).json({
            status: false,
            error: err,
          });
        }
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const bulkGmail = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, pdfs, contacts } = req.body;
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

    let detail_content = 'sent pdf using email';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
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

      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_subject = subject;
      let pdf_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_subject = pdf_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        pdf_content = pdf_content
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
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject,
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.PDF_TITLE;
        } else {
          pdf_titles = `${pdf.title}`;
        }

        if (j < pdfs.length - 1) {
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_descriptions += pdf.description;
        }
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`;
        const pdf_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${pdf.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${pdf_link}"><img src="${pdf.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        pdf_objects += pdf_object;
        activities.push(activity.id);
      }

      if (pdf_subject === '') {
        pdf_subject = 'PDF: ' + pdf_titles;
      } else {
        pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
        pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '<br/>' + pdf_objects;
      }

      if (content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      const email_content =
        '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
        pdf_content +
        '</tbody></table>' +
        '<br/>Thank you,<br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';
      // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, pdf_subject, email_content );

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
              Subject: pdf_subject,
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
              console.log('gmail pdf send err', err);
              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('err', err);
              });
              error.push({
                contact: {
                  first_name: _contact.first_name,
                  email: _contact.email,
                },
                err,
              });
              resolve();
            });
        } catch (err) {
          console.log('err', err);
          Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
            console.log('err', err);
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
        }
      });
      promise_array.push(promise);
    }

    Promise.all(promise_array)
      .then(() => {
        if (no_connected) {
          return res.status(406).send({
            status: false,
            error: 'no connected',
          });
        }
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
        if (err) {
          return res.status(400).json({
            status: false,
            error: err,
          });
        }
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
  const pdfs = await PDF.find({
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
    data: pdfs,
  });
};

const createPDF = async (req, res) => {
  let preview;
  const { currentUser } = req;

  let count = 0;
  let max_upload_count = 0;

  if (!currentUser.material_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable materials',
    });
  }

  if (currentUser.material_info['is_limit']) {
    const userVideoCount = await Video.countDocuments({
      user: currentUser.id,
      uploaded: true,
    });
    const userPDFCount = await PDF.countDocuments({
      user: currentUser.id,
      del: false,
    });
    count = userVideoCount + userPDFCount;
    max_upload_count =
      currentUser.material_info.upload_max_count ||
      system_settings.MATERIAL_UPLOAD_LIMIT.PRO;
  }

  if (currentUser.material_info['is_limit'] && max_upload_count <= count) {
    return res.status(412).send({
      status: false,
      error: 'Exceed upload max materials',
    });
  }

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
      console.error('Upload PDF Preview Image', error);
    }
  } else {
    preview = req.body.preview;
  }

  const pdf = new PDF({
    ...req.body,
    preview,
    user: req.currentUser.id,
  });

  if (req.body.shared_pdf) {
    PDF.updateOne(
      {
        _id: req.body.shared_pdf,
      },
      {
        $set: {
          has_shared: true,
          shared_pdf: pdf.id,
        },
      }
    ).catch((err) => {
      console.log('pdf update err', err.message);
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

    if (garbage['edited_pdf']) {
      garbage['edited_pdf'].push(req.body.default_pdf);
    } else {
      garbage['edited_pdf'] = [req.body.default_pdf];
    }
  }

  const _pdf = await pdf
    .save()
    .then()
    .catch((err) => {
      console.log('err', err);
    });

  const response = { ..._pdf._doc };
  if (req.body.folder) {
    const updateResult = await Folder.updateOne(
      { _id: req.body['folder'], user: currentUser._id },
      { $addToSet: { pdfs: { $each: [pdf['_id']] } } }
    );
    if (updateResult && updateResult.nModified) {
      response['folder'] = req.body.folder;
    }
  }
  if (req.body.theme) {
    await Garbage.updateOne(
      { user: currentUser._id },
      { $set: { ['material_themes.' + pdf['_id']]: req.body.theme } }
    ).catch((err) => {
      console.log('saving theme is failed.', err.message);
    });
  }

  res.send({
    status: true,
    data: response,
  });
};

const downloadPDF = async (req, res) => {
  const { currentUser } = req;
  const pdf = await PDF.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!pdf) {
    return res.status(400).json({
      status: false,
      error: 'Invalid permission',
    });
  }

  if (!pdf.url) {
    return res.status(400).json({
      status: false,
      error: 'URL not found',
    });
  }
  const options = {
    Bucket: api.AWS.AWS_S3_BUCKET_NAME,
    Key: pdf.key || pdf.url.slice(44),
  };

  res.attachment(pdf.url.slice(44));

  s3.headObject(options)
    .promise()
    .then(() => {
      const fileStream = s3.getObject().createReadStream();
      fileStream.pipe(res);
    })
    .catch((error) => {
      return res.status(500).json({
        status: false,
        error,
      });
    });
};

const getAnalytics = async (req, res) => {
  const { currentUser } = req;

  const pdf = await PDF.findOne({ _id: req.params.id });
  const sent_activity = await Activity.countDocuments({
    pdfs: req.params.id,
    user: currentUser.id,
    type: 'pdfs',
  });

  const watched_activity = await PDFTracker.find({
    pdf: req.params.id,
    user: currentUser.id,
  }).populate('contact');

  const watched_contacts = await PDFTracker.aggregate([
    {
      $match: {
        pdf: mongoose.Types.ObjectId(req.params.id),
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
    pdfs: req.params.id,
    user: currentUser.id,
    type: 'pdfs',
    content: 'generated link',
  })
    .populate('contacts')
    .populate('pdf_trackers');
  return res.send({
    status: true,
    data: {
      pdf,
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
  playExtensionPdf,
  playUuidPdf,
  playDirectSmsPdf,
  playUserPdf,
  create,
  createPDF,
  updateDetail,
  updateDefault,
  get,
  getEasyLoad,
  getAll,
  getPreview,
  getAnalytics,
  sendPDF,
  sendText,
  bulkEmail,
  bulkText,
  createSmsContent,
  remove,
  getHistory,
  bulkOutlook,
  bulkGmail,
  downloadPDF,
};
