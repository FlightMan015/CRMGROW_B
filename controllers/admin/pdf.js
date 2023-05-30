const path = require('path');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');
const base64Img = require('base64-img');
const mime = require('mime-types');

const AWS = require('aws-sdk');
const uuidv1 = require('uuid/v1');
const mongoose = require('mongoose');
const urls = require('../../constants/urls');
const User = require('../../models/user');
const Activity = require('../../models/activity');
const PDF = require('../../models/pdf');
const PDFTracker = require('../../models/pdf_tracker');
const { FILES_PATH, PREVIEW_PATH } = require('../../config/path');
const api = require('../../config/api');
const { uploadBase64Image, removeFile } = require('../../helpers/fileUpload');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const create = async (req, res) => {
  if (req.file) {
    if (req.currentUser) {
      const pdf = new PDF({
        type: req.file.mimetype,
        url: req.file.location,
        role: 'admin',
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
  if (req.body.preview) {
    // base 64 image
    const editData = { ...req.body };
    delete editData.preview;
    const pdf = await PDF.findOne({ _id: req.params.id });

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

    pdf.updated_at = new Date();

    pdf.save().then((_pdf) => {
      return res.send({
        status: true,
        data: _pdf,
      });
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Not_found_preview',
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
    const contentType = mime.contentType(path.extname(filePath));
    res.set('Content-Type', contentType);
    res.sendFile(filePath);
  } else {
    res.status(404).send({
      status: false,
      error: 'Preview does not exist',
    });
  }
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const _pdf = PDFTracker.find({ user: currentUser.id });

  if (!_pdf) {
    return res.status(400).json({
      status: false,
      error: 'PDF doesn`t exist',
    });
  }

  const _pdf_list = await PDF.find({ user: currentUser.id });
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
        $match: { pdf: _pdf_list[i]._id },
      },
    ]);

    const myJSON = JSON.stringify(_pdf_list[i]);
    const _pdf = JSON.parse(myJSON);
    const pdf_detail = await Object.assign(_pdf, { views: _pdf_detail.length });
    _pdf_detail_list.push(pdf_detail);
  }

  res.send({
    status: true,
    data: _pdf_detail_list,
  });
};

const sendPDF = async (req, res) => {
  const { currentUser } = req;
  const { email, content, pdf, contact } = req.body;
  sgMail.setApiKey(process.env.SENDGRID_KEY);

  const text = `${content}\n${process.env.TEAMGROW_DOMAIN}/material/view/pdf/?pdf=${pdf}&contact=${contact}&user=${currentUser.id}`;
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
        const activity = new Activity({
          content: `${currentUser.user_name} sent pdf`,
          contacts: contact,
          user: currentUser.id,
          type: 'pdfs',
          pdfs: pdf,
          created_at: new Date(),
          updated_at: new Date(),
        });
        activity.save().then(() => {
          res.send({
            status: true,
          });
        });
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
};

const remove = async (req, res) => {
  try {
    const pdf = await PDF.findOne({ _id: req.params.id }).catch((err) => {
      console.log('err', err);
    });
    const { url } = pdf;

    s3.deleteObject(
      {
        Bucket: api.AWS.AWS_S3_BUCKET_NAME,
        Key: url.slice(44),
      },
      function (err, data) {
        console.log('err', err);
      }
    );

    pdf.del = true;
    pdf.save();

    res.send({
      status: true,
    });
  } catch (e) {
    console.error(e);
    res.status(500).send({
      status: false,
      error: 'internal_server_error',
    });
  }
};

const getPdfs = async (req, res) => {
  const { page } = req.params;
  const skip = (page - 1) * 12;

  const pdfs = await PDF.aggregate([
    { $match: { del: false } },
    { $skip: skip },
    { $limit: 12 },
  ]).catch((err) => {
    console.log('err', err);
  });

  await PDF.populate(pdfs, {
    path: 'user',
    select: 'user_name picture_profile',
  });

  const pdfCounts = await PDF.countDocuments({});

  res.send({
    status: true,
    data: pdfs,
    total: pdfCounts,
  });
};

const getPdfsByUser = async (req, res) => {
  const user = req.params.id;
  const page = parseInt(req.body.page);
  const skip = (page - 1) * 12;

  const pdfs = await PDF.aggregate([
    { $match: { user: mongoose.Types.ObjectId(user), del: false } },
    { $skip: skip },
    { $limit: 12 },
  ]).catch((err) => {
    res.status(500).send({
      status: false,
      error: err,
    });
  });

  const pdfCounts = await PDF.countDocuments({ del: false, user });

  return res.send({
    status: true,
    data: pdfs,
    total: pdfCounts,
  });
};

module.exports = {
  create,
  updateDetail,
  get,
  getPreview,
  getAll,
  sendPDF,
  remove,
  getPdfs,
  getPdfsByUser,
};
