const path = require('path');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');
const base64Img = require('base64-img');
const mime = require('mime-types');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

ffmpeg.setFfmpegPath(ffmpegPath);

const uuidv1 = require('uuid/v1');
const phone = require('phone');
const AWS = require('aws-sdk');
const GIFEncoder = require('gifencoder');

const extractFrames = require('ffmpeg-extract-frames');
const { createCanvas, loadImage } = require('canvas');
const pngFileStream = require('png-file-stream');
const sharp = require('sharp');
const graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const { google } = require('googleapis');
const Base64 = require('js-base64').Base64;
const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
const Activity = require('../models/activity');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Folder = require('../models/folder');
const VideoTracker = require('../models/video_tracker');
const Garbage = require('../models/garbage');
const Contact = require('../models/contact');
const MaterialTheme = require('../models/material_theme');
const Team = require('../models/team');
const User = require('../models/user');
const TimeLine = require('../models/time_line');
const Task = require('../models/task');
const EmailTemplate = require('../models/email_template');
const Automation = require('../models/automation');
const {
  THUMBNAILS_PATH,
  TEMP_PATH,
  GIF_PATH,
  VIDEO_PATH,
  PLAY_BUTTON_PATH,
} = require('../config/path');
const urls = require('../constants/urls');
const api = require('../config/api');
const system_settings = require('../config/system_settings');
const mail_contents = require('../constants/mail_contents');
const { emptyBucket } = require('./material');
const emailHelper = require('../helpers/email');
const garbageHelper = require('../helpers/garbage');
const textHelper = require('../helpers/text');
const videoHelper = require('../helpers/video');
const ActivityHelper = require('../helpers/activity');
const { uploadBase64Image, downloadFile } = require('../helpers/fileUpload');

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
const { RestClient } = require('@signalwire/node');

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});
const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;

const twilio = require('twilio')(accountSid, authToken);

var limitTime = 0;
const timeBounce = 10 * 60 * 1000;
const alertBounce = 60 * 1000;
var counterDirection = 1;
let recordDuration = 0;
let max_duration = 0;

const play = async (req, res) => {
  const video_id = req.query.video;
  const sender_id = req.query.user;
  const from = req.query.from;
  const video = await Video.findOne({ _id: video_id }).catch((err) => {
    console.log('video find err', err.message);
  });

  const user = await User.findOne({
    _id: sender_id,
    del: false,
    'subscription.is_suspended': false,
  }).catch((err) => {
    console.log('user find err', err.message);
  });

  let capture_dialog = true;
  let capture_delay = 0;
  let capture_field = [];

  if (user) {
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
      if (!video.enabled_capture) {
        capture_dialog = false;
      } else {
        if (video.capture_form) {
          let selectForm;
          const allForms = Object.keys(garbage.capture_field);
          if (allForms.indexOf(video.capture_form) !== -1) {
            selectForm = video.capture_form;
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
        (themeSetting && themeSetting[video_id]) ||
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
    const material = await videoHelper.getVideoPublicUrl(video._doc);
    if (material.is_draft && !material.title) {
      material.title = `${moment().format('MMMM Do YYYY')} - ${
        user.user_name
      } Recording`;
    }
    return res.render('lead_material_' + theme, {
      material,
      material_type: 'video',
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
      from_recording: from,
    });
  } else {
    return res.send(
      'Sorry! This video link is expired for some reason. Please try ask to sender to send again.'
    );
  }
};
const playDemo = async (req, res) => {
  const video = await Video.findOne({ _id: system_settings.DEMO_VIDEO }).catch(
    (err) => {
      console.log('err', err.message);
    }
  );

  const user = await User.findOne({
    email: system_settings.ADMIN_ACCOUNT,
    del: false,
  }).catch((err) => {
    console.log('err', err.message);
  });

  let capture_dialog = true;
  let capture_delay = 0;
  let capture_field = [];
  let calendly;
  let capture_tags = [];
  let capture_automation = '';

  if (user) {
    const garbage = await Garbage.findOne({ user: user._id }).catch((err) => {
      console.log('err', err);
    });

    if (garbage) {
      // additional_fields = garbage.additional_fields;
      if (!video.enabled_capture) {
        capture_dialog = false;
      } else {
        if (video.capture_form) {
          let selectForm;
          const allForms = Object.keys(garbage.capture_field);
          if (allForms.indexOf(video.capture_form) !== -1) {
            selectForm = video.capture_form;
          } else {
            selectForm = 'default';
          }
          capture_delay = garbage['capture_field'][selectForm]['capture_delay'];
          capture_field = garbage['capture_field'][selectForm]['fields'];
          capture_tags = garbage['capture_field'][selectForm]['tags'];
          capture_automation =
            garbage['capture_field'][selectForm]['automation'];
        } else {
          capture_delay =
            garbage['capture_field'][garbage.capture_form]['capture_delay'];
          capture_field =
            garbage['capture_field'][garbage.capture_form]['fields'];
          capture_tags = garbage['capture_field'][garbage.capture_form]['tags'];
          capture_automation =
            garbage['capture_field'][garbage.capture_form]['automation'];
        }
      }

      if (garbage['calendly'] && garbage['calendly'].link) {
        calendly = garbage['calendly'].link;
      }
    } else {
      capture_dialog = false;
    }

    const material = await videoHelper.getVideoPublicUrl(video._doc);
    return res.render('demo', {
      material,
      material_type: 'video',
      user,
      capture_dialog,
      capture_delay,
      calendly,
      capture_tags,
      capture_automation,
      capture_field: capture_field || [],
    });
  } else {
    return res.send(
      'Sorry! This video link is expired for some reason. Please try ask to sender to send again.'
    );
  }
};
const play1 = async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id })
    .populate([{ path: 'user' }, { path: 'videos' }])
    .catch((err) => {
      console.log('err', err);
    });

  if (activity) {
    if (!activity.user) {
      return res.send(
        'Sorry! This video link is expired for some reason. Please try ask to sender to send again.1'
      );
    }

    const data = activity['user'];
    const myJSON = JSON.stringify(data);
    const user = JSON.parse(myJSON);
    delete user.hash;
    delete user.salt;
    delete user.payment;

    let video;
    if (activity['videos'] instanceof Array) {
      video = activity['videos'][0];
    } else {
      video = activity['videos'];
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

    let material_start = 0;

    if (activity.material_last) {
      material_start = activity.material_last;
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
        (themeSetting && themeSetting[video._id]) ||
        garbage['material_theme'] ||
        theme;
      logo = garbage['logo'] || urls.DEFAULT_TEMPLATE_PAGE_LOGO;
      highlights = garbage['highlights'] || [];
      brands = garbage['brands'] || [];

      if (garbage['calendly'] && garbage['calendly'].link) {
        calendly = garbage['calendly'].link;
      }
    }

    const material = await videoHelper.getVideoPublicUrl(video._doc);
    return res.render('material_' + theme, {
      material,
      material_type: 'video',
      user,
      contact: activity['contacts'],
      activity: activity.id,
      social_link,
      calendly,
      material_start,
      setting: {
        logo,
        highlights,
        brands,
      },
    });
  } else {
    return res.send(
      'Sorry! This video link is expired for some reason. Please try ask to sender to send again.3'
    );
  }
};
const playUserVideo = async (req, res) => {
  const videoId = req.params.id;
  const video = await Video.findOne({ _id: videoId, del: false }).populate({
    path: 'user',
    select: {
      _id: true,
      email: true,
      cell_phone: true,
      user_name: true,
      del: true,
      subscription: true,
      learn_more: true,
      social_link: true,
      picture_profile: true,
    },
  });
  if (video) {
    if (
      video.user &&
      !video.user.del &&
      video.user.subscription &&
      !video.user.subscription.is_suspended
    ) {
      const user = video.user;

      let capture_dialog = true;
      let capture_delay = 0;
      let capture_field = [];
      const garbage = await Garbage.findOne({ user: video.user._id }).catch(
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
        if (!video.enabled_capture) {
          capture_dialog = false;
        } else {
          if (video.capture_form) {
            let selectForm;
            const allForms = Object.keys(garbage.capture_field);
            if (allForms.indexOf(video.capture_form) !== -1) {
              selectForm = video.capture_form;
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
          (themeSetting && themeSetting[videoId]) ||
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
      const material = await videoHelper.getVideoPublicUrl(video._doc);
      if (material.is_draft) {
        material.title = `${moment().format('MMMM Do YYYY')} - ${
          user.user_name
        } Recording`;
      }
      return res.render('lead_material_' + theme, {
        material,
        material_type: 'video',
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

const playUuidVideo = async (req, res) => {
  const uuid = req.params.id;
  const activity = await Activity.findOne({ send_uuid: uuid });
  if (activity) {
    playTrackableVideo(activity.videos[0], uuid, activity.user, res);
  } else {
    return res.send(
      'Sorry! This video link is expired for some reason. Please try ask to sender to send again.3'
    );
  }
};

const embedPlay = async (req, res) => {
  const video = await Video.findOne({ _id: req.params.video });
  const material = await videoHelper.getVideoPublicUrl(video._doc);
  res.render('embedVideo', {
    video: material,
  });
};

const pipe = async (req, res) => {
  const filePath = TEMP_PATH + req.params.name;

  if (fs.existsSync(filePath)) {
    const contentType = mime.contentType(path.extname(req.params.name));
    res.set('Content-Type', contentType);
    res.sendFile(filePath);
  } else {
    res.status(404).send({
      status: false,
      error: 'File does not exist',
    });
  }
};

const create = async (req, res) => {
  const { currentUser } = req;

  let count = 0;
  let max_upload_count = 0;

  if (!currentUser.material_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable create video',
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
    const file_name = req.file.filename;

    const video = new Video({
      user: req.currentUser.id,
      url: urls.VIDEO_URL + file_name,
      type: req.file.mimetype,
      path: req.file.path,
      key: req.file.key,
      created_at: new Date(),
    });

    const _video = await video
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });
    res.send({
      status: true,
      data: _video,
    });
  }
};

const createVideo = async (req, res) => {
  let preview;
  const { currentUser } = req;

  if (req.body.thumbnail) {
    // Thumbnail

    const play = await loadImage(PLAY_BUTTON_PATH);

    const canvas = createCanvas(
      system_settings.THUMBNAIL.WIDTH,
      system_settings.THUMBNAIL.HEIGHT
    );
    const ctx = canvas.getContext('2d');
    const image = await loadImage(req.body.thumbnail);

    let height = image.height;
    let width = image.width;
    if (height > width) {
      ctx.rect(
        0,
        0,
        system_settings.THUMBNAIL.WIDTH,
        system_settings.THUMBNAIL.HEIGHT
      );
      ctx.fillStyle = '#000000';
      ctx.fill();
      width = (system_settings.THUMBNAIL.HEIGHT * width) / height;
      height = system_settings.THUMBNAIL.HEIGHT;
      ctx.drawImage(image, (250 - width) / 2, 0, width, height);
    } else {
      height = system_settings.THUMBNAIL.HEIGHT;
      width = system_settings.THUMBNAIL.WIDTH;
      ctx.drawImage(image, 0, 0, width, height);
    }

    ctx.drawImage(play, 10, 150);

    const buf = canvas.toBuffer();
    const file_name = uuidv1();
    const today = new Date();
    const year = today.getYear();
    const month = today.getMonth();
    const params = {
      Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
      Key: 'preview' + year + '/' + month + '/' + file_name,
      Body: buf,
      ACL: 'public-read',
    };

    const { Location, Key } = await s3.upload(params).promise();
    preview = Location;
  }

  const video = new Video({
    ...req.body,
    preview,
    converted: 'completed',
    user: currentUser.id,
    created_at: new Date(),
  });

  if (req.body.shared_video) {
    Video.updateOne(
      {
        _id: req.body.shared_video,
      },
      {
        $set: {
          has_shared: true,
          shared_video: video.id,
        },
      }
    ).catch((err) => {
      console.log('video update err', err.message);
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

    if (garbage['edited_video']) {
      garbage['edited_video'].push(req.body.default_video);
    } else {
      garbage['edited_video'] = [req.body.default_video];
    }
  }

  const _video = await video
    .save()
    .then()
    .catch((err) => {
      console.log('err', err);
    });
  const response = { ..._video._doc };
  if (req.body.folder) {
    const updateResult = await Folder.updateOne(
      { _id: req.body['folder'], user: currentUser._id },
      { $addToSet: { videos: { $each: [video['_id']] } } }
    );
    if (updateResult && updateResult.nModified) {
      response['folder'] = req.body.folder;
    }
  }

  if (req.body.theme) {
    await Garbage.updateOne(
      { user: currentUser._id },
      { $set: { ['material_themes.' + video._id]: req.body.theme } }
    ).catch((err) => {
      console.log('saving theme is failed.', err.message);
    });
  }

  res.send({
    status: true,
    data: response,
  });
};

const updateConvertStatus = async (req, res) => {
  const { currentUser } = req;
  const status = { ...req.body };
  const video = await Video.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('err', err.message);
  });

  if (!video) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }

  if (status) {
    if (status['preview']) {
      video['preview'] =
        'https://teamgrow.s3.us-east-2.amazonaws.com/preview/' +
        video['key'] +
        '.gif';
    }
    if (status['converted'] === 100) {
      video['url'] =
        api.AWS.CLOUDFRONT + '/transcoded/' + video['key'] + '.mp4';
      video['converted'] = 'completed';
    }
    if (status['streamd'] === 100) {
      video['url'] =
        api.AWS.CLOUDFRONT +
        '/streamd/' +
        video['key'] +
        '/' +
        video['key'] +
        '.m3u8';
      video['converted'] = 'completed';
    }

    video.save().then(() => {
      return res.send({
        status: true,
        data: video._doc,
      });
    });
  }
};

const update = async (req, res) => {
  const editData = { ...req.body };
  delete editData.site_image;
  delete editData.thumbnail;
  const { currentUser } = req;
  let thumbnail_path = '';
  const video = await Video.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('err', err.message);
  });

  if (!video) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }
  if (req.body.site_image) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      const siteImage = await uploadBase64Image(
        req.body.site_image,
        'site_image' + year + '/' + month
      );
      video['site_image'] = siteImage;
    } catch (error) {
      console.error('Upload Site Image', error);
    }
  }
  if (req.body.thumbnail) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      const thumbnail_image = await uploadBase64Image(
        req.body.thumbnail,
        'thumbnail' + year + '/' + month
      );
      video['thumbnail'] = thumbnail_image;
    } catch (error) {
      console.error('Upload Video Thumbnail Image', error);
    }
  }

  const file_name = req.params.id;
  if (req.body.thumbnail) {
    // base 64 image

    if (!fs.existsSync(THUMBNAILS_PATH)) {
      fs.mkdirSync(THUMBNAILS_PATH);
    }

    thumbnail_path = base64Img.imgSync(
      req.body.thumbnail,
      THUMBNAILS_PATH,
      file_name
    );
    if (fs.existsSync(thumbnail_path)) {
      // Thumbnail
      const play = await loadImage(PLAY_BUTTON_PATH);

      const canvas = createCanvas(
        system_settings.THUMBNAIL.WIDTH,
        system_settings.THUMBNAIL.HEIGHT
      );
      const ctx = canvas.getContext('2d');
      const image = await loadImage(thumbnail_path);

      let height = image.height;
      let width = image.width;
      if (height > width) {
        ctx.rect(
          0,
          0,
          system_settings.THUMBNAIL.WIDTH,
          system_settings.THUMBNAIL.HEIGHT
        );
        ctx.fillStyle = '#000000';
        ctx.fill();
        width = (system_settings.THUMBNAIL.HEIGHT * width) / height;
        height = system_settings.THUMBNAIL.HEIGHT;
        ctx.drawImage(image, (250 - width) / 2, 0, width, height);
      } else {
        height = system_settings.THUMBNAIL.HEIGHT;
        width = system_settings.THUMBNAIL.WIDTH;
        ctx.drawImage(image, 0, 0, width, height);
      }

      // ctx.rect(70, 170, 200, 40);
      // ctx.globalAlpha = 0.7;
      // ctx.fillStyle = '#333';
      // ctx.fill();
      // ctx.globalAlpha = 1.0;
      // ctx.font = '24px Arial';
      // ctx.fillStyle = '#ffffff';
      // ctx.fillText('Play video', 80, 200);
      ctx.drawImage(play, 10, 150);

      const buf = canvas.toBuffer();

      if (!fs.existsSync(GIF_PATH)) {
        fs.mkdirSync(GIF_PATH);
      }
      for (let i = 0; i < 20; i++) {
        if (i < 10) {
          fs.writeFileSync(GIF_PATH + file_name + `-0${i}.png`, buf);
        } else {
          fs.writeFileSync(GIF_PATH + file_name + `-${i}.png`, buf);
        }
      }

      /**
      sharp(thumbnail_path)
      .resize(250, 140)
      .toBuffer()
      .then(data => {
          const today = new Date()
          const year = today.getYear()
          const month = today.getMonth()
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'thumbnail' +  year + '/' + month + '/' + file_name, 
            Body: data,
            ACL: 'public-read'
          };
          
          s3.upload(params, async (s3Err, upload)=>{
            if (s3Err){
              console.log('upload s3 error', s3Err)
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`)
            }
          })
      });
      */
    }
  }

  for (const key in editData) {
    video[key] = editData[key];
  }

  if (video['path'] && req.body.thumbnail) {
    const data = {
      file_name,
    };

    regeneratePreview(data)
      .then((res) => {
        Video.updateOne(
          { _id: req.params.id },
          { $set: { preview: res } }
        ).catch((err) => {
          console.log('update preview err', err.message);
        });
      })
      .catch((err) => {
        console.log('err', err.message);
      });
  }

  video['updated_at'] = new Date();
  video
    .save()
    .then((_video) => {
      res.send({
        status: true,
        data: _video,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
    });
};

const updateDetail = async (req, res) => {
  const editData = { ...req.body };
  delete editData.site_image;
  delete editData.thumbnail;
  const { currentUser } = req;
  const video = await Video.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('video found err', err.message);
  });

  if (!video) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }
  if (req.body.site_image) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      const siteImage = await uploadBase64Image(
        req.body.site_image,
        'site_image' + year + '/' + month
      );
      video['site_image'] = siteImage;
    } catch (error) {
      console.error('Upload Site Image', error);
    }
  }
  if (req.body.thumbnail) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      const thumbnail_image = await uploadBase64Image(
        req.body.thumbnail,
        'thumbnail' + year + '/' + month
      );
      video['thumbnail'] = thumbnail_image;
    } catch (error) {
      console.error('Upload Video Thumbnail Image', error);
    }
  }

  for (const key in editData) {
    video[key] = editData[key];
  }
  video['converted'] = 'progress';

  if (editData['folder']) {
    await Folder.updateOne(
      { _id: editData['folder'], user: currentUser._id },
      { $addToSet: { videos: { $each: [video['_id']] } } }
    );
  }
  if (editData['theme']) {
    await Garbage.updateOne(
      { user: currentUser._id },
      { $set: { ['material_themes.' + video._id]: editData.theme } }
    ).catch((err) => {
      console.log('saving theme is failed.', err.message);
    });
  }

  video['updated_at'] = new Date();
  video
    .save()
    .then((_video) => {
      return res.send({
        status: true,
        data: _video,
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
  const { video, id } = req.body;
  let thumbnail_path;
  const { currentUser } = req;

  const defaultVideo = await Video.findOne({ _id: id, role: 'admin' }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  if (!defaultVideo) {
    return res.status(400).json({
      status: false,
      error: 'This Default video not exists',
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

  if (garbage['edited_video']) {
    garbage['edited_video'].push(id);
  } else {
    garbage['edited_video'] = [id];
  }

  console.log('garbage', garbage);

  await garbage.save().catch((err) => {
    return res.status(400).json({
      status: false,
      error: 'Update Garbage Error.',
    });
  });

  for (const key in video) {
    defaultVideo[key] = video[key];
  }

  if (video.thumbnail) {
    // base 64 image
    const file_name = uuidv1();

    if (!fs.existsSync(THUMBNAILS_PATH)) {
      fs.mkdirSync(THUMBNAILS_PATH);
    }

    thumbnail_path = base64Img.imgSync(
      video.thumbnail,
      THUMBNAILS_PATH,
      file_name
    );
    if (fs.existsSync(thumbnail_path)) {
      fs.readFile(thumbnail_path, (err, data) => {
        if (err) {
          console.log('file read err', err.message || err.msg);
        } else {
          console.log('File read was successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'thumbnail' + year + '/' + month + '/' + file_name,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) {
              console.log('upload s3 error', s3Err);
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`);

              thumbnail_path = upload.Location;
              if (thumbnail_path) {
                defaultVideo['thumbnail'] = thumbnail_path;
              }

              defaultVideo['updated_at'] = new Date();
              const defaultVideoJSON = JSON.parse(JSON.stringify(defaultVideo));
              delete defaultVideoJSON['_id'];
              delete defaultVideoJSON['role'];

              const newVideo = new Video({
                ...defaultVideoJSON,
                user: currentUser._id,
                default_video: id,
                default_edited: true,
              });

              const _video = await newVideo
                .save()
                .then()
                .catch((err) => {
                  console.log('video new creating err', err.message);
                });

              return res.send({
                status: true,
                data: _video,
              });
            }
          });
        }
      });

      // Thumbnail
      /**
      const play = await loadImage(PLAY_BUTTON_PATH);
    
      const canvas = createCanvas(250, 140)
      const ctx = canvas.getContext('2d');
      let image = await loadImage(thumbnail_path);
        
      let height = image.height;
      let width = image.width;
      if(height > width) {
        ctx.rect(0, 0, 250, 140);
        ctx.fillStyle = '#000000';
        ctx.fill();
        width = 140*width/height;
        height = 140;
        ctx.drawImage(image, (250-width)/2, 0, width, height);
      } else {
        height = 140;
        width = 250;
        ctx.drawImage(image, 0, 0, width, height);
      }
      ctx.rect(60, 100, 150, 30);
      ctx.globalAlpha  = 0.7;
      ctx.fillStyle = '#333';
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.font = '20px Impact'
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Play video', 70, 120)
      ctx.drawImage(play, 10, 95, 40, 40)
      let buf = canvas.toBuffer();
      
      for(let i=0; i<30; i++){
        if(i<10){
          fs.writeFileSync(GIF_PATH+`frame-0${i}.png`, buf)
        } else {
          fs.writeFileSync(GIF_PATH+`frame-${i}.png`, buf)
        }
      }
       */
    } else {
      console.log('thumbnail writting server error');
      return res.status(400).json({
        status: false,
        error: 'thumbnail writing server error.',
      });
    }
  } else {
    defaultVideo['updated_at'] = new Date();
    const defaultVideoJSON = JSON.parse(JSON.stringify(defaultVideo));
    delete defaultVideoJSON['_id'];
    delete defaultVideoJSON['role'];

    const newVideo = new Video({
      ...defaultVideoJSON,
      user: currentUser._id,
      default_video: id,
      default_edited: true,
    });

    const _video = await newVideo
      .save()
      .then()
      .catch((err) => {
        console.log('video save err', err);
      });

    return res.send({
      status: true,
      data: _video,
    });
  }
  // if(!defaultVideo['preview']){
  //   const file_path = defaultVideo['path']
  //   defaultVideo['preview'] = await generatePreview(file_path).catch(err=>{
  //     console.log('err', err)
  //   })
  // }
};

const generatePreview = async (data) => {
  const { file_name, file_path, area, custom_thumbnail, mode } = data;

  if (!fs.existsSync(GIF_PATH)) {
    fs.mkdirSync(GIF_PATH);
  }

  return new Promise(async (resolve, reject) => {
    const offsets = [];
    for (let i = 1000; i < 5000; i += 100) {
      offsets.push(i);
    }

    await extractFrames({
      input: file_path,
      output: GIF_PATH + `screenshot-${file_name}-%i.jpg`,
      offsets,
    }).catch((err) => {
      console.log('err', err);
    });

    const play = await loadImage(PLAY_BUTTON_PATH);

    const canvas = createCanvas(
      system_settings.THUMBNAIL.WIDTH,
      system_settings.THUMBNAIL.HEIGHT
    );
    const ctx = canvas.getContext('2d');
    const encoder = new GIFEncoder(
      system_settings.THUMBNAIL.WIDTH,
      system_settings.THUMBNAIL.HEIGHT
    );

    for (let i = 1; i < 40; i++) {
      const image = await loadImage(
        GIF_PATH + `screenshot-${file_name}-${i}.jpg`
      ).catch((err) => {
        console.log('screenshot generating error', err);
      });

      if (!image) {
        break;
      }

      let height = image.height;
      let width = image.width;
      let posX = 0;
      let posY = 0;

      if (height > width) {
        ctx.rect(
          0,
          0,
          system_settings.THUMBNAIL.WIDTH,
          system_settings.THUMBNAIL.HEIGHT
        );
        ctx.fillStyle = '#000000';
        ctx.fill();
        posX = (system_settings.THUMBNAIL.WIDTH - width) / 2;
        posY = 0;
        width = (system_settings.THUMBNAIL.HEIGHT * width) / height;
        height = system_settings.THUMBNAIL.HEIGHT;
      } else {
        height = system_settings.THUMBNAIL.HEIGHT;
        width = system_settings.THUMBNAIL.WIDTH;
      }

      if (mode === 'crop' && area) {
        const { areaX, areaY, areaW, areaH } = area;
        ctx.drawImage(
          image,
          areaX,
          areaY,
          areaW,
          areaH,
          posX,
          posY,
          width,
          height
        );
      } else if (mode === 'mirror') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(image, posX, posY, width, height);
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      } else {
        ctx.drawImage(image, posX, posY, width, height);
      }

      ctx.drawImage(play, 10, 150);

      const buf = canvas.toBuffer();

      if (custom_thumbnail) {
        fs.writeFileSync(GIF_PATH + `${file_name}-${i + 19}.png`, buf);
      } else {
        if (i < 10) {
          fs.writeFileSync(GIF_PATH + `${file_name}-0${i}.png`, buf);
        } else {
          fs.writeFileSync(GIF_PATH + `${file_name}-${i}.png`, buf);
        }
      }
    }

    const stream = pngFileStream(GIF_PATH + `${file_name}-??.png`)
      .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
      .pipe(fs.createWriteStream(GIF_PATH + file_name));

    stream.on('finish', () => {
      if (fs.existsSync(GIF_PATH + file_name)) {
        fs.readFile(GIF_PATH + file_name, (err, data) => {
          if (err) {
            console.log('stream file error', err);
          }
          console.log('Gif File read was successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'gif' + year + '/' + month + '/' + file_name,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) throw s3Err;
            console.log(`Gif File uploaded successfully at ${upload.Location}`);

            fs.unlinkSync(GIF_PATH + file_name);
            resolve(upload.Location);
          });
        });
      }
    });
    stream.on('error', (err) => {
      console.log('err', err);
      reject(err);
    });
  });
};

const regeneratePreview = async (data) => {
  const { file_name } = data;

  if (!fs.existsSync(GIF_PATH)) {
    fs.mkdirSync(GIF_PATH);
  }

  return new Promise(async (resolve, reject) => {
    const play = await loadImage(PLAY_BUTTON_PATH);

    const canvas = createCanvas(
      system_settings.THUMBNAIL.WIDTH,
      system_settings.THUMBNAIL.HEIGHT
    );
    const ctx = canvas.getContext('2d');
    const encoder = new GIFEncoder(
      system_settings.THUMBNAIL.WIDTH,
      system_settings.THUMBNAIL.HEIGHT
    );

    if (fs.existsSync(GIF_PATH + `screenshot-${file_name}-1.jpg`)) {
      for (let i = 1; i < 40; i++) {
        const image = await loadImage(
          GIF_PATH + `screenshot-${file_name}-${i}.jpg`
        );

        let height = image.height;
        let width = image.width;
        if (height > width) {
          ctx.rect(
            0,
            0,
            system_settings.THUMBNAIL.WIDTH,
            system_settings.THUMBNAIL.HEIGHT
          );
          ctx.fillStyle = '#000000';
          ctx.fill();
          width = (system_settings.THUMBNAIL.HEIGHT * width) / height;
          height = system_settings.THUMBNAIL.HEIGHT;
          ctx.drawImage(
            image,
            (system_settings.THUMBNAIL.WIDTH - width) / 2,
            0,
            width,
            height
          );
        } else {
          height = system_settings.THUMBNAIL.HEIGHT;
          width = system_settings.THUMBNAIL.WIDTH;
          ctx.drawImage(image, 0, 0, width, height);
        }
        // ctx.rect(70, 170, 200, 40);
        // ctx.globalAlpha = 0.7;
        // ctx.fillStyle = '#333';
        // ctx.fill();
        // ctx.globalAlpha = 1.0;
        // ctx.font = '24px Arial';
        // ctx.fillStyle = '#ffffff';
        // ctx.fillText('Play video', 80, 200);
        ctx.drawImage(play, 10, 150);

        const buf = canvas.toBuffer();
        fs.writeFileSync(GIF_PATH + `${file_name}-${i + 19}.png`, buf);
      }
    }

    const stream = pngFileStream(GIF_PATH + `${file_name}-??.png`)
      .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
      .pipe(fs.createWriteStream(GIF_PATH + file_name));

    stream.on('finish', () => {
      if (fs.existsSync(GIF_PATH + file_name)) {
        fs.readFile(GIF_PATH + file_name, (err, data) => {
          if (err) {
            console.log('stream file error', err);
          }
          console.log('Gif File read was successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'gif' + year + '/' + month + '/' + file_name,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) throw s3Err;
            console.log(`Gif File uploaded successfully at ${upload.Location}`);

            fs.unlinkSync(GIF_PATH + file_name);
            resolve(upload.Location);
          });
        });
      }
    });
    stream.on('error', (err) => {
      console.log('err', err);
      reject(err);
    });
  });
};

const get = async (req, res) => {
  const withPublicUrl = req.query.with;
  const video = await Video.findOne({ _id: req.params.id, del: false });
  const user = await User.findOne({ _id: video.user });
  if (!video) {
    return res.status(400).json({
      status: false,
      error: 'Video doesn`t exist',
    });
  }
  const myJSON = JSON.stringify(video);
  let data = JSON.parse(myJSON);
  if (withPublicUrl) {
    data = await videoHelper.getVideoPublicUrl(data);
  }
  Object.assign(data, { user });

  res.send({
    status: true,
    data,
  });
};

const getThumbnail = (req, res) => {
  const filePath = THUMBNAILS_PATH + req.params.name;

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
    return res.status(404).send({
      status: false,
      error: 'Thumbnail does not exist',
    });
  }
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const garbage = await garbageHelper.get(currentUser);
  let editedVideos = [];
  if (garbage && garbage['edited_video']) {
    editedVideos = garbage['edited_video'];
  }

  const company = currentUser.company || 'eXp Realty';
  const _video_list = await Video.find({ user: currentUser.id, del: false })
    .sort({ priority: 1 })
    .sort({ created_at: 1 });
  const _video_admin = await Video.find({
    role: 'admin',
    del: false,
    _id: { $nin: editedVideos },
    company,
  })
    .sort({ priority: 1 })
    .sort({ created_at: 1 });

  Array.prototype.push.apply(_video_list, _video_admin);

  const teams = await Team.find({
    $or: [{ members: currentUser.id }, { owner: currentUser.id }],
  }).populate('videos');

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(_video_list, team.videos);
    }
  }

  if (!_video_list) {
    return res.status(400).json({
      status: false,
      error: 'Video doesn`t exist',
    });
  }
  const _video_detail_list = [];

  for (let i = 0; i < _video_list.length; i++) {
    const count = await VideoTracker.countDocuments({
      video: _video_list[i]._id,
      user: currentUser._id,
    });

    const video_detail = { ..._video_list[i]._doc, views: count };
    _video_detail_list.push(video_detail);
  }

  return res.send({
    status: true,
    data: _video_detail_list,
  });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      user: currentUser.id,
    });

    if (video) {
      const error_message = [];
      const automations = await Automation.find({
        user: currentUser.id,
        automations: {
          $elemMatch: {
            'action.videos': { $elemMatch: { $in: [video.id] } },
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
        video_ids: video.id,
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
        videos: video.id,
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
                id: video.id,
                title: video.title,
                type: 'video',
                thumbnail: video.thumbnail,
                preview: video.preview,
              },
              error_message,
            },
          ],
        });
      }
      if (video.role === 'team') {
        Team.updateOne(
          { videos: req.params.id },
          {
            $pull: { videos: { $in: [req.params.id] } },
          }
        ).catch((err) => {
          console.log('err', err.message);
        });
      }

      Video.updateOne({ _id: req.params.id }, { $set: { del: true } })
        .then(async () => {
          let hasSameVideo = false;
          if (video['bucket']) {
            const sameVideos = await Video.find({
              del: false,
              key: video['key'],
            }).catch((err) => {
              console.log('same video getting error');
            });
            if (sameVideos && sameVideos.length) {
              hasSameVideo = true;
            }
          } else {
            const sameVideos = await Video.find({
              del: false,
              url: video['url'],
            }).catch((err) => {
              console.log('same video getting error');
            });
            if (sameVideos && sameVideos.length) {
              hasSameVideo = true;
            }
          }
          if (!hasSameVideo) {
            if (video['bucket']) {
              s3.deleteObject(
                {
                  Bucket: video['bucket'],
                  Key: 'transcoded/' + video['key'] + '.mp4',
                },
                function (err, data) {
                  console.log('transcoded video removing error', err);
                }
              );
              emptyBucket(
                video['bucket'],
                'streamd/' + video['key'] + '/',
                (err) => {
                  if (err) {
                    console.log('Removing files error in bucket');
                  }
                }
              );
            } else {
              const url = video['url'];
              if (url.indexOf('teamgrow.s3') > 0) {
                s3.deleteObject(
                  {
                    Bucket: api.AWS.AWS_S3_BUCKET_NAME,
                    Key: url.slice(44),
                  },
                  function (err, data) {
                    console.log('err', err);
                  }
                );
              } else {
                try {
                  const file_path = video.path;
                  if (file_path) {
                    fs.unlinkSync(file_path);
                  }
                } catch (err) {
                  console.log('err', err);
                }
              }
            }
          }
          return res.send({
            status: true,
          });
        })
        .catch((err) => {
          console.log('err', err.message);
          return res.status(500).send({
            status: true,
            error: err.message,
          });
        });
    } else {
      res.status(400).send({
        status: false,
        error: 'Invalid permission.',
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

const getAnalytics = async (req, res) => {
  const { currentUser } = req;

  const video = await Video.findOne({ _id: req.params.id });
  const sent_activity = await Activity.countDocuments({
    videos: req.params.id,
    user: currentUser.id,
    type: 'videos',
  });

  const watched_activity = await VideoTracker.find({
    video: req.params.id,
    user: currentUser.id,
  }).populate('contact');

  const watched_contacts = await VideoTracker.aggregate([
    {
      $match: {
        video: mongoose.Types.ObjectId(req.params.id),
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
    videos: req.params.id,
    user: currentUser.id,
    type: 'videos',
    content: 'generated link',
  })
    .populate('contacts')
    .populate('video_trackers');
  return res.send({
    status: true,
    data: {
      video,
      sent_activity,
      watched_activity,
      watched_contacts,
      track_activity,
    },
  });
};

const bulkEmail = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, videos, contacts } = req.body;
  const promise_array = [];
  const error = [];

  if (contacts) {
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

    let email_count = currentUser['email_info']['count'] || 0;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    let detail_content = 'sent video using email';
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

      let video_titles = '';
      let video_descriptions = '';
      let video_objects = '';
      let video_subject = subject;
      let video_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < videos.length; j++) {
        const video = await Video.findOne({ _id: videos[j] }).catch((err) => {
          console.log('video found err', err.message);
        });
        let preview;
        if (video['preview']) {
          preview = video['preview'];
        } else {
          preview = video['thumbnail'] + '?resize=true';
        }

        if (typeof video_content === 'undefined') {
          video_content = '';
        }

        video_subject = video_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        video_content = video_content
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
          type: 'videos',
          videos: video._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: video_subject,
          description: video_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        if (videos.length >= 2) {
          video_titles = mail_contents.VIDEO_TITLE;
        } else {
          video_titles = `${video.title}`;
        }

        if (j < videos.length - 1) {
          video_descriptions += `${video.description}, `;
        } else {
          video_descriptions += video.description;
        }
        const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
        const video_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${preview}" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        video_objects += video_object;
        activities.push(activity.id);
      }

      if (subject === '') {
        video_subject = 'VIDEO: ' + video_titles;
      } else {
        video_subject = video_subject.replace(/{video_title}/gi, video_titles);
        video_subject = video_subject.replace(
          /{material_title}/gi,
          video_titles
        );
      }

      if (video_content.search(/{video_object}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_object}/gi,
          video_objects
        );
      } else {
        video_content = video_content + '<br/>' + video_objects;
      }

      if (content.search(/{video_title}/gi) !== -1) {
        video_content = video_content.replace(/{video_title}/gi, video_titles);
      }

      if (content.search(/{video_description}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_description}/gi,
          video_descriptions
        );
      }

      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
        replyTo: currentUser.connected_email,
        subject: video_subject,
        html:
          '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
          video_content +
          '</tbody></table>' +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          emailHelper.generateUnsubscribeLink(activity.id) +
          '</body></html>',
        text: video_content,
      };

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then(async (_res) => {
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
                console.log('contact update err', err.message);
              });

              const garbage = await Garbage.findOne({ user: currentUser.id });
              const auto_resend = garbage.auto_resend2;
              if (auto_resend['enabled']) {
                const data = { activities, auto_resend };
                autoResend(data);
              }
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
            }
          })
          .catch((err) => {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err.message);
            });
            console.log('email sending err', msg.to);
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
        console.log('email sending err', err);
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
  const { content, subject, videos, contacts } = req.body;
  const promise_array = [];
  const error = [];
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_ONE_TIME) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_ONE_TIME} contacts at a time`,
      });
    }

    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message || err.msg);
      return res.status(406).send({
        status: false,
        error: 'not connected',
      });
    });

    let email_count = currentUser['email_info']['count'] || 0;
    let no_connected = false;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    let detail_content = 'sent video using email';
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
            error: 'Contact email is unsubscribed',
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

      let video_titles = '';
      let video_descriptions = '';
      let video_objects = '';
      let video_subject = subject;
      let video_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < videos.length; j++) {
        const video = await Video.findOne({ _id: videos[j] }).catch((err) => {
          console.log('vidoe found err', err.message);
        });
        let preview;
        if (video['preview']) {
          preview = video['preview'];
        } else {
          preview = video['thumbnail'];
        }
        if (typeof video_content === 'undefined') {
          video_content = '';
        }

        video_subject = video_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        video_content = video_content
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
          type: 'videos',
          videos: video._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: video_subject,
          description: video_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        if (videos.length >= 2) {
          video_titles = mail_contents.VIDEO_TITLE;
        } else {
          video_titles = video.title;
        }

        if (j < videos.length - 1) {
          video_descriptions += `${video.description}, `;
        } else {
          video_descriptions += video.description;
        }
        const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
        // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
        const video_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${preview}" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        video_objects += video_object;
        activities.push(activity.id);
      }

      if (video_subject === '') {
        video_subject = 'VIDEO: ' + video_titles;
      } else {
        video_subject = video_subject.replace(/{video_title}/gi, video_titles);
        video_subject = video_subject.replace(
          /{material_title}/gi,
          video_titles
        );
      }

      if (video_content.search(/{video_object}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_object}/gi,
          video_objects
        );
      } else {
        video_content = video_content + '<br/>' + video_objects;
      }

      if (content.search(/{video_title}/gi) !== -1) {
        video_content = video_content.replace(/{video_title}/gi, video_titles);
      }

      if (content.search(/{video_description}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_description}/gi,
          video_descriptions
        );
      }

      const email_content =
        '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
        video_content +
        '</tbody></table>' +
        '<br/>Thank you,<br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';

      // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, video_subject, email_content );

      promise = new Promise((resolve, reject) => {
        // gmail.users.messages.send({
        //   'auth': oauth2Client,
        //   'userId': 'me',
        //   'resource': {
        //     raw: rawContent
        //   }
        // }, (err, response) => {
        //   if(err) {
        //     Activity.deleteOne({_id: activity.id}).catch(err=>{
        //       console.log('err', err)
        //     })
        //     console.log('err', err.response['statusText'])
        //     error.push({
        //       contact: {
        //         id: contacts[i],
        //         first_name: _contact.first_name,
        //         email: _contact.email,
        //       },
        //       error: err.response['statusText']
        //     })
        //     resolve();
        //   } else {
        //     Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
        //       console.log('err', err)
        //     })
        //     resolve()
        //   }
        // });

        try {
          const body = createBody({
            headers: {
              To: _contact.email,
              From: `${currentUser.user_name} <${currentUser.connected_email}>`,
              Subject: video_subject,
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
            .then(async () => {
              email_count += 1;
              Contact.updateOne(
                { _id: contacts[i] },
                { $set: { last_activity: activity.id } }
              ).catch((err) => {
                console.log('err', err);
              });

              const garbage = await Garbage.findOne({ user: currentUser.id });
              const auto_resend = garbage.auto_resend;
              if (auto_resend['enabled']) {
                const data = { activities, auto_resend };
                autoResend(data);
              }
              resolve();
            })
            .catch((err) => {
              console.log('gmail video send err', err.message);
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
          console.log('gmail video send err', err.message);
          Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
            console.log('err', err.message);
          });
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            error: err.message,
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
          return res.status(405).send({
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
  const { content, videos: videoIds, contacts } = req.body;
  const promise_array = [];
  const error = [];

  const videos = await Video.find({ _id: { $in: videoIds } });

  let detail_content = 'sent video using sms';
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
          console.log('contact update err', err.messgae);
        }
      );
      let video_titles = '';
      let video_descriptions = '';
      let video_objects = '';
      let video_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < videos.length; j++) {
        const video = videos[j];

        if (!video_content) {
          video_content = '';
        }

        video_content = video_content
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
          type: 'videos',
          send_type: 1,
          videos: video._id,
          description: video_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;

        if (j < videos.length - 1) {
          video_titles = video_titles + video.title + ', ';
          video_descriptions += `${video.description}, `;
        } else {
          video_titles += video.title;
          video_descriptions += video.description;
        }
        const video_object = `\n${video.title}:\n\n${video_link}\n`;
        video_objects += video_object;
        activities.push(activity.id);
      }

      if (video_content.search(/{video_object}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_object}/gi,
          video_objects
        );
      } else {
        video_content = video_content + '\n' + video_objects;
      }

      if (video_content.search(/{video_title}/gi) !== -1) {
        video_content = video_content.replace(/{video_title}/gi, video_titles);
      }

      if (video_content.search(/{video_description}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_description}/gi,
          video_descriptions
        );
      }

      let promise;
      let fromNumber = currentUser['proxy_number'];

      if (fromNumber) {
        // fromNumber = await textHelper.getSignalWireNumber(currentUser.id);
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

          await textHelper.sleep(1000);

          client.messages
            .create({
              from: fromNumber,
              to: e164Phone,
              body:
                video_content + '\n\n' + textHelper.generateUnsubscribeLink(),
            })
            .then((message) => {
              if (message.status === 'queued' || message.status === 'sent') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  video_content
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

                // ====== Notification Creator =====
                resolve();
              } else if (message.status === 'delivered') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  video_content
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
      } else if (currentUser['twilio_number']) {
        fromNumber = currentUser['twilio_number'];

        promise = new Promise(async (resolve) => {
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

          await textHelper.sleep(1000);
          twilio.messages
            .create({
              from: fromNumber,
              body:
                video_content + '\n\n' + textHelper.generateUnsubscribeLink(),
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
                  video_content
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

                // ======== Notification Creator ==========
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
                  video_content
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

        promise = new Promise(async (resolve) => {
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

          await textHelper.sleep(1000);
          client.messages
            .create({
              from: fromNumber,
              to: e164Phone,
              body:
                video_content + '\n\n' + textHelper.generateUnsubscribeLink(),
            })
            .then((message) => {
              if (message.status === 'queued' || message.status === 'sent') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  video_content
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

                // ======== Notification Creator =========
                resolve();
              } else if (message.status === 'delivered') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  video_content
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
  const { content, subject, videos, contacts } = req.body;

  const _contact = await Contact.findOne({ _id: contacts[0] }).catch((err) => {
    console.log('err', err);
  });

  let video_titles = '';
  let video_descriptions = '';
  let video_objects = '';
  const video_subject = '';
  let video_content = content;
  let activity;

  for (let j = 0; j < videos.length; j++) {
    const video = videos[j];

    if (typeof video_content === 'undefined') {
      video_content = '';
    }

    video_content = video_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    const _activity = new Activity({
      content: 'sent video using sms',
      contacts: contacts[0],
      user: currentUser.id,
      type: 'videos',
      videos: video._id,
      created_at: new Date(),
      updated_at: new Date(),
      description: video_content,
    });

    activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err.message);
      });

    const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;

    if (j < videos.length - 1) {
      video_titles = video_titles + video.title + ', ';
      video_descriptions += `${video.description}, `;
    } else {
      video_titles += video.title;
      video_descriptions += video.description;
    }
    const video_object = `\n${video.title}:\n${video_link}\n`;
    video_objects += video_object;
  }

  if (video_content.search(/{video_object}/gi) !== -1) {
    video_content = video_content.replace(/{video_object}/gi, video_objects);
  } else {
    video_content += video_objects;
  }

  if (video_content.search(/{video_title}/gi) !== -1) {
    video_content = video_content.replace(/{video_title}/gi, video_titles);
  }

  if (video_content.search(/{video_description}/gi) !== -1) {
    video_content = video_content.replace(
      /{video_description}/gi,
      video_descriptions
    );
  }

  return res.send({
    status: true,
    data: video_content,
  });
};

const bulkOutlook = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, videos, contacts } = req.body;
  const promise_array = [];
  const error = [];

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_ONE_TIME) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }
    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });

    let email_count = currentUser['email_info']['count'] || 0;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    let detail_content = 'sent video using email';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
      let accessToken;
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

      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error);
          } else {
            resolve(result.token);
          }
        });
      })
        .then((token) => {
          accessToken = token.access_token;
        })
        .catch((error) => {
          console.log('error', error);
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

      let video_titles = '';
      let video_descriptions = '';
      let video_objects = '';
      let video_subject = subject;
      let video_content = content;
      const activities = [];
      let activity;

      for (let j = 0; j < videos.length; j++) {
        const video = await Video.findOne({ _id: videos[j] }).catch((err) => {
          console.log('video found err', err.message);
        });
        let preview;
        if (video['preview']) {
          preview = video['preview'];
        } else {
          preview = video['thumbnail'];
        }

        if (typeof video_content === 'undefined') {
          video_content = '';
        }

        video_subject = video_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        video_content = video_content
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
          type: 'videos',
          videos: video._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: video_subject,
          description: video_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        if (videos.length >= 2) {
          video_titles = mail_contents.VIDEO_TITLE;
        } else {
          video_titles = `${video.title}`;
        }

        if (j < videos.length - 1) {
          video_descriptions += `${video.description}, `;
        } else {
          video_descriptions += video.description;
        }
        const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
        // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
        // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
        const video_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${preview}" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        video_objects += video_object;
        activities.push(activity.id);
      }

      if (video_subject === '') {
        video_subject = 'VIDEO: ' + video_titles;
      } else {
        video_subject = video_subject.replace(/{video_title}/gi, video_titles);
        video_subject = video_subject.replace(
          /{material_title}/gi,
          video_titles
        );
      }

      if (video_content.search(/{video_object}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_object}/gi,
          video_objects
        );
      } else {
        video_content = video_content + '<br/>' + video_objects;
      }

      if (content.search(/{video_title}/gi) !== -1) {
        video_content = video_content.replace(/{video_title}/gi, video_titles);
      }

      if (content.search(/{video_description}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_description}/gi,
          video_descriptions
        );
      }

      const email_content =
        '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
        video_content +
        '</tbody></table>' +
        '<br/>Thank you,<br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';

      const sendMail = {
        message: {
          subject: video_subject,
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
          .then(async () => {
            email_count += 1;
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });

            const garbage = await Garbage.findOne({ user: currentUser.id });
            const auto_resend = garbage.auto_resend;
            if (auto_resend['enabled']) {
              const data = { activities, auto_resend };
              autoResend(data);
            }
            resolve();
          })
          .catch((err) => {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err.message);
            });
            console.log('err', err.message);
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: err.message || err.msg,
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

const getConvertStatus = async (req, res) => {
  const { videos } = req.body;
  const result_array = {};
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const result = await videoHelper.getConvertStatus(video);
    result_array[video] = result;
  }
  return res.send(result_array);
};

const getContactsByLatestSent = async (req, res) => {
  const { currentUser } = req;

  const activities = await Activity.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(currentUser._id),
        videos: mongoose.Types.ObjectId(req.params.id),
        type: 'videos',
      },
    },
    {
      $group: {
        _id: '$contacts',
      },
    },
    {
      $project: { _id: 1 },
    },
    {
      $lookup: {
        from: 'contacts',
        localField: '_id',
        foreignField: '_id',
        as: 'contacts',
      },
    },
  ]).limit(8);
  return res.send({
    status: true,
    activities,
  });
};

const autoResend = async (data) => {
  const { activities, auto_resend } = data;
  let time_line;
  const now = moment();
  const due_date = now.add(auto_resend.period, 'hours');
  due_date.set({ second: 0, millisecond: 0 });

  for (let i = 0; i < activities.length; i++) {
    const activity = await Activity.findOne({ _id: activities[i] }).catch(
      (err) => {
        console.log('activity find err', err.message);
      }
    );
    if (!activity.send_type) {
      time_line = await Task.findOne({
        type: 'resend_email_video2',
        'action.activity': activity.id,
        status: 'active',
      });
      if (time_line) {
        time_line.due_date = due_date;
      } else {
        const canned_message = await EmailTemplate.findOne({
          _id: auto_resend.email_canned_message,
        });

        time_line = new Task({
          user: activity.user,
          contacts: activity.contacts,
          type: 'resend_email_video2',
          action: {
            activity: activity.id,
            content: canned_message.content,
            subject: canned_message.subject,
            video: activity.videos,
          },
          watched_video: activity.videos,
          'condition.case': 'watched_video',
          'condition.answer': false,
          status: 'active',
          due_date,
        });
      }
    } else {
      time_line = await Task.findOne({
        type: 'resend_text_video2',
        'action.activity': activity.id,
        status: 'active',
      });
      if (time_line) {
        time_line.due_date = due_date;
      } else {
        const canned_message = await EmailTemplate.findOne({
          _id: auto_resend.sms_canned_message,
        });
        time_line = new Task({
          user: activity.user,
          contacts: activity.contacts,
          type: 'resend_text_video2',
          action: {
            activity: activity.id,
            content: canned_message.content,
            subject: canned_message.subject,
            video: activity.videos,
          },
          watched_video: activity.videos,
          'condition.case': 'watched_video',
          'condition.answer': false,
          status: 'active',
          due_date,
        });
      }
    }

    time_line.save().catch((err) => {
      console.log('time line save err', err);
    });
  }
};

const setupRecording = (io) => {
  const fileStreams = {};
  const fileStreamSizeStatus = {};
  io.sockets.on('connection', (socket) => {
    socket.on('initVideo', async (userId) => {
      const videoId = uuidv1();
      if (!fs.existsSync(TEMP_PATH)) {
        fs.mkdirSync(TEMP_PATH);
      }

      const user = await User.findOne({ _id: userId }).catch((err) => {
        console.log('user find err', err.message);
      });

      max_duration = user.material_info.record_max_duration || 0;
      const recordVideos = await Video.find({
        user: user._id,
        recording: true,
        del: false,
      });
      recordDuration = 0;

      if (recordVideos && recordVideos.length > 0) {
        for (const recordVideo of recordVideos) {
          if (recordVideo.duration > 0) {
            recordDuration += recordVideo.duration;
          }
        }
      }

      if (recordDuration >= max_duration) {
        socket.emit('timeout', { maxOverflow: true });
      } else {
        limitTime = max_duration - recordDuration;
        if (limitTime > timeBounce) {
          // more than 10min counter is up else down
          counterDirection = 1;
          const data = {
            counterDirection: 1,
            limitTime,
          };
          socket.emit('counterDirection', data);
        } else {
          counterDirection = -1;
          const data = {
            counterDirection: -1,
            limitTime,
          };
          socket.emit('counterDirection', data);
        }
        const ws = fs.createWriteStream(TEMP_PATH + videoId + `.webm`);
        fileStreams[videoId] = ws;
        fileStreamSizeStatus[videoId] = 0;
        socket.emit('createdVideo', { video: videoId });
      }
    });
    socket.on('pushVideoData', (data) => {
      const videoId = data.videoId;
      const blob = data.data;
      const recordTime = data.recordTime || 0;

      if (counterDirection === -1 && recordTime <= 500) {
        socket.emit('timeout', { timeOverflow: true });
      } else {
        if (!fileStreams[videoId]) {
          fileStreams[videoId] = fs.createWriteStream(
            TEMP_PATH + videoId + `.webm`,
            { flags: 'a' }
          );
          const stats = fs.statSync(TEMP_PATH + videoId + `.webm`);
          fileStreamSizeStatus[videoId] = stats.size;
        }
        if (data.sentSize === fileStreamSizeStatus[videoId]) {
          socket.emit('receivedVideoData', {
            receivedSize: fileStreamSizeStatus[videoId],
          });
        } else {
          let bufferSize = 0;
          blob.forEach((e) => {
            fileStreams[videoId].write(e);
            bufferSize += e.length;
          });
          fileStreamSizeStatus[videoId] += bufferSize;

          const estimateTime = max_duration - recordDuration - recordTime;
          if (estimateTime <= timeBounce && counterDirection === 1) {
            counterDirection = -1;
            const data = {
              counterDirection: -1,
              limitTime: estimateTime,
            };
            socket.emit('counterDirection', data);
          }
          socket.emit('receivedVideoData', {
            receivedSize: fileStreamSizeStatus[videoId],
          });
        }
      }
    });
    socket.on('saveVideo', async (data) => {
      const videoId = data.videoId;
      const duration = data.duration;
      fileStreams[videoId].close();

      const token = data.token;
      let decoded;
      try {
        decoded = jwt.verify(token, api.JWT_SECRET);
      } catch (err) {
        socket.emit('failedSaveVideo');
      }
      if (token) {
        const user = await User.findOne({ _id: decoded.id }).catch((err) => {
          console.log('user find err', err.message);
        });

        // check record max duration for save video.
        max_duration = user.material_info.record_max_duration || 0;
        const recordVideos = await Video.find({
          user: user._id,
          recording: true,
          del: false,
        });

        recordDuration = 0;

        if (recordVideos && recordVideos.length > 0) {
          for (const recordVideo of recordVideos) {
            if (recordVideo.duration > 0) {
              recordDuration += recordVideo.duration;
            }
          }
        }
        recordDuration += duration;

        if (recordDuration > max_duration) {
          console.log('Maximum record time is exceeded.');
        } else {
          const video = new Video({
            url: urls.VIDEO_URL + videoId + `.webm`,
            path: TEMP_PATH + videoId + `.webm`,
            title: `${moment().format('MMMM Do YYYY')} - ${
              user.user_name
            } Recording`,
            duration,
            user: decoded.id,
            recording: true,
            bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
            converted: 'progress',
          });
          video
            .save()
            .then((_video) => {
              // console.log("emit saved video =============>", _video.id);
              socket.emit('savedVideo', { video: _video.id });

              let area;
              let params;
              videoHelper.getDuration(_video.id);

              if (data.mode === 'crop') {
                // Crop area
                const screen = data.screen;
                const videoWidth = 1440;
                const videoHeight = Math.floor(
                  (videoWidth * screen.height) / screen.width
                );
                const areaX = (data.area.startX * videoWidth) / screen.width;
                const areaY = (data.area.startY * videoHeight) / screen.height;
                const areaW = (data.area.w * videoWidth) / screen.width;
                const areaH = (data.area.h * videoHeight) / screen.height;
                area = {
                  areaX,
                  areaY,
                  areaW,
                  areaH,
                };
                // CROP AREA USING FFMPEG
                videoHelper.getDuration(_video.id);
                params = {
                  id: _video.id,
                  mode: 'crop',
                  area,
                };
              } else if (data.mode === 'mirror') {
                params = {
                  id: _video.id,
                  mode: 'mirror',
                };
              } else {
                videoHelper.getDuration(_video.id);
                params = {
                  id: _video.id,
                };
                // CONVERT FFMPEG
              }
              // Upload the Meta Data and Video to the S3
              var videoKey = _video.id;
              if (params.mode) {
                s3.putObject({
                  Bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
                  Key: 'meta/' + videoKey + '.txt',
                  Body: JSON.stringify(params),
                  ContentType: 'text/plain',
                }).promise();
              }
              if (fs.existsSync(TEMP_PATH + videoId + `.webm`)) {
                try {
                  const fileStream = fs.createReadStream(
                    TEMP_PATH + videoId + `.webm`
                  );
                  const uploadParams = {
                    Bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
                    Key: 'sources/' + videoKey + '.webm',
                    Body: fileStream,
                    ContentType: 'video/webm',
                  };
                  s3.upload(uploadParams)
                    .promise()
                    .then(() => {
                      _video['key'] = _video._id;
                      _video.save();

                      if (fs.existsSync(TEMP_PATH + videoId + `.webm`)) {
                        fs.unlinkSync(TEMP_PATH + videoId + `.webm`);
                      }
                    });

                  const video_data = {
                    file_name: _video.id,
                    file_path: _video.path,
                    area,
                    mode: data.mode,
                  };
                  videoHelper.generateThumbnail(video_data);
                } catch (err) {
                  console.log('file uploading is failed.', err);
                }
              }
            })
            .catch((err) => {
              console.log('Faield SAVE VIDEO', err);
              socket.emit('failedSaveVideo');
            });
        }
      }
    });
    socket.on('cancelRecord', (data) => {
      // console.log("on cancel record ===========>", data.videoId);
      const videoId = data.videoId;
      if (fs.existsSync(TEMP_PATH + videoId + `.webm`)) {
        try {
          if (fileStreams[videoId]) {
            fileStreams[videoId].close();
          }
        } catch (e) {
          console.log('close file stream', e);
        }
        fs.unlinkSync(TEMP_PATH + videoId + `.webm`);
      }
      socket.emit('removedVideo');
    });
  });
};

const getEasyLoad = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const videos = await Video.find({
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
    data: videos,
  });
};

const uploadVideo = async (req, res) => {
  const { currentUser } = req;

  let count = 0;
  let max_upload_count = 0;

  if (!currentUser.material_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable upload videos',
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
    const key = req.file.key;
    let fileName = path.basename(key);
    const extName = path.extname(key);
    fileName = fileName.replace(extName, '');
    const video = new Video({
      key: fileName,
      bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
      type: req.file.mimetype,
      user: currentUser._id,
      converted: 'progress',
    });

    const _video = await video
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });
    res.send({
      status: true,
      data: _video,
    });
  }
};

const playTrackableVideo = async (video_id, uuid, user_id, res) => {
  if (uuid) {
    const activity = await Activity.findOne({ send_uuid: uuid })
      .populate([{ path: 'user' }, { path: 'videos' }])
      .catch((err) => {
        console.log('err', err);
      });
    if (activity) {
      if (!activity.user) {
        return res.send(
          'Sorry! This video link is expired for some reason. Please try ask to sender to send again.1'
        );
      }

      const data = activity['user'];
      const myJSON = JSON.stringify(data);
      const user = JSON.parse(myJSON);
      delete user.hash;
      delete user.salt;
      delete user.payment;

      const video = await Video.findOne({ _id: video_id });

      if (!video) {
        return res.send(
          'Sorry! This video link is expired for some reason. Please try ask to sender to send again.3'
        );
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

      let material_start = 0;

      if (activity.material_last) {
        material_start = activity.material_last;
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
          (themeSetting && themeSetting[video._id]) ||
          garbage['material_theme'] ||
          theme;
        logo = garbage['logo'] || urls.DEFAULT_TEMPLATE_PAGE_LOGO;
        highlights = garbage['highlights'] || [];
        brands = garbage['brands'] || [];

        if (garbage['calendly'] && garbage['calendly'].link) {
          calendly = garbage['calendly'].link;
        }
      }
      const material = await videoHelper.getVideoPublicUrl(video._doc);
      return res.render('material_' + theme, {
        material,
        material_type: 'video',
        user,
        contact: activity['contacts'],
        activity: activity.id,
        social_link,
        calendly,
        material_start,
        setting: {
          logo,
          highlights,
          brands,
        },
      });
    } else {
      return res.send(
        'Sorry! This video link is expired for some reason. Please try ask to sender to send again.3'
      );
    }
  } else {
    let sender_id = user_id;

    const video = await Video.findOne({ _id: video_id }).catch((err) => {
      console.log('video find err', err.message);
    });

    if (!sender_id) {
      sender_id = video.user;
    }

    if (sender_id) {
      const user = await User.findOne({
        _id: sender_id,
        del: false,
        'subscription.is_suspended': false,
      }).catch((err) => {
        console.log('user find err', err.message);
      });

      let capture_dialog = true;
      let capture_delay = 0;
      let capture_field = [];
      // let additional_fields = [];

      if (user) {
        const garbage = await Garbage.findOne({ user: user._id }).catch(
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
          // additional_fields = garbage.additional_fields;
          if (!video.enabled_capture) {
            capture_dialog = false;
          } else {
            if (video.capture_form) {
              let selectForm;
              const allForms = Object.keys(garbage.capture_field);
              if (allForms.indexOf(video.capture_form) !== -1) {
                selectForm = video.capture_form;
              } else {
                selectForm = 'default';
              }
              capture_delay =
                garbage['capture_field'][selectForm]['capture_delay'];
              capture_field = garbage['capture_field'][selectForm]['fields'];
              intro_video =
                garbage['capture_field'][selectForm]['capture_video'];
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
            (themeSetting && themeSetting[video_id]) ||
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
        const material = await videoHelper.getVideoPublicUrl(video._doc);
        if (material.is_draft) {
          material.title = `${moment().format('MMMM Do YYYY')} - ${
            user.user_name
          } Recording`;
        }
        return res.render('lead_material_' + theme, {
          material,
          material_type: 'video',
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
          'Sorry! This video link is expired for some reason. Please try ask to sender to send again.3'
        );
      }
    } else {
      const material = await videoHelper.getVideoPublicUrl(video._doc);

      return res.render('lead_material_theme6', {
        material,
        material_type: 'video',
        user: {},
        capture_dialog: false,
        capture_field: {},
        additional_fields: [],
        social_link: {},
        setting: {},
      });
    }
  }
};

const playExtensionVideo = async (req, res) => {
  const uuid = req.query.activity;
  const user_id = req.query.user;
  const video_id = req.query.video;
  playTrackableVideo(video_id, uuid, user_id, res);
};

const playDirectSmsVideo = async (req, res) => {
  const uuid = req.query.token;
  const user_id = req.query.user;
  const video_id = req.query.video;
  Activity.findOne({ videos: [video_id], send_uuid: uuid }).then(
    (_activity) => {
      if (_activity) {
        req.params = { id: _activity._id };
        play1(req, res);
      } else {
        playTrackableVideo(video_id, uuid, user_id, res);
      }
    }
  );
};

const downloadVideo = async (req, res) => {
  const { currentUser } = req;
  const video = await Video.findOne({
    _id: req.params.id,
    user: currentUser._id,
  });

  if (video && video.bucket) {
    const material = await videoHelper.getVideoPublicUrl(video._doc);
    if (material['is_converted']) {
      return res.send({
        status: true,
        data: material['converted_url'],
      });
    }
  }
  return res.send({
    status: false,
  });
};

const initRecord = (req, res) => {
  const { currentUser } = req;

  Video.find({
    user: currentUser._id,
    recording: true,
    del: false,
  })
    .then((_videos) => {
      var duration = 0;
      _videos.forEach((e) => {
        if (!e.is_draft && e.duration) {
          duration += e.duration;
        }
      });

      const max_duration =
        (currentUser.material_info &&
          currentUser.material_info.record_max_duration) ||
        0;
      if (currentUser.material_info.is_limit && duration >= max_duration) {
        return res.status(400).send({
          status: false,
          error: 'timeout',
        });
      } else {
        const source = req.query.source;
        if (source === 'popup' || source === 'web') {
          return res.send({
            status: true,
            data: {
              max_duration,
              duration,
              user_name: currentUser.user_name,
            },
          });
        } else {
          const newVideo = new Video({
            user: currentUser._id,
            is_draft: true,
            ...req.body,
          });
          newVideo
            .save()
            .then((_v) => {
              return res.send({
                status: true,
                data: {
                  max_duration,
                  duration,
                  id: newVideo._id,
                },
              });
            })
            .catch((err) => {
              console.log('video creation is failed.', err);
              return res.status(400).send({
                status: false,
                error: 'video creation is failed.',
              });
            });
        }
      }
    })
    .catch((err) => {
      console.log('videos loading is failed.', err);
      return res.status(400).send({
        status: false,
      });
    });
};
const publish = (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;
  const { chunk_count } = req.body;

  Video.updateOne(
    { user: currentUser._id, _id: id },
    { $set: { chunk_count, is_draft: false } }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message || 'video publishing is failed.',
      });
    });
};

const trash = (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;

  Video.deleteOne({ user: currentUser._id, _id: id })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message || 'video trashing is failed.',
      });
    });
};

const uploadChunk = (req, res) => {
  const { currentUser } = req;
  const files = [];
  if (req.files && req.files.length) {
    req.files.forEach((e) => {
      files.push(e.originalname);
    });
    console.log('fiels', files);
    res.send({
      status: true,
      data: files,
    });
  } else if (req.file) {
    res.send({
      status: true,
      data: req.file,
    });
  }
};

const completeRecord = (req, res) => {
  const { currentUser } = req;
  const { video, count, meta, action, duration, _id, ext, rotate, title } =
    req.body;
  const payload = {
    video,
    count,
    meta,
    action,
  };
  if (ext) {
    payload['ext'] = ext;
  }
  if (rotate) {
    payload['rotate'] = rotate;
  }

  // Merge all files
  request({
    method: 'POST',
    uri: 'https://f8nhu9b8o4.execute-api.us-east-2.amazonaws.com/default/complete-record',
    body: JSON.stringify(payload),
  })
    .then(async (_res) => {
      if (action === 'delete') {
        if (_id) {
          Video.deleteOne({ _id }).catch((err) => {
            console.log('video recording cancel is failed.', err);
          });
        }
        return res.send({
          status: true,
        });
      } else {
        const videoData = {
          title:
            title ||
            `${moment().format('MMMM Do YYYY')} - ${
              currentUser.user_name
            } Recording`,
          key: video,
          duration,
          user: currentUser.id,
          recording: true,
          bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
          thumbnail:
            'https://teamgrow.s3.us-east-2.amazonaws.com/thumbnails/' +
            video +
            '.jpg',
          site_image:
            'https://teamgrow.s3.us-east-2.amazonaws.com/site_images/' +
            video +
            '.jpg',
          converted: 'progress',
        };
        // Check the video exist and update
        let _video;
        if (_id) {
          _video = await Video.findOne({ _id }).catch((err) => {
            console.log('not found existing video.', err);
          });
        }
        if (_video) {
          if (_video.title) {
            delete videoData['title'];
          }
          if (_video.key) {
            delete videoData['key'];
          }
          Video.updateOne({ _id }, { $set: videoData })
            .then(() => {
              return res.send({
                status: true,
                video: {
                  id: _video._id,
                },
              });
            })
            .catch((err) => {
              return res.status(400).send({
                status: false,
                error: 'video record is not completed.',
              });
            });
        } else {
          const newVideo = new Video(videoData);
          newVideo
            .save()
            .then(() => {
              return res.send({
                status: true,
                video: {
                  id: newVideo._id,
                },
              });
            })
            .catch((err) => {
              console.log('video record is not created', err);
              return res.status(400).send({
                status: false,
                error: 'video record is not created.',
              });
            });
        }
      }
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.error || err.message,
      });
    });
};

const mergeFiles = (req, res) => {
  const { currentUser } = req;
  const { id, count, ext, video, action } = req.body;

  // Merge all files
  request({
    method: 'POST',
    uri: 'https://f8nhu9b8o4.execute-api.us-east-2.amazonaws.com/default/merge-files',
    body: JSON.stringify({
      id,
      count,
      action,
      ext,
    }),
  })
    .then(async (_res) => {
      if (action === 'delete') {
        return res.send({
          status: true,
        });
      } else {
        // Video Record Creation
        createVideoData(video, id, currentUser._id)
          .then((_video) => {
            return res.send({
              status: true,
              data: {
                id: _video._id,
              },
            });
          })
          .catch(() => {
            return res.status(400).send({
              status: false,
              error: 'Video creation is failed.',
            });
          });
      }
    })
    .catch((err) => {
      console.log('error is occured in api call', err.error || err.message);
      try {
        const error = JSON.parse(err.error);
        if (error.message === 'Endpoint request timed out') {
          // Close Message
          createVideoData(video, id, currentUser._id)
            .then((_video) => {
              return res.send({
                status: true,
                data: {
                  id: _video._id,
                },
              });
            })
            .catch(() => {
              return res.status(400).send({
                status: false,
                error: 'Video creation is failed.',
              });
            });
        } else {
          return res.status(400).send({
            status: false,
            error: err.error || err.message,
          });
        }
      } catch (_err) {
        return res.status(400).send({
          status: false,
          error: err.error || err.message,
        });
      }
    });
};

const createVideoData = (video, id, user) => {
  return new Promise(async (resolve, reject) => {
    if (video['site_image']) {
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const siteImage = await uploadBase64Image(
          video['site_image'],
          'site_image' + year + '/' + month
        );
        video['site_image'] = siteImage;
      } catch (error) {
        console.error('Upload Site Image', error);
      }
    }
    if (video['thumbnail']) {
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const thumbnail_image = await uploadBase64Image(
          video['thumbnail'],
          'thumbnail' + year + '/' + month
        );
        video['thumbnail'] = thumbnail_image;
      } catch (error) {
        console.error('Upload Video Thumbnail Image', error);
      }
    }
    const { title, duration, description, site_image, thumbnail } = video;
    const _video = new Video({
      title,
      description,
      thumbnail,
      site_image,
      key: id,
      duration,
      user,
      bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
      converted: 'progress',
    });
    if (video['folder']) {
      Folder.updateOne(
        { _id: video['folder'], user },
        { $addToSet: { videos: { $each: [video['_id']] } } }
      ).catch((err) => {
        console.log('foler update is failed.', err.message);
      });
    }
    if (video['theme']) {
      Garbage.updateOne(
        { user },
        { $set: { ['material_themes.' + video._id]: video.theme } }
      ).catch((err) => {
        console.log('saving theme is failed.', err.message);
      });
    }
    _video
      .save()
      .then(() => {
        resolve(_video);
      })
      .catch(() => {
        reject();
      });
  });
};

const getConvertStatus2 = (req, res) => {
  const { currentUser } = req;
  const { id } = req.body;

  // Merge all files
  request({
    method: 'GET',
    uri:
      'https://f8nhu9b8o4.execute-api.us-east-2.amazonaws.com/default/convert-status?video_id=' +
      id,
  })
    .then((_res) => {
      const result = JSON.parse(_res);
      return res.send({
        status: true,
        ...result,
      });
    })
    .catch((err) => {
      console.log('error is occured in api call', err);
      return res.status(400).send({
        status: false,
        error: err.error || err.message,
      });
    });
};

const uploadSingle = async (req, res) => {
  const { currentUser } = req;

  const count = 0;
  const max_upload_count = 0;

  if (!currentUser.material_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable create video',
    });
  }

  // if (currentUser.material_info['is_limit']) {
  //   const userVideoCount = await Video.countDocuments({
  //     user: currentUser.id,
  //     uploaded: true,
  //   });
  //   max_upload_count =
  //     currentUser.material_info.upload_max_count ||
  //     system_settings.MATERIAL_UPLOAD_LIMIT.PRO;
  // }

  // if (currentUser.material_info['is_limit'] && max_upload_count <= count) {
  //   return res.status(412).send({
  //     status: false,
  //     error: 'Exceed upload max materials',
  //   });
  // }

  if (req.file) {
    const video = new Video({
      user: req.currentUser.id,
      key: req.params.id,
      bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
      converted: 'progress',
    });

    const _video = await video
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });
    res.send({
      status: true,
      data: _video,
    });
  }
};

const updateStatus = (req, res) => {
  const { input, output } = req.body;
  const operation = req.query.operation;

  if (!input || !input.video) {
    return res.status(400).send({
      status: false,
      error: 'invalid_request',
    });
  }

  Video.findOne({ key: input['video'] })
    .then((_video) => {
      if (!_video) {
        return res.status(400).send({
          status: false,
          error: 'not_found_video',
        });
      }

      const data = {};
      if (operation === 'merged') {
        if (output['merged'] && output['merged']['status']) {
          data['status.merged'] = { status: true };
        } else if (output['merged']) {
          data['status.merged'] = output['merged'];
        }
        if (output['thumbnail'] && output['thumbnail']['status']) {
          data['thumbnail'] =
            urls.STORAGE_BASE + '/' + output['thumbnail']['url'];
        }
        if (output['siteImage'] && output['siteImage']['status']) {
          data['site_image'] =
            urls.STORAGE_BASE + '/' + output['siteImage']['url'];
        }
      } else if (operation === 'converted') {
        if (output['converted'] && output['converted']['status']) {
          data['converted'] = 'completed';
          data['status.converted'] = { status: true };
        } else if (output['converted']) {
          data['status.converted'] = output['converted'];
        }
      } else if (operation === 'stream') {
        if (output['stream'] && output['stream']['status']) {
          data['status.stream'] = { status: true };
        } else if (output['stream']) {
          data['status.stream'] = output['stream'];
        }
      }

      Video.updateOne({ key: input['video'] }, { $set: data }).then(() => {
        return res.send({
          status: true,
        });
      });
    })
    .catch(() => {
      return res.status(500).send({
        status: false,
        error: 'db_error',
      });
    });
};

module.exports = {
  play,
  playUserVideo,
  play1,
  playDemo,
  playExtensionVideo,
  playUuidVideo,
  playDirectSmsVideo,
  embedPlay,
  pipe,
  create,
  update,
  updateDetail,
  updateDefault,
  get,
  getThumbnail,
  getEasyLoad,
  getAll,
  getConvertStatus,
  bulkEmail,
  bulkText,
  remove,
  getAnalytics,
  getContactsByLatestSent,
  createVideo,
  createSmsContent,
  bulkGmail,
  bulkOutlook,
  autoResend,
  setupRecording,
  downloadVideo,
  publish,
  trash,
  uploadVideo,
  updateConvertStatus,
  initRecord,
  uploadChunk,
  completeRecord,
  mergeFiles,
  uploadSingle,
  getConvertStatus2,
  updateStatus,
};
