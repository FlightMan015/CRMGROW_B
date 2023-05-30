const phone = require('phone');
const mongoose = require('mongoose');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const Garbage = require('../models/garbage');
const Automation = require('../models/automation');
const Label = require('../models/label');
const EmailTemplate = require('../models/email_template');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const LabelHelper = require('../helpers/label');
const garbageHelper = require('../helpers/garbage');
const { sendEmail } = require('../helpers/email');

const system_settings = require('../config/system_settings');
const jwt = require('jsonwebtoken');
const api = require('../config/api');

const addContact = async (req, res) => {
  const { currentUser } = req;
  const { label, cell_phone } = req.body;
  let max_upload_count = 0;
  let count = 0;

  const contact_info = currentUser.contact_info;
  if (contact_info['is_limit']) {
    count = await Contact.countDocuments({ user: currentUser.id });
    max_upload_count =
      contact_info.max_count || system_settings.CONTACT_UPLOAD_LIMIT.LITE;
  }

  if (contact_info['is_limit'] && max_upload_count < count) {
    return res.status(412).send({
      status: false,
      error: 'You are exceed for max contacts',
    });
  }

  if (cell_phone) {
    req.body.cell_phone = phone(cell_phone)[0];
  } else {
    delete req.body.cell_phone;
  }

  const contact = new Contact({
    ...req.body,
    user: currentUser.id,
  });

  contact
    .save()
    .then((_contact) => {
      const detail_content = 'added contact';

      const activity = new Activity({
        content: detail_content,
        contacts: _contact.id,
        user: currentUser.id,
        type: 'contacts',
      });

      activity.save().then((_activity) => {
        _contact['last_activity'] = _activity.id;
        _contact.save().catch((err) => {
          console.log('contact save err', err.message);
        });

        return res.send({
          status: true,
          data: {
            ..._contact,
            label,
          },
        });
      });
    })
    .catch((err) => {
      console.log('contact save error', err.message);
      return res.send({
        status: false,
        error: 'Internal server error',
      });
    });
};

const getContact = (req, res) => {
  const { currentUser } = req;
  Contact.findOne({
    _id: req.body.id,
    user: currentUser.id,
  })
    .then((contact) => {
      if (contact) {
        return res.send({
          status: true,
          data: contact,
        });
      } else {
        return res.send({
          status: false,
          error: 'Invalid permission',
        });
      }
    })
    .catch((err) => {
      console.log('get contact error', err.message);
      return res.send({
        status: false,
        error: 'Internal server error',
      });
    });
};

const createToken = (req, res) => {
  const { currentUser } = req;
  const token = jwt.sign(
    { id: currentUser.id, api_loggin: true },
    api.JWT_SECRET
  );
  Garbage.updateOne(
    { user: currentUser.id },
    {
      $set: { access_token: token },
    }
  ).catch((err) => {
    console.log('get contact error', err.message);
  });
  return res.send({
    status: true,
    token,
  });
};

const getAutomations = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const automations = await Automation.aggregate([
    {
      $match: {
        $or: [
          { user: mongoose.Types.ObjectId(currentUser.id), del: false },
          {
            role: 'admin',
            company,
            del: false,
          },
          {
            shared_members: currentUser.id,
          },
        ],
      },
    },
    {
      $project: {
        _id: false,
        id: '$_id',
        title: true,
      },
    },
  ]);

  return res.send(automations);
};

const getEmailTemplates = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const email_templates = await EmailTemplate.aggregate([
    {
      $match: {
        $or: [
          { user: mongoose.Types.ObjectId(currentUser.id) },
          {
            role: 'admin',
            company,
          },
          {
            shared_members: currentUser.id,
          },
        ],
      },
    },
    {
      $project: {
        _id: false,
        id: '$_id',
        title: true,
      },
    },
  ]);

  return res.send(email_templates);
};

const getVideos = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const videos = await Video.aggregate([
    {
      $match: {
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
      },
    },
    {
      $project: {
        _id: false,
        id: '$_id',
        title: true,
      },
    },
  ]);

  return res.send(videos);
};

const getPdfs = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const pdfs = await PDF.aggregate([
    {
      $match: {
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
      },
    },
    {
      $project: {
        _id: false,
        id: '$_id',
        title: true,
      },
    },
  ]);

  return res.send(pdfs);
};

const getImages = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const images = await Image.aggregate([
    {
      $match: {
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
      },
    },
    {
      $project: {
        _id: false,
        id: '$_id',
        title: true,
      },
    },
  ]);

  return res.send(images);
};

const getLabels = async (req, res) => {
  const { currentUser } = req;
  const garbage = await garbageHelper.get(currentUser);

  if (!garbage) {
    return res.status(400).send({
      status: false,
      error: `Couldn't get the Garbage`,
    });
  }

  let editedLabels = [];
  if (garbage && garbage['edited_label']) {
    editedLabels = garbage['edited_label'];
  }

  // const company = currentUser.company || 'eXp Realty';
  const labels = await Label.aggregate([
    {
      $match: {
        $or: [
          { user: mongoose.Types.ObjectId(currentUser.id) },
          {
            role: 'admin',
            _id: { $nin: editedLabels },
          },
        ],
      },
    },
    {
      $project: {
        _id: false,
        id: '$_id',
        name: true,
      },
    },
  ]);

  res.send(labels);
};

const searchContact = async (req, res, next) => {
  const { currentUser } = req;
  let contact;
  const nameMatch = req.body.email.match(/^([^@]*)@/);
  if (!nameMatch) {
    return res.status(400).send({
      status: false,
      error: 'Invalid email address',
    });
  }
  contact = await Contact.findOne({
    email: req.body.email,
    user: currentUser.id,
  }).catch((err) => {
    console.log('contact find err', err.message);
    return res.send('contact find err');
  });
  if (!contact) {
    const name = nameMatch ? nameMatch[1] : req.body.email;
    contact = new Contact({
      email: req.body.email,
      first_name: name,
    });
    contact.save().catch((err) => {
      console.log('new contact save err', err.message);
    });
  }

  req.body.contact = contact.id;
  req.body.contacts = [contact.id];
  req.params.id = contact.id;

  next();
};

const addNewTag = async (req, res) => {
  const { email, tag } = req.body;
  Contact.updateOne(
    { email },
    {
      $push: { tags: { $each: [tag] } },
    }
  ).catch((err) => {
    console.log('err', err);
  });
  return res.send({
    status: true,
  });
};

const sendVideo = async (req, res) => {
  const { currentUser } = req;
  const { template_id, video_id, contacts } = req.body;
  const email_template = await EmailTemplate.findOne({
    _id: template_id,
  });

  const { content, subject } = email_template;

  const data = {
    user: currentUser.id,
    content,
    subject,
    video_ids: [video_id],
    contacts,
  };

  sendEmail(data)
    .then((result) => {
      if (result[0] && result[0].status === true) {
        return res.send({
          status: true,
        });
      } else {
        return res.status(400).send({
          status: false,
          error: 'Send error',
        });
      }
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const sendPdf = async (req, res) => {
  const { currentUser } = req;
  const { template_id, pdf_id, contacts } = req.body;
  const email_template = await EmailTemplate.findOne({
    _id: template_id,
  });

  const { content, subject } = email_template;

  const data = {
    user: currentUser.id,
    content,
    subject,
    pdf_ids: [pdf_id],
    contacts,
  };

  sendEmail(data)
    .then((result) => {
      if (result[0] && result[0].status === true) {
        return res.send({
          status: true,
        });
      } else {
        return res.status(400).send({
          status: false,
          error: 'Send error',
        });
      }
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const sendImage = async (req, res) => {
  const { currentUser } = req;
  const { template_id, image_id, contacts } = req.body;
  const email_template = await EmailTemplate.findOne({
    _id: template_id,
  });

  const { content, subject } = email_template;
  const data = {
    user: currentUser.id,
    content,
    subject,
    image_ids: [image_id],
    contacts,
  };

  sendEmail(data)
    .then((result) => {
      if (result[0] && result[0].status === true) {
        return res.send({
          status: true,
        });
      } else {
        return res.status(400).send({
          status: false,
          error: 'Send error',
        });
      }
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

module.exports = {
  createToken,
  getContact,
  addContact,
  addNewTag,
  getAutomations,
  getEmailTemplates,
  getLabels,
  getVideos,
  getPdfs,
  getImages,
  sendVideo,
  sendPdf,
  sendImage,
  searchContact,
};
