const uuidv1 = require('uuid/v1');
const moment = require('moment-timezone');
const Task = require('../models/task');
const Notification = require('../models/notification');
const system_settings = require('../config/system_settings');
const { createCronNotification } = require('../helpers/notificationImpl');
// const { createFollowup } = require('../helpers/followup');

const get = async (req, res) => {
  const { currentUser } = req;

  const data = await Task.find({ user: currentUser.id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Task doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const task = new Task({
    ...req.body,
    source: 'schedule',
    user: currentUser.id,
  });

  task.save().catch((err) => {
    return res.status(400).send({
      status: false,
      error: err.message,
    });
  });

  return res.send({
    status: true,
  });
};

const bulkCreate = async (req, res) => {
  const { currentUser } = req;
  const { contacts: inputContacts, data } = req.body;

  data['source'] = 'schedule';
  // let type;
  // let followup_data;
  // let required_followup = false;

  const STANDARD_CHUNK = 8;
  const CHUNK_COUNT = 12;
  const MIN_CHUNK = 5;
  const TIME_GAPS = [1, 2, 3];
  const taskProcessId = new Date().getTime() + uuidv1();
  let chunk;

  if (data.type === 'send_email') {
    // type = 'email';
    // required_followup = true;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    if (!currentUser.primary_connected) {
      return res.status(406).json({
        status: false,
        error: 'no connected',
      });
    }

    if (inputContacts.length > max_email_count) {
      return res.status(400).json({
        status: false,
        error: 'Email max limited',
      });
    }
  } else if (data.type === 'send_text') {
    // type = 'text';
    // required_followup = true;
    if (inputContacts.length > system_settings.TEXT_ONE_TIME) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.TEXT_ONE_TIME} contacts at a time`,
      });
    }

    if (!currentUser['twilio_number']) {
      return res.status(408).json({
        status: false,
        error: 'No phone',
      });
    }
  }

  let contacts = [...inputContacts];
  let contactsToTemp = [];

  let LIMIT_CHUNK = STANDARD_CHUNK;
  if (
    data.type === 'send_email' &&
    currentUser.connected_email_type === 'smtp' &&
    currentUser.primary_connected
  ) {
    LIMIT_CHUNK = inputContacts.length;
  }

  if (inputContacts.length > LIMIT_CHUNK) {
    contactsToTemp = contacts.slice(STANDARD_CHUNK);
    contacts = contacts.slice(0, STANDARD_CHUNK);
    const task = new Task({
      ...data,
      user: currentUser.id,
      due_date: data.due_date,
      process: taskProcessId,
      contacts,
      status: 'active',
    });

    task.save().catch((err) => {
      console.log('campaign job save err', err.message);
    });

    // if (required_followup) {
    //   followup_data = {
    //     task: task.id,
    //     user: currentUser.id,
    //     contacts: inputContacts,
    //     type,
    //     content: data.action.subject,
    //     due_date: data.due_date,
    //     set_recurrence: data.set_recurrence,
    //     recurrence_mode: data.recurrence_mode,
    //   };
    //   createFollowup(followup_data);
    // }

    let taskIndex = 0;
    let delay = 1;
    while (taskIndex < contactsToTemp.length) {
      const due_date = moment(data.due_date).add(delay, 'minutes');
      chunk = Math.floor(Math.random() * (CHUNK_COUNT - MIN_CHUNK)) + MIN_CHUNK;
      const task = new Task({
        ...data,
        user: currentUser.id,
        due_date,
        process: taskProcessId,
        contacts: contactsToTemp.slice(taskIndex, taskIndex + chunk),
        status: 'active',
      });

      task.save().catch((err) => {
        console.log('campaign job save err', err.message);
      });

      // if (required_followup) {
      //   followup_data = {
      //     task: task.id,
      //     user: currentUser.id,
      //     contacts: inputContacts,
      //     type,
      //     content: data.action.subject,
      //     due_date: data.due_date,
      //     set_recurrence: data.set_recurrence,
      //     recurrence_mode: data.recurrence_mode,
      //   };
      //   createFollowup(followup_data);
      // }

      taskIndex += chunk;
      const timeIndex = Math.floor(Math.random() * TIME_GAPS.length);
      delay += TIME_GAPS[timeIndex];
    }
  } else {
    const task = new Task({
      ...data,
      user: currentUser.id,
      process: taskProcessId,
      contacts: inputContacts,
      status: 'active',
    });
    task.save().catch((err) => {
      console.log('campaign job save err', err.message);
    });

    // if (required_followup) {
    //   followup_data = {
    //     task: task.id,
    //     user: currentUser.id,
    //     contacts: inputContacts,
    //     type,
    //     content: data.action.subject,
    //     due_date: data.due_date,
    //     set_recurrence: data.set_recurrence,
    //     recurrence_mode: data.recurrence_mode,
    //   };
    //   createFollowup(followup_data);
    // }
  }

  if (data.type === 'send_email') {
    createCronNotification(
      'bulk_email',
      {
        process: taskProcessId,
      },
      { _id: currentUser.id }
    );

    // Notification for the bulk email create
    const notification = new Notification({
      user: currentUser._id,
      type: 'personal',
      criteria: 'bulk_email',
      status: 'pending',
      process: taskProcessId,
      contact: [...inputContacts],
      detail: {
        video_ids: data.video_ids || [],
        pdf_ids: data.video_ids || [],
        image_ids: data.video_ids || [],
        content: data.content,
        subject: data.subject,
      },
      deliver_status: {
        succeed: [],
        failed: [],
        not_executed: [],
      },
    });
    notification.save().catch((err) => {
      console.log('Bulk Email notification creation is failed.', err);
    });
  } else if (data.type === 'send_text') {
    createCronNotification(
      'bulk_text',
      {
        process: taskProcessId,
      },
      { _id: currentUser.id }
    );

    // Notification for the bulk email create
    const notification = new Notification({
      user: currentUser._id,
      type: 'personal',
      criteria: 'bulk_sms',
      status: 'pending',
      process: taskProcessId,
      contact: [...inputContacts],
      detail: {
        video_ids: data.video_ids || [],
        pdf_ids: data.video_ids || [],
        image_ids: data.video_ids || [],
        content: data.content,
      },
      deliver_status: {
        succeed: [],
        failed: [],
        not_executed: [],
      },
    });

    notification.save().catch((err) => {
      console.log('Bulk Email notification creation is failed.', err);
    });
  }

  return res.send({
    status: true,
    message: 'all_queue',
  });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;

  Task.deleteOne({ user: currentUser._id, _id: id }).catch((err) => {
    console.log('task remove err', err.message);
  });

  return res.send({
    status: true,
  });
};

const update = async (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;
  const data = req.body;

  Task.updateOne({ user: currentUser._id, _id: id }, { $set: data }).catch(
    (err) => {
      console.log('task update err', err.message);
    }
  );

  return res.send({
    status: true,
  });
};

/**
 * Check the mass contacts task: This is called when change the primary email
 * @param {*} req
 * @param {*} res
 */
const getMassTasks = async (req, res) => {
  const { currentUser } = req;

  Task.find({ 'contacts.15': { $exists: true }, user: currentUser._id })
    .select({
      process: true,
      'action.subject': true,
    })
    .then((_tasks) => {
      return res.send({
        status: true,
        data: _tasks,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || err,
      });
    });
};

module.exports = {
  get,
  create,
  bulkCreate,
  remove,
  update,
  getMassTasks,
};
