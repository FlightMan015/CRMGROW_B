const PhoneLog = require('../models/phone_log');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const ActivityHelper = require('../helpers/activity');
const { DIALER } = require('../config/api');
const request = require('request-promise');
const User = require('../models/user');
const Notification = require('../models/notification');

const loadCustomer = async (req, res) => {
  const { currentUser } = req;

  var options = {
    method: 'GET',
    url: 'https://app.stormapp.com/api/customers/' + currentUser._id,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: DIALER.VENDOR_ID,
      password: DIALER.API_KEY,
    },
    json: true,
  };

  request(options, function (error, response, data) {
    if (error) throw new Error(error);

    return res.send({
      status: true,
      data,
    });
  });
};

const get = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.params;
  const data = await PhoneLog.find({ user: currentUser.id, contact });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Phone log doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const logs = req.body;
  let detail_content = 'called';
  if (req.guest_loggin) {
    detail_content = ActivityHelper.assistantLog(detail_content);
  }

  // Checking the Deal Call
  let shared_log_id;
  if (logs[0]['deal']) {
    const dealId = logs[0]['deal'];
    const uuid = logs[0]['uuid'];
    // Check if there is saved deal log with the uuid
    const shared_log = await PhoneLog.findOne({ deal: dealId, uuid }).catch(
      (err) => {
        console.log('Failed: Getting the shared log with uuid', err);
      }
    );
    // If there is no one with uuid, create the deal phone call log
    if (shared_log) {
      shared_log_id = shared_log._id;
    } else {
      const dealPhoneLog = new PhoneLog({
        user: currentUser.id,
        deal: dealId,
        uuid,
        updated_at: new Date(),
        created_at: new Date(),
      });
      dealPhoneLog.save().catch((err) => {
        console.log('Failed: deal phone log saving', err);
      });
      const dealPhoneActivity = new Activity({
        content: detail_content,
        deals: dealId,
        user: currentUser.id,
        type: 'phone_logs',
        phone_logs: dealPhoneLog.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
      dealPhoneActivity.save().catch((err) => {
        console.log('Failed: Deal Phone Activity Saving', err);
      });
      shared_log_id = dealPhoneLog._id;
    }
  }

  logs.forEach(async (log) => {
    let duration = 0;
    if (log.recordingId) {
      const recordingData = await getRecording(
        currentUser._id,
        log.recordingId
      );
      if (recordingData && recordingData.seconds) {
        duration = recordingData.seconds;
      }
    }

    const phoneLogObject = {
      content: log.content,
      contact: log.contactId,
      status: log.outcome,
      human: log.human,
      rating: log.rating,
      label: log.label,
      duration: log.duration,
      answered: log.answered,
      recording: log.recordingId,
      recording_duration: duration,
      voicemail: log.voicemailId,
      user: currentUser.id,
      updated_at: new Date(),
      created_at: new Date(),
    };
    if (shared_log_id) {
      phoneLogObject['has_shared'] = true;
      phoneLogObject['shared_log'] = shared_log_id;
    }

    const phone_log = new PhoneLog(phoneLogObject);
    phone_log
      .save()
      .then((_phone_log) => {
        const activity = new Activity({
          content: detail_content,
          contacts: _phone_log.contact,
          user: currentUser.id,
          type: 'phone_logs',
          phone_logs: _phone_log.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        activity.save().then((_activity) => {
          Contact.updateOne(
            { _id: _phone_log.contact },
            {
              $set: { last_activity: _activity.id },
            }
          ).catch((err) => {
            console.log('err', err);
          });
          const myJSON = JSON.stringify(_phone_log);
          const data = JSON.parse(myJSON);
          data.activity = _activity;
        });
      })
      .catch((e) => {
        let errors;
        if (e.errors) {
          errors = e.errors.map((err) => {
            delete err.instance;
            return err;
          });
        }
      });
  });

  return res.send({
    status: true,
  });
};

const loadRecording = (req, res) => {
  const { currentUser } = req;
  const { recording } = req.body;
  var options = {
    method: 'GET',
    url:
      'https://app.stormapp.com/api/customers/' +
      currentUser._id +
      '/recordings/' +
      recording,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: DIALER.VENDOR_ID,
      password: DIALER.API_KEY,
    },
    json: true,
  };

  request(options, function (error, response, data) {
    if (error) throw new Error(error);

    return res.send({
      status: true,
      data,
    });
  });
};

const getRecording = (user_id, recording) => {
  return new Promise((resolve, reject) => {
    var options = {
      method: 'GET',
      url:
        'https://app.stormapp.com/api/customers/' +
        user_id +
        '/recordings/' +
        recording,
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        user: DIALER.VENDOR_ID,
        password: DIALER.API_KEY,
      },
      json: true,
    };

    request(options, function (error, response, data) {
      if (error) {
        reject(new Error(error));
      }
      resolve(data);
    });
  });
};

const edit = (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;
  const { content, rating, label } = req.body;

  PhoneLog.updateOne(
    { _id: id, user: currentUser._id },
    { $set: { content, rating, label } }
  )
    .then((_res) => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('phone log updating is failed.', err);
      return res.status(400).send({
        status: false,
      });
    });
};

const handleEvent = (req, res) => {
  const { type, payload } = req.body;
  if (type === 'CUSTOMER_CREATED_EVENT') {
    const { id, subscriptions } = payload;
    let level = '';
    if (subscriptions) {
      if (subscriptions.previewLine) {
        level = 'PREV';
      } else if (subscriptions.single) {
        level = 'SINGLE';
      } else if (subscriptions.multi) {
        level = 'MULTI';
      }
    }
    User.updateOne(
      { _id: id },
      { $set: { dialer_info: { is_enabled: true, level } } }
    );
    res.send({
      status: true,
      data: { type, payload },
    });
  }
};

const saveDealCall = (req, res) => {
  const { currentUser } = req;

  const data = req.body;
  const { contact, detail, content, status, deal, uuid } = data;

  // update the saved deal phone call log with content and
  PhoneLog.updateOne(
    { deal, uuid },
    { $set: { content, label: status, assigned_contacts: contact } }
  ).catch((err) => {
    console.log('Failed: Update the deal share log with content', err);
  });

  const newNotification = new Notification({
    ...req.body,
    user: currentUser._id,
  });
  newNotification.save().then((_newNotification) => {
    return res.send({
      status: true,
      data: _newNotification,
    });
  });
};

/**
 * Create Ringless Message
 * @param {*} req: Request - ringless formdata
 * @param {*} res: Response
 */
const createRingless = (req, res) => {
  const { currentUser, files } = req;
  const data = req.body;
  const { buffer, originalname: filename, mimetype } = files[0];
  var options = {
    method: 'POST',
    url: `https://api.wavv.com/v2/users/${currentUser._id}/rvm/messages`,
    auth: {
      user: DIALER.VENDOR_ID,
      password: DIALER.API_KEY,
    },
    formData: {
      name: data.name,
      file: {
        value: buffer,
        options: {
          filename,
          contentType: mimetype,
        },
      },
    },
  };

  request(options, function (error, response, data) {
    if (error) throw new Error(error);

    return res.send({
      status: true,
      data,
    });
  });
};

/**
 * Load all Ringless Messages
 * @param {*} req: Request
 * @param {*} res: Response
 */
const loadRingless = (req, res) => {
  const { currentUser } = req;
  var options = {
    method: 'GET',
    url: `https://api.wavv.com/v2/users/${currentUser._id}/rvm/messages`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: DIALER.VENDOR_ID,
      password: DIALER.API_KEY,
    },
    json: true,
  };

  request(options, function (error, response, data) {
    if (error) throw new Error(error);

    return res.send({
      status: true,
      data,
    });
  });
};

/**
 * Send Ringless Message
 * @param {*} req: Request
 * @param {*} res: Response
 */
const sendRingless = (req, res) => {
  const { currentUser } = req;
  const data = req.body;
  var options = {
    method: 'POST',
    url: `https://api.wavv.com/v2/users/${currentUser._id}/rvm/drops`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: DIALER.VENDOR_ID,
      password: DIALER.API_KEY,
    },
    body: data,
    json: true,
  };

  request(options, function (error, response, data) {
    if (error) throw new Error(error);

    return res.send({
      status: true,
      data,
    });
  });
};

module.exports = {
  get,
  create,
  loadRecording,
  edit,
  loadCustomer,
  handleEvent,
  saveDealCall,
  createRVM: createRingless,
  loadRVM: loadRingless,
  sendRVM: sendRingless,
};
