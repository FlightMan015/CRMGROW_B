const uuid = require('uuid');
const AWS = require('aws-sdk');
const api = require('../config/api');

AWS.config.update({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});
var s3 = new AWS.S3();

exports.uploadBase64Image = async (base64, dest = '') => {
  const base64Data = new Buffer.from(
    base64.replace(/^data:image\/\w+;base64,/, ''),
    'base64'
  );
  const fileType = base64.split(';')[0].split('/')[1];
  const fileName = uuid();
  const today = new Date();
  const year = today.getYear();
  const month = today.getMonth();
  var fileParam = {
    Bucket: api.AWS.AWS_S3_BUCKET_NAME,
    Key: `${
      dest ? dest + year + '/' + month + '/' : ''
    }${fileName}.${fileType}`,
    Body: base64Data,
    ContentEncoding: 'base64',
    ACL: 'public-read',
    ContentType: `image/${fileType}`,
  };
  try {
    const { Location, Key } = await s3.upload(fileParam).promise();
    return Location;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

exports.uploadFile = async (data, fileType, dest = '') => {
  const fileName = uuid();
  const today = new Date();
  const year = today.getYear();
  const month = today.getMonth();
  var fileParam = {
    Bucket: api.AWS.AWS_S3_BUCKET_NAME,
    Key: `${
      dest ? dest + year + '/' + month + '/' : ''
    }${fileName}.${fileType}`,
    Body: data,
    ACL: 'public-read',
  };
  try {
    const { Location, Key } = await s3.upload(fileParam).promise();
    return Location;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

exports.removeFile = async (originalFile) => {
  try {
    const removeParam = {
      Bucket: api.AWS.AWS_S3_BUCKET_NAME,
      Key: originalFile,
    };
    await s3.deleteObject(removeParam).promise();
  } catch (error) {
    console.log(error);
    throw error;
  }
};

exports.downloadFile = async (originalFile) => {
  return new Promise((resolve, reject) => {
    const removeParam = {
      Bucket: api.AWS.AWS_S3_BUCKET_NAME,
      Key: originalFile,
    };

    s3.getObject(removeParam, function (err, data) {
      if (err) {
        reject(err);
      } else {
        console.log('Successfully dowloaded data from  bucket');
        resolve(data);
      }
    });
  });
};
