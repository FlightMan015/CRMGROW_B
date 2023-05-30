const sgMail = require('@sendgrid/mail');
const webpush = require('web-push');
const User = require('../models/user');
const Contact = require('../models/contact');
const PDFTracker = require('../models/pdf_tracker');
const PDF = require('../models/pdf');
const Activity = require('../models/activity');
const urls = require('../constants/urls');
const mail_contents = require('../constants/mail_contents');
const api = require('../config/api');

const get = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.params;
  const data = await PDFTracker.find({
    user: currentUser.id,
    contact,
  });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'PDF log doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (data) => {
  const pdf_tracker = new PDFTracker({
    ...data,
    updated_at: new Date(),
    created_at: new Date(),
  });
  const pdf = await pdf_tracker.save();
  return pdf;
};

const createbyDesktop = async (req, res) => {
  const query = { ...req.query };

  const pdf_tracker = new PDFTracker({
    ...query,
    updated_at: new Date(),
    created_at: new Date(),
  });
  const currentUser = await User.findOne({ _id: query.user });
  const contact = await Contact.findOne({ _id: query.contact });
  const pdf = await PDF.findOne({ _id: query.pdf });

  const d = query.duration / 1000;
  let h = Math.floor(d / 3600);
  let m = Math.floor((d % 3600) / 60);
  let s = Math.floor((d % 3600) % 60);

  if (h < 10) {
    h = `0${h}`;
  }
  if (m < 10) {
    m = `0${m}`;
  }
  if (s < 10) {
    s = `0${s}`;
  }
  const timeWatched = `${h}:${m}:${s}`;

  const tD = Math.floor(pdf.duration / 1000);
  let tH = Math.floor(tD / 3600);
  let tM = Math.floor((tD % 3600) / 60);
  let tS = Math.floor((tD % 3600) % 60);

  if (tH < 10) {
    tH = `0${tH}`;
  }
  if (tM < 10) {
    tM = `0${tM}`;
  }
  if (tS < 10) {
    tS = `0${tS}`;
  }

  const timeTotal = `${tH}:${tM}:${tS}`;

  // send desktop notification
  // send email notification

  pdf_tracker.save().then((_pdf_tracker) => {
    const activity = new Activity({
      content: `${contact.first_name} watched pdf`,
      contacts: _pdf_tracker.contact,
      user: currentUser.id,
      type: 'pdf_trackers',
      pdf_trackers: _pdf_tracker.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    activity
      .save()
      .then((_activity) => {
        Contact.updateOne(
          { _id: query.contact },
          {
            $set: { last_activity: _activity.id },
          }
        ).catch((err) => {
          console.log('err', err);
        });
      })
      .catch((err) => {
        console.log('err', err);
      });
  });
};

const disconnect = async (pdf_tracker_id) => {
  const query = await PDFTracker.findOne({ _id: pdf_tracker_id });
  const currentUser = await User.findOne({ _id: query.user });
  const contact = await Contact.findOne({ _id: query.contact });
  const pdf = await PDF.findOne({ _id: query.pdf });

  const d = query.duration / 1000;
  let h = Math.floor(d / 3600);
  let m = Math.floor((d % 3600) / 60);
  let s = Math.floor((d % 3600) % 60);

  if (h < 10) {
    h = `0${h}`;
  }
  if (m < 10) {
    m = `0${m}`;
  }
  if (s < 10) {
    s = `0${s}`;
  }
  const timeWatched = `${h}:${m}:${s}`;

  const tD = Math.floor(pdf.duration / 1000);
  let tH = Math.floor(tD / 3600);
  let tM = Math.floor((tD % 3600) / 60);
  let tS = Math.floor((tD % 3600) % 60);

  if (tH < 10) {
    tH = `0${tH}`;
  }
  if (tM < 10) {
    tM = `0${tM}`;
  }
  if (tS < 10) {
    tS = `0${tS}`;
  }

  const timeTotal = `${tH}:${tM}:${tS}`;

  // send desktop notification
  // send email notification

  const activity = new Activity({
    content: `${contact.first_name} watched pdf`,
    contacts: query.contact,
    user: currentUser.id,
    type: 'pdf_trackers',
    pdf_trackers: query.id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  activity.save().then((_activity) => {
    Contact.updateOne(
      { _id: query.contact },
      {
        $set: { last_activity: _activity.id },
      }
    ).catch((err) => {
      console.log('err', err);
    });
    const myJSON = JSON.stringify(query);
    const data = JSON.parse(myJSON);
    data.activity = _activity;
  });
};

const update = async (duration, pdf_tracker_id) => {
  const pdf_tracker = await PDFTracker.findOne({ _id: pdf_tracker_id });
  pdf_tracker.duration = duration;
  pdf_tracker.updated_at = new Date();
  await pdf_tracker.save();
};

const setup = (io) => {
  console.info('Setup Socket.io:');
  io.sockets.on('connection', (socket) => {
    socket.emit('connected');
    socket.on('init', (data) => {
      create(data).then((_pdf_tracker) => {
        console.log('connection', _pdf_tracker._id);
        socket.pdf_tracker = _pdf_tracker;
      });
    });

    socket.on('update', (duration) => {
      const { pdf_tracker } = socket;
      update(duration, pdf_tracker._id);
    });

    socket.on('disconnecting', () => {
      const { pdf_tracker } = socket;
      console.log('pdf_tracker is canceling', pdf_tracker._id);
      disconnect(pdf_tracker);
    });
    // auth(socket)
  });
};

module.exports = {
  get,
  createbyDesktop,
  setup,
};
