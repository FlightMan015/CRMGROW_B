const path = require('path');
const mime = require('mime-types');
const fs = require('fs');
const sharp = require('sharp');
const AWS = require('aws-sdk');

const { FILES_PATH } = require('../config/path');
const api = require('../config/api');
const system_settings = require('../config/system_settings');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const File = require('../models/file');
const Garbage = require('../models/garbage');
const { uploadBase64Image, removeFile } = require('../helpers/fileUpload');
const urls = require('../constants/urls');

const create = async (req, res) => {
  if (req.file) {
    const file_name = req.file.filename;
    if (fs.existsSync(FILES_PATH + file_name)) {
      sharp(FILES_PATH + file_name)
        .resize(100, 100)
        .toBuffer()
        .then((data) => {
          console.log('data', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'profile' + year + '/' + month + '/' + file_name + '-resize',
            Body: data,
            ACL: 'public-read',
          };

          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) {
              console.log('upload s3 error', s3Err);
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`);
            }
          });
        });

      fs.readFile(FILES_PATH + req.file.filename, (err, data) => {
        if (err) {
          console.log('file read err', err);
          return res.status(400).send({
            status: false,
            error: 'file read error',
          });
        } else {
          console.log('File read was successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'profile' + year + '/' + month + '/' + file_name,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) {
              console.log('upload s3 error', s3Err);
              return res.status(400).send({
                status: false,
                error: 'file upload s3 error',
              });
            } else {
              return res.send({
                status: true,
                data: {
                  url: upload.Location,
                },
              });
            }
          });
        }
      });
    }
  }
};

const get = (req, res) => {
  const filePath = FILES_PATH + req.params.name;

  if (fs.existsSync(filePath)) {
    if (req.query.resize) {
      const readStream = fs.createReadStream(filePath);
      let transform = sharp();
      transform = transform.resize(100, 100);
      return readStream.pipe(transform).pipe(res);
    } else {
      const contentType = mime.contentType(path.extname(req.params.name));
      res.set('Content-Type', contentType);
      return res.sendFile(filePath);
    }
  } else {
    res.status(404).send({
      status: false,
      error: 'File does not exist',
    });
  }
};

const remove = async (req, res) => {
  const { currentUser } = req;
  try {
    const file = File.findOne({ user: currentUser.id, name: req.params.id });

    if (file) {
      fs.unlinkSync(FILES_PATH + req.params.id);
      res.send({
        status: true,
        data: {
          file_name: req.params.id,
        },
      });
    } else {
      res.status(404).send({
        status: false,
        error: 'file_not_found',
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

const upload = async (req, res) => {
  if (req.file) {
    const file_name = req.file.filename;
    if (fs.existsSync(FILES_PATH + file_name)) {
      sharp(FILES_PATH + file_name)
        .resize(100, 100)
        .toBuffer()
        .then((data) => {
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'profile' + year + '/' + month + '/' + file_name + '-resize',
            Body: data,
            ACL: 'public-read',
          };

          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) {
              console.log('upload s3 error', s3Err);
              return res.status(400).json({
                status: false,
                error: 'file upload s3 error',
              });
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`);
            }
          });
        })
        .catch((err) => {
          console.log('resize file generate error', err);
          return res.status(400).send({
            status: false,
            error: 'resize file error',
          });
        });
    }

    if (fs.existsSync(FILES_PATH + file_name)) {
      fs.readFile(FILES_PATH + req.file.filename, (err, data) => {
        if (err) {
          console.log('file read err', err);
          return res.status(400).send({
            status: false,
            error: 'file read error',
          });
        } else {
          console.log('File read was successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'profile' + year + '/' + month + '/' + file_name,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) {
              console.log('upload s3 error', s3Err);
              return res.status(400).send({
                status: false,
                error: 'file upload s3 error',
              });
            } else {
              return res.send({
                status: true,
                url: upload.Location,
              });
            }
          });
        }
      });
    }
  }
};

const uploadBase64 = async (req, res) => {
  const { currentUser } = req;
  const { data } = req.body;

  const garbage = await Garbage.findOne({ user: currentUser._id }).catch(
    (err) => {
      console.log('Error', err);
    }
  );

  if (garbage) {
    if (garbage['logo']) {
      await removeFile(garbage['logo']);
    }
    const logo = await uploadBase64Image(data);
    garbage['logo'] = logo;

    Garbage.updateOne({ user: currentUser._id }, { $set: { logo } }).then(
      (data) => {
        return res.send({
          status: true,
          data: logo,
        });
      }
    );
  } else {
    const logo = await uploadBase64Image(data);

    const newGarbage = new Garbage({
      user: currentUser._id,
      logo,
    });
    newGarbage.save().then((data) => {
      return res.send({
        status: true,
        data: logo,
      });
    });
  }
};

const loadAll = async (req, res) => {
  File.find({}).then((data) => {
    return res.send({
      data,
    });
  });
};

module.exports = {
  create,
  get,
  upload,
  remove,
  uploadBase64,
  loadAll,
};
