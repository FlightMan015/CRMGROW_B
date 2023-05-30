const path = require('path');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');
const base64Img = require('base64-img');
const mime = require('mime-types');

const uuidv1 = require('uuid/v1');
const AWS = require('aws-sdk');
const mongoose = require('mongoose');

const GIFEncoder = require('gifencoder');

const extractFrames = require('ffmpeg-extract-frames');
const { createCanvas, loadImage } = require('canvas');
const pngFileStream = require('png-file-stream');
const sharp = require('sharp');
const urls = require('../../constants/urls');
const api = require('../../config/api');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const {
  GIF_PATH,
  THUMBNAILS_PATH,
  PLAY_BUTTON_PATH,
} = require('../../config/path');
const VideoTracker = require('../../models/video_tracker');
const Video = require('../../models/video');

const create = async (req, res) => {
  if (req.file) {
    const file_name = req.file.filename;
    const video = new Video({
      role: 'admin',
      url: urls.VIDEO_URL + file_name,
      type: req.file.mimetype,
      path: req.file.path,
      created_at: new Date(),
    });

    video.save().then((_video) => {
      res.send({
        status: true,
        data: _video,
      });
    });
  }
};

const updateDetail = async (req, res) => {
  const editData = req.body;
  let thumbnail;

  const video = await Video.findOne({ _id: req.params.id }).catch((err) => {
    console.log('err', err);
  });

  for (const key in editData) {
    video[key] = editData[key];
  }
  if (thumbnail) {
    video.thumbnail = thumbnail;
  }

  video.updated_at = new Date();
  video
    .save()
    .then((_video) => {
      res.send({
        status: true,
        data: _video,
      });
    })
    .catch((err) => {
      console.log('err', err);
    });
};

const generatePreview = async (file_path) => {
  return new Promise((resolve, reject) => {
    const offsets = [];
    for (let i = 0; i < 4000; i += 100) {
      offsets.push(i);
    }

    extractFrames({
      input: file_path,
      output: `${GIF_PATH}screenshot-%i.jpg`,
      offsets,
    }).catch((err) => {
      console.log('err', err);
    });

    const play = loadImage(PLAY_BUTTON_PATH);

    const canvas = createCanvas(250, 140);
    const ctx = canvas.getContext('2d');
    const encoder = new GIFEncoder(250, 140);

    for (let i = 1; i < 40; i++) {
      const image = loadImage(`${GIF_PATH}screenshot-${i}.jpg`);

      let { height } = image;
      let { width } = image;
      if (height > width) {
        ctx.rect(0, 0, 250, 140);
        ctx.fillStyle = '#000000';
        ctx.fill();
        width = (140 * width) / height;
        height = 140;
        ctx.drawImage(image, (250 - width) / 2, 0, width, height);
      } else {
        height = 140;
        width = 250;
        ctx.drawImage(image, 0, 0, width, height);
      }
      ctx.rect(60, 100, 150, 30);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#333';
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.font = '20px Impact';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Play video', 70, 120);
      ctx.drawImage(play, 10, 95, 40, 40);
      const buf = canvas.toBuffer();
      fs.writeFileSync(`${GIF_PATH}frame-${i}.png`, buf);
    }
    const file_name = uuidv1();
    const stream = pngFileStream(`${GIF_PATH}frame-??.png`)
      .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
      .pipe(fs.createWriteStream(GIF_PATH + file_name));

    stream.on('finish', () => {
      if (fs.existsSync(GIF_PATH + file_name)) {
        fs.readFile(GIF_PATH + file_name, (err, data) => {
          if (err) throw err;
          console.log('File read was successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: `gif${year}/${month}/${file_name}`,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) throw s3Err;
            console.log(`File uploaded successfully at ${upload.Location}`);

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
  const { currentUser } = req;
  const video = await Video.findOne({ _id: req.params.id });
  if (!video) {
    return res.status(400).json({
      status: false,
      error: 'Video doesn`t exist',
    });
  }
  const myJSON = JSON.stringify(video);
  const data = JSON.parse(myJSON);
  Object.assign(data, { user: currentUser.id });

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
    }
    const contentType = mime.contentType(path.extname(filePath));
    res.set('Content-Type', contentType);
    return res.sendFile(filePath);
  }
  return res.status(404).send({
    status: false,
    error: 'Thumbnail does not exist',
  });
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const _video = VideoTracker.find({ user: currentUser.id });

  if (!_video) {
    return res.status(400).json({
      status: false,
      error: 'Video doesn`t exist',
    });
  }

  const _video_list = await Video.find({ user: currentUser.id });

  const _video_detail_list = [];

  for (let i = 0; i < _video_list.length; i++) {
    const _video_detail = await VideoTracker.aggregate([
      {
        $lookup: {
          from: 'videos',
          localField: 'video',
          foreignField: '_id',
          as: 'video_detail',
        },
      },
      {
        $match: { video: _video_list[i].id },
      },
    ]);

    const myJSON = JSON.stringify(_video_list[i]);
    const _video = JSON.parse(myJSON);
    const video_detail = await Object.assign(_video, {
      views: _video_detail.length,
    });
    _video_detail_list.push(video_detail);
  }

  res.send({
    status: true,
    data: _video_detail_list,
  });
};

const getVideos = async (req, res) => {
  const { page } = req.params;
  const skip = (page - 1) * 12;

  const videos = await Video.aggregate([
    { $match: { del: false } },
    { $skip: skip },
    { $limit: 12 },
  ]).catch((err) => {
    res.status(500).send({
      status: false,
      error: err,
    });
  });

  await Video.populate(videos, {
    path: 'user',
    select: { user_name: 1, picture_profile: 1 },
  });

  const videoCounts = await Video.countDocuments({ del: false });

  return res.send({
    status: true,
    data: videos,
    total: videoCounts,
  });
};

const sendVideo = async (req, res) => {
  const { currentUser } = req;
  const { email, content, video, contact } = req.body;
  sgMail.setApiKey(process.env.SENDGRID_KEY);

  const text = `${content}\n${process.env.TEAMGROW_DOMAIN}/material/view/video/?video=${video}&contact=${contact}&user=${currentUser.id}`;
  const msg = {
    to: email,
    from: currentUser.email,
    subject: process.env.WELCOME_SEND_VIDEO_MESSAGE,
    text,
    html: text,
  };

  sgMail
    .send(msg)
    .then((_res) => {
      console.log('mailres.errorcode', _res[0].statusCode);
      if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
        console.log('status', _res[0].statusCode);
      } else {
        res.status(404).send({
          status: false,
          error: _res[0].statusCode,
        });
      }
    })
    .catch((e) => {
      console.error(e);
      res.status(500).send({
        status: false,
        error: 'internal_server_error',
      });
    });
  res.send({
    status: true,
  });
};

const remove = async (req, res) => {
  try {
    const video = await Video.findOne({ _id: req.params.id }).catch((err) => {
      console.log('err', err);
    });
    const { url } = video;

    s3.deleteObject(
      {
        Bucket: api.AWS.AWS_S3_BUCKET_NAME,
        Key: url.slice(44),
      },
      function (err, data) {
        console.log('err', err);
      }
    );

    video.del = true;
    video.save();
  } catch (e) {
    console.error(e);
    res.status(500).send({
      status: false,
      error: 'internal_server_error',
    });
  }
};

const getVideosByUser = async (req, res) => {
  const user = req.params.id;
  const page = parseInt(req.body.page);
  const skip = (page - 1) * 12;

  const videos = await Video.aggregate([
    { $match: { user: mongoose.Types.ObjectId(user), del: false } },
    { $skip: skip },
    { $limit: 12 },
  ]).catch((err) => {
    res.status(500).send({
      status: false,
      error: err,
    });
  });

  const videoCounts = await Video.countDocuments({ del: false, user });

  return res.send({
    status: true,
    data: videos,
    total: videoCounts,
  });
};

module.exports = {
  create,
  updateDetail,
  get,
  getThumbnail,
  getAll,
  sendVideo,
  remove,
  getVideos,
  getVideosByUser,
};
