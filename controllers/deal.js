const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { google } = require('googleapis');
const AWS = require('aws-sdk');

const User = require('../models/user');
const Deal = require('../models/deal');
const DealStage = require('../models/deal_stage');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Note = require('../models/note');
const FollowUp = require('../models/follow_up');
const ActivityHelper = require('../helpers/activity');
const Email = require('../models/email');
const Text = require('../models/text');
const Appointment = require('../models/appointment');
const TeamCall = require('../models/team_call');
const Notification = require('../models/notification');
const Garbage = require('../models/garbage');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const Task = require('../models/task');
const VideoTracker = require('../models/video_tracker');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
const EmailTracker = require('../models/email_tracker');
const Automation = require('../models/automation');
const TimeLine = require('../models/time_line');
const { assignTimeline } = require('../helpers/automation');
const {
  addGoogleCalendarById,
  addOutlookCalendarById,
  updateGoogleCalendarById,
  updateOutlookCalendarById,
  removeGoogleCalendarById,
  removeOutlookCalendarById,
} = require('./appointment');
const { sendEmail, updateUserCount } = require('../helpers/email');
const { sendText, updateUserTextCount } = require('../helpers/text');
const api = require('../config/api');
const urls = require('../constants/urls');
const mail_contents = require('../constants/mail_contents');
const system_settings = require('../config/system_settings');
const { getAvatarName } = require('../helpers/utility');
const uuidv1 = require('uuid/v1');
const _ = require('lodash');
const PhoneLog = require('../models/phone_log');

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const getAll = async (req, res) => {
  const { currentUser } = req;
  const { contacts } = req.body;

  const data = await Deal.find({
    user: currentUser.id,
    contacts: { $in: contacts },
  });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Deal doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  const { contacts } = req.body;

  const deal = new Deal({
    ...req.body,
    primary_contact: req.body.primary_contact || contacts[0],
    user: currentUser.id,
    put_at: new Date(),
  });

  const deal_stage = await DealStage.findOne({
    _id: req.body.deal_stage,
  }).catch((err) => {
    console.log('deal stage found error', err.message);
    return res.status(500).send(err.message || 'Deal found error');
  });

  if (deal_stage.automation) {
    const data = {
      automation_id: deal_stage.automation,
      assign_array: [deal.id],
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

  let detail_content = 'added deal';

  if (req.guest_loggin) {
    detail_content = ActivityHelper.assistantLog(detail_content);
  }

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

  deal
    .save()
    .then((_deal) => {
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

      for (let i = 0; i < contacts.length; i++) {
        const activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'deals',
          deals: _deal.id,
          deal_stages: req.body.deal_stage,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        Contact.updateOne(
          { _id: contacts[i] },
          { $set: { last_activity: activity.id } }
        ).catch((err) => {
          console.log('contact update err', err.message);
        });
      }

      const myJSON = JSON.stringify(_deal);
      const data = JSON.parse(myJSON);
      data.deal_stage = req.body.deal_stage;
      return res.send({
        status: true,
        data: _deal,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const winDeal = async (req, res) => {
  const { currentUser } = req;

  const deal = await Deal.findOne({
    _id: req.params.id,
  });

  let detail_content = 'won deal';
  if (req.guest_loggin) {
    detail_content = ActivityHelper.assistantLog(detail_content);
  }

  const activity = new Activity({
    user: currentUser.id,
    content: detail_content,
    type: 'deals',
    deals: deal.id,
  });

  activity.save().catch((err) => {
    console.log('activity save err', err.message);
  });

  if (deal.contatcts) {
    for (let i = 0; i < deal.contacts.length; i++) {
      const activity = new Activity({
        contacts: deal.contacts[i],
        content: detail_content,
        type: 'deals',
        user: currentUser.id,
        deals: deal.id,
      });
      activity.save().catch((err) => {
        console.log('create deal activity err', err.message);
      });
    }
  }

  return res.send({
    status: true,
  });
};

const moveDeal = async (req, res) => {
  const { currentUser } = req;
  const { deal_id, position } = req.body;
  let { deal_stage_id } = req.body;

  const deal = await Deal.findOne({ _id: deal_id }).catch((err) => {
    console.log('deal found error', err.message);
    return res.status(500).send(err.message || 'Deal found error');
  });
  const deal_stage = await DealStage.findOne({ _id: deal_stage_id }).catch(
    (err) => {
      console.log('deal stage found error', err.message);
      return res.status(500).send(err.message || 'Deal found error');
    }
  );

  if (deal_stage.automation) {
    const data = {
      automation_id: deal_stage.automation,
      assign_array: [deal_id],
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

  try {
    await DealStage.updateOne(
      { _id: deal.deal_stage },
      {
        $pull: {
          deals: { $in: [mongoose.Types.ObjectId(deal_id)] },
        },
      },
      { new: true }
    ).catch((err) => {
      console.log('source deal stage update error', err.message);
      throw err.message || 'Source deal stage update error';
    });

    await Deal.updateOne(
      { _id: deal_id },
      {
        $set: {
          deal_stage: deal_stage_id,
          put_at: new Date(),
        },
      }
    ).catch((err) => {
      console.log('deal update error', err.message);
      throw err.message || 'deal update error';
    });
    if (!deal_stage_id) {
      deal_stage_id = deal.deal_stage;
    } else {
      if (deal.contacts) {
        let detail_content = 'moved deal';
        if (req.guest_loggin) {
          detail_content = ActivityHelper.assistantLog(detail_content);
        }

        const activity = new Activity({
          user: currentUser.id,
          content: detail_content,
          type: 'deals',
          deals: deal.id,
          deal_stages: deal_stage_id,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        for (let i = 0; i < deal.contacts.length; i++) {
          const activity = new Activity({
            content: detail_content,
            contacts: deal.contacts[i],
            user: currentUser.id,
            type: 'deals',
            deals: deal.id,
            deal_stages: deal_stage_id,
          });

          activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });

          Contact.updateOne(
            { _id: deal.contacts[i] },
            { $set: { last_activity: activity.id } }
          ).catch((err) => {
            console.log('contact deal update err', err.message);
          });
        }
      }
    }
    await DealStage.updateOne(
      { _id: deal_stage_id },
      {
        $push: {
          deals: {
            $each: [deal_id],
            $position: position,
          },
        },
      }
    ).catch((err) => {
      console.log('destination deal stage update error', err.message);
      throw err.message || 'Destination deal stage update error';
    });

    return res.send({
      status: true,
    });
  } catch (error) {
    return res.status(500).send(error);
  }
};

const remove = async (req, res) => {
  const { currentUser } = req;

  const deal = await Deal.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('deal find err', err.message);
  });

  if (!deal) {
    return res.status(400).json({
      status: false,
      error: 'Permission invalid',
    });
  }

  Deal.deleteOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('remove deal', err.message);
  });

  DealStage.updateOne(
    {
      _id: deal.deal_stage,
    },
    {
      $pull: {
        deals: { $in: [mongoose.Types.ObjectId(req.params.id)] },
      },
    }
  ).catch((err) => {
    console.log('remove deal', err.message);
  });

  await Activity.deleteMany({ deals: req.params.id });

  // remove notes
  const notes = await Note.find({ deal: req.params.id });

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    await Note.deleteOne({
      _id: note.id,
    }).catch((err) => {
      console.log('deal note delete err', err.message);
    });

    const contact_notes = await Note.find({
      user: currentUser.id,
      shared_note: note.id,
    }).catch((err) => {
      console.log('deal related note find err', err.message);
    });

    const contact_note_ids = [];
    contact_notes.forEach((contact_note) => {
      contact_note_ids.push(contact_note.id);
    });

    await Activity.deleteMany({
      notes: { $in: contact_note_ids },
      type: 'notes',
    }).catch((err) => {
      console.log('activity remove err', err.message);
    });

    await Note.deleteMany({
      shared_note: note.id,
      user: currentUser.id,
    }).catch((err) => {
      console.log('deal note delete err', err.message);
    });

    await Activity.deleteOne({
      notes: note.id,
      user: currentUser.id,
      type: 'notes',
    }).catch((err) => {
      console.log('deal not activity remove err', err.message);
    });
  }

  // followup remove
  const followups = await FollowUp.find({ deal: req.params.id });

  for (let i = 0; i < followups.length; i++) {
    const followup = followups[i];

    await FollowUp.deleteOne({
      _id: followup.id,
    }).catch((err) => {
      console.log('remove followup err', err.message);
    });

    await Activity.deleteOne({
      follow_ups: followup.id,
      type: 'follow_ups',
    }).catch((err) => {
      console.log('followup find err', err.message);
    });

    const follow_ups = await FollowUp.find({
      shared_follow_up: followup.id,
      user: currentUser.id,
    }).catch((err) => {
      console.log('followup find err', err.message);
    });

    const contact_followup_ids = [];
    follow_ups.forEach((contact_note) => {
      contact_followup_ids.push(contact_note.id);
    });

    await Activity.deleteMany({
      follow_ups: { $in: contact_followup_ids },
      type: 'follow_ups',
    }).catch((err) => {
      console.log('activity remove err', err.message);
    });

    await FollowUp.deleteMany({
      shared_follow_up: followup.id,
      user: currentUser.id,
    }).catch((err) => {
      console.log('remove followup err', err.message);
    });
  }

  // email remove
  const emails = await Email.find({ deal: req.params.id });

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];

    await Email.deleteOne({
      _id: email.id,
    }).catch((err) => {
      console.log('remove email err', err.message);
    });

    await Activity.deleteOne({
      emails: email.id,
      type: 'emails',
    }).catch((err) => {
      console.log('email find err', err.message);
    });

    // const tempEmails = await Email.find({
    //   shared_email: email.id,
    // }).catch((err) => {
    //   console.log('email find err', err.message);
    // });

    // const contact_email_ids = [];
    // tempEmails.forEach((contact_email) => {
    //   contact_email_ids.push(contact_email.id);
    // });

    // await Activity.deleteMany({
    //   emails: { $in: contact_email_ids },
    // }).catch((err) => {
    //   console.log('activity remove err', err.message);
    // });
  }

  // text remove

  const texts = await Text.find({ deal: req.params.id });

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    await Text.deleteOne({
      _id: text.id,
    }).catch((err) => {
      console.log('remove Text err', err.message);
    });

    await Activity.deleteOne({
      texts: text.id,
      type: 'texts',
    }).catch((err) => {
      console.log('Text find err', err.message);
    });

    // const tempTexts = await Text.find({
    //   shared_text: text.id,
    // }).catch((err) => {
    //   console.log('Text find err', err.message);
    // });

    // const contact_text_ids = [];
    // tempTexts.forEach((contact_text) => {
    //   contact_text_ids.push(contact_text.id);
    // });

    // await Activity.deleteMany({
    //   texts: { $in: contact_text_ids },
    // }).catch((err) => {
    //   console.log('activity remove err', err.message);
    // });
  }

  await Appointment.deleteMany({ deal: req.params.id });
  await TimeLine.deleteMany({ deal: req.params.id });

  await ActivityHelper.updateLastActivity(deal.contacts);

  return res.send({
    status: true,
  });
};

const removeOnlyDeal = async (req, res) => {
  const { currentUser } = req;

  const deal = await Deal.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('deal find err', err.message);
  });

  if (!deal) {
    return res.status(400).json({
      status: false,
      error: 'Permission invalid',
    });
  }

  Deal.deleteOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('remove deal', err.message);
  });

  DealStage.updateOne(
    {
      _id: deal.deal_stage,
    },
    {
      $pull: {
        deals: { $in: [mongoose.Types.ObjectId(req.params.id)] },
      },
    }
  ).catch((err) => {
    console.log('remove deal', err.message);
  });

  await Activity.deleteMany({ deals: req.params.id });

  // remove notes
  const notes = await Note.find({ deal: req.params.id });

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    Note.deleteOne({
      _id: note.id,
    }).catch((err) => {
      console.log('deal note delete err', err.message);
    });

    Activity.deleteOne({
      notes: req.body.note,
      type: 'notes',
    }).catch((err) => {
      console.log('deal note activity remove err', err.message);
    });
  }

  // followup remove
  const followups = await FollowUp.find({ deal: req.params.id });

  for (let i = 0; i < followups.length; i++) {
    const followup = followups[i];

    FollowUp.deleteOne({
      _id: followup.id,
    }).catch((err) => {
      console.log('remove followup err', err.message);
    });

    Activity.deleteOne({
      follow_ups: followup.id,
      type: 'follow_ups',
    }).catch((err) => {
      console.log('followup find err', err.message);
    });
  }

  // email remove
  const emails = await Email.find({ deal: req.params.id });

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];

    Email.deleteOne({
      _id: email.id,
    }).catch((err) => {
      console.log('remove email err', err.message);
    });

    // Activity.deleteOne({
    //   emails: email.id,
    //   type: 'emails',
    // }).catch((err) => {
    //   console.log('email find err', err.message);
    // });
  }

  // text remove
  const texts = await Text.find({ deal: req.params.id });

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    Text.deleteOne({
      _id: text.id,
    }).catch((err) => {
      console.log('remove Text err', err.message);
    });

    // Activity.deleteOne({
    //   texts: text.id,
    //   type: 'texts',
    // }).catch((err) => {
    //   console.log('Text find err', err.message);
    // });
  }

  return res.send({
    status: true,
  });
};

const edit = async (req, res) => {
  const { currentUser } = req;
  const body = req.body;

  const currentDeal = await Deal.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || JSON.stringify(err),
    });
  });

  if (!currentDeal) {
    return res.status(400).send({
      status: false,
      error: 'Not found current deal.',
    });
  }

  Deal.updateOne(
    {
      _id: req.params.id,
      user: currentUser.id,
    },
    { $set: { ...body } }
  )
    .then(async () => {
      if (currentDeal.deal_stage + '' !== body.deal_stage + '') {
        console.log(
          'current stage',
          'new-stage',
          currentDeal.deal_stage,
          body.deal_stage
        );
        await DealStage.updateOne(
          { _id: currentDeal.deal_stage },
          { $pull: { deals: currentDeal._id } }
        ).catch((err) => {
          return res.status(500).send({
            status: false,
            error: err.message || JSON.stringify(err),
          });
        });
        await DealStage.updateOne(
          { _id: body.deal_stage },
          { $addToSet: { deals: currentDeal._id } }
        ).catch((err) => {
          return res.status(500).send({
            status: false,
            error: err.message || JSON.stringify(err),
          });
        });
        return res.send({
          status: true,
        });
      } else {
        return res.send({
          status: true,
        });
      }
    })
    .catch((err) => {
      return res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

const updateContact = async (req, res) => {
  const { currentUser } = req;
  const { action, contacts, deleteAllDealData } = req.body;

  let query;
  if (action === 'add') {
    query = { $addToSet: { contacts: { $each: contacts } } };
  } else if (action === 'remove') {
    query = { $pull: { contacts: { $in: contacts } } };
  }

  const _deal = await Deal.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (action === 'remove') {
    await Activity.deleteMany({
      contacts: { $in: contacts },
      deals: req.params.id,
      type: 'deals',
      // content: { $ne: 'removed deal' },
    });

    // delete Note
    const notesToUpdate = await Note.find(
      {
        deal: req.params.id,
        assigned_contacts: { $in: contacts },
      },
      { _id: 1 }
    );

    const notesIdsToUpdate = [];
    if (notesToUpdate.length > 0) {
      for (let i = 0; i < notesToUpdate.length; i++) {
        notesIdsToUpdate.push(notesToUpdate[i]._id);
      }
      await Note.updateMany(
        {
          deal: req.params.id,
          assigned_contacts: { $in: contacts },
        },
        { $pull: { assigned_contacts: { $in: contacts } } }
      ).catch((err) => {
        console.log('updating note err: ', err);
      });

      if (deleteAllDealData) {
        await Activity.deleteMany({
          contacts: { $in: contacts },
          notes: { $in: notesIdsToUpdate },
        }).catch((err) => {
          console.log('activity remove err', err.message);
        });

        await Note.deleteMany({
          contact: { $in: contacts },
          shared_note: { $in: notesIdsToUpdate },
        }).catch((err) => {
          console.log('deleteMany note err: ', err);
        });
      }
    }

    // delete followup
    const followupsToUpdate = await FollowUp.find(
      {
        deal: req.params.id,
        assigned_contacts: { $in: contacts },
      },
      { _id: 1 }
    );

    const followupIdsToUpdate = [];
    if (followupsToUpdate.length > 0) {
      for (let i = 0; i < followupsToUpdate.length; i++) {
        followupIdsToUpdate.push(followupsToUpdate[i]._id);
      }
      await FollowUp.updateMany(
        {
          deal: req.params.id,
          assigned_contacts: { $in: contacts },
        },
        { $pull: { assigned_contacts: { $in: contacts } } }
      ).catch((err) => {
        console.log('updating followUp err: ', err);
      });

      if (deleteAllDealData) {
        await Activity.deleteMany({
          contacts: { $in: contacts },
          follow_ups: { $in: followupIdsToUpdate },
        }).catch((err) => {
          console.log('activity remove err', err.message);
        });
        await FollowUp.deleteMany({
          contact: { $in: contacts },
          shared_follow_up: { $in: followupIdsToUpdate },
        }).catch((err) => {
          console.log('deleteMany followUp err: ', err);
        });
      }
    }

    // delete email
    const emailsToUpdate = await Email.find(
      {
        deal: req.params.id,
        assigned_contacts: { $in: contacts },
      },
      { _id: 1 }
    );

    const emailIdsToUpdate = [];
    if (emailsToUpdate.length > 0) {
      for (let i = 0; i < emailsToUpdate.length; i++) {
        emailIdsToUpdate.push(emailsToUpdate[i]._id);
      }
      await Email.updateMany(
        {
          deal: req.params.id,
          assigned_contacts: { $in: contacts },
        },
        { $pull: { assigned_contacts: { $in: contacts } } }
      ).catch((err) => {
        console.log('updating email err: ', err);
      });

      if (deleteAllDealData) {
        // await Activity.deleteMany({
        //   contacts: { $in: contacts },
        //   emails: { $in: emailIdsToUpdate },
        // }).catch((err) => {
        //   console.log('activity remove err', err.message);
        // });
        await Email.deleteMany({
          contacts: { $in: contacts },
          shared_email: { $in: emailIdsToUpdate },
        }).catch((err) => {
          console.log('deleteMany email err: ', err);
        });
      }
    }

    // delete text
    const textsToUpdate = await Text.find(
      {
        deal: req.params.id,
        assigned_contacts: { $in: contacts },
      },
      { _id: 1 }
    );

    const textIdsToUpdate = [];
    if (textsToUpdate.length > 0) {
      for (let i = 0; i < textsToUpdate.length; i++) {
        textIdsToUpdate.push(textsToUpdate[i]._id);
      }

      await Text.updateMany(
        {
          deal: req.params.id,
          assigned_contacts: { $in: contacts },
        },
        { $pull: { assigned_contacts: { $in: contacts } } }
      ).catch((err) => {
        console.log('updating Text err: ', err);
      });
      if (deleteAllDealData) {
        // await Activity.deleteMany({
        //   contacts: { $in: contacts },
        //   texts: { $in: textIdsToUpdate },
        // }).catch((err) => {
        //   console.log('activity remove err', err.message);
        // });
        await Text.deleteMany({
          contacts: { $in: contacts },
          shared_text: { $in: textIdsToUpdate },
        }).catch((err) => {
          console.log('deleteMany Text err: ', err);
        });
      }
    }

    // delete apponintment

    const appointmentsToUpdate = await Appointment.find(
      {
        deal: req.params.id,
        contacts: { $in: contacts },
      },
      { _id: 1 }
    );

    const appointmentIdsToUpdate = [];
    if (appointmentsToUpdate.length > 0) {
      const contactDetails = await Contact.find(
        {
          _id: { $in: contacts },
        },
        { email: 1 }
      );

      const contactEmails = [];
      for (let i = 0; i < contactDetails.length; i++) {
        contactEmails.push(contactDetails[i].email);
      }

      for (let i = 0; i < appointmentsToUpdate.length; i++) {
        appointmentIdsToUpdate.push(appointmentsToUpdate[i]._id);
      }

      if (deleteAllDealData) {
        await Activity.deleteMany({
          contacts: { $in: contacts },
          appointments: { $in: appointmentIdsToUpdate },
        }).catch((err) => {
          console.log('activity remove err', err.message);
        });

        await Appointment.updateMany(
          {
            deal: req.params.id,
            contacts: { $in: contacts },
          },
          {
            $pull: {
              guests: { $in: contactEmails },
              contacts: { $in: contacts },
            },
          }
        ).catch((err) => {
          console.log('updating Text err: ', err);
        });
      }
    }

    if (deleteAllDealData) {
      await TimeLine.deleteMany({
        deal: req.params.id,
        contact: { $in: contacts },
      });

      await ActivityHelper.updateLastActivity(contacts);
    }
  }

  if (_deal) {
    // if (_deal.contacts && _deal.contacts.length >= 10 && action === 'add') {
    //   console.log('Assigned contacts are exceeded.');
    // } else {
    await Deal.updateOne(
      {
        _id: req.params.id,
        user: currentUser.id,
      },
      query
    )
      .then((result) => {
        let detail_content = '';
        if (action === 'add') {
          detail_content = 'added deal';
          for (let i = 0; i < contacts.length; i++) {
            const activity = new Activity({
              content: detail_content,
              contacts: contacts[i],
              user: currentUser.id,
              type: 'deals',
              deals: req.params.id,
            });

            activity.save().catch((err) => {
              console.log('activity save err', err.message);
            });
            Contact.updateOne(
              { _id: contacts[i] },
              { $set: { last_activity: activity.id } }
            ).catch((err) => {
              console.log('err', err);
            });
          }
        } else {
          detail_content = 'removed deal';
        }
        res.send({
          status: true,
        });
      })
      .catch((err) => {
        res.status(500).send({
          status: false,
          error: err.message || JSON.stringify(err),
        });
      });
    // }
  } else {
    return res.status(400).send({
      status: false,
      error: 'Not found current deal.',
    });
  }
};

const getDetail = (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;

  Deal.findOne({ _id: id, user: currentUser._id })
    .then(async (_deal) => {
      const _contacts = await Contact.find({ _id: { $in: _deal['contacts'] } });
      const primary_contact = _deal.primary_contact;

      return res.send({
        status: true,
        data: {
          main: _deal,
          contacts: _contacts,
          primary_contact,
          activities: [],
        },
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const getSiblings = (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;

  DealStage.findOne({ deals: id, user: currentUser._id })
    .then((_stage) => {
      Deal.find({ _id: { $in: _stage.deals } })
        .select({ _id: true, title: true, contacts: true })
        .then(async (_deals) => {
          const existingDealIds = _deals.map((_d) => _d._id + '');
          const deals = _.keyBy(_deals, (_d) => {
            return _d._id + '';
          });
          const currentPos = _stage.deals.indexOf(id);
          let prevDealId;
          let nextDealId;
          let prevDeal = null;
          let nextDeal = null;
          for (let i = currentPos - 1; i >= 0; i--) {
            const cursor = _stage.deals[i] + '';
            if (existingDealIds.indexOf(cursor) !== -1) {
              prevDealId = cursor;
              break;
            }
          }
          for (let i = currentPos + 1; i < _stage.deals.length; i++) {
            const cursor = _stage.deals[i] + '';
            if (existingDealIds.indexOf(cursor) !== -1) {
              nextDealId = cursor;
              break;
            }
          }
          if (prevDealId) {
            prevDeal = deals[prevDealId];
            if (prevDeal && prevDeal.contacts) {
              const _contacts = await Contact.find({
                _id: { $in: prevDeal.contacts },
              })
                .select({
                  _id: true,
                  first_name: true,
                  last_name: true,
                  cell_phone: true,
                  email: true,
                })
                .catch((err) => {
                  console.log('Fail: Prev deal contacts', err);
                });
              prevDeal.contacts = _contacts;
            } else {
              prevDeal.contacts = [];
            }
          }
          if (nextDealId) {
            nextDeal = deals[nextDealId];
            if (nextDeal && nextDeal.contacts) {
              const _contacts = await Contact.find({
                _id: { $in: nextDeal.contacts },
              })
                .select({
                  _id: true,
                  first_name: true,
                  last_name: true,
                  cell_phone: true,
                  email: true,
                })
                .catch((err) => {
                  console.log('Fail: Next deal contacts', err);
                });
              nextDeal.contacts = _contacts;
            } else {
              nextDeal.contacts = [];
            }
          }
          return res.send({
            status: true,
            prev: prevDeal,
            next: nextDeal,
          });
        })
        .catch((err) => {
          console.log('Fail: Deals getting failed.', err);
          return res.send({
            status: true,
            prev: null,
            next: null,
          });
        });
    })
    .catch((err) => {
      console.log('Fail: Deal Stage getting failed.', err);
      return res.send({
        status: true,
        prev: null,
        next: null,
      });
    });
};

const getActivity = async (req, res) => {
  const { currentUser } = req;
  const { count } = req.body;
  const startTime = new Date().getTime();

  // Contact Activity List
  let _activity_list;

  if (count) {
    _activity_list = await Activity.find({
      user: currentUser.id,
      deals: req.body.deal,
    })
      .sort({ updated_at: -1 })
      .limit(count);
  } else {
    _activity_list = await Activity.find({
      user: currentUser.id,
      deals: req.body.deal,
    }).sort({ updated_at: 1 });
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
  let phone_logs = [];

  if (count) {
    const loadedIds = [];
    const noteIds = [];
    const emailIds = [];
    const textIds = [];
    const apptIds = [];
    const taskIds = [];
    const dealIds = [];
    const phoneLogIds = [];
    for (let i = 0; i < _activity_list.length; i++) {
      const _activity = _activity_list[i];
      if (
        [
          'notes',
          'emails',
          'texts',
          'appointments',
          'follow_ups',
          'deals',
          'phone_logs',
        ].indexOf(_activity.type) !== -1
      ) {
        let detail_id = _activity[_activity.type];
        if (detail_id instanceof Array) {
          detail_id = detail_id[0];
        }
        if (loadedIds.indexOf(detail_id) === -1) {
          switch (_activity.type) {
            case 'notes':
              noteIds.push(detail_id);
              break;
            case 'emails': {
              emailIds.push(detail_id);
              break;
            }
            case 'texts': {
              textIds.push(detail_id);
              break;
            }
            case 'appointments':
              apptIds.push(detail_id);
              break;
            case 'follow_ups':
              taskIds.push(detail_id);
              break;
            case 'deals':
              dealIds.push(detail_id);
              break;
            case 'phone_logs':
              phoneLogIds.push(detail_id);
          }
        }
      }
    }
    notes = await Note.find({ _id: { $in: noteIds } });
    emails = await Email.find({ _id: { $in: emailIds } }).populate([
      { path: 'video_tracker', select: '-_id -user -contact' },
      { path: 'image_tracker', select: '-_id -user -contact' },
      { path: 'pdf_tracker', select: '-_id -user -contact' },
      { path: 'email_tracker', select: '-_id -user -contact' },
    ]);
    texts = await Text.find({ _id: { $in: textIds } }).populate([
      { path: 'video_tracker', select: '-_id -user -contact' },
      { path: 'image_tracker', select: '-_id -user -contact' },
      { path: 'pdf_tracker', select: '-_id -user -contact' },
      { path: 'text_tracker', select: '-_id -user -contact' },
    ]);
    appointments = await Appointment.find({ _id: { $in: apptIds } });
    tasks = await FollowUp.find({
      $or: [
        { _id: { $in: taskIds } },
        { parent_follow_up: { $exists: true, $in: taskIds } },
      ],
    });
    phone_logs = await PhoneLog.find({ _id: { $in: phoneLogIds } });
  } else {
    notes = await Note.find({ deal: req.body.deal });
    emails = await Email.find({ deal: req.body.deal }).populate([
      { path: 'video_tracker' },
      { path: 'image_tracker' },
      { path: 'pdf_tracker' },
      { path: 'email_tracker' },
    ]);
    texts = await Text.find({ deal: req.body.deal }).populate([
      { path: 'video_tracker' },
      { path: 'image_tracker' },
      { path: 'pdf_tracker' },
      { path: 'text_tracker' },
    ]);
    appointments = await Appointment.find({ deal: req.body.deal });
    tasks = await FollowUp.find({ deal: req.body.deal });
    phone_logs = await PhoneLog.find({ deal: req.body.deal });
  }

  for (let i = 0; i < _activity_list.length; i++) {
    const e = _activity_list[i];
    if (
      (e['type'] === 'emails' && e['emails']) ||
      (e['type'] === 'texts' && e['texts'])
    ) {
      if (e['videos'] instanceof Array) {
        Array.prototype.push.apply(videoIds, e['videos']);
      } else {
        videoIds.push(e['videos']);
      }
      if (e['pdfs'] instanceof Array) {
        Array.prototype.push.apply(pdfIds, e['pdfs']);
      } else {
        pdfIds.push(e['pdfs']);
      }
      if (e['images'] instanceof Array) {
        Array.prototype.push.apply(imageIds, e['images']);
      } else {
        imageIds.push(e['images']);
      }
    }
  }

  const sharedCallLogIds = phone_logs.map((e) => e._id);
  const videos = await Video.find({ _id: { $in: videoIds } });
  const pdfs = await PDF.find({ _id: { $in: pdfIds } });
  const images = await Image.find({ _id: { $in: imageIds } });
  const sub_calls = await PhoneLog.find({
    shared_log: { $in: sharedCallLogIds },
  });
  Array.prototype.push.apply(materials, videos);
  Array.prototype.push.apply(materials, pdfs);
  Array.prototype.push.apply(materials, images);

  const data = {
    activity: _activity_list,

    details: {
      materials,
      notes,
      emails,
      texts,
      appointments,
      tasks,
      phone_logs,
      sub_calls,
    },
  };

  return res.send({
    status: true,
    data,
  });
};

const getTimeLines = async (req, res) => {
  const { currentUser } = req;
  const dealId = req.params.id;

  const _deal = await Deal.findOne({ _id: dealId }).catch((err) => {
    console.log('deal found err', err.message);
  });

  if (_deal) {
    // TimeLines
    const _timelines = await TimeLine.find({
      type: 'deal',
      user: currentUser.id,
      deal: dealId,
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
    const data = {
      time_lines: _timelines,
      automation,
    };

    return res.send({
      status: true,
      data,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Deal not found',
    });
  }
};

const getAllTimeLines = async (req, res) => {
  const { currentUser } = req;
  // TimeLines
  const _timelines = await TimeLine.find({
    type: 'deal',
    user: currentUser.id,
    automation: { $ne: null },
  })
    .populate({ path: 'automation', select: 'title' })
    .sort({ due_date: 1 })
    .catch((err) => {
      console.log('err', err);
    });

  const data = {
    time_lines: _timelines,
  };

  return res.send({
    status: true,
    data,
  });
};

const getMaterialActivity = async (req, res) => {
  const { currentUser } = req;
  let send_activityIds;
  let email_trackers;

  const deal_activity = await Activity.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (deal_activity['type'] === 'emails') {
    const emails = await Email.find({
      shared_email: deal_activity.emails,
      has_shared: true,
      user: currentUser.id,
    });

    const emailIds = (emails || []).map((e) => e._id);

    const send_activities = await Activity.find({
      emails: { $in: emailIds },
    }).select('_id');

    send_activityIds = send_activities.map((e) => e._id);

    email_trackers = await EmailTracker.find({
      activity: { $in: send_activityIds },
    }).catch((err) => {
      console.log('deal video tracker find err', err.message);
    });
  } else {
    const texts = await Text.find({
      shared_text: deal_activity.texts,
      has_shared: true,
      user: currentUser.id,
    }).catch((err) => {
      console.log('deal text find err', err.message);
    });
    const textIds = (texts || []).map((e) => e._id);

    const send_activities = await Activity.find({
      texts: { $in: textIds },
    }).select('_id');

    send_activityIds = send_activities.map((e) => e._id);
  }

  const video_trackers = await VideoTracker.find({
    activity: { $in: send_activityIds },
  }).catch((err) => {
    console.log('deal video tracker find err', err.message);
  });

  const pdf_trackers = await PDFTracker.find({
    activity: { $in: send_activityIds },
  }).catch((err) => {
    console.log('deal pdf tracker find err', err.message);
  });

  const image_trackers = await ImageTracker.find({
    activity: { $in: send_activityIds },
  }).catch((err) => {
    console.log('deal image tracker find err', err.message);
  });

  return res.send({
    status: true,
    data: {
      video_trackers,
      pdf_trackers,
      image_trackers,
      email_trackers,
    },
  });
};

const getNotes = async (req, res) => {
  const { currentUser } = req;
  const notes = await Note.find({
    user: currentUser.id,
    deal: req.body.deal,
  });

  return res.status({
    status: true,
    data: notes,
  });
};

const createNote = async (req, res) => {
  const { currentUser } = req;
  let data = {};
  if (req.body.data) {
    data = JSON.parse(req.body.data);
  } else {
    data = { ...req.body };
  }
  const { deal, content, contacts } = data;

  const file = req.file;
  let location;
  if (file) {
    location = file.location;
  }

  const note = new Note({
    content,
    deal,
    user: currentUser.id,
    assigned_contacts: contacts,
    audio: location,
  });

  note.save().catch((err) => {
    console.log('deal note create err', err.message);
  });

  const activityLog = 'added note';
  const activity = new Activity({
    user: currentUser.id,
    content: activityLog,
    notes: note.id,
    type: 'notes',
    deals: deal,
  });

  activity.save().catch((err) => {
    console.log('activity save err', err.message);
  });

  for (let i = 0; i < contacts.length; i++) {
    const contact_note = new Note({
      contact: contacts[i],
      has_shared: true,
      shared_note: note.id,
      content,
      user: currentUser.id,
      audio: location,
    });

    contact_note.save().catch((err) => {
      console.log('note save err', err.message);
    });

    const note_activity = new Activity({
      content,
      contacts: contacts[i],
      type: 'notes',
      notes: contact_note.id,
      user: currentUser.id,
    });

    note_activity
      .save()
      .then((_activity) => {
        Contact.updateOne(
          { _id: contacts[i] },
          {
            $set: { last_activity: _activity.id },
          }
        ).catch((err) => {
          console.log('err', err);
        });
      })
      .catch((err) => {
        console.log('deal add note error', err.message);
        return res.status(400).send({
          status: false,
          error: err.message,
        });
      });
  }
  return res.send({
    status: true,
  });
};

const editNote = async (req, res) => {
  const { currentUser } = req;

  let editData = {};
  if (req.body.data) {
    editData = JSON.parse(req.body.data);
  } else {
    editData = { ...req.body };
  }
  if (req.file) {
    editData['audio'] = req.file.location;
  }
  delete editData.contact;

  const dealNoteId = editData.note;

  const note = await Note.findOne({ _id: dealNoteId }).catch((err) => {
    console.log('not_found_note', err);
  });

  await Note.updateOne(
    {
      _id: dealNoteId,
    },
    {
      $set: { ...editData },
    }
  ).catch((err) => {
    console.log('deal note update err', err.message);
  });

  delete editData.deal;

  Note.updateMany(
    {
      shared_note: dealNoteId,
      user: currentUser.id,
    },
    {
      $set: { ...editData },
    }
  )
    .then(() => {
      if (note.audio) {
        removeAudioFromS3(note.audio);
      }
    })
    .catch((err) => {
      console.log('deal note update err', err.message);
    });

  return res.send({
    status: true,
  });
};

const removeNote = async (req, res) => {
  const { currentUser } = req;

  const note = await Note.findOne({ _id: req.body.note }).catch((err) => {
    console.log('not_found_note', err);
  });

  await Note.deleteOne({
    _id: req.body.note,
  }).catch((err) => {
    console.log('deal note delete err', err.message);
  });

  const contact_notes = await Note.find({
    shared_note: req.body.note,
    user: currentUser.id,
  }).catch((err) => {
    console.log('deal related note find err', err.message);
  });

  const contact_note_ids = [];
  contact_notes.forEach((contact_note) => {
    contact_note_ids.push(mongoose.Types.ObjectId(contact_note.id));
  });

  if (contact_note_ids) {
    Activity.deleteMany({
      notes: { $in: contact_note_ids },
      user: currentUser.id,
      type: 'notes',
    }).catch((err) => {
      console.log('activity deal note delete err', err.message);
    });

    Note.deleteMany({
      _id: { $in: contact_note_ids },
      user: currentUser.id,
    })
      .then(() => {
        if (note.audio) {
          removeAudioFromS3(note.audio);
        }
      })
      .catch((err) => {
        console.log('deal note delete err', err.message);
      });
  }

  Activity.deleteOne({
    notes: req.body.note,
    type: 'notes',
  }).catch((err) => {
    console.log('deal not activity remove err', err.message);
  });

  return res.send({
    status: true,
  });
};

/**
 * Remove the audio file from s3
 * @param {*} file: audio file path to remove
 */
const removeAudioFromS3 = async (file) => {
  const count = await Note.countDocuments({ audio: file });
  if (!count) {
    // Remove audio file
    const key = file.replace(
      'https://teamgrow.s3.us-east-2.amazonaws.com/',
      ''
    );
    s3.deleteObject(
      {
        Bucket: api.AWS.AWS_S3_BUCKET_NAME,
        Key: key,
      },
      function (err, data) {
        console.log('transcoded video removing error', err);
      }
    );
  }
};

const createFollowUp = async (req, res) => {
  const { currentUser } = req;
  // const {
  //   deal,
  //   type,
  //   content,
  //   due_date,
  //   contacts,
  //   set_recurrence,
  //   recurrence_mode,
  // } = req.body;

  const created = await addFollowUp({ ...req.body, user: currentUser.id });
  if (created && created.status) {
    return res.send(created);
  } else {
    return res.status(500).send(created);
  }
};

const addFollowUp = async (createData, activity_content = 'added task') => {
  const {
    deal,
    type,
    content,
    due_date,
    contacts,
    set_recurrence,
    recurrence_mode,
    user,
    is_full,
  } = createData;

  const garbage = await Garbage.findOne({ user: createData.user }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  let reminder_before = 30;
  if (garbage) {
    reminder_before = garbage.reminder_before;
  }

  return new Promise(async (resolve, reject) => {
    const deal_followup = new FollowUp({
      user,
      deal,
      type,
      content,
      assigned_contacts: contacts,
      set_recurrence,
      recurrence_mode: set_recurrence ? recurrence_mode : undefined,
      due_date: set_recurrence ? undefined : due_date,
      remind_at: undefined,
    });
    await deal_followup.save().catch((err) => {
      console.log('new follow up save err', err.message);
      resolve({
        status: false,
        error: err.message,
      });
    });

    const activity = new Activity({
      content: activity_content,
      type: 'follow_ups',
      follow_ups: deal_followup.id,
      deals: deal_followup.deal,
      user,
    });
    activity.save().catch((err) => {
      console.log('activity save err', err.message);
      resolve({
        status: false,
        error: err.message,
      });
    });

    const contact_follow_ups = [];
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const contact_followup = new FollowUp({
        has_shared: true,
        shared_follow_up: deal_followup.id,
        contact,
        content,
        type,
        user,
        set_recurrence,
        recurrence_mode: set_recurrence ? recurrence_mode : undefined,
        due_date: set_recurrence ? undefined : due_date,
        remind_at:
          set_recurrence || is_full
            ? undefined
            : moment(due_date).clone().subtract(reminder_before, 'minutes'),
      });
      contact_followup.save().catch((err) => {
        console.log('new follow up save err', err.message);
        resolve({
          status: false,
          error: err.message,
        });
      });

      const new_activity = new Activity({
        content: activity_content,
        type: 'follow_ups',
        follow_ups: contact_followup.id,
        contacts: contact,
        user,
      });
      new_activity.save().catch((err) => {
        console.log('activity save err', err.message);
        resolve({
          status: false,
          error: err.message,
        });
      });

      Contact.updateOne(
        {
          _id: contact,
        },
        {
          $set: {
            last_activity: new_activity.id,
          },
        }
      ).catch((err) => {
        console.log('contact followup update err', err.message);
      });
      contact_follow_ups[contact] = contact_followup._id;
    }

    if (set_recurrence) {
      let update_date;
      if (createData.timezone) {
        update_date = moment.tz(due_date, createData.timezone).clone();
      } else {
        update_date = moment(due_date).clone();
      }

      let max_date = update_date.clone().add(6, 'weeks').endOf('weeks');

      if (
        createData.recurrence_date &&
        moment(createData.recurrence_date).isBefore(max_date)
      ) {
        max_date = moment(createData.recurrence_date);
      }
      while (max_date.isAfter(update_date)) {
        let deleted = false;
        if (
          createData.deleted_due_dates &&
          createData.deleted_due_dates.length
        ) {
          deleted = createData.deleted_due_dates.some((e) => {
            return update_date.clone().isSame(moment(e));
          });
        }

        if (!deleted) {
          const recurring_follow_up = new FollowUp({
            ...deal_followup._doc,
            _id: undefined,
            due_date: update_date.clone(),
            remind_at: undefined,
            parent_follow_up: deal_followup._id,
          });
          await recurring_follow_up.save().catch((err) => {
            console.log('new followup save err', err.message);
            resolve({
              status: false,
              error: err.message,
            });
          });

          for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            const contact_followup = new FollowUp({
              has_shared: true,
              shared_follow_up: recurring_follow_up._id,
              contact,
              content,
              type,
              user,
              set_recurrence,
              recurrence_mode: set_recurrence ? recurrence_mode : undefined,
              due_date: update_date.clone(),
              remind_at: is_full
                ? undefined
                : update_date.clone().subtract(reminder_before, 'minutes'),
              parent_follow_up: contact_follow_ups[contact],
            });
            contact_followup.save().catch((err) => {
              console.log('new follow up save err', err.message);
              resolve({
                status: false,
                error: err.message,
              });
            });
          }
        }
        switch (recurrence_mode) {
          case 'DAILY': {
            update_date.add(1, 'days');
            break;
          }
          case 'WEEKLY': {
            update_date.add(7, 'days');
            break;
          }
          case 'MONTHLY': {
            update_date.add(1, 'months');
            break;
          }
          case 'YEARLY': {
            update_date.add(1, 'years');
            break;
          }
        }
      }
    }

    resolve({
      status: true,
    });
  });
};

const updateFollowUp = async (req, res) => {
  const { currentUser } = req;
  const {
    edit_mode,
    set_recurrence,
    due_date,
    assigned_contacts,
    recurrence_mode,
    content,
    type,
    is_full,
  } = req.body;

  const garbage = await Garbage.findOne({ user: currentUser.id }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  let reminder_before = 30;
  if (garbage) {
    reminder_before = garbage.reminder_before;
  }

  let query = {
    ...req.body,
    contacts: assigned_contacts.map((e) => e._id),
  };

  if (due_date) {
    const startdate = moment(due_date);
    const remind_at = is_full
      ? undefined
      : startdate.subtract(reminder_before, 'minutes');
    query = { ...query, remind_at, status: 0 };
  }

  const follow_up = await FollowUp.findOne({
    _id: query.followup,
  });

  let same_recurring_mode = false;
  if (
    moment(due_date).isSame(follow_up.due_date) &&
    recurrence_mode === follow_up.recurrence_mode &&
    set_recurrence === follow_up.set_recurrence
  ) {
    same_recurring_mode = true;
  }
  delete query.updated_at;

  let updated;
  if (edit_mode === 'all') {
    if (set_recurrence) {
      query.due_date = await getInitialDate(query);
    }
    await deleteFollowUps(follow_up, true);
    updated = await addFollowUp(query, 'updated task');
  } else if (edit_mode === 'following') {
    if (same_recurring_mode) {
      await FollowUp.updateMany(
        {
          user: currentUser._id,
          parent_follow_up: { $exists: true, $eq: follow_up.parent_follow_up },
          status: follow_up.status,
          due_date: { $gte: follow_up.due_date },
        },
        {
          $set: { type, content, is_full },
        }
      );
      updated = await updateFollowUpActivity(query);
    } else {
      const recurring_follow_up = await FollowUp.findOne({
        user: currentUser._id,
        _id: follow_up.parent_follow_up,
      });
      if (recurring_follow_up.recurrence_date) {
        query.recurrence_date = recurring_follow_up.recurrence_date;
      }
      if (same_recurring_mode && recurring_follow_up.deleted_due_dates) {
        query.deleted_due_dates = recurring_follow_up.deleted_due_dates;
      }

      await FollowUp.updateMany(
        {
          user: currentUser.id,
          $or: [
            { _id: follow_up.parent_follow_up },
            {
              shared_follow_up: {
                $exists: true,
                $eq: follow_up.parent_follow_up,
              },
            },
          ],
        },
        {
          $set: {
            recurrence_date: follow_up.due_date,
          },
        }
      );

      const follow_ups = await FollowUp.find({
        user: currentUser.id,
        parent_follow_up: { $exists: true, $eq: follow_up.parent_follow_up },
        status: follow_up.status,
        due_date: { $gte: follow_up.due_date },
      });

      for (const _follow_up of follow_ups) {
        deleteFollowUps(_follow_up, false);
      }

      updated = await addFollowUp(query, 'updated task');
    }
  } else {
    if (set_recurrence && !follow_up.set_recurrence) {
      await deleteFollowUps(follow_up, false);
      updated = await addFollowUp(query, 'updated task');
    } else {
      await FollowUp.updateOne(
        { user: query.user, _id: query.followup },
        {
          $set: {
            ...query,
            parent_follow_up: query.set_recurrence
              ? query.parent_follow_up
              : undefined,
          },
        }
      ).catch((err) => {
        console.log('deal followup update err', err.message);
      });
      updated = await updateFollowUpActivity(query);
    }
  }

  if (updated && updated.status) {
    return res.send(updated);
  } else {
    return res.status(500).send(updated);
  }
};

const getInitialDate = async (editData) => {
  const first_recurring = await FollowUp.findOne({
    user: editData.user,
    deal: editData.deal,
    parent_follow_up: editData.parent_follow_up,
    status: editData.status,
  })
    .sort({ due_date: 1 })
    .lean();

  const first_date = {
    year: moment(first_recurring.due_date).year(),
    month: moment(first_recurring.due_date).month() + 1,
    day: moment(first_recurring.due_date).date(),
    weekday: moment(first_recurring.due_date).weekday(),
  };
  const edit_date = {
    year: moment(editData.due_date).year(),
    month: moment(editData.due_date).month() + 1,
    day: moment(editData.due_date).date(),
    weekday: moment(editData.due_date).weekday(),
  };

  const time = moment(editData.due_date).format('hh:mm');

  let result;
  if (moment(editData.due_date).isBefore(moment(first_recurring.due_date))) {
    result = editData.due_date;
  } else {
    switch (editData.recurrence_mode) {
      case 'DAILY': {
        result = moment(first_recurring.due_date).format('YYYY-MM-DD ') + time;
        break;
      }
      case 'WEEKLY': {
        if (first_date.weekday <= edit_date.weekday) {
          result =
            moment(first_recurring.due_date)
              .startOf('week')
              .add(edit_date.weekday, 'days')
              .format('YYYY-MM-DD ') + time;
        } else {
          result =
            moment(first_recurring.due_date)
              .startOf('week')
              .add(7, 'days')
              .add(edit_date.weekday, 'days')
              .format('YYYY-MM-DD ') + time;
        }
        break;
      }
      case 'MONTHLY': {
        if (first_date.day <= edit_date.day) {
          result = `${first_date.year}-${first_date.month}-${edit_date.day} ${time}`;
        } else {
          result = `${first_date.year}-${first_date.month + 1}-${
            edit_date.day
          } ${time}`;
        }
        break;
      }
      case 'YEARLY': {
        if (first_date.month <= edit_date.month) {
          result = `${first_date.year}-${edit_date.month}-${edit_date.day} ${time}`;
        } else {
          result = `${first_date.year + 1}-${edit_date.month}-${
            edit_date.day
          } ${time}`;
        }
        break;
      }
    }
  }

  return moment(result, 'YYYY-MM-DD hh:mm').format();
};

const updateFollowUpActivity = async (editData) => {
  return new Promise(async (resolve) => {
    const activity_content = 'updated task';

    const activity = new Activity({
      content: activity_content,
      type: 'follow_ups',
      deals: editData.deal,
      user: editData.user,
      follow_ups: editData.set_recurrence
        ? editData.parent_follow_up
        : editData.followup,
    });

    activity.save().catch((err) => {
      console.log('activity save err', err.message);
      resolve({ status: false, error: err.message });
    });

    const followups = await FollowUp.find({
      shared_follow_up: editData.followup,
    });

    const contacts = [];
    const followUpIds = [];
    const contactFollowMatch = {};
    followups.forEach((e) => {
      if (e && e['contact']) {
        contacts.push(e['contact']);
        contactFollowMatch[e['contact']] = e.parent_follow_up
          ? e.parent_follow_up
          : e._id;
      }
      followUpIds.push(e._id);
    });

    const query = { ...editData, assigned_contacts: [] };
    delete query.deal;
    if (query.set_recurrence) {
      delete query.parent_follow_up;
    } else {
      query.parent_follow_up = undefined;
    }

    FollowUp.updateMany(
      { user: editData.user, _id: { $in: followUpIds } },
      { $set: { ...query } }
    ).catch((err) => {
      console.log('followup update err', err.message);
      resolve({ status: false, error: err.message });
    });

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      const new_activity = new Activity({
        content: activity_content,
        contacts: contact,
        user: editData.user,
        type: 'follow_ups',
        follow_ups: contactFollowMatch[contact],
      });

      new_activity
        .save()
        .then((_activity) => {
          Contact.updateOne(
            { _id: contact },
            {
              $set: { last_activity: _activity.id },
            }
          ).catch((err) => {
            console.log('err', err);
            resolve({ status: false, error: err.message });
          });
          resolve({ status: true });
        })
        .catch((e) => {
          console.log('follow error', e);
          resolve({ status: false, error: e.message });
        });
    }
  });
};

const completeFollowUp = async (req, res) => {
  const { currentUser } = req;
  // const { deal, type, content, due_date } = req.body;

  FollowUp.updateOne(
    {
      user: currentUser.id,
      _id: req.body.followup,
    },
    {
      $set: { status: 1 },
    }
  ).catch((err) => {
    console.log('deal followup update err', err.message);
  });

  const activity_content = 'completed task';

  const activity = new Activity({
    content: activity_content,
    type: 'follow_ups',
    follow_ups: req.body.followup,
    deals: req.body.deal,
    user: currentUser.id,
  });

  activity.save().catch((err) => {
    console.log('activity save err', err.message);
  });

  const followups = await FollowUp.find({
    user: currentUser.id,
    shared_follow_up: req.body.followup,
  }).catch((err) => {
    console.log('followups find err', err.message);
  });

  const contacts = [];
  const followUpIds = [];
  const contactFollowMatch = {};
  followups.forEach((e) => {
    if (e && e['contact']) {
      contacts.push(e['contact']);
      contactFollowMatch[e['contact']] = e._id;
    }
    followUpIds.push(e._id);
  });

  FollowUp.updateMany(
    { _id: { $in: followUpIds }, user: currentUser._id },
    {
      $set: { status: 1 },
    }
  ).catch((err) => {
    console.log('contact deal update task', err.message);
  });

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    const activity = new Activity({
      content: activity_content,
      contacts: contact,
      user: currentUser.id,
      type: 'follow_ups',
      follow_ups: contactFollowMatch[contact],
    });

    activity
      .save()
      .then((_activity) => {
        Contact.updateOne(
          { _id: contact },
          {
            $set: { last_activity: _activity.id },
          }
        ).catch((err) => {
          console.log('err', err);
        });
      })
      .catch((e) => {
        console.log('follow error', e);
        return res.status(400).send({
          status: false,
          error: e,
        });
      });
  }
  return res.send({
    status: true,
  });
};

const removeFollowUp = async (req, res) => {
  const { include_recurrence, followup } = req.body;

  const follow_up = await FollowUp.findOne({ _id: followup });
  if (follow_up) {
    await deleteFollowUps(follow_up, include_recurrence);
  }

  if (follow_up.assigned_contacts && follow_up.assigned_contacts.length) {
    const contacts = follow_up.assigned_contacts;
    await ActivityHelper.updateLastActivity(contacts);
  }

  return res.send({
    status: true,
  });
};

const deleteFollowUps = async (follow_up, include_recurrence) => {
  if (follow_up.set_recurrence) {
    const shared_follow_ups = await FollowUp.find({
      user: follow_up.user,
      shared_follow_up: follow_up._id,
    })
      .distinct('_id')
      .lean();
    if (include_recurrence) {
      const parent_follow_ups = await FollowUp.find({
        user: follow_up.user,
        parent_follow_up: { $exists: true, $eq: follow_up.parent_follow_up },
      })
        .distinct('_id')
        .lean();

      const shared_parent_follow_ups = await FollowUp.find({
        user: follow_up.user,
        shared_follow_up: {
          $exists: true,
          $in: [...parent_follow_ups, follow_up.parent_follow_up],
        },
      })
        .distinct('_id')
        .lean();

      // contact task
      if (shared_parent_follow_ups) {
        FollowUp.deleteMany({
          user: follow_up.user,
          _id: { $in: shared_parent_follow_ups },
          status: follow_up.status,
        }).catch((err) => {
          console.log('remove followup err', err.message);
        });
        Activity.deleteMany({
          user: follow_up.user,
          follow_ups: { $in: shared_parent_follow_ups },
          type: 'follow_ups',
        }).catch((err) => {
          console.log('followup find err', err.message);
        });
      }
      // deal task
      if (follow_up.parent_follow_up) {
        FollowUp.deleteMany({
          user: follow_up.user,
          _id: follow_up.parent_follow_up,
        }).catch((err) => {
          console.log('remove followup err', err.message);
        });
        FollowUp.deleteMany({
          user: follow_up.user,
          parent_follow_up: follow_up.parent_follow_up,
          status: follow_up.status,
        }).catch((err) => {
          console.log('remove followup err', err.message);
        });
        Activity.deleteMany({
          user: follow_up.user,
          follow_ups: follow_up.parent_follow_up,
          type: 'follow_ups',
        }).catch((err) => {
          console.log('followup find err', err.message);
        });
      }
    } else {
      FollowUp.deleteMany({
        _id: follow_up._id,
      }).catch((err) => {
        console.log('remove followup err', err.message);
      });

      FollowUp.deleteMany({
        shared_follow_up: follow_up._id,
      }).catch((err) => {
        console.log('remove followup err', err.message);
      });
    }

    Activity.deleteMany({
      user: follow_up.user,
      follow_ups: { $in: [...shared_follow_ups, follow_up._id] },
      type: 'follow_ups',
    }).catch((err) => {
      console.log('followup find err', err.message);
    });
  } else {
    FollowUp.deleteOne({
      user: follow_up.user,
      _id: follow_up._id,
    }).catch((err) => {
      console.log('remove followup err', err.message);
    });

    Activity.deleteMany({
      user: follow_up.user,
      follow_ups: follow_up._id,
      type: 'follow_ups',
    }).catch((err) => {
      console.log('followup find err', err.message);
    });

    const shared_follow_up = await FollowUp.find({
      user: follow_up.user,
      shared_follow_up: follow_up._id,
    })
      .distinct('_id')
      .lean();

    FollowUp.deleteMany({
      user: follow_up.user,
      _id: { $in: shared_follow_up },
    }).catch((err) => {
      console.log('remove followup err', err.message);
    });

    Activity.deleteMany({
      user: follow_up.user,
      follow_ups: { $in: shared_follow_up },
      type: 'follow_ups',
    }).catch((err) => {
      console.log('followup find err', err.message);
    });
  }
};

const sendEmails = async (req, res) => {
  const { currentUser } = req;
  const {
    subject,
    content,
    cc,
    bcc,
    deal,
    contacts: inputContacts,
    video_ids,
    pdf_ids,
    image_ids,
  } = req.body;
  const error = [];

  if (!currentUser.primary_connected) {
    return res.status(406).json({
      status: false,
      error: 'no connected',
    });
  }

  const email = new Email({
    user: currentUser.id,
    subject,
    content,
    cc,
    bcc,
    deal,
  });
  email.save().catch((err) => {
    console.log('new email save err', err.message);
  });

  const activity_content = 'sent email';
  const activity = new Activity({
    user: currentUser.id,
    content: activity_content,
    deals: deal,
    type: 'emails',
    emails: email.id,
    videos: video_ids,
    pdfs: pdf_ids,
    images: image_ids,
  });
  activity.save().catch((err) => {
    console.log('activity save err', err.message);
  });

  const taskProcessId = new Date().getTime() + uuidv1();
  let contacts = [...inputContacts];
  let contactsToTemp = [];

  const STANDARD_CHUNK = 8;
  const CHUNK_COUNT = 12;
  const MIN_CHUNK = 5;
  const TIME_GAPS = [1, 2, 3];

  let LIMIT_CHUNK = STANDARD_CHUNK;
  if (
    currentUser.connected_email_type === 'smtp' &&
    currentUser.primary_connected
  ) {
    LIMIT_CHUNK = inputContacts.length;
  }

  if (inputContacts.length > LIMIT_CHUNK) {
    const currentTasks = await Task.find({
      user: currentUser._id,
      type: 'send_email',
      status: 'active',
      source: 'normal',
    })
      .sort({ due_date: -1 })
      .limit(1)
      .catch((err) => {
        console.log('Getting Last Email Tasks', err);
      });
    let last_due;
    if (currentTasks && currentTasks.length) {
      last_due = currentTasks[0].due_date;
      contactsToTemp = [...contacts];
      contacts = [];
    } else {
      last_due = new Date();
      contactsToTemp = contacts.slice(STANDARD_CHUNK);
      contacts = contacts.slice(0, STANDARD_CHUNK);
    }

    let delay = 2;
    let taskIndex = 0;
    while (taskIndex < contactsToTemp.length) {
      const due_date = moment(last_due).add(delay, 'minutes');
      const chunk =
        Math.floor(Math.random() * (CHUNK_COUNT - MIN_CHUNK)) + MIN_CHUNK;

      const task = new Task({
        user: currentUser.id,
        contacts: contactsToTemp.slice(taskIndex, taskIndex + chunk),
        status: 'active',
        process: taskProcessId,
        type: 'send_email',
        action: {
          ...req.body,
          contacts: undefined,
        },
        due_date,
      });

      task.save().catch((err) => {
        console.log('campaign job save err', err.message);
      });

      taskIndex += chunk;
      const timeIndex = Math.floor(Math.random() * TIME_GAPS.length);
      delay += TIME_GAPS[timeIndex];
    }

    if (!contacts.length) {
      return res.send({
        status: true,
        message: 'all_queue',
      });
    }
  }
  if (contacts.length) {
    const data = {
      user: currentUser.id,
      ...req.body,
      shared_email: email.id,
      has_shared: true,
    };

    sendEmail(data)
      .then(async (_res) => {
        const succeedContacts = [];
        _res.forEach((response) => {
          if (!response.status) {
            error.push({
              contact: response.contact,
              error: response.error,
              type: response.type,
            });
          } else {
            succeedContacts.push(response.contact._id);
          }
        });

        if (succeedContacts.length) {
          Email.updateOne(
            {
              _id: email.id,
            },
            {
              $set: {
                assigned_contacts: succeedContacts,
              },
            }
          ).catch((err) => {
            console.log('deal email assigned contact', err.message);
          });
        } else {
          if (!contactsToTemp || !contactsToTemp.length) {
            Email.deleteOne({
              _id: email.id,
            }).catch((err) => {
              console.log('deal email assigned contact', err.message);
            });
            Activity.deleteOne({
              _id: activity._id,
            }).catch((err) => {
              console.log('deal email activity remove', err.message);
            });
          }
        }

        let notRunnedContactIds = [];
        if (_res.length !== contacts.length) {
          const runnedContactIds = [];
          _res.forEach((e) => {
            runnedContactIds.push(e.contact && e.contact._id);
          });
          notRunnedContactIds = _.differenceBy(
            contacts,
            runnedContactIds,
            (e) => e + ''
          );
        }

        // Create Notification and With Success and Failed
        if (contactsToTemp && contactsToTemp.length) {
          // Failed Contacts && Total Contacts Count
          const failed = error.map((e) => e.contact && e.contact._id);
          const not_executed = [...notRunnedContactIds];
          const succeed = _.differenceBy(
            contacts,
            [...failed, ...notRunnedContactIds],
            (e) => e + ''
          );

          const task = new Task({
            user: currentUser._id,
            contacts,
            status: 'completed',
            process: taskProcessId,
            type: 'send_email',
            action: {
              subject,
              content,
              deal,
            },
            due_date: new Date(),
            exec_result: {
              notExecuted: not_executed,
              succeed,
              failed: error,
            },
          });
          task.save().catch((err) => {
            console.log('Some email is sent immediately', err);
          });
        }

        updateUserCount(currentUser._id, _res.length - error.length).catch(
          (err) => {
            console.log('Update user email count failed.', err);
          }
        );

        if (error.length > 0) {
          const connect_errors = error.filter((e) => {
            if (
              e.type === 'connection_failed' ||
              e.type === 'google_token_invalid' ||
              e.type === 'outlook_token_invalid'
            ) {
              return true;
            }
          });
          if (connect_errors.length) {
            return res.status(406).json({
              status: false,
              error,
              notExecuted: notRunnedContactIds,
              queue: contactsToTemp.length,
              sent: contacts.length - error.length - notRunnedContactIds.length,
            });
          } else {
            return res.status(405).json({
              status: false,
              error,
              notExecuted: notRunnedContactIds,
              queue: contactsToTemp.length,
              sent: contacts.length - error.length - notRunnedContactIds.length,
            });
          }
        } else {
          return res.send({
            status: true,
            data: {
              queue: contactsToTemp.length,
            },
          });
        }
      })
      .catch((err) => {
        console.log('email send error', err);
      });
  }
};

const getEmails = async (req, res) => {
  const { currentUser } = req;
  const emails = await Email.find({
    user: currentUser.id,
    deal: req.body.deal,
  });

  return res.status({
    status: true,
    data: emails,
  });
};

const getAppointments = async (req, res) => {
  const { currentUser } = req;
  const appointments = await Appointment.find({
    user: currentUser.id,
    deal: req.body.deal,
  });

  return res.status({
    status: true,
    data: appointments,
  });
};

const getTeamCalls = async (req, res) => {
  const { currentUser } = req;
  const team_calls = await TeamCall.find({
    user: currentUser.id,
    deal: req.body.deal,
  });

  return res.status({
    status: true,
    data: team_calls,
  });
};

const removeTeamCall = async (req, res) => {
  const { currentUser } = req;

  TeamCall.deleteOne({
    _id: req.body.team_call,
    user: currentUser.id,
  })
    .then(() => {
      // shared team call delete
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('team call delete err', err.message);
      return res.send(500).json({
        status: false,
        error: err,
      });
    });
};

const createAppointment = async (req, res) => {
  const { currentUser } = req;
  const { contacts } = req.body;

  let event_id;
  let recurrence_id;

  if (currentUser.calendar_connected) {
    const _appointment = req.body;
    const { connected_email, calendar_id } = req.body;

    const calendar_list = currentUser.calendar_list;
    let calendar;
    calendar_list.some((_calendar) => {
      if (_calendar.connected_email === connected_email) {
        calendar = _calendar;
        return true;
      }
    });

    if (!calendar) {
      return res.status(400).json({
        status: false,
        error: 'Invalid calendar',
      });
    }

    if (calendar.connected_calendar_type === 'outlook') {
      const { new_event_id, new_recurrence_id } = await addOutlookCalendarById(
        _appointment,
        calendar,
        calendar_id
      );
      event_id = new_event_id;
      recurrence_id = new_recurrence_id;
    } else {
      const token = JSON.parse(calendar.google_refresh_token);

      const { new_event_id, new_recurrence_id } = await addGoogleCalendarById(
        token.refresh_token,
        _appointment,
        calendar_id
      );
      event_id = new_event_id;
      recurrence_id = new_recurrence_id;
    }

    const deal_data = { ...req.body };

    const appointment = new Appointment({
      ...deal_data,
      event_id,
      user: currentUser.id,
    });

    appointment.save().catch((err) => {
      console.log('deal appointment create err', err.message);
    });

    const content = 'added meeting';
    const activity = new Activity({
      user: currentUser.id,
      content,
      type: 'appointments',
      appointments: appointment.id,
      deals: req.body.deal,
    });

    activity.save().catch((err) => {
      console.log('activity save err', err.message);
    });

    for (let i = 0; i < contacts.length; i++) {
      // const contact_appointment = new Appointment({
      //   ...req.body,
      //   event_id,
      //   contact: contacts[i],
      //   has_shared: true,
      //   shared_appointment: appointment.id,
      //   user: currentUser.id,
      // });

      // contact_appointment.save().catch((err) => {
      //   console.log('note save err', err.message);
      // });

      const appointment_activity = new Activity({
        content,
        contacts: contacts[i],
        type: 'appointments',
        appointments: appointment.id,
        user: currentUser.id,
      });

      appointment_activity.save().catch((err) => {
        console.log('note activity err', err.message);
      });
    }
    return res.send({
      status: true,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'You must connect gmail/outlook',
    });
  }
};

const updateAppointment = async (req, res) => {
  const { currentUser } = req;
  const { contacts } = req.body;

  if (currentUser.calendar_connected) {
    const _appointment = req.body;
    const { connected_email, calendar_id } = req.body;

    const calendar_list = currentUser.calendar_list;
    let calendar;
    calendar_list.some((_calendar) => {
      if (_calendar.connected_email === connected_email) {
        calendar = _calendar;
        return true;
      }
    });

    if (!calendar) {
      return res.status(400).json({
        status: false,
        error: 'Invalid calendar',
      });
    }

    const event_id = req.body.recurrence_id || req.body.event_id;
    if (calendar.connected_calendar_type === 'outlook') {
      const data = { appointment: _appointment, calendar, event_id };
      updateOutlookCalendarById(data);
    } else {
      const token = JSON.parse(calendar.google_refresh_token);

      const data = {
        refresh_token: token.refresh_token,
        appointment: _appointment,
        event_id,
        calendar_id,
      };
      await updateGoogleCalendarById(data);
    }

    const deal_data = { ...req.body };

    Appointment.updateOne(
      {
        _id: req.body.appointment,
      },
      { $set: deal_data }
    ).catch((err) => {
      console.log('appointment update err', err.message);
    });

    const activity_content = 'updated meeting';
    const activity = new Activity({
      user: currentUser.id,
      content: activity_content,
      type: 'appointments',
      appointments: req.body.appointment,
      deals: req.body.deal,
    });

    activity.save().catch((err) => {
      console.log('activity save err', err.message);
    });

    for (let i = 0; i < contacts.length; i++) {
      const appointment_activity = new Activity({
        content: activity_content,
        contacts: contacts[i],
        type: 'appointments',
        appointments: req.body.appointment,
        user: currentUser.id,
      });

      appointment_activity.save().catch((err) => {
        console.log('note activity err', err.message);
      });
    }
    return res.send({
      status: true,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'You must connect gmail/outlook',
    });
  }
};

const removeAppointment = async (req, res) => {
  const { currentUser } = req;

  if (currentUser.calendar_connected) {
    const { connected_email } = req.body;

    const calendar_list = currentUser.calendar_list;
    let calendar;
    calendar_list.some((_calendar) => {
      if (_calendar.connected_email === connected_email) {
        calendar = _calendar;
        return true;
      }
    });

    if (!calendar) {
      return res.status(400).json({
        status: false,
        error: 'Invalid calendar',
      });
    }

    const remove_id = req.body.recurrence_id || req.body.event_id;

    if (calendar.connected_calendar_type === 'outlook') {
      const data = { calendar_id: req.body.calendar_id, calendar, remove_id };
      removeOutlookCalendarById(data);
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );
      const token = JSON.parse(calendar.google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: token.refresh_token });
      const data = {
        oauth2Client,
        calendar_id: req.body.calendar_id,
        remove_id,
      };
      removeGoogleCalendarById(data);
    }

    const appointment = Appointment.findOne({
      user: currentUser.id,
      event_id: remove_id,
    }).catch((err) => {
      console.log('appointment find err', err.message);
    });

    Activity.deleteMany({
      appointments: appointment.id,
      user: currentUser.id,
    }).catch((err) => {
      console.log('appointment activity err', err.message);
    });

    Appointment.deleteOne({
      user: currentUser.id,
      event_id: remove_id,
    }).catch((err) => {
      console.log('appointment update err', err.message);
    });

    return res.send({
      status: true,
    });
  }
};

const createTeamCall = async (req, res) => {
  const { currentUser } = req;
  let leader;
  let contacts;

  if (req.body.contacts && req.body.contacts.length > 0) {
    contacts = await Contact.find({ _id: { $in: req.body.contacts } }).catch(
      (err) => {
        console.log('contact find err', err.message);
      }
    );
  }

  if (req.body.leader) {
    leader = await User.findOne({ _id: req.body.leader }).catch((err) => {
      console.log('leader find err', err.message);
    });
  }

  const deal_data = { ...req.body };

  const team_call = new TeamCall({
    ...deal_data,
    user: currentUser.id,
  });

  console.log('deal_data', deal_data, team_call);

  team_call
    .save()
    .then(() => {
      const activity = new Activity({
        team_calls: team_call.id,
        user: currentUser.id,
        content: 'inquired group call',
        type: 'team_calls',
        deals: req.body.deal,
      });

      activity.save().catch((err) => {
        console.log('activity save err', err.message);
      });

      if (leader) {
        let guests = '';
        if (contacts) {
          for (let i = 0; i < contacts.length; i++) {
            const first_name = contacts[i].first_name || '';
            const last_name = contacts[i].last_name || '';
            const data = {
              first_name,
              last_name,
            };

            const new_activity = new Activity({
              team_calls: team_call.id,
              user: currentUser.id,
              contacts: contacts[i].id,
              content: 'inquired group call',
              type: 'team_calls',
            });

            new_activity.save().catch((err) => {
              console.log('activity save err', err.message);
            });

            Contact.updateOne(
              {
                _id: contacts[i].id,
              },
              {
                $set: { last_activity: new_activity.id },
              }
            ).catch((err) => {
              console.log('contact update err', err.message);
            });

            const guest = `<tr style="margin-bottom:10px;"><td><span class="icon-user">${getAvatarName(
              data
            )}</label></td><td style="padding-left:5px;">${first_name} ${last_name}</td></tr>`;
            guests += guest;
          }
        }

        const organizer = `<tr><td><span class="icon-user">${getAvatarName({
          full_name: currentUser.user_name,
        })}</label></td><td style="padding-left: 5px;">${
          currentUser.user_name
        }</td></tr>`;

        const templatedData = {
          user_name: currentUser.user_name,
          leader_name: leader.user_name,
          created_at: moment().format('h:mm MMMM Do, YYYY'),
          subject: team_call.subject,
          description: team_call.description || '',
          organizer,
          call_url: urls.TEAM_CALLS + team_call.id,
          guests,
        };

        const params = {
          Destination: {
            ToAddresses: [leader.email],
          },
          Source: mail_contents.NO_REPLAY,
          Template: 'TeamCallRequest',
          TemplateData: JSON.stringify(templatedData),
          ReplyToAddresses: [currentUser.email],
        };

        // Create the promise and SES service object
        ses
          .sendTemplatedEmail(params)
          .promise()
          .then((response) => {
            console.log('success', response.MessageId);
          })
          .catch((err) => {
            console.log('ses send err', err);
          });
      }

      /** **********
       *  Creat dashboard notification to the inviated users
       *  */
      if (leader) {
        const notification = new Notification({
          user: leader.id,
          team_call: team_call.id,
          criteria: 'team_call_invited',
          content: `You've been invited to join a call by ${currentUser.user_name}.`,
        });

        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });
      }

      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('team save err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message,
      });
    });
};

const sendTexts = async (req, res) => {
  const { currentUser } = req;
  const { content, deal, video_ids, pdf_ids, image_ids, contacts } = req.body;
  const error = [];

  const text_info = currentUser.text_info;
  let count = 0;
  let max_text_count = 0;
  let additional_sms_credit = 0;

  if (!currentUser['twilio_number']) {
    return res.status(408).json({
      status: false,
      error: 'No phone',
    });
  }

  if (!text_info['is_enabled']) {
    return res.status(412).json({
      status: false,
      error: 'Disable send sms',
    });
  }

  if (text_info['is_limit']) {
    count = currentUser.text_info.count || 0;

    max_text_count =
      text_info.max_count || system_settings.TEXT_MONTHLY_LIMIT.PRO;

    const { additional_credit } = currentUser.text_info;
    if (additional_credit) {
      additional_sms_credit = additional_credit.amount;
    }

    if (max_text_count <= count && !additional_sms_credit) {
      return res.status(409).json({
        status: false,
        error: 'Exceed max sms credit',
      });
    }
  }

  const text = new Text({
    user: currentUser.id,
    type: 0,
    content,
    deal,
    assigned_contacts: contacts,
  });

  text.save().catch((err) => {
    console.log('new text save err', err.message);
  });

  const textProcessId = new Date().getTime() + '_' + uuidv1();

  const data = {
    user: currentUser.id,
    ...req.body,
    shared_text: text.id,
    has_shared: true,
    // max_text_count,
    textProcessId,
  };

  sendText(data)
    .then((_res) => {
      let sentCount = 0;
      const errors = [];
      const failed = [];
      const succeed = [];
      const sendStatus = {};
      const invalidContacts = [];
      const textResult = _res.splice(-1);
      _res.forEach((e) => {
        if (!e.status && !e.type) {
          errors.push(e);
          if (e.contact && e.contact._id) {
            failed.push(e.contact._id);
          }
        }
        if (e.isSent || e.status) {
          sentCount++;
        }
        if (e.delivered && e.contact && e.contact._id) {
          succeed.push(e.contact._id);
        }
        if (e.sendStatus) {
          if (e.contact && e.contact._id) {
            sendStatus[e.contact._id] = e.sendStatus;
          }
        } else if (!e.status) {
          if (e.contact && e.contact._id) {
            invalidContacts.push(e.contact._id);
          }
        }
      });
      if (textResult && textResult[0] && textResult[0]['text']) {
        const query = { $set: { send_status: sendStatus } };
        if (invalidContacts && invalidContacts.length) {
          query['$pull'] = { contacts: { $in: invalidContacts } };
        }
        if (invalidContacts.length === contacts.length) {
          Text.deleteOne({ _id: textResult[0]['text'] }).catch((err) => {
            console.log('remove texting is failed', err);
          });
        } else {
          Text.updateOne({ _id: textResult[0]['text'] }, query).catch((err) => {
            console.log('texting result saving is failed', err);
          });
        }
      }

      if (contacts.length && contacts.length > 1) {
        // Notification for bulk sms create
        const notification = new Notification({
          user: currentUser._id,
          type: 'personal',
          criteria: 'bulk_text',
          status: 'pending',
          process: textProcessId,
          contact: [...contacts],
          detail: {
            video_ids,
            pdf_ids,
            image_ids,
            content,
            deal,
          },
          deliver_status: {
            succeed,
            errors,
            failed,
          },
        });
        notification.save().catch((err) => {
          console.log('Bulk Email notification creation is failed.', err);
        });
      }

      if (sentCount) {
        const activity_content = 'sent text';

        const activity = new Activity({
          user: currentUser.id,
          content: activity_content,
          deals: deal,
          type: 'texts',
          texts: text.id,
          videos: video_ids,
          pdfs: pdf_ids,
          images: image_ids,
        });

        activity.save().catch((err) => {
          console.log('deal text activity save err', err.message);
        });

        updateUserTextCount(currentUser._id, sentCount).catch((err) => {
          console.log('update user text info is failed.', err);
        });
      } else {
        Text.deleteOne({
          _id: text.id,
        }).catch((err) => {
          console.log('deal email assigned contact', err.message);
        });
      }

      if (errors.length > 0) {
        return res.status(405).json({
          status: false,
          error: errors,
        });
      }
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('email send error', err);
    });
};

const bulkCreate = async (req, res) => {
  const { currentUser } = req;
  const { deals } = req.body;
  const promise_array = [];
  const deal_ids = [];

  for (let i = 0; i < deals.length; i++) {
    const deal = new Deal({
      title: deals[i].deal,
      deal_stage: deals[i].deal_stage,
      user: currentUser.id,
      put_at: new Date(),
    });

    const promise = new Promise(async (resolve) => {
      const _deal = await deal.save().catch((err) => {
        console.log('deal save err', err.message);
      });

      const deal_stage = await DealStage.findOne({
        _id: deals[i].deal_stage,
      }).catch((err) => {
        console.log('deal stage found error', err.message);
        return res.status(500).send(err.message || 'Deal found error');
      });

      if (deal_stage.automation) {
        const data = {
          automation_id: deal_stage.automation,
          assign_array: [deal.id],
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

      DealStage.updateOne(
        { _id: deals[i].deal_stage },
        { $push: { deals: _deal._id } }
      ).catch((err) => {
        console.log('error', err.message);
      });

      deal_ids.push({
        deal_id: _deal._id,
        deal_name: deals[i].deal,
      });

      resolve(_deal);
    });

    promise_array.push(promise);
  }

  Promise.all(promise_array)
    .then(() => {
      return res.send({
        status: true,
        data: deal_ids,
      });
    })
    .catch((err) => {
      return res.status(500).json({
        status: false,
      });
    });
};

const setPrimaryContact = async (req, res) => {
  const { currentUser } = req;
  const { deal_id, contact_id } = req.body;

  const _deal = await Deal.findOne({
    _id: deal_id,
    user: currentUser.id,
  });

  if (_deal) {
    Deal.updateOne(
      {
        _id: deal_id,
        user: currentUser.id,
      },
      { primary_contact: contact_id }
    ).then((result) => {
      return res
        .send({
          status: true,
        })
        .catch((err) => {
          res.status(500).send({
            status: false,
            error: err.message || JSON.stringify(err),
          });
        });
    });
  } else {
    return res.status(400).send({
      status: false,
      error: 'Not found current deal.',
    });
  }
};

module.exports = {
  getAll,
  getActivity,
  getNotes,
  getAppointments,
  getTeamCalls,
  removeTeamCall,
  create,
  moveDeal,
  edit,
  remove,
  getDetail,
  getSiblings,
  getMaterialActivity,
  createNote,
  editNote,
  removeNote,
  createFollowUp,
  completeFollowUp,
  createAppointment,
  updateAppointment,
  removeAppointment,
  updateFollowUp,
  removeFollowUp,
  createTeamCall,
  sendEmails,
  getEmails,
  sendTexts,
  updateContact,
  getTimeLines,
  bulkCreate,
  setPrimaryContact,
  getAllTimeLines,
  removeOnlyDeal,
};
