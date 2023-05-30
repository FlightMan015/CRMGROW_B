const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const child_process = require('child_process');
const uuidv1 = require('uuid/v1');
const fs = require('fs');
const AWS = require('aws-sdk');
const api = require('../config/api');
const Video = require('../models/video');
const Garbage = require('../models/garbage');
const Team = require('../models/team');
const { emptyBucket } = require('../controllers/material');

const {
  VIDEO_CONVERT_LOG_PATH,
  TEMP_PATH,
  THUMBNAILS_PATH,
} = require('../config/path');
const urls = require('../constants/urls');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const convertRecordVideo = async (data) => {
  const { id, area, mode } = data;

  const video = await Video.findOne({ _id: id }).catch((err) => {
    console.log('video convert find video error', err.message);
  });

  const file_path = video['path'];
  const new_file = uuidv1() + '.mp4';
  const new_path = TEMP_PATH + new_file;
  // const video_path = 'video.mov'
  const args = [
    '-fflags',
    '+genpts',
    '-i',
    file_path,
    '-movflags',
    'faststart',
    '-preset',
    'ultrafast',
    '-profile:v',
    'high',
    '-level',
    '4.2',
    '-r',
    '24',
    new_path,
  ];

  if (mode === 'crop' && area) {
    const crop = `crop=${area.areaW}:${area.areaH}:${area.areaX}:${area.areaY}`;
    args.splice(args.length - 3, 0, '-filter:v', crop);
  }

  if (mode === 'mirror') {
    args.splice(args.length - 3, 0, '-vf', 'hflip');
  }

  if (!fs.existsSync(TEMP_PATH)) {
    fs.mkdirSync(TEMP_PATH);
  }

  const ffmpegConvert = child_process.spawn(ffmpegPath, args);
  ffmpegConvert.on('close', function () {
    const new_url = urls.VIDEO_URL + new_file;
    video['url'] = new_url;
    video['converted'] = 'completed';
    video['path'] = new_path;
    video['old_path'] = file_path;
    video
      .save()
      .then(() => {
        // fs.unlinkSync(file_path);
      })
      .catch((err) => {
        console.log('vide update err', err.message || err.msg);
      });
  });

  if (!fs.existsSync(VIDEO_CONVERT_LOG_PATH)) {
    fs.mkdirSync(VIDEO_CONVERT_LOG_PATH);
  }

  ffmpegConvert.stderr.on('data', function (data) {
    const content = Buffer.from(data).toString();

    fs.appendFile(
      VIDEO_CONVERT_LOG_PATH + video.id + '.txt',
      content,
      function (err) {
        // If an error occurred, show it and return
        if (err) {
          console.error(err);
          // Successfully wrote binary contents to the file!
          return err;
        }
      }
    );
  });
};

const convertUploadVideo = async (id) => {
  const video = await Video.findOne({ _id: id }).catch((err) => {
    console.log('video convert find video error', err.message);
  });

  const file_path = video['path'];
  const new_file = uuidv1() + '.mov';
  const new_path = TEMP_PATH + new_file;

  const args = [
    '-i',
    file_path,
    '-c:v',
    'libx264',
    '-b:v',
    '1.5M',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    'faststart',
    new_path,
  ];

  if (!fs.existsSync(TEMP_PATH)) {
    fs.mkdirSync(TEMP_PATH);
  }

  if (!fs.existsSync(VIDEO_CONVERT_LOG_PATH)) {
    fs.mkdirSync(VIDEO_CONVERT_LOG_PATH);
  }

  const ffmpegConvert = child_process.spawn(ffmpegPath, args);
  ffmpegConvert.on('close', function () {
    const new_url = urls.VIDEO_URL + new_file;
    video['url'] = new_url;
    video['converted'] = 'completed';
    video['path'] = new_path;
    video['old_path'] = file_path;
    video
      .save()
      .then(() => {
        // fs.unlinkSync(file_path);
      })
      .catch((err) => {
        console.log('vide update err', err.message || err.msg);
      });
  });

  ffmpegConvert.stderr.on('data', function (data) {
    const content = Buffer.from(data).toString();
    fs.appendFile(
      VIDEO_CONVERT_LOG_PATH + video.id + '.txt',
      content,
      function (err) {
        // If an error occurred, show it and return
        if (err) {
          console.error(err);
          return err;
        }
        // Successfully wrote binary contents to the file!
      }
    );
  });
};

const getConvertStatus = async (video_path) => {
  if (!fs.existsSync(VIDEO_CONVERT_LOG_PATH + video_path + '.txt')) {
    return {
      id: video_path,
      status: false,
      error: "Converting Status File doesn't exist.",
    };
  }
  const content = fs.readFileSync(
    VIDEO_CONVERT_LOG_PATH + video_path + '.txt',
    'utf8'
  );
  let duration = 0;
  let time = 0;
  let progress = 0;
  let result;
  let matches = content ? content.match(/Duration: (.*?), start:/) : [];

  if (matches && matches.length > 0) {
    const rawDuration = matches[1];

    let ar = rawDuration.split(':').reverse();
    // eslint-disable-next-line use-isnan
    if (ar[0] === 'N/A') {
      const video = await Video.findOne({ _id: video_path }).catch((err) => {
        console.log('video find err', err.message);
      });
      duration = video.duration / 1000;
    } else {
      duration = parseFloat(ar[0]);
      if (ar[1]) duration += parseInt(ar[1]) * 60;
      if (ar[2]) duration += parseInt(ar[2]) * 60 * 60;
    }

    // get the time
    matches = content.match(/time=(.*?) bitrate/g);

    if (matches && matches.length > 0) {
      let rawTime = matches.pop();
      // needed if there is more than one match
      if (Array.isArray(rawTime)) {
        rawTime = rawTime.pop().replace('time=', '').replace(' bitrate', '');
      } else {
        rawTime = rawTime.replace('time=', '').replace(' bitrate', '');
      }
      // convert rawTime from 00:00:00.00 to seconds.
      ar = rawTime.split(':').reverse();
      time = parseFloat(ar[0]);
      if (ar[1]) time += parseInt(ar[1]) * 60;
      if (ar[2]) time += parseInt(ar[2]) * 60 * 60;

      // calculate the progress
      progress = Math.round((time / duration) * 100);
    }

    if (progress === 0) {
      // TODO err - giving up after 8 sec. no progress - handle progress errors here
      result = {
        id: video_path,
        status: false,
      };
    } else {
      result = {
        id: video_path,
        status: true,
        progress,
      };
    }
  } else if (content.indexOf('Permission denied') > -1) {
    result = {
      id: video_path,
      status: false,
      error:
        'ffmpeg : Permission denied, either for ffmpeg or upload location ...',
    };
  }
  return result;
};

const getDuration = async (id) => {
  const video = await Video.findOne({ _id: id }).catch((err) => {
    console.log('video convert find video error', err.message);
  });

  const file_path = video['path'];
  const args = ['-i', file_path, '-f', 'null', '-'];

  const ffmpegConvert = child_process.spawn(ffmpegPath, args);
  ffmpegConvert.stderr.on('data', (data) => {
    const content = new Buffer(data).toString();
    const matches = content.match(/time=(.*?) bitrate/g);

    if (matches && matches.length > 0) {
      let rawTime = matches.pop();
      // needed if there is more than one match
      if (Array.isArray(rawTime)) {
        rawTime = rawTime.pop().replace('time=', '').replace(' bitrate', '');
      } else {
        rawTime = rawTime.replace('time=', '').replace(' bitrate', '');
      }
      // convert rawTime from 00:00:00.00 to seconds.
      const ar = rawTime.split(':').reverse();
      let time = parseFloat(ar[0]);
      if (ar[1]) time += parseInt(ar[1]) * 60;
      if (ar[2]) time += parseInt(ar[2]) * 60 * 60;

      Video.updateOne(
        { _id: id },
        {
          $set: { duration: time * 1000 },
        }
      ).catch((err) => {
        console.log('video update err', err.message);
      });
    }
  });
};

const generateThumbnail = (data) => {
  const { file_name, file_path, area, mode } = data;

  if (!fs.existsSync(THUMBNAILS_PATH)) {
    fs.mkdirSync(THUMBNAILS_PATH);
  }

  const thumbnail_path = THUMBNAILS_PATH + file_name + '.png';
  let args = [];
  if (mode === 'crop' && area) {
    const crop = `crop=${area.areaW}:${area.areaH}:${area.areaX}:${area.areaY}`;
    args = [
      '-i',
      file_path,
      '-ss',
      '00:00:01',
      '-filter:v',
      crop,
      '-vframes',
      '1',
      thumbnail_path,
    ];
  } else if (mode === 'mirror') {
    args = [
      '-i',
      file_path,
      '-ss',
      '00:00:01',
      '-vf',
      'hflip',
      '-vframes',
      '1',
      thumbnail_path,
    ];
  } else {
    args = [
      '-i',
      file_path,
      '-ss',
      '00:00:01',
      '-vframes',
      '1',
      thumbnail_path,
    ];
  }
  const ffmpegConvert = child_process.spawn(ffmpegPath, args);
  ffmpegConvert.on('close', function () {
    fs.readFile(thumbnail_path, (err, data) => {
      console.log('data read successful data', data);
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
        if (s3Err) throw s3Err;
        console.log('file_name', file_name);
        console.log(`File uploaded successfully at ${upload.Location}`);
        Video.updateOne(
          { _id: file_name },
          {
            $set: {
              thumbnail: upload.Location,
            },
          }
        ).catch((err) => {
          console.log('video update err', err.message);
        });
      });
    });
  });
};

const removeVideos = async (user) => {
  const videos = await Video.find({
    user,
    del: false,
  }).catch((err) => {
    console.log('video find err', err.message);
  });

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];

    if (video['default_edited']) {
      Garbage.updateOne(
        { user: user.id },
        {
          $pull: { edited_video: { $in: [video.default_video] } },
        }
      ).catch((err) => {
        console.log('default video remove err', err.message);
      });
    }
    if (video['shared_video']) {
      Video.updateOne(
        {
          _id: video.shared_video,
          user: user.id,
        },
        {
          $unset: { shared_video: true },
          has_shared: false,
        }
      ).catch((err) => {
        console.log('default video remove err', err.message);
      });
    }
    if (video.role === 'team') {
      Team.updateOne(
        { videos: video.id },
        {
          $pull: { videos: { $in: [video.id] } },
        }
      ).catch((err) => {
        console.log('err', err.message);
      });
    }

    Video.updateOne({ _id: video.id }, { $set: { del: true } })
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
      })
      .catch((err) => {
        console.log('video update err', err.message);
      });
  }
};

const getVideoPublicUrl = async (video) => {
  if (video.bucket && video.bucket === api.AWS.AWS_PRIVATE_S3_BUCKET) {
    video['is_private'] = true;
    const signer = new AWS.CloudFront.Signer(
      api.AWS.CLOUDFRONT_ACCESS_KEY,
      api.AWS.CLOUDFRONT_PUBLIC_KEY
    );
    const streamUrl = api.AWS.CLOUDFRONT + '/streamd/' + video.key + '/*';
    const transcodedUrl =
      api.AWS.CLOUDFRONT + '/transcoded/' + video.key + '.mp4';
    const oneDay = 24 * 60 * 60 * 1000;
    const expires = Math.floor((Date.now() + oneDay) / 1000);
    const streamPolicy = `
    {
        "Statement": [
            {
                "Resource": "${streamUrl}",
                "Condition": {
                    "DateLessThan": {
                        "AWS:EpochTime": ${expires}
                    }
                }
            }
        ]
    }`;
    const transcodedPolicy = `
    {
        "Statement": [
            {
                "Resource": "${transcodedUrl}",
                "Condition": {
                    "DateLessThan": {
                        "AWS:EpochTime": ${expires}
                    }
                }
            }
        ]
    }`;
    const streamSignedUrl = signer.getSignedUrl({
      url: streamUrl,
      policy: streamPolicy,
    });
    const url = signer.getSignedUrl({
      url: transcodedUrl,
      policy: transcodedPolicy,
    });
    try {
      const convertedMeta = await s3
        .headObject({
          Bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
          Key: 'transcoded/' + video.key + '.mp4',
        })
        .promise();
      if (convertedMeta) {
        video['is_converted'] = true;
      }
    } catch (err) {
      video['is_converted'] = false;
    }
    try {
      const streamMeta = await s3
        .headObject({
          Bucket: api.AWS.AWS_PRIVATE_S3_BUCKET,
          Key: 'streamd/' + video.key + '/' + video.key + '.m3u8',
        })
        .promise();
      if (streamMeta) {
        video['is_stream'] = true;
      }
    } catch (err) {
      video['is_stream'] = false;
    }
    video['stream_url'] = streamSignedUrl;
    video['converted_url'] = url;
  } else {
    video['is_private'] = false;
    video['is_stream'] = false;
  }
  return video;
};

module.exports = {
  convertRecordVideo,
  convertUploadVideo,
  getConvertStatus,
  getDuration,
  generateThumbnail,
  removeVideos,
  getVideoPublicUrl,
};
