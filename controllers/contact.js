/* eslint-disable eqeqeq */
const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const csv = require('csv-parser');
const webpush = require('web-push');
const phone = require('phone');
const moment = require('moment-timezone');
const Verifier = require('email-verifier');
const AWS = require('aws-sdk');
const _ = require('lodash');

const Contact = require('../models/contact');
const Activity = require('../models/activity');
const FollowUp = require('../models/follow_up');
const Appointment = require('../models/appointment');
const Email = require('../models/email');
const Note = require('../models/note');
const User = require('../models/user');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const TimeLine = require('../models/time_line');
const Automation = require('../models/automation');
const EmailTracker = require('../models/email_tracker');
const Reminder = require('../models/reminder');
const Garbage = require('../models/garbage');
const Image = require('../models/image');
const Text = require('../models/text');
const ImageTracker = require('../models/image_tracker');
const PDFTracker = require('../models/pdf_tracker');
const VideoTracker = require('../models/video_tracker');
const Deal = require('../models/deal');
const DealStage = require('../models/deal_stage');
const Team = require('../models/team');
const Label = require('../models/label');
const Notification = require('../models/notification');
const Task = require('../models/task');
const PhoneLog = require('../models/phone_log');
const Draft = require('../models/draft');
const CampaignJob = require('../models/campaign_job');
const Campaign = require('../models/campaign');
const LabelHelper = require('../helpers/label');
const ActivityHelper = require('../helpers/activity');
const GarbageHelper = require('../helpers/garbage');
const urls = require('../constants/urls');
const api = require('../config/api');
const uuidv1 = require('uuid/v1');
const system_settings = require('../config/system_settings');
const mail_contents = require('../constants/mail_contents');
const { getAvatarName, validateEmail } = require('../helpers/utility');
const { sendNotificationEmail } = require('../helpers/email');
const {
  tagTriggerAutomation,
  assignTimeline,
} = require('../helpers/automation');
const { createNotification } = require('../helpers/notification');

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;

const twilio = require('twilio')(accountSid, authToken);

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const getAll = async (req, res) => {
  const { currentUser } = req;
  const data = await Contact.find({ user: currentUser.id });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Contact doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const getAllByLastActivity = async (req, res) => {
  const { currentUser } = req;
  const data = await Contact.find({ user: currentUser.id })
    .populate('last_activity')
    .sort({ first_name: 1 })
    .catch((err) => {
      console.log('err', err);
    });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Contact doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const getByLastActivity = async (req, res) => {
  const { currentUser } = req;
  let { field, dir } = req.body;
  dir = dir ? 1 : -1;
  const count = req.body.count || 50;
  if (field === 'updated_at') {
    field = 'last_activity';
    dir *= -1;
  } else if (field === 'name') {
    field = 'first_name';
  } else {
    field = 'created_at';
  }

  let contacts;
  if (typeof req.params.id === 'undefined') {
    contacts = await Contact.find({
      $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
    })
      .populate('last_activity')
      .populate('shared_members')
      .collation({ locale: 'en' })
      .sort({ [field]: dir })
      .limit(count);
  } else {
    const id = parseInt(req.params.id);
    contacts = await Contact.find({
      $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
    })
      .populate('last_activity')
      .populate('shared_members')
      .collation({ locale: 'en' })
      .sort({ [field]: dir })
      .skip(id)
      .limit(count);
  }

  if (!contacts) {
    return res.status(400).json({
      status: false,
      error: 'Contacts doesn`t exist',
    });
  }

  const total = await Contact.countDocuments({
    $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
  });

  return res.send({
    status: true,
    data: {
      contacts,
      count: total,
    },
  });
};

const getDetail = async (req, res) => {
  const { currentUser } = req;
  if (req.params.id === 'null' || req.params.id === 'undefined') {
    return res.status(400).json({
      status: false,
      error: 'Invalid Contact',
    });
  }
  const contactId = req.params.id;

  const _contact = await Contact.findOne({
    _id: contactId,
    $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
  }).catch((err) => {
    console.log('contact found err', err.message);
  });

  if (_contact) {
    // TimeLines
    const _timelines = await TimeLine.find({
      user: currentUser.id,
      contact: req.params.id,
      automation: { $ne: null },
    })
      .sort({ due_date: 1 })
      .catch((err) => {
        console.log('err', err);
      });
    let automation = {};
    if (_timelines.length) {
      automation = await Automation.findOne({
        _id: _timelines[0]['automation'],
      })
        .select({ title: 1 })
        .catch((err) => {
          console.log('err', err);
        });
    }

    // Contact Activity List
    const _activity_list = [];

    // Contact Relative Details
    const videoIds = [];
    const imageIds = [];
    const pdfIds = [];
    const materials = [];
    const notes = [];
    const emails = [];
    const texts = [];
    const appointments = [];
    const tasks = [];
    const deals = [];
    const users = [];
    const phone_logs = [];

    const myJSON = JSON.stringify(_contact);
    const contact = JSON.parse(myJSON);
    const data = await Object.assign(
      contact,
      { activity: _activity_list },
      { automation },
      {
        details: {
          materials,
          notes,
          emails,
          texts,
          appointments,
          tasks,
          deals,
          users,
          phone_logs,
        },
      }
    );

    return res.send({
      status: true,
      data,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contact not found',
    });
  }
};

const get = async (req, res) => {
  const { currentUser } = req;
  let { dir } = req.body;
  const { key, index, count } = req.body;

  if (req.params.id === 'null' || req.params.id === 'undefined') {
    return res.status(400).json({
      status: false,
      error: 'Invalid Contact',
    });
  }

  if (key === 'last_activity') {
    dir *= -1;
  }
  let next_contact;
  let prev_contact;

  const _contact = await Contact.findOne({
    _id: req.params.id,
    $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
  }).catch((err) => {
    console.log('contact found err', err.message);
  });

  if (_contact) {
    if (key === 'first_name') {
      next_contact = await Contact.find({
        user: currentUser.id,
      })
        .sort({ [key]: dir })
        .skip(index + 1)
        .limit(1);
      if (index - 1 >= 0) {
        prev_contact = await Contact.find({
          user: currentUser.id,
        })
          .sort({ [key]: dir })
          .skip(index - 1)
          .limit(1);
      }
    } else {
      if (dir === 1) {
        next_contact = await Contact.find({
          [key]: { $gte: _contact[key] },
          user: currentUser.id,
          _id: { $ne: req.params.id },
        })
          .sort({ [key]: 1 })
          .limit(1);
        prev_contact = await Contact.find({
          [key]: { $lte: _contact[key] },
          user: currentUser.id,
          _id: { $ne: req.params.id },
        })
          .sort({ [key]: -1 })
          .limit(1);
      } else {
        next_contact = await Contact.find({
          [key]: { $lte: _contact[key] },
          user: currentUser.id,
          _id: { $ne: req.params.id },
        })
          .sort({ [key]: -1 })
          .limit(1);
        prev_contact = await Contact.find({
          [key]: { $gte: _contact[key] },
          user: currentUser.id,
          _id: { $ne: req.params.id },
        })
          .sort({ [key]: 1 })
          .limit(1);
      }
    }

    let next = null;
    let prev = null;
    if (next_contact && next_contact[0]) {
      next = next_contact[0].id;
    }
    if (prev_contact && prev_contact[0]) {
      prev = prev_contact[0].id;
    }

    // const _follow_up = await FollowUp.find({
    //   user: currentUser.id,
    //   contact: req.params.id,
    //   status: { $ne: -1 },
    // }).sort({ due_date: 1 });

    // const _appointment = await Appointment.find({
    //   user: currentUser.id,
    //   contact: req.params.id,
    //   status: { $ne: -1 },
    // }).sort({ due_date: 1 });

    const _timelines = await TimeLine.find({
      user: currentUser.id,
      contact: req.params.id,
      automation: { $ne: null },
    })
      .sort({ due_date: 1 })
      .catch((err) => {
        console.log('err', err);
      });
    let automation = {};
    if (_timelines.length) {
      automation = await Automation.findOne({
        _id: _timelines[0]['automation'],
      })
        .select({ title: 1 })
        .catch((err) => {
          console.log('err', err);
        });
    }

    let _activity_list;

    if (count) {
      _activity_list = await Activity.find({
        contacts: req.params.id,
        status: { $ne: 'pending' },
      })
        .sort({ updated_at: -1 })
        .limit(count);
    } else {
      _activity_list = await Activity.find({
        contacts: req.params.id,
        status: { $ne: 'pending' },
      }).sort({ updated_at: 1 });
    }

    const _activity_detail_list = [];

    for (let i = 0; i < _activity_list.length; i++) {
      const _activity_detail = await Activity.aggregate([
        {
          $lookup: {
            from: _activity_list[i].type,
            localField: _activity_list[i].type,
            foreignField: '_id',
            as: 'activity_detail',
          },
        },
        {
          $match: { _id: _activity_list[i]._id },
        },
      ]);

      _activity_detail_list.push(_activity_detail[0]);
    }

    const myJSON = JSON.stringify(_contact);
    const contact = JSON.parse(myJSON);
    const data = await Object.assign(
      contact,
      // { follow_up: _follow_up },
      // { appointment: _appointment },
      { activity: _activity_detail_list },
      { next },
      { prev },
      { time_lines: _timelines },
      { automation }
    );

    return res.send({
      status: true,
      data,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contact not found',
    });
  }
};

const create = async (req, res) => {
  const { currentUser } = req;

  let max_upload_count = 0;
  let count = 0;
  let deal_stage;
  let newDeal;
  let newContact;

  const contact_info = currentUser.contact_info;
  if (contact_info['is_limit']) {
    count = await Contact.countDocuments({ user: currentUser.id });
    max_upload_count =
      contact_info.max_count || system_settings.CONTACT_UPLOAD_LIMIT.PRO;
  }

  if (contact_info['is_limit'] && max_upload_count <= count) {
    return res.status(412).send({
      status: false,
      error: 'Exceed upload max contacts',
    });
  }

  if (req.body.cell_phone) {
    req.body.cell_phone = phone(req.body.cell_phone)[0];
  } else {
    delete req.body.cell_phone;
  }

  /**
   *  Email / Phone unique validation
   */

  let contact_old;
  if (req.body.email && req.body.email != '') {
    contact_old = await Contact.findOne({
      user: currentUser.id,
      email: req.body['email'],
    });
    if (contact_old !== null) {
      return res.status(400).send({
        status: false,
        error: 'Email must be unique!',
      });
    }
  }

  if (req.body.cell_phone) {
    contact_old = await Contact.findOne({
      user: currentUser.id,
      cell_phone: req.body['cell_phone'],
    });
    if (contact_old !== null) {
      return res.status(400).send({
        status: false,
        error: 'Phone number must be unique!',
      });
    }
  }

  // let cleaned = ('' + cell_phone).replace(/\D/g, '')
  // let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
  // if (match) {
  //   let intlCode = (match[1] ? '+1 ' : '')
  //   cell_phone = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
  // }

  if (req.body.deal_stage) {
    deal_stage = await DealStage.findOne({
      _id: req.body.deal_stage,
    }).catch((err) => {
      console.log('error', err.message);
    });
  }

  const contact = new Contact({
    ...req.body,
    user: currentUser.id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  await contact
    .save()
    .then((_contact) => {
      newContact = _contact;
    })
    .catch((err) => {
      console.log('contact save error', err.message);
      return res.status(500).send({
        status: false,
        error: 'Internal server error',
      });
    });

  let data;
  if (newContact) {
    let detail_content = 'added';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    const activity = new Activity({
      content: detail_content,
      contacts: newContact.id,
      user: currentUser.id,
      type: 'contacts',
      created_at: new Date(),
      updated_at: new Date(),
    });

    await activity.save().then((_activity) => {
      const myJSON = JSON.stringify(newContact);
      data = JSON.parse(myJSON);
      data.activity = _activity;
      newContact['last_activity'] = _activity.id;
      newContact.save().catch((err) => {
        console.log('err', err);
      });
    });

    if (req.body.note) {
      const note = new Note({
        contact: newContact.id,
        user: currentUser.id,
        content: req.body.note,
      });

      await note.save().catch((err) => {
        console.log('add note save err', err.message);
      });
    }

    if (req.body.deal_stage) {
      const deal = new Deal({
        contacts: newContact.id,
        user: currentUser.id,
        deal_stage: req.body.deal_stage,
        primary_contact: newContact.id,
        title: `${newContact.first_name} ${newContact.last_name || ''} Deal`,
        put_at: new Date(),
      });

      await deal.save().then((_deal) => {
        newDeal = _deal;
        let detail_content = 'added deal';
        if (req.guest_loggin) {
          detail_content = ActivityHelper.assistantLog(detail_content);
        }

        DealStage.updateOne(
          {
            _id: req.body.deal_stage,
          },
          {
            $push: { deals: _deal._id },
          }
        ).catch((err) => {
          console.log('error', err.message);
        });

        const activity = new Activity({
          content: detail_content,
          contacts: newContact.id,
          user: currentUser.id,
          type: 'deals',
          deals: _deal.id,
          deal_stages: req.body.deal_stage,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        Contact.updateOne(
          { _id: newContact.id },
          { $set: { last_activity: activity.id } }
        ).catch((err) => {
          console.log('contact update err', err.message);
        });
      });

      if (newDeal) {
        if (deal_stage.automation) {
          const data = {
            automation_id: deal_stage.automation,
            assign_array: [newDeal._id],
            user_id: currentUser.id,
            required_unique: true,
          };

          assignTimeline(data)
            .then((_res) => {
              if (_res[0] && !_res[0].status) {
                console.log('automation assign err', _res[0].error);
              }
            })
            .catch((err) => {
              console.log('assign automation err', err.message);
            });
        }
      }
    }

    res.send({
      status: true,
      data,
    });
  }

  // const contact = new Contact({
  //   ...req.body,
  //   user: currentUser.id,
  //   created_at: new Date(),
  //   updated_at: new Date(),
  // });

  // contact
  //   .save()
  //   .then((_contact) => {
  //     let detail_content = 'added';
  //     if (req.guest_loggin) {
  //       detail_content = ActivityHelper.assistantLog(detail_content);
  //     }

  //     const activity = new Activity({
  //       content: detail_content,
  //       contacts: _contact.id,
  //       user: currentUser.id,
  //       type: 'contacts',
  //       created_at: new Date(),
  //       updated_at: new Date(),
  //     });

  //     activity.save().then((_activity) => {
  //       _contact['last_activity'] = _activity.id;
  //       _contact.save().catch((err) => {
  //         console.log('err', err);
  //       });

  //       if (req.body.deal_stage) {
  //         const deal = new Deal({
  //           contacts: contact.id,
  //           user: currentUser.id,
  //           deal_stage: req.body.deal_stage,
  //           title: `${contact.first_name} ${contact.last_name || ''} Deal`,
  //           put_at: new Date(),
  //         });

  //         deal
  //           .save()
  //           .then((_deal) => {
  //             let detail_content = 'added deal';
  //             if (req.guest_loggin) {
  //               detail_content = ActivityHelper.assistantLog(detail_content);
  //             }

  //             DealStage.updateOne(
  //               {
  //                 _id: req.body.deal_stage,
  //               },
  //               {
  //                 $push: { deals: _deal._id },
  //               }
  //             ).catch((err) => {
  //               console.log('error', err.message);
  //             });

  //             /**
  //             if (req.body.tags) {
  //               const tag_trigger_data = {
  //                 user_id: currentUser.id,
  //                 tags: req.body.tags,
  //                 contact_id: _contact.id,
  //               };

  //               tagTriggerAutomation(tag_trigger_data);
  //             }
  //             */

  //            /**
  //            const activity = new Activity({
  //              content: detail_content,
  //              contacts: contact.id,
  //             user: currentUser.id,
  //              type: 'deals',
  //              deals: _deal.id,
  //            });

  //            activity.save().catch((err) => {
  //              console.log('activity save err', err.message);
  //            });

  //            Contact.updateOne(
  //             { _id: contact.id },
  //              { $set: { last_activity: activity.id } }
  //            ).catch((err) => {
  //             console.log('contact update err', err.message);
  //            });
  //             */
  //           })
  //           .catch((err) => {
  //             console.log('deal create err', err.message);
  //           });
  //       }

  //       if (req.body.note) {
  //         const note = new Note({
  //           contact: contact.id,
  //           user: currentUser.id,
  //           content: req.body.note,
  //         });

  //         note.save().catch((err) => {
  //           console.log('add note save err', err.message);
  //         });
  //       }

  //       /**
  //       if (req.body.tags) {
  //         const tag_trigger_data = {
  //           user_id: currentUser.id,
  //           tags: req.body.tags,
  //           contact_id: contact.id,
  //         };

  //         tagTriggerAutomation(tag_trigger_data);
  //       }
  //       */

  //       const myJSON = JSON.stringify(_contact);
  //       const data = JSON.parse(myJSON);
  //       data.activity = _activity;
  //       res.send({
  //         status: true,
  //         data,
  //       });
  //     });
  //   })
  //   .catch((err) => {
  //     console.log('contact save error', err.message);
  //     return res.status(500).send({
  //       status: false,
  //       error: 'Internal server error',
  //     });
  //   });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  const data = await Contact.findOne({
    user: currentUser.id,
    _id: req.params.id,
  });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }

  const id = req.params.id;
  await Contact.deleteOne({ _id: id });
  await Activity.deleteMany({ contacts: id });
  await Draft.deleteMany({ contact: id });
  await Note.deleteMany({ contact: id });
  await FollowUp.deleteMany({ contact: id });
  await Reminder.deleteMany({ contact: id });
  await TimeLine.deleteMany({ contact: id });
  await Notification.deleteMany({ contact: id });
  await PhoneLog.deleteMany({ contact: id });
  await EmailTracker.deleteMany({ contact: id });
  await ImageTracker.deleteMany({ contact: id });
  await PDFTracker.deleteMany({ contact: id });
  await VideoTracker.deleteMany({ contact: id });
  // remove contact from record
  await Appointment.updateMany({ contacts: id }, { $pull: { contacts: id } });
  await CampaignJob.updateMany({ contacts: id }, { $pull: { contacts: id } });
  await Campaign.updateMany({ contacts: id }, { $pull: { contacts: id } });
  await Deal.updateMany({ contacts: id }, { $pull: { contacts: id } });
  await Email.updateMany({ contacts: id }, { $pull: { contacts: id } });
  await Task.updateMany({ contacts: id }, { $pull: { contacts: id } });
  await Team.updateMany({ contacts: id }, { $pull: { contacts: id } });
  await Text.updateMany({ contacts: id }, { $pull: { contacts: id } });

  res.send({
    status: true,
  });
};

const bulkRemove = async (req, res) => {
  const { currentUser } = req;
  const ids = req.body.ids;
  var deleted = 0;
  var undeleted = 0;
  ids.forEach((id) => {
    if (removeContact(currentUser.id, id)) {
      deleted++;
    } else {
      undeleted++;
    }
  });

  return res.send({
    status: true,
    data: {
      deleted,
      undeleted,
    },
  });
};

const removeContact = async (user_id, id) => {
  const data = await Contact.findOne({ user: user_id, _id: id });
  if (!data) {
    const shared_data = await Contact.findOne({
      shared_members: user_id,
      _id: id,
    });

    if (shared_data) {
      if (shared_data.shared_members.length === 1) {
        Contact.updateOne(
          { shared_members: user_id, _id: id },
          {
            $pull: {
              shared_members: { $in: [user_id] },
            },
          }
        ).catch((err) => {
          console.log('contact update err', err.message);
        });
      } else {
        Contact.updateOne(
          { shared_members: user_id, _id: id },
          {
            $unset: {
              shared_members: true,
              shared_contact: true,
              shared_team: true,
            },
          }
        ).catch((err) => {
          console.log('contact update err', err.message);
        });
      }
      return true;
    } else {
      return false;
    }
  } else {
    await Contact.deleteOne({ _id: id });
    await Activity.deleteMany({ contacts: id });
    await Draft.deleteMany({ contact: id });
    await Note.deleteMany({ contact: id });
    await FollowUp.deleteMany({ contact: id });
    await Reminder.deleteMany({ contact: id });
    await TimeLine.deleteMany({ contact: id });
    await Notification.deleteMany({ contact: id });
    await PhoneLog.deleteMany({ contact: id });
    await EmailTracker.deleteMany({ contact: id });
    await ImageTracker.deleteMany({ contact: id });
    await PDFTracker.deleteMany({ contact: id });
    await VideoTracker.deleteMany({ contact: id });
    // remove contact from record
    await Appointment.updateMany({ contacts: id }, { $pull: { contacts: id } });
    await CampaignJob.updateMany({ contacts: id }, { $pull: { contacts: id } });
    await Campaign.updateMany({ contacts: id }, { $pull: { contacts: id } });
    await Deal.updateMany({ contacts: id }, { $pull: { contacts: id } });
    await Email.updateMany({ contacts: id }, { $pull: { contacts: id } });
    await Task.updateMany({ contacts: id }, { $pull: { contacts: id } });
    await Team.updateMany({ contacts: id }, { $pull: { contacts: id } });
    await Text.updateMany({ contacts: id }, { $pull: { contacts: id } });

    return true;
  }
};

const update = async (req, res) => {
  const { currentUser } = req;
  const query = { ...req.body };
  if (req.params.id === 'null' || req.params.id === 'undefined') {
    return res.status(400).json({
      status: false,
      error: 'Invalid Contact',
    });
  } else {
    const contact = await Contact.findOne({
      _id: req.params.id,
    }).catch((err) => {
      console.log('err', err);
    });

    if (query['label'] === '') {
      delete query.label;
    }

    let contact_old;
    if (req.body.email && req.body.email != '') {
      contact_old = await Contact.findOne({
        _id: { $ne: req.params.id },
        user: currentUser.id,
        email: req.body['email'],
      });
      if (contact_old !== null) {
        return res.status(400).send({
          status: false,
          error: 'Email must be unique!',
        });
      }
    }

    if (req.body.cell_phone) {
      contact_old = await Contact.findOne({
        _id: { $ne: req.params.id },
        user: currentUser.id,
        cell_phone: req.body['cell_phone'],
      });
      if (contact_old !== null) {
        return res.status(400).send({
          status: false,
          error: 'Phone number must be unique!',
        });
      }
    }

    if (req.body.deal_stage) {
      const deal = new Deal({
        contacts: contact.id,
        user: currentUser.id,
        deal_stage: req.body.deal_stage,
        title: `${contact.first_name} ${contact.last_name || ''} Deal`,
        primary_contact: contact.id,
        put_at: new Date(),
      });

      deal
        .save()
        .then((_deal) => {
          let detail_content = 'added deal';
          if (req.guest_loggin) {
            detail_content = ActivityHelper.assistantLog(detail_content);
          }

          DealStage.updateOne(
            {
              _id: req.body.deal_stage,
            },
            {
              $push: { deals: _deal._id },
            }
          ).catch((err) => {
            console.log('error', err.message);
          });

          const activity = new Activity({
            user: currentUser.id,
            content: detail_content,
            type: 'deals',
            deals: deal.id,
            deal_stages: req.body.deal_stage,
          });

          activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });

          const contact_activity = new Activity({
            content: detail_content,
            contacts: contact.id,
            user: currentUser.id,
            type: 'deals',
            deals: _deal.id,
            deal_stages: req.body.deal_stage,
          });

          contact_activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });

          Contact.updateOne(
            { _id: contact.id },
            { $set: { last_activity: contact_activity.id } }
          ).catch((err) => {
            console.log('contact update err', err.message);
          });
        })
        .catch((err) => {
          console.log('deal create err', err.message);
        });
    }

    Contact.updateOne(
      { _id: contact.id },
      {
        $set: { ...query },
      }
    )
      .then(() => {
        /**
        if (req.body.tags) {
          const tag_trigger_data = {
            user_id: currentUser.id,
            tags: req.body.tags,
            contact_id: contact.id,
          };

          tagTriggerAutomation(tag_trigger_data);
        }
         */
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('contact update err', err.message);
        return res.status(500).json({
          status: false,
          error: err.message,
        });
      });
  }
};

const bulkEditLabel = async (req, res) => {
  const { contacts } = req.body;
  let { label } = req.body;
  if (label === '') {
    label = undefined;
  }
  Contact.find({ _id: { $in: contacts } })
    .updateMany({ $set: { label } })
    .then(() => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Label Update Error',
      });
    });
};

const bulkUpdate = async (req, res) => {
  const { contacts, data, tags } = req.body;
  let tagUpdateQuery = {};
  if (tags.tags && tags.tags.length) {
    switch (tags.option) {
      case 2:
        tagUpdateQuery = { $push: { tags: { $each: tags.tags } } };
        break;
      case 3:
        tagUpdateQuery = { $pull: { tags: { $in: tags.tags } } };
        break;
      case 4:
        tagUpdateQuery = { tags: tags.tags };
        break;
    }
  }
  let updateQuery = {};
  if (Object.keys(data).length) {
    updateQuery = { $set: data };
  }
  if (Object.keys(tagUpdateQuery).length) {
    updateQuery = { ...updateQuery, ...tagUpdateQuery };
  }

  Contact.find({ _id: { $in: contacts } })
    .updateMany(updateQuery)
    .then(() => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('error', err);
      res.status(500).send({
        status: false,
        error: err.message || 'Update Error',
      });
    });
};

const importCSV = async (req, res) => {
  const file = req.file;
  const contact_array = [];
  fs.createReadStream(file.path)
    .pipe(csv())
    .on('data', async (data) => {
      contact_array.push(data);
    })
    .on('end', async () => {
      uploadContacts(req, res, contact_array);
    });
};
const importContacts = async (req, res) => {
  const contacts = req.body.contacts || [];
  uploadContacts(req, res, contacts);
};

const uploadContacts = async (req, res, contact_array) => {
  const { currentUser } = req;
  const additional_fields = [];
  const _garbage = await Garbage.findOne({ user: currentUser.id }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  _garbage.additional_fields.forEach((field) => {
    additional_fields.push(field.name);
  });
  const labels = await LabelHelper.getAll(currentUser.id);
  const contact_info = currentUser.contact_info;
  let count = 0;
  let max_upload_count = 0;
  if (contact_info['is_limit']) {
    count = await Contact.countDocuments({ user: currentUser.id });

    max_upload_count =
      contact_info.max_count || system_settings.CONTACT_UPLOAD_LIMIT.PRO;

    if (max_upload_count <= count) {
      return res.send({
        status: false,
        error: 'max_exceed',
      });
    }
  }
  let duplicate_contacts = [];
  const exceed_contacts = [];
  const promise_array = [];

  let add_content = 'added';
  if (req.guest_loggin) {
    add_content = ActivityHelper.assistantLog(add_content);
  }
  const assignAutomation = [];
  for (let i = 0; i < contact_array.length; i++) {
    const promise = new Promise(async (resolve) => {
      try {
        const data = contact_array[i];

        // additional field working
        if (additional_fields.length > 0) {
          const additionalData = {};
          for (const key in data) {
            if (additional_fields.indexOf(key) > -1) {
              additionalData[key] = data[key];
            }
          }
          data['additional_field'] = additionalData;
        }

        if (data['first_name'] === '') {
          data['first_name'] = null;
        }
        if (data['email'] === '') {
          data['email'] = null;
        }
        if (data['cell_phone'] === '') {
          data['cell_phone'] = null;
        }
        if (data['first_name'] || data['email'] || data['cell_phone']) {
          let cell_phone;
          const query = [];

          /**
          if (data['first_name'] && data['last_name']) {
            query.push({
              user: currentUser.id,
              first_name: data['first_name'],
              last_name: data['last_name'],
            });
          }
          */

          if (data['email'] && validateEmail(data['email'])) {
            query.push({
              user: currentUser.id,
              email: new RegExp(data['email'], 'i'),
            });
          }

          if (data['cell_phone']) {
            cell_phone = phone(data['cell_phone'])[0];
            if (cell_phone) {
              query.push({
                user: currentUser.id,
                cell_phone,
              });
            }
          }

          const _duplicate_contacts = await Contact.find({
            $or: query,
          })
            .populate('label')
            .catch((err) => {
              console.log('contact find err', err.message);
            });

          if (_duplicate_contacts && _duplicate_contacts.length > 0) {
            duplicate_contacts = duplicate_contacts.concat(_duplicate_contacts);

            duplicate_contacts.push(data);
            resolve();
            return;
          }

          if (contact_info['is_limit'] && max_upload_count <= count) {
            exceed_contacts.push(data);
            resolve();
            return;
          }
          count += 1;

          let tags = [];
          if (data['tags'] !== '' && typeof data['tags'] !== 'undefined') {
            tags = data['tags'].split(/,\s|\s,|,|\s/);
          }
          let label;

          if (data['label'] !== '' && typeof data['label'] !== 'undefined') {
            for (let i = 0; i < labels.length; i++) {
              if (capitalize(labels[i].name) === capitalize(data['label'])) {
                label = labels[i]._id;
                break;
              }
            }

            /**
            if (!label) {
              const new_label = new Label({
                user: currentUser.id,
                name: data['label'],
              });

              new_label.save().catch((err) => {
                console.log('new label save err', err.message);
              });
              label = new_label.id;
              labels.push({
                _id: label,
                name: data['label'],
              });
            }
            */
          }

          delete data.label;
          delete data.tags;

          const contact = new Contact({
            ...data,
            tags,
            label,
            cell_phone,
            user: currentUser.id,
          });

          contact
            .save()
            .then(async (_contact) => {
              const activity = new Activity({
                content: add_content,
                contacts: _contact.id,
                user: currentUser.id,
                type: 'contacts',
              });

              activity
                .save()
                .then((_activity) => {
                  Contact.updateOne(
                    { _id: _contact.id },
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

              if (data['notes'] && data['notes'].length > 0) {
                let notes = [];
                try {
                  notes = JSON.parse(data['notes']);
                } catch (err) {
                  if (data['notes'] instanceof Array) {
                    notes = data['notes'];
                  } else {
                    notes = [data['notes']];
                  }
                }
                // const notes = data['notes'];
                for (let i = 0; i < notes.length; i++) {
                  // const { content, title } = notes[i];
                  const content = notes[i];
                  const note = new Note({
                    content,
                    contact: _contact.id,
                    user: currentUser.id,
                  });

                  note.save().catch((err) => {
                    console.log('contact import note save err', err.message);
                  });

                  /**
                  note.save().then((_note) => {
                    const _activity = new Activity({
                      content: note_content,
                      contacts: _contact.id,
                      user: currentUser.id,
                      type: 'notes',
                      notes: _note.id,
                    });

                    _activity
                      .save()
                      .then((__activity) => {
                        Contact.updateOne(
                          { _id: _contact.id },
                          { $set: { last_activity: __activity.id } }
                        ).catch((err) => {
                          console.log('err', err);
                        });
                      })
                      .catch((err) => {
                        console.log('error', err);
                      });
                  });
                  */
                }
              }
              if (data['deal_id']) {
                const deal = await Deal.findOne({
                  _id: data['deal_id'],
                });
                if (deal) {
                  const query = { contacts: _contact.id };
                  if (data['primary_contact']) {
                    query['primary_contact'] = _contact.id;
                  }
                  Deal.updateOne(
                    {
                      _id: deal.id,
                      user: currentUser.id,
                    },
                    { $push: query }
                  ).catch((err) => {
                    console.log('deal update err', err.message);
                  });
                  const activity = new Activity({
                    content: 'added deal',
                    contacts: _contact.id,
                    user: currentUser.id,
                    type: 'deals',
                    deals: deal.id,
                    deal_stages: deal.deal_stage,
                  });

                  activity.save().catch((err) => {
                    console.log('activity save err', err.message);
                  });
                }
              }

              // make group for bulk assign automation
              if (data['automation_id']) {
                const automation_id = data['automation_id'];
                const index = assignAutomation.findIndex(
                  (item) => item['automation'] === automation_id
                );
                if (index >= 0) {
                  if (assignAutomation[index]['contacts']) {
                    assignAutomation[index]['contacts'].push(_contact.id);
                  } else {
                    assignAutomation[index]['contacts'] = [_contact.id];
                  }
                } else {
                  assignAutomation.push({
                    automation: automation_id,
                    contacts: [_contact._id],
                  });
                }
              }
              resolve();
            })
            .catch((err) => {
              console.log('contact save err', err);
            });
        } else {
          resolve();
        }
      } catch (err) {
        console.log('contact import csv internal err', err);
      }
    });
    promise_array.push(promise);
  }

  Promise.all(promise_array).then(async () => {
    // bulk assign automation
    if (assignAutomation.length > 0) {
      for (const groupItem of assignAutomation) {
        const automation_id = groupItem.automation;
        const inputContacts = groupItem.contacts;
        const inputDeals = groupItem.deals;
        let inputData;
        if (inputContacts) {
          inputData = inputContacts;
        } else {
          inputData = inputDeals;
        }

        const STANDARD_CHUNK = 8;
        const CHUNK_COUNT = 12;
        const MIN_CHUNK = 5;
        const TIME_GAPS = [2, 3, 4, 5];

        const _automation = await Automation.findOne({
          _id: automation_id,
        }).catch((err) => {
          console.log('automation find err', err.message);
          return res.status(400).json({
            status: false,
            error: err.message || 'Automation found err',
          });
        });

        if (_automation) {
          let count = 0;
          let max_assign_count;

          const automation_info = currentUser.automation_info;

          if (!automation_info['is_enabled']) {
            return res.status(412).send({
              status: false,
              error: 'Disable create automations',
            });
          }

          if (automation_info['is_limit']) {
            max_assign_count =
              automation_info.max_count ||
              system_settings.AUTOMATION_ASSIGN_LIMIT.PRO;

            const timeline = await TimeLine.aggregate([
              {
                $match: {
                  user: mongoose.Types.ObjectId(currentUser._id),
                },
              },
              {
                $group: {
                  _id: { contact: '$contact' },
                  count: { $sum: 1 },
                },
              },
              {
                $project: { _id: 1 },
              },
              {
                $count: 'total',
              },
            ]);

            if (timeline[0] && timeline[0]['total']) {
              count = timeline[0]['total'];
            }
          }

          if (automation_info['is_limit'] && max_assign_count <= count) {
            return res.status(412).send({
              status: false,
              error: 'Exceed max active automations',
            });
          }

          const taskProcessId = new Date().getTime() + uuidv1();

          let assigns = [...inputData];
          let assignsToTemp = [];

          // TODO: Scheduled Time Task
          if (inputData.length > STANDARD_CHUNK) {
            const currentAction = await TimeLine.find({
              user: currentUser._id,
              status: 'active',
              parent_ref: 'a_10000',
            })
              .sort({ due_date: -1 })
              .limit(1)
              .catch((err) => {
                console.log('Getting Last Email Tasks', err.message);
              });

            let last_due;
            if (currentAction && currentAction.length) {
              // Split From Here
              last_due = currentAction[0].due_date;
              assignsToTemp = [...assigns];
              assigns = [];
            } else {
              // Handle First Chunk and Create With Anothers
              last_due = new Date();
              assignsToTemp = assigns.slice(STANDARD_CHUNK);
              assigns = assigns.slice(0, STANDARD_CHUNK);
            }

            let delay = 2;
            let taskIndex = 0;
            while (taskIndex < assignsToTemp.length) {
              const due_date = moment(last_due).add(delay, 'minutes');
              const chunk =
                Math.floor(Math.random() * (CHUNK_COUNT - MIN_CHUNK)) +
                MIN_CHUNK;
              let task;

              if (inputContacts) {
                // Order Timeline in future
                assignTimeline({
                  user_id: currentUser._id,
                  assign_array: assignsToTemp.slice(
                    taskIndex,
                    taskIndex + chunk
                  ),
                  automation_id,
                  required_unique: true,
                  scheduled_time: due_date,
                });
              } else {
                // Order Deal Timeline in future
                assignTimeline({
                  user_id: currentUser._id,
                  assign_array: assignsToTemp.slice(
                    taskIndex,
                    taskIndex + chunk
                  ),
                  automation_id,
                  required_unique: true,
                  scheduled_time: due_date,
                });
              }

              task.save().catch((err) => {
                console.log('campaign job save err', err.message);
              });

              taskIndex += chunk;
              const timeIndex = Math.floor(Math.random() * TIME_GAPS.length);
              delay += TIME_GAPS[timeIndex];
            }

            if (!assigns.length) {
              // TO REMOVE
              const notification = new Notification({
                user: currentUser._id,
                type: 'personal',
                criteria: 'assign_automation',
                status: 'pending',
                process: taskProcessId,
                contact: [...inputContacts],
                detail: {
                  automation: automation_id,
                },
                deliver_status: {
                  succeed: [],
                  failed: [],
                  not_executed: [],
                },
              });
              notification.save().catch((err) => {
                console.log(
                  'Bulk assign automation notification creation is failed.',
                  err
                );
              });
              // --- End Remove ---

              return res.send({
                status: true,
                message: 'all_queue',
              });
            }
          }

          if (assigns.length) {
            const data = {
              automation_id,
              assign_array: assigns,
              user_id: currentUser.id,
              required_unique: true,
            };

            assignTimeline(data)
              .then(async (result) => {
                const error = [];
                result.forEach((_res) => {
                  if (!_res.status) {
                    error.push({
                      contact: _res.contact,
                      error: _res.error,
                      type: _res.type,
                    });
                  }
                });

                let notRunnedAssignIds = [];
                if (result.length !== assigns.length) {
                  if (inputContacts) {
                    const runnedContactIds = [];
                    result.forEach((e) => {
                      runnedContactIds.push(e.contact && e.contact._id);
                    });
                    notRunnedAssignIds = _.differenceBy(
                      assigns,
                      runnedContactIds,
                      (e) => e + ''
                    );
                  } else {
                    const runnedDealIds = [];
                    result.forEach((e) => {
                      runnedDealIds.push(e.deal && e.deal._id);
                    });
                    notRunnedAssignIds = _.differenceBy(
                      assigns,
                      runnedDealIds,
                      (e) => e + ''
                    );
                  }
                }

                // Create Notification and With Success and Failed
                if (assignsToTemp && assignsToTemp.length) {
                  // TO REMOVE
                  const failed = error.map((e) => e.contact && e.contact._id);
                  const not_executed = [...notRunnedAssignIds];
                  const succeed = _.differenceBy(
                    assigns,
                    [...failed, ...notRunnedAssignIds],
                    (e) => e + ''
                  );
                  const notification = new Notification({
                    user: currentUser._id,
                    type: 'personal',
                    criteria: 'assign_automation',
                    status: 'pending',
                    process: taskProcessId,
                    contact: [...inputContacts],
                    detail: {
                      automation: automation_id,
                    },
                    deliver_status: {
                      succeed,
                      failed,
                      not_executed,
                      error,
                    },
                  });

                  notification.save().catch((err) => {
                    console.log(
                      'Bulk assign automation notification creation is failed.',
                      err
                    );
                  });

                  const task = new Task({
                    user: currentUser._id,
                    contacts: assigns,
                    status: 'completed',
                    process: taskProcessId,
                    type: 'assign_automation',
                    action: {
                      automation: automation_id,
                    },
                    due_date: new Date(),
                    exec_result: {
                      notExecuted: not_executed,
                      succeed,
                      failed: error,
                    },
                  });
                  task.save().catch((err) => {
                    console.log('Some assign is processed immediately', err);
                  });
                  // --- End Remove ---
                }

                if (error.length > 0) {
                  return res.status(405).json({
                    status: false,
                    error,
                    notExecuted: notRunnedAssignIds,
                  });
                }
              })
              .catch((err) => {
                console.log('bulk automation assigning is failed', err);
              });
          }
        }
      }
    }

    return res.send({
      status: true,
      exceed_contacts,
      duplicate_contacts,
    });
  });
};

const overwriteCSV = async (req, res) => {
  const file = req.file;
  const { currentUser } = req;
  const failure = [];

  const contact_array = [];
  fs.createReadStream(file.path)
    .pipe(csv())
    .on('data', async (data) => {
      contact_array.push(data);
    })
    .on('end', async () => {
      const promise_array = [];
      for (let i = 0; i < contact_array.length; i++) {
        const email = contact_array[i]['email'];
        const data = contact_array[i];
        let tags = [];
        if (data['tags'] !== '' && typeof data['tags'] !== 'undefined') {
          tags = data['tags'].split(/,\s|\s,|,|\s/);
        }
        delete data.tags;
        for (const key in data) {
          if (data[key] === '' && typeof data[key] === 'undefined') {
            delete data[key];
          }
        }
        if (email) {
          await Contact.updateOne(
            { email },
            { $set: data, $push: { tags: { $each: tags } } }
          ).catch((err) => {
            console.log('err', err);
          });
        }
      }
      return res.send({
        status: true,
      });
    });
};

const exportCSV = async (req, res) => {
  const { currentUser } = req;
  const { contacts } = req.body;

  const data = [];
  for (let i = 0; i < contacts.length; i++) {
    const _data = {
      contact_id: contacts[i],
      note: [],
    };
    const _note = await Note.find({
      user: currentUser.id,
      contact: contacts[i],
    });
    const _contact = await Contact.findOne({ _id: contacts[i] }).populate({
      path: 'label',
      select: 'name',
    });

    if (_note.length !== 0) {
      _data['note'] = _note;
    }
    _data['contact'] = _contact;
    data.push(_data);
  }

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Note doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const search = async (req, res) => {
  const { currentUser } = req;
  const searchStr = req.body.search;
  const search = searchStr.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  const phoneSearch = searchStr.replace(/[.*+\-?^${}()|[\]\\\s]/g, '');
  const runStartTime = new Date().getTime();
  let contacts = [];
  if (search.split(' ').length > 1) {
    contacts = await Contact.find({
      $or: [
        {
          first_name: { $regex: search.split(' ')[0], $options: 'i' },
          last_name: { $regex: search.split(' ')[1], $options: 'i' },
          user: currentUser.id,
        },
        {
          first_name: { $regex: search.split(' ')[0], $options: 'i' },
          last_name: { $regex: search.split(' ')[1], $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          first_name: { $regex: search, $options: 'i' },
          user: currentUser.id,
        },
        {
          first_name: { $regex: search, $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          last_name: { $regex: search, $options: 'i' },
          user: currentUser.id,
        },
        {
          last_name: { $regex: search, $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          user: currentUser.id,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          shared_members: currentUser.id,
        },
      ],
    })
      .populate('last_activity')
      .sort({ first_name: 1 });
  } else {
    contacts = await Contact.find({
      $or: [
        {
          first_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
          user: currentUser.id,
        },
        {
          first_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          email: { $regex: '.*' + search.split(' ')[0] + '.*', $options: 'i' },
          user: currentUser.id,
        },
        {
          email: { $regex: '.*' + search.split(' ')[0] + '.*', $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          last_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
          user: currentUser.id,
        },
        {
          last_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          user: currentUser.id,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          shared_members: currentUser.id,
        },
      ],
    })
      .populate('last_activity')
      .sort({ first_name: 1 });
  }

  console.log('run time', new Date().getTime() - runStartTime);
  const count = await Contact.countDocuments({ user: currentUser.id });
  return res.send({
    status: true,
    data: {
      contacts,
      search,
      total: count,
    },
  });
};

const searchEasy = async (req, res) => {
  const { currentUser } = req;
  let search = req.body.search;
  let phoneSearchStr;
  if (search) {
    search = search.replace(/[.*+\-?^${}()|[\]\\\s,#]/g, '\\$&');
    phoneSearchStr = search.replace(/[.*+\-?^${}()|[\]\\\s,#]/g, '');
  }
  const skip = req.body.skip || 0;
  let data = [];
  if (search.split(' ').length == 1) {
    const option = {
      $or: [
        {
          first_name: {
            $regex: '.*' + search.split(' ')[0] + '.*',
            $options: 'i',
          },
          user: currentUser.id,
        },
        {
          email: { $regex: '.*' + search.split(' ')[0] + '.*', $options: 'i' },
          user: currentUser.id,
        },
        {
          last_name: {
            $regex: '.*' + search.split(' ')[0] + '.*',
            $options: 'i',
          },
          user: currentUser.id,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearchStr + '.*',
            $options: 'i',
          },
          user: currentUser.id,
        },
        {
          first_name: {
            $regex: '.*' + search.split(' ')[0] + '.*',
            $options: 'i',
          },
          shared_members: currentUser.id,
        },
        {
          email: { $regex: '.*' + search.split(' ')[0] + '.*', $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          last_name: {
            $regex: '.*' + search.split(' ')[0] + '.*',
            $options: 'i',
          },
          shared_members: currentUser.id,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearchStr + '.*',
            $options: 'i',
          },
          shared_members: currentUser.id,
        },
      ],
    };
    data = await Contact.find(option)
      .sort({ first_name: 1 })
      .skip(skip)
      .limit(8)
      .catch((err) => {
        console.log('err', err);
      });
  } else {
    data = await Contact.find({
      $or: [
        {
          first_name: {
            $regex: '.*' + search.split(' ')[0] + '.*',
            $options: 'i',
          },
          last_name: {
            $regex: '.*' + search.split(' ')[1] + '.*',
            $options: 'i',
          },
          user: currentUser.id,
        },
        {
          first_name: { $regex: '.*' + search + '.*', $options: 'i' },
          user: currentUser.id,
        },
        {
          last_name: { $regex: '.*' + search + '.*', $options: 'i' },
          user: currentUser.id,
        },
        {
          cell_phone: { $regex: '.*' + phoneSearchStr + '.*', $options: 'i' },
          user: currentUser.id,
        },
        {
          first_name: {
            $regex: '.*' + search.split(' ')[0] + '.*',
            $options: 'i',
          },
          last_name: {
            $regex: '.*' + search.split(' ')[1] + '.*',
            $options: 'i',
          },
          shared_members: currentUser.id,
        },
        {
          first_name: { $regex: '.*' + search + '.*', $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          last_name: { $regex: '.*' + search + '.*', $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          cell_phone: { $regex: '.*' + phoneSearchStr + '.*', $options: 'i' },
          shared_members: currentUser.id,
        },
      ],
    })
      .sort({ first_name: 1 })
      .skip(skip)
      .limit(8)
      .catch((err) => {
        console.log('err', err);
      });
  }
  return res.send({
    status: true,
    data,
  });
};

const filter = async (req, res) => {
  const { currentUser } = req;
  const query = req.body;
  let data = [];
  data = await Contact.find({ ...query, user: currentUser.id });
  return res.send({
    status: true,
    data,
  });
};

const getById = async (req, res) => {
  const { currentUser } = req;
  const _contact = await Contact.findOne({
    user: currentUser.id,
    _id: req.params.id,
  });

  if (!_contact) {
    return res.status(400).json({
      status: false,
      error: 'Contact doesn`t exist',
    });
  }

  res.send({
    status: true,
    data: _contact,
  });
};

const getByIds = async (req, res) => {
  const { ids } = req.body;
  const _contacts = await Contact.find({
    _id: { $in: ids },
  });

  res.send({
    status: true,
    data: _contacts,
  });
};

const leadContact = async (req, res) => {
  const { first_name, email, cell_phone, video, pdf, image, automation } =
    req.body;
  let user = req.body.user;
  if (!user && !req.currentUser) {
    return res.status(400).send({
      status: false,
      error: 'NOT_FOUND_USER',
    });
  }
  if (!user && req.currentUser) {
    user = req.currentUser._id;
  }
  const tags = req.body.tags || [];
  const fieldData = { ...req.body };
  delete fieldData['user'];
  delete fieldData['first_name'];
  delete fieldData['email'];
  delete fieldData['cell_phone'];
  delete fieldData['video'];
  delete fieldData['pdf'];
  delete fieldData['image'];
  delete fieldData['tags'];
  delete fieldData['automation'];

  const additional_fields = [];
  const _garbage = await Garbage.findOne({ user }).catch((err) => {
    console.log('err', err);
  });

  if (_garbage.additional_fields.length) {
    for (let i = 0; i < _garbage.additional_fields.length; i++) {
      const field = _garbage.additional_fields[i];
      additional_fields.push(field.name);
    }
  }
  if (additional_fields.length > 0) {
    const additionalData = {};
    for (const key in fieldData) {
      if (
        additional_fields.indexOf(key) > -1 ||
        (key !== 'source' &&
          key !== 'website' &&
          key !== 'brokerage' &&
          key !== 'address' &&
          key !== 'city' &&
          key !== 'country' &&
          key !== 'state' &&
          key !== 'zip')
      ) {
        additionalData[key] = fieldData[key];
        delete fieldData[key];
      }
    }
    fieldData['additional_field'] = additionalData;
  }

  if (!email && !cell_phone) {
    return res.status(400).send({
      status: false,
      error: 'Please input email address or cell_phone',
    });
  }

  let _exist;
  if (email) {
    _exist = await Contact.findOne({
      email,
      user,
    }).catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
  }

  if (!_exist && cell_phone) {
    _exist = await Contact.findOne({
      cell_phone,
      user,
    }).catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
  }

  if (_exist) {
    let _activity;
    if (video) {
      _activity = new Activity({
        content: 'LEAD CAPTURE - watched video',
        contacts: _exist.id,
        user,
        type: 'videos',
        videos: video,
      });
    } else if (pdf) {
      _activity = new Activity({
        content: 'LEAD CAPTURE - reviewed pdf',
        contacts: _exist.id,
        user,
        type: 'pdfs',
        pdfs: pdf,
      });
    } else if (image) {
      _activity = new Activity({
        content: 'LEAD CAPTURE - reviewed image',
        contacts: _exist.id,
        user,
        type: 'images',
        images: image,
      });
    } else {
      const _activity = new Activity({
        content: 'LEAD CAPTURE - watched landing page',
        contacts: _exist.id,
        user,
        type: 'emails',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    const newTags = _.union(_exist.tags, tags);
    const updateData = { ...fieldData, tags: newTags };
    if (_activity) {
      const activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });
      updateData['last_activity'] = activity.id;
    }

    Contact.updateOne(
      { _id: _exist.id },
      {
        $set: {
          ...updateData,
        },
      }
    )
      .then(() => {
        if (automation) {
          const data = {
            assign_array: [_exist.id],
            automation_id: automation,
            user_id: user,
            required_unique: true,
          };

          assignTimeline(data)
            .then((_res) => {
              if (!_res[0].status) {
                console.log('automation assign err', _res[0].error);
              }
            })
            .catch((err) => {
              console.log('assign automation err', err.message);
            });
        }
      })
      .catch((err) => {
        console.log('contact update err', err.message);
      });

    return res.json({
      status: true,
      data: {
        contact: _exist.id,
        activity: _activity ? _activity.id : null,
      },
    });
  } else {
    const e164Phone = phone(cell_phone)[0];

    const label = system_settings.LEAD;
    tags.push('leadcapture');
    const _contact = new Contact({
      ...fieldData,
      first_name,
      email,
      cell_phone: e164Phone,
      label,
      tags,
      user,
    });

    if (video) {
      _contact
        .save()
        .then(async (contact) => {
          const _video = await Video.findOne({ _id: video }).catch((err) => {
            console.log('video found err', err.message);
          });
          const currentUser = await User.findOne({ _id: user }).catch((err) => {
            console.log('current user found err', err.message);
          });

          const _activity = new Activity({
            content: 'LEAD CAPTURE - watched video',
            contacts: contact.id,
            user: currentUser.id,
            type: 'videos',
            videos: video,
            created_at: new Date(),
            updated_at: new Date(),
          });

          const activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          // Create Notification for lead capture video
          createNotification(
            'video_lead_capture',
            {
              criteria: 'lead_capture',
              contact,
              video: _video,
            },
            currentUser
          );

          Contact.updateOne(
            { _id: contact.id },
            { $set: { last_activity: activity.id } }
          ).catch((err) => {
            console.log('contact update err', err.message);
          });

          if (automation) {
            const data = {
              assign_array: [contact.id],
              automation_id: automation,
              user_id: currentUser.id,
              required_unique: true,
            };

            assignTimeline(data)
              .then((_res) => {
                if (!_res[0].status) {
                  console.log('automation assign err', _res[0].error);
                }
              })
              .catch((err) => {
                console.log('assign automation err', err.message);
              });
          }

          return res.send({
            status: true,
            data: {
              contact: contact.id,
              activity: activity.id,
            },
          });
        })
        .catch((err) => {
          return res.status(400).send({
            status: false,
            error: err.message,
          });
        });
    } else if (pdf) {
      _contact
        .save()
        .then(async (contact) => {
          const _pdf = await PDF.findOne({ _id: pdf }).catch((err) => {
            console.log('err', err);
          });
          const currentUser = await User.findOne({ _id: user }).catch((err) => {
            console.log('err', err);
          });

          const _activity = new Activity({
            content: 'LEAD CAPTURE - reviewed pdf',
            contacts: contact.id,
            user: currentUser.id,
            type: 'pdfs',
            pdfs: pdf,
            created_at: new Date(),
            updated_at: new Date(),
          });

          const activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          // Create Notification for the pdf lead capture
          createNotification(
            'pdf_lead_capture',
            {
              criteria: 'lead_capture',
              contact,
              pdf: _pdf,
            },
            currentUser
          );

          Contact.updateOne(
            { _id: contact.id },
            { $set: { last_activity: activity.id } }
          ).catch((err) => {
            console.log('err', err);
          });

          if (automation) {
            const data = {
              assign_array: [contact.id],
              automation_id: automation,
              user_id: currentUser.id,
              required_unique: true,
            };

            assignTimeline(data)
              .then((_res) => {
                if (!_res[0].status) {
                  console.log('automation assign err', _res[0].error);
                }
              })
              .catch((err) => {
                console.log('assign automation err', err.message);
              });
          }

          return res.send({
            status: true,
            data: {
              contact: contact.id,
              activity: activity.id,
            },
          });
        })
        .catch((err) => {
          return res.status(500).send({
            status: false,
            error: err.message,
          });
        });
    } else if (image) {
      _contact
        .save()
        .then(async (contact) => {
          const _image = await Image.findOne({ _id: image }).catch((err) => {
            console.log('err', err);
          });
          const currentUser = await User.findOne({ _id: user }).catch((err) => {
            console.log('err', err);
          });

          const _activity = new Activity({
            content: 'LEAD CAPTURE - reviewed image',
            contacts: contact.id,
            user: currentUser.id,
            type: 'images',
            images: image,
            created_at: new Date(),
            updated_at: new Date(),
          });

          const activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          // Create Notification for Image Lead Capture
          createNotification(
            'image_lead_capture',
            {
              criteria: 'lead_capture',
              contact,
              image: _image,
            },
            currentUser
          );

          Contact.updateOne(
            { _id: contact.id },
            { $set: { last_activity: activity.id } }
          ).catch((err) => {
            console.log('err', err);
          });

          if (automation) {
            const data = {
              assign_array: [contact.id],
              automation_id: automation,
              user_id: currentUser.id,
              required_unique: true,
            };

            assignTimeline(data)
              .then((_res) => {
                if (!_res[0].status) {
                  console.log('automation assign err', _res[0].error);
                }
              })
              .catch((err) => {
                console.log('assign automation err', err.message);
              });
          }

          return res.send({
            status: true,
            data: {
              contact: contact.id,
              activity: activity.id,
            },
          });
        })
        .catch((err) => {
          return res.status(400).send({
            status: false,
            error: err.message,
          });
        });
    } else {
      _contact
        .save()
        .then(async (contact) => {
          const currentUser = await User.findOne({ _id: user }).catch((err) => {
            console.log('current user found err', err.message);
          });

          const _activity = new Activity({
            content: 'LEAD CAPTURE - watched landing page',
            contacts: contact.id,
            user: currentUser.id,
            type: 'emails',
            created_at: new Date(),
            updated_at: new Date(),
          });

          const activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          // Create Notification for lead capture video
          createNotification(
            'video_lead_capture',
            {
              criteria: 'lead_capture',
              contact,
            },
            currentUser
          );

          Contact.updateOne(
            { _id: contact.id },
            { $set: { last_activity: activity.id } }
          ).catch((err) => {
            console.log('contact update err', err.message);
          });

          return res.send({
            status: true,
            data: {
              contact: contact.id,
              activity: activity.id,
            },
          });
        })
        .catch((err) => {
          return res.status(400).send({
            status: false,
            error: err.message,
          });
        });
    }
  }
};

const advanceSearch = async (req, res) => {
  const { currentUser } = req;

  const action = req.params.action;

  const {
    searchStr,
    recruitingStageCondition, // not use for v2
    labelCondition,
    countryCondition,
    regionCondition,
    cityCondition,
    zipcodeCondition,
    tagsCondition,
    brokerageCondition,
    sourceCondition,
    stagesCondition,

    includeLabel,
    includeSource,
    includeTag,
    includeBrokerage,

    activityCondition,
    activityStart,
    activityEnd,
    lastMaterial,
    materialCondition,

    teamOptions,
  } = req.body;

  let { field, dir } = req.body;
  dir = dir ? 1 : -1;
  const skip = req.body.skip || 0;
  const count = req.body.count || 50;
  if (field === 'updated_at') {
    field = 'last_activity';
    dir *= -1;
  } else if (field === 'name') {
    field = 'first_name';
  } else {
    field = 'created_at';
  }

  const runStartTime = new Date().getTime();

  const teamQuery = { $or: [] };
  let teamContacts = [];
  const teamContactIds = [];
  if (Object.keys(teamOptions).length) {
    for (const team_id in teamOptions) {
      const teamOption = teamOptions[team_id];
      if (teamOption.flag === 1) {
        if (
          teamOption.share_with &&
          teamOption.share_with.flag === 1 &&
          teamOption.share_by &&
          teamOption.share_by.flag === 1
        ) {
          teamQuery['$or'].push({
            shared_team: [team_id],
            $or: [
              { user: currentUser._id },
              { shared_members: teamOption.share_with.members },
            ],
          });
        } else {
          teamQuery['$or'].push({
            shared_team: [team_id],
            user: currentUser._id,
            shared_members: teamOption.share_with.members,
          });
        }
        continue;
      } else {
        const shareWithQuery = {};
        const shareByQuery = {};
        const evTeamQuery = { $or: [] };
        if (teamOption.share_with && teamOption.share_with.flag !== -1) {
          shareWithQuery['user'] = currentUser._id;
          shareWithQuery['shared_team'] = [team_id];
          if (!teamOption.share_with.flag) {
            shareWithQuery['shared_members'] = teamOption.share_with.members;
          }
          evTeamQuery['$or'].push(shareWithQuery);
        }
        if (teamOption.share_by && teamOption.share_by.flag !== -1) {
          shareByQuery['user'] = [currentUser._id];
          shareByQuery['shared_team'] = [team_id];
          if (!teamOption.share_by.flag) {
            shareByQuery['shared_members'] = {
              $in: teamOption.share_with.members,
            };
          }
          evTeamQuery['$or'].push(shareByQuery);
        }
        teamQuery['$or'].push(evTeamQuery);
      }
    }
    teamContacts = await Contact.find(teamQuery);
    teamContacts.forEach((e) => {
      teamContactIds.push(e._id);
    });

    if (!teamContactIds.length) {
      return res.send({
        status: true,
        data: [],
      });
    }
  }

  // V2 Material Check
  var query = {
    $and: [
      {
        $or: [
          { user: mongoose.Types.ObjectId(currentUser.id) },
          { shared_members: mongoose.Types.ObjectId(currentUser.id) },
        ],
      },
    ],
  };

  // advance search for stage field
  let dealContactIds = [];
  if (stagesCondition && stagesCondition.length) {
    const deals = await Deal.find({
      deal_stage: { $in: stagesCondition },
      user: currentUser._id,
    });
    deals.forEach((e) => {
      dealContactIds = [...dealContactIds, ...e.contacts];
    });
    if (!dealContactIds.length) {
      return res.send({
        status: true,
        data: [],
      });
    }
  }

  if (Object.keys(teamOptions).length) {
    for (const action in materialCondition) {
      materialCondition[action]['flag'] = false;
    }
  }

  var materialQuery = [];
  var excludeMaterialQuery = [];
  var excludeMaterialContacts = [];
  var materialContacts = [];
  if (
    materialCondition['sent_video']['flag'] &&
    materialCondition['sent_image']['flag'] &&
    materialCondition['sent_pdf']['flag']
  ) {
    materialQuery = [
      {
        type: { $in: ['videos', 'pdfs', 'images'] },
      },
    ];
  } else if (
    materialCondition['sent_video']['flag'] ||
    materialCondition['sent_image']['flag'] ||
    materialCondition['sent_pdf']['flag']
  ) {
    if (materialCondition['sent_video']['flag']) {
      materialQuery = [
        {
          type: 'videos',
          videos: mongoose.Types.ObjectId(
            materialCondition['sent_video']['material']
          ),
        },
      ];
    } else if (materialCondition['sent_pdf']['flag']) {
      materialQuery = [
        {
          type: 'pdfs',
          pdfs: mongoose.Types.ObjectId(
            materialCondition['sent_pdf']['material']
          ),
        },
      ];
    } else if (materialCondition['sent_image']['flag']) {
      materialQuery = [
        {
          type: 'images',
          images: mongoose.Types.ObjectId(
            materialCondition['sent_image']['material']
          ),
        },
      ];
    }
  }
  if (
    materialCondition['watched_video']['flag'] &&
    materialCondition['watched_image']['flag'] &&
    materialCondition['watched_pdf']['flag']
  ) {
    materialQuery = [
      {
        type: { $in: ['video_trackers', 'pdf_trackers', 'image_trackers'] },
      },
    ];
  } else if (
    materialCondition['watched_video']['flag'] ||
    materialCondition['watched_image']['flag'] ||
    materialCondition['watched_pdf']['flag']
  ) {
    if (materialCondition['watched_video']['flag']) {
      materialQuery = [
        {
          type: 'video_trackers',
          videos: mongoose.Types.ObjectId(
            materialCondition['watched_video']['material']
          ),
        },
      ];
    } else if (materialCondition['watched_image']['flag']) {
      materialQuery = [
        {
          type: 'image_trackers',
          images: mongoose.Types.ObjectId(
            materialCondition['watched_image']['material']
          ),
        },
      ];
    } else if (materialCondition['watched_pdf']['flag']) {
      materialQuery = [
        {
          type: 'pdf_trackers',
          pdfs: mongoose.Types.ObjectId(
            materialCondition['watched_pdf']['material']
          ),
        },
      ];
    }
  }
  // Material Contacts
  if (materialQuery.length) {
    // const materialTime = new Date().getTime();
    const materialActivities = await Activity.aggregate([
      {
        $match: {
          $and: [
            { user: mongoose.Types.ObjectId(currentUser._id) },
            { $and: materialQuery },
            { contacts: { $ne: null } },
          ],
        },
      },
      { $unwind: '$contacts' },
      {
        $group: {
          _id: { contact: '$contacts' },
          contact: { $last: '$contacts' },
        },
      },
    ]);
    materialContacts = materialActivities.map((e) => e.contact);
    // console.log('material executing time', new Date().getTime() - materialTime);
  }

  if (
    materialCondition['not_sent_video']['flag'] &&
    materialCondition['not_sent_image']['flag'] &&
    materialCondition['not_sent_pdf']['flag']
  ) {
    materialQuery = [
      {
        type: { $in: ['videos', 'pdfs', 'images'] },
      },
    ];
  } else if (
    materialCondition['not_sent_video']['flag'] ||
    materialCondition['not_sent_image']['flag'] ||
    materialCondition['not_sent_pdf']['flag']
  ) {
    if (materialCondition['not_sent_video']['flag']) {
      materialQuery = [
        {
          type: 'videos',
          videos: mongoose.Types.ObjectId(
            materialCondition['not_sent_video']['material']
          ),
        },
      ];
    } else if (materialCondition['not_sent_pdf']['flag']) {
      materialQuery = [
        {
          type: 'pdfs',
          pdfs: mongoose.Types.ObjectId(
            materialCondition['not_sent_pdf']['material']
          ),
        },
      ];
    } else if (materialCondition['not_sent_image']['flag']) {
      materialQuery = [
        {
          type: 'images',
          images: mongoose.Types.ObjectId(
            materialCondition['not_sent_image']['material']
          ),
        },
      ];
    }
  }
  if (
    materialCondition['not_watched_video']['flag'] &&
    materialCondition['not_watched_image']['flag'] &&
    materialCondition['not_watched_pdf']['flag']
  ) {
    excludeMaterialQuery = [
      {
        type: { $in: ['videos', 'pdfs', 'images'] },
      },
    ];
    materialQuery = [
      {
        type: { $in: ['video_trackers', 'pdf_trackers', 'image_trackers'] },
      },
    ];
  } else if (
    materialCondition['not_watched_video']['flag'] ||
    materialCondition['not_watched_image']['flag'] ||
    materialCondition['not_watched_pdf']['flag']
  ) {
    if (materialCondition['not_watched_video']['flag']) {
      excludeMaterialQuery = [
        {
          type: 'videos',
          videos: mongoose.Types.ObjectId(
            materialCondition['not_watched_video']['material']
          ),
        },
      ];
      materialQuery = [
        {
          type: 'video_trackers',
          videos: mongoose.Types.ObjectId(
            materialCondition['not_watched_video']['material']
          ),
        },
      ];
    } else if (materialCondition['not_watched_image']['flag']) {
      excludeMaterialQuery = [
        {
          type: 'images',
          images: mongoose.Types.ObjectId(
            materialCondition['not_watched_image']['material']
          ),
        },
      ];
      materialQuery = [
        {
          type: 'image_trackers',
          images: mongoose.Types.ObjectId(
            materialCondition['not_watched_image']['material']
          ),
        },
      ];
    } else if (materialCondition['not_watched_pdf']['flag']) {
      excludeMaterialQuery = [
        {
          type: 'pdfs',
          pdfs: mongoose.Types.ObjectId(
            materialCondition['not_watched_pdf']['material']
          ),
        },
      ];
      materialQuery = [
        {
          type: 'pdf_trackers',
          pdfs: mongoose.Types.ObjectId(
            materialCondition['not_watched_pdf']['material']
          ),
        },
      ];
    }
  }
  if (
    materialCondition['not_sent_video']['flag'] ||
    materialCondition['not_sent_image']['flag'] ||
    materialCondition['not_sent_pdf']['flag']
  ) {
    if (materialQuery.length) {
      // const materialTime = new Date().getTime();
      const notMaterialActivities = await Activity.aggregate([
        {
          $match: {
            $and: [
              { user: mongoose.Types.ObjectId(currentUser._id) },
              { $and: materialQuery },
              { contacts: { $ne: null } },
            ],
          },
        },
        { $unwind: '$contacts' },
        {
          $group: {
            _id: { contact: '$contacts' },
            contact: { $last: '$contacts' },
          },
        },
      ]);
      excludeMaterialContacts = notMaterialActivities.map((e) => e.contact);
      // console.log('no-material runtime', new Date().getTime() - materialTime);
      if (excludeMaterialContacts.length) {
        query['$and'].push({ _id: { $nin: excludeMaterialContacts } });
      }
    }
  }
  if (
    materialCondition['not_watched_video']['flag'] ||
    materialCondition['not_watched_image']['flag'] ||
    materialCondition['not_watched_pdf']['flag']
  ) {
    if (materialQuery.length && excludeMaterialQuery.length) {
      const notMaterialActivities = await Activity.aggregate([
        {
          $match: {
            $and: [
              { user: mongoose.Types.ObjectId(currentUser._id) },
              { $and: materialQuery },
              { contacts: { $ne: null } },
            ],
          },
        },
        { $unwind: '$contacts' },
        {
          $group: {
            _id: { contact: '$contacts' },
            contact: { $last: '$contacts' },
          },
        },
      ]);
      excludeMaterialContacts = notMaterialActivities.map((e) => e.contact);
      const materialActivities = await Activity.aggregate([
        {
          $match: {
            $and: [
              { user: mongoose.Types.ObjectId(currentUser._id) },
              { $and: excludeMaterialQuery },
              { contacts: { $ne: null, $nin: excludeMaterialContacts } },
            ],
          },
        },
        { $unwind: '$contacts' },
        {
          $group: {
            _id: { contact: '$contacts' },
            contact: { $last: '$contacts' },
          },
        },
      ]);
      // console.log('no-material runtime', new Date().getTime() - materialTime);
      materialContacts = materialActivities.map((e) => e.contact);
    }
  }

  if (
    materialCondition['sent_video']['flag'] ||
    materialCondition['sent_image']['flag'] ||
    materialCondition['sent_pdf']['flag'] ||
    materialCondition['watched_video']['flag'] ||
    materialCondition['watched_image']['flag'] ||
    materialCondition['watched_pdf']['flag'] ||
    materialCondition['not_watched_video']['flag'] ||
    materialCondition['not_watched_image']['flag'] ||
    materialCondition['not_watched_pdf']['flag']
  ) {
    if (!materialContacts.length) {
      return res.send({
        status: true,
        data: [],
      });
    } else if (dealContactIds.length) {
      const intersected = _.intersection(materialContacts, dealContactIds);
      query['$and'].push({ _id: { $in: intersected } });
    } else {
      query['$and'].push({ _id: { $in: materialContacts } });
    }
  } else if (teamContactIds.length) {
    query['$and'].push({ _id: { $in: teamContactIds } });
  } else if (dealContactIds.length) {
    query['$and'].push({ _id: { $in: dealContactIds } });
  }

  if (searchStr) {
    var strQuery = {};
    var search = searchStr.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
    var phoneSearchStr = searchStr.replace(/[.*+\-?^${}()|[\]\\\s]/g, '');
    if (search.split(' ').length > 1) {
      const firstStr = search.split(' ')[0];
      const secondStr = search.split(' ')[1];
      strQuery = {
        $or: [
          {
            first_name: { $regex: '.*' + firstStr, $options: 'i' },
            last_name: { $regex: secondStr + '.*', $options: 'i' },
          },
          { first_name: { $regex: '.*' + search + '.*', $options: 'i' } },
          { last_name: { $regex: '.*' + search + '.*', $options: 'i' } },
          {
            cell_phone: { $regex: '.*' + phoneSearchStr + '.*', $options: 'i' },
          },
        ],
      };
    } else {
      strQuery = {
        $or: [
          { first_name: { $regex: '.*' + search + '.*', $options: 'i' } },
          { email: { $regex: '.*' + search + '.*', $options: 'i' } },
          { last_name: { $regex: '.*' + search + '.*', $options: 'i' } },
          {
            cell_phone: { $regex: '.*' + phoneSearchStr + '.*', $options: 'i' },
          },
        ],
      };
    }
    query['$and'].push(strQuery);
  }

  if (sourceCondition && sourceCondition.length) {
    let sources = sourceCondition;
    if (sourceCondition.indexOf(null) !== -1) {
      sources = [...sourceCondition, '', null];
    }
    var sourceQuery = {};
    if (includeSource) {
      sourceQuery = { source: { $in: sources } };
    } else {
      sourceQuery = { source: { $nin: sources } };
    }
    query['$and'].push(sourceQuery);
  }

  if (labelCondition && labelCondition.length) {
    var labelQuery;
    const labelConditionData = [];
    labelCondition.forEach((e) => {
      if (e) {
        labelConditionData.push(mongoose.Types.ObjectId(e));
      } else {
        labelConditionData.push(e);
      }
    });
    if (includeLabel) {
      labelQuery = { label: { $in: labelConditionData } };
    } else {
      labelQuery = { label: { $nin: labelConditionData } };
    }

    query['$and'].push(labelQuery);
  }

  if (tagsCondition && tagsCondition.length) {
    var tagsQuery;
    if (tagsCondition.indexOf(null) !== -1) {
      const index = tagsCondition.indexOf(null);
      tagsCondition.splice(index, 1);
      if (includeTag) {
        tagsQuery = {
          $or: [
            { tags: { $elemMatch: { $in: tagsCondition } } },
            { tags: [] },
            { tags: '' },
            { tags: null },
          ],
        };
      } else {
        tagsQuery = {
          $and: [
            { tags: { $nin: [[], '', null] } },
            { tags: { $not: { $in: tagsCondition } } },
          ],
        };
      }
    } else {
      if (includeTag) {
        tagsQuery = { tags: { $elemMatch: { $in: tagsCondition } } };
      } else {
        tagsQuery = { tags: { $not: { $in: tagsCondition } } };
      }
    }
    query['$and'].push(tagsQuery);
  }

  if (brokerageCondition && brokerageCondition.length) {
    let brokerages = brokerageCondition;
    if (brokerageCondition.indexOf(null) !== -1) {
      brokerages = [...brokerageCondition, '', null];
    }
    var brokerageQuery = {};
    if (includeBrokerage) {
      brokerageQuery = { brokerage: { $in: brokerages } };
    } else {
      brokerageQuery = { brokerage: { $nin: brokerages } };
    }
    query['$and'].push(brokerageQuery);
  }

  if (countryCondition && countryCondition.length) {
    var countryQuery = { country: { $in: countryCondition } };
    query['$and'].push(countryQuery);
  }

  if (regionCondition && regionCondition.length) {
    var regionQuery = { state: { $in: regionCondition } };
    query['$and'].push(regionQuery);
  }

  if (cityCondition && cityCondition.length) {
    var cityQuery = { city: { $regex: '.*' + cityCondition + '.*' } };
    query['$and'].push(cityQuery);
  }

  if (zipcodeCondition) {
    var zipQuery = { zip: { $regex: '.*' + zipcodeCondition + '.*' } };
    query['$and'].push(zipQuery);
  }

  // let results = [];
  // const resultContactIds = [];
  const lastActivityQuery = [];
  const lastActivityTimeQuery = [];
  if (
    (activityCondition && activityCondition.length) ||
    activityStart ||
    activityEnd ||
    lastMaterial['send_video']['flag'] ||
    lastMaterial['send_pdf']['flag'] ||
    lastMaterial['send_image']['flag'] ||
    lastMaterial['watched_video']['flag'] ||
    lastMaterial['watched_pdf']['flag'] ||
    lastMaterial['watched_image']['flag']
  ) {
    const clickLinkPos = activityCondition.indexOf('clicked_link');
    if (clickLinkPos !== -1) {
      activityCondition.splice(clickLinkPos, 1);
    }
    if (activityCondition && activityCondition.length) {
      lastActivityQuery.push({
        'last_activity.type': { $in: activityCondition },
      });
    }
    if (activityStart) {
      const activityStartDate = new Date(
        `${activityStart.year}-${activityStart.month}-${activityStart.day}`
      );
      lastActivityTimeQuery.push({
        'last_activity.created_at': { $gte: activityStartDate },
      });
    }
    if (activityEnd) {
      const activityEndDate = new Date(
        `${activityEnd.year}-${activityEnd.month}-${activityEnd.day}`
      );
      lastActivityTimeQuery.push({
        'last_activity.created_at': { $lte: activityEndDate },
      });
    }
    if (clickLinkPos !== -1) {
      const clickContent = 'clicked';
      const mQuery = {
        'last_activity.type': 'email_trackers',
        'last_activity.content': {
          $regex: '.*' + clickContent + '.*',
          $options: 'i',
        },
      };
      lastActivityQuery.push(mQuery);
    }
    if (lastMaterial['send_video']['flag']) {
      const mQuery = { 'last_activity.type': 'videos' };
      if (lastMaterial['send_video']['material']) {
        mQuery['last_activity.videos'] = lastMaterial['send_video']['material'];
      }
      lastActivityQuery.push(mQuery);
    }
    if (lastMaterial['send_pdf']['flag']) {
      const mQuery = { 'last_activity.type': 'pdfs' };
      if (lastMaterial['send_pdf']['material']) {
        mQuery['last_activity.pdfs'] = lastMaterial['send_pdf']['material'];
      }
      lastActivityQuery.push(mQuery);
    }
    if (lastMaterial['send_image']['flag']) {
      const mQuery = { 'last_activity.type': 'images' };
      if (lastMaterial['send_image']['material']) {
        mQuery['last_activity.images'] = lastMaterial['send_image']['material'];
      }
      lastActivityQuery.push(mQuery);
    }
    if (lastMaterial['watched_video']['flag']) {
      const mQuery = { 'last_activity.type': 'video_trackers' };
      if (lastMaterial['watched_video']['material']) {
        mQuery['last_activity.videos'] =
          lastMaterial['watched_video']['material'];
      }
      lastActivityQuery.push(mQuery);
    }
    if (lastMaterial['watched_pdf']['flag']) {
      const mQuery = { 'last_activity.type': 'pdf_trackers' };
      if (lastMaterial['watched_pdf']['material']) {
        mQuery['last_activity.pdfs'] = lastMaterial['watched_pdf']['material'];
      }
      lastActivityQuery.push(mQuery);
    }
    if (lastMaterial['watched_image']['flag']) {
      const mQuery = { 'last_activity.type': 'image_trackers' };
      if (lastMaterial['watched_image']['material']) {
        mQuery['last_activity.images'] =
          lastMaterial['watched_image']['material'];
      }
      lastActivityQuery.push(mQuery);
    }
  }
  // console.log('last activity query', lastActivityQuery);
  const startDate = new Date().getTime();
  let total = 0;
  let data;
  if (!action) {
    if (lastActivityQuery.length || lastActivityTimeQuery.length) {
      const lastActivityTimeTypeQuery = [...lastActivityTimeQuery];
      if (lastActivityQuery && lastActivityQuery.length) {
        lastActivityTimeTypeQuery.push({ $or: lastActivityQuery });
      }
      data = await Contact.aggregate([
        {
          $match: query,
        },
        {
          $sort: { [field]: dir },
        },
        {
          $lookup: {
            from: 'activities',
            localField: 'last_activity',
            foreignField: '_id',
            as: 'last_activity',
          },
        },
        {
          $unwind: '$last_activity',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'shared_members',
            foreignField: '_id',
            as: 'shared_members',
          },
        },
        {
          $match: {
            $and: lastActivityTimeTypeQuery,
          },
        },
        {
          $facet: {
            count: [{ $count: 'total' }],
            data: [
              {
                $skip: skip,
              },
              {
                $limit: count,
              },
            ],
          },
        },
      ]);
    } else {
      data = await Contact.aggregate([
        {
          $match: query,
        },
        {
          $sort: { [field]: dir },
        },
        {
          $lookup: {
            from: 'activities',
            localField: 'last_activity',
            foreignField: '_id',
            as: 'last_activity',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'shared_members',
            foreignField: '_id',
            as: 'shared_members',
          },
        },
        {
          $facet: {
            count: [{ $count: 'total' }],
            data: [
              {
                $skip: skip,
              },
              {
                $limit: count,
              },
            ],
          },
        },
      ]);
    }
    console.log(
      'executing time',
      new Date().getTime() - startDate,
      new Date().getTime() - runStartTime
    );
    let result = [];
    if (
      data &&
      data.length &&
      data[0].count &&
      data[0].count.length &&
      data[0].count[0]['total']
    ) {
      total = data[0].count[0]['total'];
      result = data[0].data;
    }

    // const total = await Contact.countDocuments({ user: currentUser.id });
    return res.send({
      status: true,
      data: result,
      total,
    });
  } else if (action === 'select') {
    if (lastActivityQuery.length || lastActivityTimeQuery.length) {
      const lastActivityTimeTypeQuery = [...lastActivityTimeQuery];
      if (lastActivityQuery && lastActivityQuery.length) {
        lastActivityTimeTypeQuery.push({ $or: lastActivityQuery });
      }
      data = await Contact.aggregate([
        {
          $match: query,
        },
        {
          $sort: { [field]: dir },
        },
        {
          $lookup: {
            from: 'activities',
            localField: 'last_activity',
            foreignField: '_id',
            as: 'last_activity',
          },
        },
        {
          $unwind: '$last_activity',
        },
        {
          $match: {
            $and: lastActivityTimeTypeQuery,
          },
        },
        {
          $project: {
            _id: 1,
            first_name: 1,
            last_name: 1,
            email: 1,
            cell_phone: 1,
          },
        },
      ]);
    } else {
      data = await Contact.aggregate([
        {
          $match: query,
        },
        {
          $sort: { [field]: dir },
        },
        {
          $project: {
            _id: 1,
            first_name: 1,
            last_name: 1,
            email: 1,
            cell_phone: 1,
          },
        },
      ]);
    }

    // const total = await Contact.countDocuments({ user: currentUser.id });
    return res.send({
      status: true,
      data,
    });
  }
};
const additionalFields = async (req, res) => {
  const { currentUser } = req;
  const garbage = await Garbage.findOne({ user: currentUser.id });
  let totalCount = 0;
  const counts = [];
  let query = {};
  for (const item of garbage.additional_fields) {
    const fieldName = item.name;
    query = { ['additional_field.' + fieldName]: { $nin: [null, ''] } };
    query['user'] = currentUser.id;
    totalCount = await Contact.countDocuments(query).catch((err) => {
      console.log('custom contact search is failed', err);
    });
    counts.push(totalCount);
  }
  return res.send({
    status: true,
    total: counts,
    data: garbage,
  });
};

const additionalFieldSearch = async (req, res) => {
  const { currentUser } = req;
  const { fieldName, str } = req.body;
  const garbage = await GarbageHelper.get(currentUser);
  let totalCount = 0;
  let data = [];
  let query = {};
  const search = str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  const phoneSearch = str.replace(/[.*+\-?^${}()|[\]\\\s]/g, '');
  const selectedField = (garbage.additional_fields || []).filter(
    (e) => e.name === fieldName
  )[0];
  if (!str) {
    query = { ['additional_field.' + fieldName]: { $nin: [null, ''] } };
  } else if (str === 'all') {
    query = { ['additional_field.' + fieldName]: { $nin: [null, ''] } };
  } else {
    if (
      !selectedField ||
      selectedField.type === 'text' ||
      selectedField.type === 'email'
    ) {
      query = {
        ['additional_field.' + fieldName]: {
          $regex: '.*' + search + '.*',
          $options: 'i',
        },
      };
    } else if (selectedField.type === 'phone') {
      query = {
        ['additional_field.' + fieldName]: {
          $regex: '.*' + phoneSearch + '.*',
          $options: 'i',
        },
      };
    } else if (selectedField.type === 'dropdown') {
      query = {
        ['additional_field.' + fieldName]: str,
      };
    }
  }
  query['user'] = currentUser.id;
  totalCount = await Contact.countDocuments(query).catch((err) => {
    console.log('custom contact search is failed', err);
  });
  if (totalCount) {
    data = await Contact.find(query)
      .populate({ path: 'last_activity' })
      .catch((err) => {
        console.log('custom contact search is failed.', err);
      });
  }
  return res.send({
    status: true,
    data,
    total: totalCount,
  });
};

const getBrokerages = async (req, res) => {
  const { currentUser } = req;

  const data = await Contact.aggregate([
    {
      $match: { user: mongoose.Types.ObjectId(currentUser.id) },
    },
    { $group: { _id: '$brokerage' } },
    {
      $sort: { _id: 1 },
    },
  ]).catch((err) => {
    console.log('err', err);
  });

  return res.send({
    status: true,
    data,
  });
};

const getSources = async (req, res) => {
  const { currentUser } = req;

  const data = await Contact.aggregate([
    {
      $match: { user: mongoose.Types.ObjectId(currentUser.id) },
    },
    { $group: { _id: '$source' } },
    {
      $sort: { _id: 1 },
    },
  ]).catch((err) => {
    console.log('err', err);
  });

  return res.send({
    status: true,
    data,
  });
};

const getCities = async (req, res) => {
  const { currentUser } = req;

  const data = await Contact.aggregate([
    {
      $match: { user: mongoose.Types.ObjectId(currentUser.id) },
    },
    { $group: { _id: '$city' } },
    {
      $sort: { _id: 1 },
    },
  ]).catch((err) => {
    console.log('err', err);
  });

  return res.send({
    status: true,
    data,
  });
};

const getNthContact = async (req, res) => {
  const { currentUser } = req;
  const skip = req.params.id;

  const contact = await Contact.aggregate([
    {
      $match: { user: currentUser.id },
    },
    {
      $sort: { first_name: 1 },
    },
    {
      $skip: skip,
    },
  ]);
};

const loadFollows = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.body;

  const _follow_up = await FollowUp.find({
    user: currentUser.id,
    contact,
    status: { $ne: -1 },
  }).sort({ due_date: 1 });
  return res.send({
    status: true,
    follow_ups: _follow_up,
  });
};

const loadTimelines = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.body;

  const _timelines = await TimeLine.find({
    user: currentUser.id,
    contact,
  });
  let automation = {};
  if (_timelines.length) {
    automation = await Automation.findOne({ _id: _timelines[0]['automation'] })
      .select({ title: 1 })
      .catch((err) => {
        console.log('err', err);
      });
  }
  return res.send({
    status: true,
    timelines: _timelines,
    automation,
  });
};

const selectAllContacts = async (req, res) => {
  const { currentUser } = req;

  const contacts = await Contact.find({
    $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
  }).select('_id');
  return res.send({
    status: true,
    data: contacts,
  });
};

const getAllContacts = async (req, res) => {
  const { currentUser } = req;

  const contacts = await Contact.find({
    $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
  }).select({
    _id: 1,
    first_name: 1,
    last_name: 1,
    email: 1,
    cell_phone: 1,
  });
  return res.send({
    status: true,
    data: contacts,
  });
};

const checkEmail = async (req, res) => {
  const { currentUser } = req;
  const { email } = req.body;

  const contacts = await Contact.find({
    user: currentUser.id,
    email: { $regex: new RegExp('^' + email + '$', 'i') },
  });
  return res.send({
    status: true,
    data: contacts,
  });
};

const checkPhone = async (req, res) => {
  const { currentUser } = req;
  const { cell_phone } = req.body;

  if (typeof cell_phone === 'object') {
    return res.send({
      data: [],
      status: true,
    });
  }

  const contacts = await Contact.find({
    user: currentUser.id,
    cell_phone,
  });
  return res.send({
    status: true,
    data: contacts,
  });
};

const loadDuplication = async (req, res) => {
  const { currentUser } = req;
  const duplications = await Contact.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(currentUser._id),
      },
    },
    {
      $group: {
        _id: { email: '$email' },
        count: { $sum: 1 },
        contacts: { $push: '$$ROOT' },
      },
    },
    {
      $match: { count: { $gte: 2 } },
    },
  ]).catch((err) => {
    console.log('err', err);
    return res.status(500).send({
      status: false,
      error: err.error,
    });
  });

  return res.send({
    status: true,
    data: duplications,
  });
};

/**
const mergeContacts = (req, res) => {
  const { currentUser } = req;
  const { primary, secondaries, result } = req.body;
  delete result['_id'];
  Contact.updateOne({ _id: mongoose.Types.ObjectId(primary) }, { $set: result })
    .then((data) => {
      Contact.deleteMany({ _id: { $in: secondaries } })
        .then(async (data) => {
          await Activity.deleteMany({
            contacts: { $in: secondaries },
            type: 'contacts',
          });
          await Activity.updateMany(
            { contacts: { $in: secondaries } },
            { $set: { contacts: mongoose.Types.ObjectId(primary) } }
          );
          await EmailTracker.updateMany(
            { contact: { $in: secondaries } },
            { $set: { contact: mongoose.Types.ObjectId(primary) } }
          );
          await Email.updateMany(
            { contacts: { $in: secondaries } },
            { $set: { contacts: mongoose.Types.ObjectId(primary) } }
          );
          await FollowUp.updateMany(
            { contact: { $in: secondaries } },
            { $set: { contact: mongoose.Types.ObjectId(primary) } }
          );
          await ImageTracker.updateMany(
            { contact: { $in: secondaries } },
            { $set: { contact: mongoose.Types.ObjectId(primary) } }
          );
          await Note.updateMany(
            { contact: { $in: secondaries } },
            { $set: { contact: mongoose.Types.ObjectId(primary) } }
          );
          await PDFTracker.updateMany(
            { contact: { $in: secondaries } },
            { $set: { contact: mongoose.Types.ObjectId(primary) } }
          );
          await PhoneLog.updateMany(
            { contact: { $in: secondaries } },
            { $set: { contact: mongoose.Types.ObjectId(primary) } }
          );
          await Reminder.updateMany(
            { contact: { $in: secondaries } },
            { $set: { contact: mongoose.Types.ObjectId(primary) } }
          );
          await VideoTracker.updateMany(
            { contact: { $in: secondaries } },
            { $set: { contact: mongoose.Types.ObjectId(primary) } }
          );
          return res.send({
            status: true,
          });
        })
        .catch((e) => {
          console.log('error', e);
          return res.status(500).send({
            status: false,
            error: e.error,
          });
        });
      // TimeLine.updateMany({contact: {$in: secondaries}}, {$set: {contact: mongoose.Types.ObjectId(primary)}});
    })
    .catch((e) => {
      console.log('error', e);
      return res.status(500).send({
        status: false,
        error: e.error,
      });
    });
};
 */

const bulkCreate = async (req, res) => {
  const { contacts } = req.body;
  const { currentUser } = req;
  let count = 0;
  let max_upload_count = 0;
  const contact_info = currentUser.contact_info;

  if (contact_info['is_limit']) {
    count = await Contact.countDocuments({ user: currentUser.id });
    max_upload_count =
      contact_info.max_count || system_settings.CONTACT_UPLOAD_LIMIT.PRO;
  }

  if (contact_info['is_limit'] && max_upload_count <= count) {
    return res.status(412).send({
      status: false,
      error: 'Exceed upload max contacts',
    });
  }

  const failure = [];
  const succeed = [];
  const promise_array = [];
  let detail_content = 'added';
  if (req.guest_loggin) {
    detail_content = ActivityHelper.assistantLog(detail_content);
  }

  for (let i = 0; i < contacts.length; i++) {
    const promise = new Promise(async (resolve, reject) => {
      const data = { ...contacts[i] };
      count += 1;
      if (contact_info['is_limit'] && max_upload_count <= count) {
        const field = {
          data,
          message: 'Exceed upload max contacts',
        };
        failure.push(field);
        resolve();
        return;
      }

      if (data['email']) {
        const email_contact = await Contact.findOne({
          email: data['email'],
          user: currentUser.id,
        }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (email_contact) {
          failure.push({ message: 'duplicate', data });

          let existing = false;
          failure.some((item) => {
            if (item.data._id == email_contact.id) {
              existing = true;
              return true;
            }
          });
          if (!existing) {
            failure.push({ message: 'duplicate', data: email_contact });
          }
          resolve();
          return;
        }
      }

      if (data['cell_phone']) {
        data['cell_phone'] = phone(data['cell_phone'])[0];
      }

      if (data['cell_phone']) {
        const phone_contact = await Contact.findOne({
          cell_phone: data['cell_phone'],
          user: currentUser.id,
        }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (phone_contact) {
          failure.push({ message: 'duplicate', data });

          let existing = false;
          failure.some((item) => {
            if (item.data._id == phone_contact.id) {
              existing = true;
              return true;
            }
          });
          if (!existing) {
            failure.push({ message: 'duplicate', data: phone_contact });
          }
          resolve();
          return;
        }
      }

      if (data['label']) {
        data['label'] = await LabelHelper.convertLabel(
          currentUser.id,
          data['label']
        );
      } else {
        delete data.label;
      }

      const contact = new Contact({
        ...data,
        user: currentUser.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
      contact
        .save()
        .then((_contact) => {
          succeed.push(_contact);

          const activity = new Activity({
            content: detail_content,
            contacts: _contact.id,
            user: currentUser.id,
            type: 'contacts',
            created_at: new Date(),
            updated_at: new Date(),
          });
          activity
            .save()
            .then((_activity) => {
              Contact.updateOne(
                { _id: _contact.id },
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
          resolve();
        })
        .catch((err) => {
          console.log('err', err);
        });
    });

    promise_array.push(promise);
  }

  Promise.all(promise_array).then(function () {
    const contact_info = {
      count,
      max_upload_count,
    };
    currentUser.contact = contact_info;
    currentUser.save().catch((err) => {
      console.log('user save err', err.message);
    });
    return res.send({
      status: true,
      failure,
      succeed,
    });
  });
};

const verifyEmail = async (email) => {
  // const { email } = req.body;
  const verifier = new Verifier(api.EMAIL_VERIFICATION_KEY, {
    checkFree: false,
    checkDisposable: false,
    checkCatchAll: false,
  });

  return new Promise((resolve, reject) => {
    verifier.verify(email, (err, data) => {
      if (err) {
        reject(false);
      }
      if (
        data['formatCheck'] === 'true' &&
        data['smtpCheck'] === 'true' &&
        data['dnsCheck'] === 'true'
      ) {
        resolve(true);
      } else {
        reject(false);
      }
    });
  });
};

const verifyPhone = async (req, res) => {
  const { cell_phone } = req.body;
  const e164Phone = phone(cell_phone)[0];

  if (e164Phone) {
    return res.send({
      status: true,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Invalid Phone Number',
    });
  }
};

const capitalize = (s) => {
  if ((typeof s).toLowerCase() !== 'string') return;
  if (s.split(' ').length === 2) {
    const s1 = s.split(' ')[0];
    const s2 = s.split(' ')[1];

    return `${s1.charAt(0).toUpperCase() + s1.slice(1).toLowerCase()} ${s2
      .charAt(0)
      .toUpperCase()}${s2.slice(1).toLowerCase()}`;
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const interestContact = async (req, res) => {
  const { user, contact, material, materialType } = req.body;
  const _exist = await Contact.findOne({
    _id: contact,
    user,
  }).catch((err) => {
    return res.status(400).send({
      status: false,
      error: err.message,
    });
  });
  if (_exist) {
    let _activity;
    if (materialType === 'video') {
      _activity = new Activity({
        content: 'gave thumbs up',
        contacts: _exist.id,
        user,
        type: 'videos',
        videos: material,
      });
    } else if (materialType === 'pdf') {
      _activity = new Activity({
        content: 'gave thumbs up',
        contacts: _exist.id,
        user,
        type: 'pdfs',
        pdfs: material,
      });
    } else if (materialType === 'image') {
      _activity = new Activity({
        content: 'gave thumbs up',
        contacts: _exist.id,
        user,
        type: 'images',
        images: material,
      });
    }

    const activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('activity save err', err.message);
      });

    return res.json({
      status: true,
      data: {
        contact: _exist.id,
        activity: activity.id,
      },
    });
  }
};

const interestSubmitContact = async (req, res) => {
  const { user, first_name, email, cell_phone, material, materialType } =
    req.body;
  let _exist = await Contact.findOne({
    email,
    user,
  }).catch((err) => {
    return res.status(400).send({
      status: false,
      error: err.message,
    });
  });

  if (!_exist) {
    _exist = await Contact.findOne({
      cell_phone,
      user,
    }).catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
  }

  let video;
  let pdf;
  let image;
  if (materialType === 'video') {
    video = material;
  }
  if (materialType === 'pdf') {
    pdf = material;
  }
  if (materialType === 'image') {
    image = material;
  }

  if (_exist) {
    let _activity;
    if (video) {
      _activity = new Activity({
        content: 'INTERESTED',
        contacts: _exist.id,
        user,
        type: 'videos',
        videos: video,
      });
    } else if (pdf) {
      _activity = new Activity({
        content: 'INTERESTED',
        contacts: _exist.id,
        user,
        type: 'pdfs',
        pdfs: pdf,
      });
    } else if (image) {
      _activity = new Activity({
        content: 'INTERESTED',
        contacts: _exist.id,
        user,
        type: 'images',
        images: image,
      });
    }

    const activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });

    return res.json({
      status: true,
      data: {
        contact: _exist.id,
        activity: activity.id,
      },
    });
  } else {
    if (email) {
      const { error } = await verifyEmail(email).catch((err) => {
        return {
          error: err.message,
        };
      });
      if (error) {
        res.status(400).json({
          status: false,
          error,
        });
      }
    }
    const e164Phone = phone(cell_phone)[0];

    if (!e164Phone) {
      return res.status(400).json({
        status: false,
        error: 'Invalid Phone Number',
      });
    }

    const label = system_settings.LEAD;
    const _contact = new Contact({
      first_name,
      email,
      cell_phone: e164Phone,
      label,
      tags: ['interested'],
      user,
    });

    if (video) {
      _contact
        .save()
        .then(async (contact) => {
          const _video = await Video.findOne({ _id: video }).catch((err) => {
            console.log('video found err', err.message);
          });
          const currentUser = await User.findOne({ _id: user }).catch((err) => {
            console.log('current user found err', err.message);
          });

          const _activity = new Activity({
            content: 'INTERESTED',
            contacts: contact.id,
            user: currentUser.id,
            type: 'videos',
            videos: video,
            created_at: new Date(),
            updated_at: new Date(),
          });

          const activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          // Create Notification for interested video lead capture
          createNotification(
            'video_interesting_capture',
            {
              criteria: 'lead_capture',
              contact,
              video: _video,
            },
            currentUser
          );

          Contact.updateOne(
            { _id: contact.id },
            { $set: { last_activity: activity.id } }
          ).catch((err) => {
            console.log('contact update err', err.message);
          });

          return res.send({
            status: true,
            data: {
              contact: contact.id,
              activity: activity.id,
            },
          });
        })
        .catch((err) => {
          return res.status(400).send({
            status: false,
            error: err.message,
          });
        });
    } else if (pdf) {
      _contact
        .save()
        .then(async (contact) => {
          const _pdf = await PDF.findOne({ _id: pdf }).catch((err) => {
            console.log('err', err);
          });
          const currentUser = await User.findOne({ _id: user }).catch((err) => {
            console.log('err', err);
          });

          const _activity = new Activity({
            content: 'INTERESTED',
            contacts: contact.id,
            user: currentUser.id,
            type: 'pdfs',
            pdfs: pdf,
            created_at: new Date(),
            updated_at: new Date(),
          });

          const activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          // Create Notification for interested pdf lead capture
          createNotification(
            'pdf_interesting_capture',
            {
              criteria: 'lead_capture',
              contact,
              pdf: _pdf,
            },
            currentUser
          );

          Contact.updateOne(
            { _id: contact.id },
            { $set: { last_activity: activity.id } }
          ).catch((err) => {
            console.log('err', err);
          });

          return res.send({
            status: true,
            data: {
              contact: contact.id,
              activity: activity.id,
            },
          });
        })
        .catch((err) => {
          return res.status(500).send({
            status: false,
            error: err.message,
          });
        });
    } else if (image) {
      _contact
        .save()
        .then(async (contact) => {
          const _image = await Image.findOne({ _id: image }).catch((err) => {
            console.log('err', err);
          });
          const currentUser = await User.findOne({ _id: user }).catch((err) => {
            console.log('err', err);
          });

          const _activity = new Activity({
            content: 'INTERESTED',
            contacts: contact.id,
            user: currentUser.id,
            type: 'images',
            images: image,
            created_at: new Date(),
            updated_at: new Date(),
          });

          const activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          // Create Notification for the interested image lead
          createNotification(
            'image_interesting_capture',
            {
              criteria: 'lead_capture',
              contact,
              image: _image,
            },
            currentUser
          );

          Contact.updateOne(
            { _id: contact.id },
            { $set: { last_activity: activity.id } }
          ).catch((err) => {
            console.log('err', err);
          });

          return res.send({
            status: true,
            data: {
              contact: contact.id,
              activity: activity.id,
            },
          });
        })
        .catch((err) => {
          return res.status(400).send({
            status: false,
            error: err.message,
          });
        });
    }
  }
};

const resubscribe = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.body;

  const _activity = new Activity({
    user: currentUser.id,
    contacts: contact,
    content: 'resubscribed',
    type: 'emails',
  });
  const activity = await _activity
    .save()
    .then()
    .catch((err) => {
      console.log('err', err.message);
    });
  Contact.updateOne(
    { _id: contact },
    {
      $set: { last_activity: activity.id },
      $pull: { tags: { $in: ['unsubscribed'] } },
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const getSharedContact = async (req, res) => {
  const { currentUser } = req;

  if (req.params.id === 'null' || req.params.id === 'undefined') {
    return res.status(400).json({
      status: false,
      error: 'Invalid Contact',
    });
  }

  const _contact = await Contact.findOne({
    _id: req.params.id,
  })
    .populate('label')
    .catch((err) => {
      console.log('contact found err', err.message);
    });

  const team = await Team.findOne({
    $or: [
      {
        owner: currentUser.id,
        members: mongoose.Types.ObjectId(_contact.user[0]),
      },
      {
        editors: currentUser.id,
        members: mongoose.Types.ObjectId(_contact.user[0]),
      },
    ],
  });

  if (_contact && team) {
    const _activity_list = await Activity.find({
      contacts: req.params.id,
    }).sort({ updated_at: 1 });
    const _activity_detail_list = [];

    for (let i = 0; i < _activity_list.length; i++) {
      const _activity_detail = await Activity.aggregate([
        {
          $lookup: {
            from: _activity_list[i].type,
            localField: _activity_list[i].type,
            foreignField: '_id',
            as: 'activity_detail',
          },
        },
        {
          $match: { _id: _activity_list[i]._id },
        },
      ]);

      _activity_detail_list.push(_activity_detail[0]);
    }

    const myJSON = JSON.stringify(_contact);
    const contact = JSON.parse(myJSON);
    const data = await Object.assign(contact, {
      activity: _activity_detail_list,
    });

    return res.send({
      status: true,
      data,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contact not found',
    });
  }
};

const mergeContact = async (req, res) => {
  const { currentUser } = req;
  const { primary_contact, secondary_contact } = req.body;
  const editData = { ...req.body };

  delete editData.primary_contact;
  delete editData.secondary_contact;

  if (editData.activity_merge) {
    switch (editData.activity_merge) {
      case 'both': {
        Activity.updateMany(
          {
            contacts: secondary_contact,
          },
          {
            $set: { contacts: mongoose.Types.ObjectId(primary_contact) },
          }
        ).catch((err) => {
          console.log('activity update err', err.message);
        });

        VideoTracker.updateMany(
          { contact: secondary_contact },
          { $set: { contact: mongoose.Types.ObjectId(primary_contact) } }
        );

        PDFTracker.updateMany(
          { contact: secondary_contact },
          { $set: { contact: mongoose.Types.ObjectId(primary_contact) } }
        );

        ImageTracker.updateMany(
          { contact: secondary_contact },
          { $set: { contact: mongoose.Types.ObjectId(primary_contact) } }
        );

        EmailTracker.updateMany(
          { contact: secondary_contact },
          { $set: { contact: mongoose.Types.ObjectId(primary_contact) } }
        );

        // Migration Needed
        Email.updateMany(
          {
            user: currentUser._id,
            contacts: { $elemMatch: { $in: [secondary_contact] } },
          },
          { $addToSet: { contacts: primary_contact } }
        ).then(() => {
          Email.updateMany(
            {
              user: currentUser._id,
              contacts: { $elemMatch: { $in: [secondary_contact] } },
            },
            { $pull: { contacts: secondary_contact } }
          ).then(() => {
            Email.updateMany(
              {
                user: currentUser._id,
                contacts: secondary_contact,
              },
              { $set: { contacts: mongoose.Types.ObjectId(primary_contact) } }
            );
          });
        });
        break;
      }

      case 'primary': {
        Activity.deleteMany({
          contacts: secondary_contact,
        }).catch((err) => {
          console.log('activity remove err', err.message);
        });
        break;
      }

      case 'remove': {
        Activity.deleteMany({
          contacts: { $in: [primary_contact, secondary_contact] },
        }).catch((err) => {
          console.log('activity remove err', err.message);
        });
        break;
      }
    }
  }

  if (editData.followup_merge) {
    switch (editData.followup_merge) {
      case 'both': {
        FollowUp.updateMany(
          {
            contact: secondary_contact,
          },
          {
            $set: { contact: primary_contact },
          }
        ).catch((err) => {
          console.log('followup update err', err.message);
        });
        break;
      }
      case 'primary': {
        FollowUp.deleteMany({
          contact: secondary_contact,
        }).catch((err) => {
          console.log('followup remove err', err.message);
        });
        break;
      }
      case 'remove': {
        FollowUp.deleteMany({
          contact: { $in: [primary_contact, secondary_contact] },
        }).catch((err) => {
          console.log('followup remove err', err.message);
        });
        break;
      }
    }
  }

  if (editData.automation_merge) {
    switch (editData.automation_merge) {
      case 'primary': {
        TimeLine.deleteMany({
          contact: secondary_contact,
        }).catch((err) => {
          console.log('timeline remove err', err.message);
        });
        break;
      }
      case 'remove': {
        TimeLine.deleteMany({
          contact: { $in: [primary_contact, secondary_contact] },
        }).catch((err) => {
          console.log('timeline remove err', err.message);
        });
        break;
      }
    }
  }

  Contact.findOneAndUpdate(
    {
      _id: primary_contact,
    },
    {
      $set: editData,
    },
    { new: true }
  )
    .then((data) => {
      Contact.deleteOne({ _id: secondary_contact }).catch((err) => {
        console.log('contact delete err', err.message);
      });

      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      console.log('contact update err', err.message);
    });
};

const updateContact = async (req, res) => {
  const { label, cell_phone } = req.body;
  const { currentUser } = req;

  if (label) {
    req.body.label = await LabelHelper.convertLabel(currentUser.id, label);
  } else {
    delete req.body.label;
  }
  if (cell_phone) {
    req.body.cell_phone = phone(cell_phone)[0];
  } else {
    delete req.body.cell_phone;
  }
  if (req.body.notes && req.body.notes.length > 0) {
    let note_content = 'added note';
    if (req.guest_loggin) {
      note_content = ActivityHelper.assistantLog(note_content);
    }

    for (let i = 0; i < req.body.notes.length; i++) {
      // const { content, title } = req.body['notes'][i];
      const content = req.body['notes'][i];
      const note = new Note({
        content,
        contact: req.body.id,
        user: currentUser.id,
      });

      note.save().then((_note) => {
        const _activity = new Activity({
          content: note_content,
          contacts: req.body.id,
          user: currentUser.id,
          type: 'notes',
          notes: _note.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        _activity
          .save()
          .then((__activity) => {
            Contact.updateOne(
              { _id: req.body.id },
              { $set: { last_activity: __activity.id } }
            ).catch((err) => {
              console.log('err', err);
            });
          })
          .catch((err) => {
            console.log('error', err);
          });
      });
    }
  }

  Contact.updateOne(
    {
      _id: req.body.id,
      user: currentUser.id,
    },
    {
      $set: {
        ...req.body,
      },
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('contact update err', err.message);
      return res.send({
        status: false,
        error: 'Internal server error',
      });
    });
};

const shareContacts = async (req, res) => {
  const { currentUser } = req;
  const { contacts, type } = req.body;
  const promise_array = [];
  const data = [];
  const error = [];
  let contacts_html = '';

  const shareTeam = await Team.findOne({ _id: req.body.team }).catch((err) => {
    console.log('team not found', err.message);
  });

  const user = await User.findOne({
    _id: req.body.user,
  }).catch((err) => {
    console.log('user find err', err.message);
  });

  for (let i = 0; i < contacts.length; i++) {
    const promise = new Promise(async (resolve, reject) => {
      const contact = await Contact.findOne({
        _id: contacts[i],
        user: currentUser.id,
      }).catch((err) => {
        console.log('contact find err', err.message);
      });

      if (!contact) {
        const _contact = await Contact.findOne({
          _id: contacts[i],
        }).catch((err) => {
          console.log('contact find err', err.message);
        });
        error.push({
          contact: _contact,
          error: 'Invalid permission',
        });

        resolve();
      } else {
        const activity_content = 'shared contact';

        if (type == 1) {
          const active_followup = await FollowUp.findOne({
            contact: contacts[i],
            due_date: { $exists: true },
            status: 0,
          });
          const active_timeline = await TimeLine.findOne({
            contact: contacts[i],
          });
          const active_task = await Task.findOne({
            status: { $in: ['active', 'draft'] },
            contacts: contacts[i],
          });
          const active_deal = await Deal.findOne({
            contacts: contacts[i],
          });

          if (
            active_followup ||
            active_timeline ||
            active_task ||
            active_deal
          ) {
            error.push({
              contact,
              error: 'Running job',
            });
            resolve();
          } else {
            const activity = new Activity({
              user: currentUser.id,
              contacts: contacts[i],
              content: activity_content,
              users: req.body.user,
              type: 'users',
            });

            activity.save().catch((err) => {
              console.log('activity save err', err.message);
            });

            Contact.updateOne(
              {
                _id: contacts[i],
              },
              {
                $set: { user: req.body.user },
              }
            )
              .then(() => {
                const first_name = contact.first_name || '';
                const last_name = contact.last_name || '';
                const name = {
                  first_name,
                  last_name,
                };
                const contact_link = urls.CONTACT_PAGE_URL + contact.id;
                const contact_html = `<tr style="margin-bottom:10px;">
                                        <td>
                                          <span class="icon-user">${getAvatarName(
                                            name
                                          )}</span>
                                        </td>
                                        <td style="padding-left:5px;">
                                          <a class="contact-name" href="${contact_link}">${first_name} ${last_name}</a>
                                        </td>
                                      </tr>`;
                contacts_html += contact_html;

                const myJSON = JSON.stringify(contact);
                const _contact = JSON.parse(myJSON);
                data.push(_contact);
                resolve();
              })
              .catch((err) => {
                console.log('contact update err', err.message);
              });
          }
        } else if (type == 2) {
          const activity = new Activity({
            user: currentUser.id,
            contacts: contacts[i],
            content: activity_content,
            users: req.body.user,
            type: 'users',
          });

          activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });

          Contact.updateOne(
            {
              _id: contacts[i],
            },
            {
              $set: {
                shared_contact: true,
                shared_team: req.body.team,
              },
              $push: {
                shared_members: req.body.user,
              },
            }
          )
            .then(() => {
              const first_name = contact.first_name || '';
              const last_name = contact.last_name || '';
              const name = {
                first_name,
                last_name,
              };
              const contact_link = urls.CONTACT_PAGE_URL + contact.id;
              const contact_html = `<tr style="margin-bottom:10px;">
                                      <td>
                                        <span class="icon-user">${getAvatarName(
                                          name
                                        )}</span>
                                      </td>
                                      <td style="padding-left:5px;">
                                        <a class="contact-name" href="${contact_link}">${first_name} ${last_name}</a>
                                      </td>
                                    </tr>`;
              contacts_html += contact_html;

              const myJSON = JSON.stringify(contact);
              const _contact = JSON.parse(myJSON);
              _contact.shared_members.push({
                user_name: user.user_name,
                picture_profile: user.picture_profile,
                email: user.email,
                cell_phone: user.cell_phone,
              });
              data.push(_contact);
              resolve();
            })
            .catch((err) => {
              console.log('contact update err', err.message);
            });
        } else if (type == 3) {
          const copied_contact = new Contact({
            ...contact._doc,
            user: req.body.user,
            _id: undefined,
          });

          copied_contact
            .save()
            .then((cloned_contact) => {
              const activity = new Activity({
                user: currentUser.id,
                contacts: cloned_contact,
                content: activity_content,
                users: req.body.user,
                type: 'users',
              });

              activity.save().catch((err) => {
                console.log('activity save err', err.message);
              });

              const first_name = contact.first_name || '';
              const last_name = contact.last_name || '';
              const name = {
                first_name,
                last_name,
              };
              const contact_link = urls.CONTACT_PAGE_URL + contact.id;
              const contact_html = `<tr style="margin-bottom:10px;">
                                      <td>
                                        <span class="icon-user">${getAvatarName(
                                          name
                                        )}</span>
                                      </td>
                                      <td style="padding-left:5px;">
                                        <a class="contact-name" href="${contact_link}">${first_name} ${last_name}</a>
                                      </td>
                                    </tr>`;
              contacts_html += contact_html;

              const myJSON = JSON.stringify(contact);
              const _contact = JSON.parse(myJSON);
              data.push(_contact);
              resolve();
            })
            .catch((err) => {
              console.log('contact update err', err.message);
            });
        }
      }
    });
    promise_array.push(promise);
  }

  Promise.all(promise_array)
    .then(() => {
      if (data.length > 0) {
        const params = {
          template_data: {
            user_name: currentUser.user_name,
            team_member_name: user.user_name,
            team_name: shareTeam.name,
            created_at: moment().format('h:mm MMMM Do, YYYY'),
            html: contacts_html,
          },
          template_name: 'ShareContact',
          required_reply: false,
          email: user.email,
        };

        // Create the promise and SES service object
        sendNotificationEmail(params);

        const sharedContacts = data.map((e) => e._id);
        const notification = new Notification({
          creator: currentUser._id,
          user: req.body.user,
          criteria: 'contact_shared',
          contact: sharedContacts,
          team: shareTeam._id,
          content: `${currentUser.user_name} have shared a contact in CRMGrow`,
        });

        // Notification
        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });
      }
      return res.send({
        status: true,
        data,
        error,
      });
    })
    .catch((err) => {
      console.log('contact share err', err);
      return res.status(400).json({
        status: false,
        error: err,
      });
    });
};

const stopShare = async (req, res) => {
  const { currentUser } = req;
  const { contacts } = req.body;
  const promise_array = [];
  const data = [];
  const error = [];

  const shareTeam = await Team.findOne({ _id: req.body.team }).catch((err) => {
    console.log('team not found', err.message);
  });

  const user = await User.findOne({
    _id: req.body.user,
  }).catch((err) => {
    console.log('user find err', err.message);
  });

  for (let i = 0; i < contacts.length; i++) {
    const promise = new Promise(async (resolve, reject) => {
      const contact = await Contact.findOne({
        _id: contacts[i],
        user: currentUser.id,
      })
        .populate([
          { path: 'last_activity' },
          {
            path: 'shared_members',
            select: {
              user_name: 1,
              picture_profile: 1,
              email: 1,
              cell_phone: 1,
            },
          },
          {
            path: 'user',
            select: {
              user_name: 1,
              picture_profile: 1,
              email: 1,
              cell_phone: 1,
            },
          },
        ])
        .catch((err) => {
          console.log('contact find err', err.message);
        });

      if (!contact) {
        const _contact = await Contact.findOne({
          _id: contacts[i],
        }).catch((err) => {
          console.log('contact find err', err.message);
        });
        error.push({
          contact: {
            _id: contacts[i],
            first_name: _contact.first_name,
            email: _contact.email,
          },
          error: 'Invalid permission',
        });

        resolve();
      }

      const activity_content = 'stopped sharing contact';
      const activity = new Activity({
        user: currentUser.id,
        contact: contacts[i],
        content: activity_content,
        users: req.body.user,
        type: 'users',
      });

      activity.save().catch((err) => {
        console.log('activity save err', err.message);
      });

      let query;
      if (contact.shared_members && contact.shared_members.length > 1) {
        query = {
          $pull: {
            shared_members: req.body.user,
          },
        };
      } else {
        query = {
          $unset: {
            shared_contact: true,
            shared_team: true,
            shared_members: true,
          },
        };
      }

      Contact.updateOne(
        {
          _id: contacts[i],
        },
        {
          ...query,
        }
      )
        .then(() => {
          const first_name = contact.first_name || '';
          const last_name = contact.last_name || '';
          const name = {
            first_name,
            last_name,
          };

          const myJSON = JSON.stringify(contact);
          const _contact = JSON.parse(myJSON);
          _contact.shared_members.push({
            user_name: user.user_name,
            picture_profile: user.picture_profile,
            email: user.email,
            cell_phone: user.cell_phone,
          });
          data.push(_contact);
          resolve();
        })
        .catch((err) => {
          console.log('contact update err', err.message);
        });
    });
    promise_array.push(promise);
  }

  Promise.all(promise_array)
    .then(() => {
      if (data.length) {
        const stoppedContact = data.map((e) => e._id);
        const notification = new Notification({
          creator: currentUser._id,
          user: req.body.user,
          criteria: 'stop_share_contact',
          contact: stoppedContact,
          team: shareTeam ? shareTeam._id : '',
          content: `${currentUser.user_name} has stop the contact sharing in CRMGrow`,
        });

        // Notification
        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });
      }
      if (error.length > 0) {
        return res.status(405).json({
          status: false,
          error,
        });
      }
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      console.log('contact share err', err);
      return res.status(400).json({
        status: false,
        error: err,
      });
    });
};

const loadByEmails = (req, res) => {
  const { currentUser } = req;
  const { emails } = req.body;
  Contact.find({
    email: { $in: emails },
    user: currentUser._id,
  })
    .select({ _id: 1, first_name: 1, last_name: 1, email: 1, cell_phone: 1 })
    .then((_contacts) => {
      return res.send({
        status: true,
        data: _contacts,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    });
};

const getActivities = async (req, res) => {
  const { currentUser } = req;
  const { count } = req.body;

  const textSelectPath = {
    user: 1,
    deal: 1,
    phone: 1,
    content: 1,
    from: 1,
    type: 1,
    status: 1,
    has_shared: 1,
    shared_text: 1,
    video_tracker: 1,
    pdf_tracker: 1,
    image_tracker: 1,
    service_type: 1,
    created_at: 1,
    updated_at: 1,
  };

  if (req.params.id === 'null' || req.params.id === 'undefined') {
    return res.status(400).json({
      status: false,
      error: 'Invalid Contact',
    });
  }

  const contactId = req.params.id;

  textSelectPath['send_status.' + contactId] = 1;

  const _contact = await Contact.findOne({
    _id: contactId,
    $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
  }).catch((err) => {
    console.log('contact found err', err.message);
  });

  if (_contact) {
    // Contact Activity List
    let _activity_list;
    if (count) {
      _activity_list = await Activity.find({
        contacts: req.params.id,
        status: { $ne: 'pending' },
      })
        .sort({ updated_at: -1 })
        .limit(count)
        .populate([
          { path: 'video_trackers', select: '-_id -user -contact' },
          { path: 'image_trackers', select: '-_id -user -contact' },
          { path: 'pdf_trackers', select: '-_id -user -contact' },
          { path: 'email_trackers', select: '-_id -user -contact' },
          { path: 'text_trackers', select: '-_id -user -contact' },
        ]);
    } else {
      _activity_list = await Activity.find({
        contacts: req.params.id,
        status: { $ne: 'pending' },
      })
        .sort({ updated_at: 1 })
        .populate([
          { path: 'video_trackers', select: '-_id -user -contact' },
          { path: 'image_trackers', select: '-_id -user -contact' },
          { path: 'pdf_trackers', select: '-_id -user -contact' },
          { path: 'email_trackers', select: '-_id -user -contact' },
          { path: 'text_trackers', select: '-_id -user -contact' },
        ]);
    }

    // Contact Relative Details
    const videoIds = [];
    const imageIds = [];
    const pdfIds = [];
    const materials = [];
    let notes = [];
    let emails = [];
    let texts = [];
    let appointments = [];
    let tasks = [];
    let deals = [];
    let users = [];
    let phone_logs = [];

    _activity_list.forEach((e) => {
      if (e['type'] === 'videos') {
        if (e['videos'] instanceof Array) {
          Array.prototype.push.apply(videoIds, e['videos']);
        } else {
          videoIds.push(e['videos']);
        }
      }
      if (e['type'] === 'images') {
        if (e['images'] instanceof Array) {
          Array.prototype.push.apply(imageIds, e['images']);
        } else {
          imageIds.push(e['images']);
        }
      }
      if (e['type'] === 'pdfs') {
        if (e['pdfs'] instanceof Array) {
          Array.prototype.push.apply(pdfIds, e['pdfs']);
        } else {
          pdfIds.push(e['pdfs']);
        }
      }
    });
    const videos = await Video.find({ _id: { $in: videoIds } });
    const pdfs = await PDF.find({ _id: { $in: pdfIds } });
    const images = await Image.find({ _id: { $in: imageIds } });
    Array.prototype.push.apply(materials, videos);
    Array.prototype.push.apply(materials, pdfs);
    Array.prototype.push.apply(materials, images);

    if (count) {
      const loadedIds = [];
      const noteIds = [];
      const emailIds = [];
      const textIds = [];
      const apptIds = [];
      const taskIds = [];
      const dealIds = [];
      const userIds = [];
      const phoneLogIds = [];

      for (let i = 0; i < _activity_list.length; i++) {
        if (
          [
            'notes',
            'emails',
            'texts',
            'appointments',
            'follow_ups',
            'deals',
            'users',
            'phone_logs',
          ].indexOf(_activity_list[i].type) !== -1
        ) {
          let detail_id = _activity_list[i][_activity_list[i].type];
          if (detail_id instanceof Array) {
            detail_id = detail_id[0];
          }
          if (loadedIds.indexOf(detail_id) === -1) {
            switch (_activity_list[i].type) {
              case 'notes':
                noteIds.push(detail_id);
                break;
              case 'emails':
                emailIds.push(detail_id);
                break;
              case 'texts':
                textIds.push(detail_id);
                break;
              case 'appointments':
                apptIds.push(detail_id);
                break;
              case 'follow_ups':
                taskIds.push(detail_id);
                break;
              case 'deals':
                if (_activity_list[i].content != 'removed deal') {
                  dealIds.push(detail_id);
                }
                break;
              case 'users':
                userIds.push(detail_id);
                break;
              case 'phone_logs':
                phoneLogIds.push(detail_id);
            }
          }
        }
      }
      notes = await Note.find({ _id: { $in: noteIds } });
      emails = await Email.find({ _id: { $in: emailIds } });
      texts = await Text.find({ _id: { $in: textIds } }).select(textSelectPath);
      appointments = await Appointment.find({ _id: { $in: apptIds } });
      tasks = await FollowUp.find({
        due_date: { $exists: true },
        $or: [
          { _id: { $in: taskIds } },
          { parent_follow_up: { $in: taskIds, $exists: true } },
        ],
      });
      deals = await Deal.find({ _id: { $in: dealIds } });
      users = await User.find({ _id: { $in: userIds } }).select(
        '_id user_name email cell_phone picture_profile'
      );
      phone_logs = await PhoneLog.find({ _id: { $in: phoneLogIds } });
    } else {
      notes = await Note.find({ contact: contactId });
      emails = await Email.find({ contacts: contactId });
      texts = await Text.find({ contacts: contactId }).select(textSelectPath);
      appointments = await Appointment.find({ contacts: contactId });
      tasks = await FollowUp.find({
        contact: contactId,
        due_date: { $exists: true },
      });
      deals = await Deal.find({ contacts: contactId });
      users = await User.find({
        _id: { $in: _contact.shared_members || [] },
      }).select('_id user_name email cell_phone picture_profile');
      phone_logs = await PhoneLog.find({ contact: contactId });
    }

    return res.send({
      status: true,
      data: {
        activity: _activity_list,
        details: {
          materials,
          notes,
          emails,
          texts,
          appointments,
          tasks,
          deals,
          users,
          phone_logs,
        },
      },
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contact not found',
    });
  }
};

const loadNotes = (req, res) => {
  const { currentUser } = req;
  const contactId = req.params.id;

  Note.find({ contact: contactId })
    .then((notes) => {
      return res.send({
        status: true,
        data: notes,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const getTimeline = async (req, res) => {
  const { currentUser } = req;
  const { automationId } = req.body;

  if (req.params.id === 'null' || req.params.id === 'undefined') {
    return res.status(400).json({
      status: false,
      error: 'Invalid Contact',
    });
  }

  const contactId = req.params.id;

  const _contact = await Contact.findOne({
    _id: contactId,
    $or: [{ user: currentUser.id }, { shared_members: currentUser.id }],
  }).catch((err) => {
    console.log('contact found err', err.message);
  });

  if (_contact) {
    // Contact TimeLines
    const _contact_timelines = await TimeLine.find({
      contact: req.params.id,
      type: { $ne: 'deal' },
      automation: automationId || { $ne: null },
    })
      .sort({ due_date: 1 })
      .catch((err) => {
        console.log('err', err);
      });

    let contact_automation = {};
    if (_contact_timelines.length) {
      contact_automation = await Automation.findOne({
        _id: _contact_timelines[0]['automation'],
      })
        .select({ title: 1 })
        .catch((err) => {
          console.log('err', err);
        });
    }

    // Deal TimeLines
    const _deal_timelines = [];
    const _deals = await Deal.find({
      user: currentUser.id,
      contacts: { $in: req.params.id },
    });

    if (_deals && _deals.length > 0) {
      for (const _deal of _deals) {
        const _deal_timeline = await TimeLine.find({
          user: currentUser.id,
          type: 'deal',
          deal: _deal._id,
          automation: { $ne: null },
        });
        if (_deal_timeline && _deal_timeline.length > 0) {
          // get current active timeline
          let active_timeline = null;
          for (const item of _deal_timeline) {
            if (
              item.visible &&
              item.action &&
              item.action.type !== 'automation'
            ) {
              active_timeline = item;
            }
          }
          if (active_timeline) {
            const _deal_automation = await Automation.findOne({
              _id: active_timeline['automation'],
            })
              .select({ title: 1 })
              .catch((err) => {
                console.log('err', err);
              });

            _deal_timelines.push({
              automation: _deal_automation,
              deal: _deal._id,
              timeline: _deal_timeline,
            });
          }
        }
      }
    }

    return res.send({
      status: true,
      data: {
        contact_timelines: _contact_timelines,
        contact_automation,
        deal_timelines: _deal_timelines,
      },
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contact not found',
    });
  }
};

const getTasks = (req, res) => {
  const { currentUser } = req;
  const contactId = req.params.id;

  const campaign_promise = new Promise((resolve, reject) => {
    CampaignJob.find({
      user: currentUser._id,
      status: 'active',
      contacts: contactId,
    })
      .populate({
        path: 'campaign',
        select: {
          _id: true,
          title: true,
          subject: true,
          content: true,
          newsletter: true,
        },
      })
      .then((data) => {
        resolve({ campaigns: data });
      })
      .catch((err) => {
        reject(err);
      });
  });
  const task_promise = new Promise((resolve, reject) => {
    Task.find({
      user: currentUser._id,
      status: { $in: ['active', 'draft'] },
      contacts: contactId,
    })
      .select({
        action: true,
        due_date: true,
        recurrence_mode: true,
        set_recurrence: true,
        type: true,
        process: true,
      })
      .then(async (data) => {
        // TO REMOVE: please remove this block code in next stage
        const automationIds = [];
        let automations = [];
        data.forEach((e) => {
          if (
            e.type === 'assign_automation' &&
            e.action &&
            (e.action.automation_id || e.action.automation)
          ) {
            automationIds.push(e.action.automation_id || e.action.automation);
          }
        });
        if (automationIds.length) {
          automations = await Automation.find({
            _id: { $in: automationIds },
          })
            .select({ _id: true, title: true })
            .catch((err) => {
              console.log('err', err);
            });
        }
        // --- End Remove ---
        resolve({ tasks: data, automations });
      })
      .catch((err) => {
        reject(err);
      });
  });

  Promise.all([campaign_promise, task_promise])
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        err,
      });
    });
};

/**
 * Remove contact from task
 * @param {*} req : body is json => { contact: contactId, task: taskId | campaignId, type: 'task' | 'campaign'}
 * @param {*} res
 */
const removeFromTask = async (req, res) => {
  const { currentUser } = req;
  const { contact, task, type } = req.body;

  if (type === 'campaign') {
    // pull the contact from campaign job and campaign
    const campaignJob = await CampaignJob.findOne({
      user: currentUser._id,
      _id: task,
      status: 'active',
    }).catch((err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    });
    if (!campaignJob) {
      return res.status(400).send({
        status: false,
        error: 'not_found',
      });
    }
    const campaign = await Campaign.findOne({
      user: currentUser._id,
      _id: campaignJob.campaign,
    }).catch((err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    });
    const pos = (campaignJob.contacts || []).findIndex(
      (e) => e + '' === contact
    );
    console.log('campaign job', campaignJob);
    if (pos !== -1) {
      if (campaignJob.contacts.length === 1) {
        CampaignJob.deleteOne({ user: currentUser._id, _id: task }).catch(
          (err) => {}
        );
      } else {
        campaignJob.contacts.splice(pos, 1);
        campaignJob.save();
      }
    }
    if (campaign) {
      const campaignPos = (campaign.contacts || []).findIndex(
        (e) => e + '' === contact
      );
      if (campaignPos !== -1) {
        if (campaign.contacts.length === 1) {
          Campaign.deleteOne({
            user: currentUser._id,
            _id: campaignJob.campaign,
          });
          CampaignJob.deleteMany({ user: currentUser._id });
        } else {
          campaign.contacts.splice(campaignPos, 1);
          campaign.save();
        }
      }
    }
  } else if (type === 'task') {
    const taskDoc = await Task.findOne({
      user: currentUser._id,
      _id: task,
      status: 'active',
    }).catch((err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    });
    if (!taskDoc) {
      return res.status(400).send({
        status: false,
        error: 'not_found',
      });
    }
    const pos = (taskDoc.contacts || []).findIndex((e) => e + '' === contact);
    if (pos !== -1) {
      if (taskDoc.contacts.length === 1) {
        Task.deleteOne({ user: currentUser._id, _id: task }).catch((err) => {});
      } else {
        taskDoc.contacts.splice(pos, 1);
        taskDoc.save();
      }
    }
  }
  return res.send({
    status: true,
    data: true,
  });
};

module.exports = {
  getAll,
  getAllByLastActivity,
  getByLastActivity,
  get,
  getBrokerages,
  getSources,
  getCities,
  create,
  search,
  advanceSearch,
  searchEasy,
  additionalFields,
  additionalFieldSearch,
  remove,
  bulkRemove,
  update,
  bulkEditLabel,
  bulkUpdate,
  importCSV,
  importContacts,
  overwriteCSV,
  exportCSV,
  getById,
  getByIds,
  getNthContact,
  leadContact,
  loadFollows,
  loadTimelines,
  selectAllContacts,
  getAllContacts,
  checkEmail,
  checkPhone,
  loadDuplication,
  bulkCreate,
  verifyEmail,
  verifyPhone,
  resubscribe,
  filter,
  interestContact,
  interestSubmitContact,
  getSharedContact,
  shareContacts,
  stopShare,
  mergeContact,
  // mergeContacts,
  updateContact,
  loadByEmails,
  getActivities,
  loadNotes,
  getDetail,
  getTimeline,
  getTasks,
  removeFromTask,
};
