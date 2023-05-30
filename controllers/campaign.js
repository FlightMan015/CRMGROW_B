const moment = require('moment-timezone');
const Campaign = require('../models/campaign');
const CampaignJob = require('../models/campaign_job');
const MailList = require('../models/mail_list');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const Garbage = require('../models/garbage');
const EmailTracker = require('../models/email_tracker');
const VideoTracker = require('../models/video_tracker');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
const _ = require('lodash');

const system_settings = require('../config/system_settings');
const mongoose = require('mongoose');
const EmailTemplate = require('../models/email_template');
const MaterialTheme = require('../models/material_theme');

const get = async (req, res) => {
  const { currentUser } = req;
  const campaign_id = req.params.id;
  const campaign = await Campaign.findOne({
    _id: campaign_id,
    user: currentUser.id,
  })
    .select({ sent: false, failed: false })
    .populate({
      path: 'mail_list',
    })
    .populate({
      path: 'videos',
    })
    .populate({
      path: 'pdfs',
    })
    .populate({
      path: 'images',
    });

  let email_template;
  let newsletter;
  if (campaign.email_template) {
    email_template = await EmailTemplate.findOne({
      _id: campaign.email_template,
    })
      .populate({
        path: 'video_ids',
      })
      .populate({
        path: 'pdf_ids',
      })
      .populate({
        path: 'image_ids',
      });
  } else if (campaign.newsletter) {
    newsletter = await MaterialTheme.findOne({
      _id: campaign.newsletter,
    })
      .populate({
        path: 'videos',
      })
      .populate({
        path: 'pdfs',
      })
      .populate({
        path: 'images',
      });
  }

  const campaignStatus = await CampaignJob.aggregate([
    {
      $match: {
        campaign: mongoose.Types.ObjectId(campaign_id),
        status: 'done',
      },
    },
    {
      $group: {
        _id: '$campaign',
        sent: { $sum: { $size: '$contacts' } },
        failed: { $sum: { $size: '$failed' } },
      },
    },
  ]);

  // Opened, Unsubscribed, clicked, watched
  const emailTrackers = await EmailTracker.find({
    campaign: campaign_id,
  }).select({ type: 1 });
  const videoTrackers = await VideoTracker.countDocuments({
    campaign: campaign_id,
  });
  const pdfTrackers = await PDFTracker.countDocuments({
    campaign: campaign_id,
  });
  const imageTrackers = await ImageTracker.countDocuments({
    campaign: campaign_id,
  });

  if (!campaign) {
    return res.status(400).json({
      status: false,
      error: 'Campaign doesn`t exist',
    });
  }

  let opened = 0;
  let clicked = 0;
  let unsubscribed = 0;
  let watched = 0;
  emailTrackers.forEach((e) => {
    if (e.type === 'open') {
      opened++;
    } else if (e.type === 'click') {
      clicked++;
    } else if (e.type === 'unsubscribe') {
      unsubscribed++;
    }
  });
  watched = (videoTrackers || 0) + (pdfTrackers || 0) + (imageTrackers || 0);

  const campaignResult = { ...campaign._doc };
  if (campaign && campaign.contacts && campaign.contacts.length) {
    campaignResult.contacts = campaign.contacts.length;
  }
  if (campaign.email_template) {
    campaignResult.email_template = email_template;
  } else if (campaign.newsletter) {
    campaignResult.newsletter = newsletter;
  }

  return res.send({
    status: true,
    data: {
      campaign: campaignResult,
      campaignStatus,
      opened,
      clicked,
      unsubscribed,
      watched,
    },
  });
};

const update = async (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;
  const payload = req.body;

  Campaign.updateOne({ _id: id, user: currentUser._id }, { $set: payload })
    .then(() => {
      res.send({
        status: true,
        data: true,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || err,
      });
    });
};

const loadSessions = async (req, res) => {
  const { currentUser } = req;
  const { id } = req.body;

  const sessions = await CampaignJob.aggregate([
    {
      $match: {
        campaign: mongoose.Types.ObjectId(id),
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$due_date' },
          month: { $month: '$due_date' },
          day: { $dayOfMonth: '$due_date' },
        },
        contacts: { $sum: { $size: '$contacts' } },
        failed: { $sum: { $size: '$failed' } },
        sent: {
          $push: {
            contacts: { $size: '$contacts' },
            status: '$status',
          },
        },
        start_at: { $min: '$due_date' },
        end_at: { $max: '$due_date' },
      },
    },
  ]);

  return res.send({
    status: true,
    data: sessions,
  });
};

const loadActivities = async (req, res) => {
  const { currentUser } = req;
  const { id } = req.body;
  const data = req.body.data || {};
  const { category, material, material_type } = data;
  const limit = data.limit || 50;
  const page = data.page || 1;
  const skip = (page - 1) * limit;

  let activities = [];
  let total = 0;
  if (!category || category === 'all') {
    total = await Activity.countDocuments({
      campaign: id,
      type: { $nin: ['videos', 'pdfs', 'images'] },
    });
    activities = await Activity.find({
      campaign: id,
      type: { $nin: ['videos', 'pdfs', 'images'] },
    })
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'email_trackers',
      })
      .populate({
        path: 'video_trackers',
      })
      .populate({
        path: 'pdf_trackers',
      })
      .populate({
        path: 'image_trackers',
      })
      .populate({
        path: 'contacts',
      });
  }
  /**
  if (!category && material) {
  }
   */
  if (category) {
    if (category === 'contact') {
      // Campaign Load
      const campaign = await Campaign.findById(id).catch((err) => {
        console.log('campaign load error');
      });
      const contactIds = campaign.contacts.slice(skip, skip + limit);
      const failed = campaign.failed.map((e) => e.contact);
      const failedContactIds = _.intersectionBy(
        contactIds,
        failed,
        (e) => e + ''
      );
      const sentContactIds = _.intersectionBy(
        contactIds,
        campaign.sent,
        (e) => e.id + ''
      );

      const contacts = await Contact.find({
        _id: { $in: contactIds },
      })
        .select({
          _id: 1,
          first_name: 1,
          last_name: 1,
          email: 1,
          cell_phone: 1,
          label: 1,
          last_activity: 1,
        })
        .populate('last_activity')
        .catch((err) => {
          console.log('contact find is failed');
        });
      return res.send({
        status: true,
        data: {
          contacts,
          contactIds,
          failed: failedContactIds,
          sent: sentContactIds,
        },
      });
    }
    // Opened, clicked, watched, unsubscribed
    if (
      category === 'open' ||
      category === 'click' ||
      category === 'unsubscribe'
    ) {
      activities = await Activity.aggregate([
        {
          $match: {
            campaign: mongoose.Types.ObjectId(id),
            type: 'email_trackers',
          },
        },
        {
          $lookup: {
            from: 'email_trackers',
            localField: 'email_trackers',
            foreignField: '_id',
            as: 'email_trackers',
          },
        },
        {
          $match: { 'email_trackers.type': category },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: 'contacts',
            localField: 'contacts',
            foreignField: '_id',
            as: 'contacts',
          },
        },
        {
          $unwind: '$email_trackers',
        },
        {
          $unwind: '$contacts',
        },
      ]);
    } else if (category === 'watched') {
      activities = await Activity.find({
        campaign: id,
        type: { $in: ['video_trackers', 'pdf_trackers', 'image_trackers'] },
      })
        .skip(skip)
        .limit(50)
        .populate({
          path: 'video_trackers',
        })
        .populate({
          path: 'pdf_trackers',
        })
        .populate({
          path: 'image_trackers',
        })
        .populate({
          path: 'contacts',
        });
    } else if (category === 'delivered') {
      activities = await Activity.find({
        campaign: id,
        type: { $in: ['emails'] },
      })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'contacts',
        });
    } else if (category === 'sent') {
      const campaign = await Campaign.findById(id).catch((err) => {
        console.log('campaign getting is failed');
      });
      if (campaign && campaign.sent.length) {
        const contactIds = campaign.sent.slice(skip, skip + limit);
        const failed = campaign.failed.map((e) => e.contact);
        const failedContactIds = _.intersectionBy(
          contactIds,
          failed,
          (e) => e + ''
        );
        const contacts = await Contact.find({
          _id: { $in: contactIds },
        })
          .select({
            _id: 1,
            first_name: 1,
            last_name: 1,
            email: 1,
            cell_phone: 1,
            label: 1,
            last_activity: 1,
          })
          .populate('last_activity')
          .catch((err) => {
            console.log('contact find failed');
          });
        return res.send({
          status: true,
          data: {
            contacts,
            contactIds,
            failed: failedContactIds,
          },
        });
      } else {
        return res.send({
          status: true,
          data: {
            contacts: [],
          },
        });
      }
    } else if (category === 'awaiting') {
      const campaign = await Campaign.findById(id).catch((err) => {
        console.log('campaign getting is failed');
      });
      if (campaign && campaign.contacts.length) {
        const contactIds = _.differenceBy(
          campaign.contacts,
          campaign.sent,
          (e) => e + ''
        );
        const awaiting = contactIds.slice(skip, skip + limit);
        const contacts = await Contact.find({
          _id: { $in: awaiting },
        })
          .select({
            _id: 1,
            first_name: 1,
            last_name: 1,
            email: 1,
            cell_phone: 1,
            label: 1,
            last_activity: 1,
          })
          .populate('last_activity')
          .catch((err) => {
            console.log('contact find failed');
          });
        return res.send({
          status: true,
          data: {
            contacts,
            contactIds: awaiting,
          },
        });
      } else {
        return res.send({
          status: true,
          data: {
            contacts: [],
          },
        });
      }
    } else if (category === 'failed') {
      const campaign = await Campaign.findById(id).catch((err) => {
        console.log('campaign getting is failed');
      });
      if (campaign && campaign.failed.length) {
        const failed = campaign.failed.slice(skip, skip + limit);
        const contactIds = failed.map((e) => e.contact);
        const contacts = await Contact.find({
          _id: { $in: contactIds },
        })
          .select({
            _id: 1,
            first_name: 1,
            last_name: 1,
            email: 1,
            cell_phone: 1,
            label: 1,
            last_activity: 1,
          })
          .populate('last_activity')
          .catch((err) => {
            console.log('contact find failed');
          });
        return res.send({
          status: true,
          data: {
            contacts,
            contactIds,
            failed,
          },
        });
      } else {
        return res.send({
          status: true,
          data: {
            contacts: [],
          },
        });
      }
    }
  }

  return res.send({
    status: true,
    data: {
      activities,
      total,
    },
  });
};

const getAll = async (req, res) => {
  const { currentUser } = req;

  const data = await Campaign.find({ user: currentUser.id }).catch((err) => {
    return res.status(500).json({
      status: false,
      error: err.message,
    });
  });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Campaign doesn`t exist',
    });
  }

  const results = [];
  data.forEach((e) => {
    const result = { ...e._doc };
    if (result.contacts && result.contacts.length) {
      result.contacts = result.contacts.length;
    } else {
      result.contacts = 0;
    }
    if (result.sent && result.sent.length) {
      result.sent = result.sent.length;
    } else {
      result.sent = 0;
    }
    if (result.failed && result.failed.length) {
      result.failed = result.failed.length;
    } else {
      result.failed = 0;
    }
    results.push(result);
  });

  return res.send({
    status: true,
    data: results,
  });
};

const getAwaitingCampaigns = async (req, res) => {
  const { currentUser } = req;

  const data = await CampaignJob.aggregate([
    {
      $match: {
        user: currentUser._id,
        status: 'active',
        due_date: { $gte: new Date() },
      },
    },
    {
      $group: {
        _id: { process: '$campaign' },
      },
    },
    {
      $lookup: {
        from: 'campaigns',
        localField: '_id.process',
        foreignField: '_id',
        as: 'campaign',
      },
    },
    {
      $unwind: '$campaign',
    },
  ]).catch((err) => {
    return res.status(500).json({
      status: false,
      error: err.message,
    });
  });
  const result = [];
  data.forEach((e) => {
    const el = {
      ...e.campaign,
      contacts: e.campaign.contacts.length,
      sent: e.campaign.sent.length,
      failed: e.campaign.failed.length,
    };
    result.push(el);
  });

  return res.send({
    status: true,
    data: result,
  });
};

const loadContactsByActivity = async (req, res) => {
  const { currentUser } = req;
  const { starting_after, ending_before } = req.body;
  let skip = req.body.skip || 0;
  const size = req.body.size || 50;

  let activity_list;
  const data = [];

  const latest_activity = await Activity.find({
    user: currentUser.id,
    campaign: req.body.campaign,
  })
    .sort({ _id: -1 })
    .limit(1);

  while (data.length < 50) {
    if (!starting_after && !ending_before) {
      activity_list = await Activity.find({
        user: currentUser.id,
        campaign: req.body.campaign,
      })
        .sort({ _id: -1 })
        .populate('contacts')
        .skip(skip)
        .limit(size * 5);
    } else if (starting_after) {
      activity_list = await Activity.find({
        user: currentUser.id,
        campaign: req.body.campaign,
      })
        .sort({ _id: -1 })
        .populate('contacts')
        .skip(skip)
        .limit(size * 5);
    } else if (ending_before) {
      activity_list = await Activity.find({
        user: currentUser.id,
        campaign: req.body.campaign,
      })
        .sort({ _id: 1 })
        .populate('contacts')
        .skip(skip)
        .limit(size * 5);
    }

    if (activity_list.length === 0) {
      break;
    }

    for (let i = 0; i < activity_list.length; i++) {
      let activity = activity_list[i];
      let next_activity = activity_list[i + 1];
      if (next_activity) {
        const activity_contact = activity.contacts
          ? activity.contacts._id
          : null;
        let next_contact = next_activity.contacts
          ? next_activity.contacts._id
          : null;

        if (activity_contact && activity_contact === next_contact) {
          activity = { ...activity._doc, additional_field: [next_activity.id] };
          i++;

          next_activity = activity_list[i + 1];
          if (!next_activity) {
            data.push(activity);
            break;
          }
          next_contact = next_activity.contacts
            ? next_activity.contacts._id
            : null;

          while (activity_contact === next_contact) {
            activity.additional_field.push(next_activity.id);
            i++;

            next_activity = activity_list[i + 1];
            if (!next_activity) {
              break;
            }
            next_contact = next_activity.contacts
              ? next_activity.contacts._id
              : null;
          }
          data.push(activity);
        } else if (activity_contact) {
          data.push(activity);
        }
      } else {
        data.push(activity);
        break;
      }
    }
    if (data.length < 50) {
      skip += activity_list.length;
    }
  }
  return res.send({
    status: true,
    data: {
      activity_list: data,
      latest: latest_activity[0],
    },
  });
};

const getDayStatus = async (req, res) => {
  const { currentUser } = req;
  const dayStatus = await CampaignJob.aggregate([
    {
      $lookup: {
        from: 'campaigns',
        localField: 'campaign',
        foreignField: '_id',
        as: 'campaign',
      },
    },
    {
      $match: {
        user: currentUser._id,
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$due_date' },
          month: { $month: '$due_date' },
          day: { $dayOfMonth: '$due_date' },
        },
        items: { $push: '$$ROOT' },
        count: { $sum: 1 },
        contacts_count: { $sum: { $size: '$contacts' } },
        last_due_date: { $last: '$due_date' },
      },
    },
  ]);

  return res.send({
    status: true,
    data: dayStatus,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  const { due_start: start_date, contacts } = req.body;

  const garbage = await Garbage.findOne({
    user: currentUser.id,
  });

  // const mail_list = await MailList.findOne({
  //   _id: req.body.mail_list,
  // });

  let setFirstJob = false;

  const new_campaign = new Campaign({
    ...req.body,
    user: currentUser.id,
  });

  const daily_limit =
    garbage.smtp_info.daily_limit || system_settings.CAMPAIGN_MAIL_START.SMTP;
  // const daily_limit = 8;

  new_campaign
    .save()
    .then(async (campaign) => {
      /**
       * Email Campaign daily limit startup count
       */
      // Find the assigned date status
      const currentDate = dayOfDate(new Date());
      const dayStatus = await CampaignJob.aggregate([
        {
          $match: {
            user: currentUser._id,
            due_date: { $gte: currentDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$due_date' },
              month: { $month: '$due_date' },
              day: { $dayOfMonth: '$due_date' },
            },
            count: { $sum: 1 },
            contacts_count: { $sum: { $size: '$contacts' } },
            last_due_date: { $last: '$due_date' },
          },
        },
      ]);
      // convert the above result to date => Status JSON
      const assigned_dates = {};
      if (dayStatus && dayStatus.length) {
        dayStatus.forEach((day) => {
          const dateString = `${day._id.year}-${day._id.month}-${day._id.day}`;
          assigned_dates[dateString] = day;
        });
      }
      // Adjust the start date (if start date is today, it would be changed to the time that is 1 hour later)
      const possible_today = new Date(new Date().getTime() + 300 * 1000);
      const _start_date = new Date(start_date + '');
      let due_start =
        _start_date <= possible_today ? possible_today : _start_date;
      const ChunkContactMax = 15;
      const ChunkContactMin = Math.floor(ChunkContactMax / 2);
      // let ChunkContactMax = 4;
      // let ChunkContactMin = 1;
      // let TimeGapMax = Math.floor(
      //   (24 * 60) / Math.ceil(daily_limit / ChunkContactMin)
      // );
      // let TimeGapMin = Math.floor(TimeGapMax / 2);
      // if (TimeGapMax < 20) {
      //   ChunkContactMin = Math.ceil(daily_limit / 72);
      //   ChunkContactMax = ChunkContactMin * 2;
      //   TimeGapMax = 20;
      //   TimeGapMin = 10;
      // }
      const TimeGapMax = 6;
      const TimeGapMin = 2;
      // Assign Contacts
      while (contacts.length) {
        const due_date_day = dayOfDate(due_start);
        // the contacts count for the campaign job that is assigned this day already
        const due_date_string =
          due_date_day.getUTCFullYear() +
          '-' +
          (due_date_day.getUTCMonth() + 1) +
          '-' +
          due_date_day.getUTCDate();
        const used_capacity = assigned_dates[due_date_string]
          ? assigned_dates[due_date_string]['contacts_count'] || 0
          : 0;
        // the assignable time calculate
        if (used_capacity >= daily_limit) {
          // Increase due_start
          due_start = moment(due_start).add(1, 'day').toDate();
          continue;
        }
        // assign the contacts to the campaign job while the capacity is true or date is true
        const next_day = moment(due_start).add(1, 'day').toDate();
        if (
          used_capacity &&
          assigned_dates[due_date_string] &&
          assigned_dates[due_date_string]['last_due_date']
        ) {
          due_start = moment(assigned_dates[due_date_string]['last_due_date'])
            .add(TimeGapMin, 'minute')
            .toDate();
        }
        let due_date = due_start;
        let assigned_count = used_capacity;
        while (
          contacts.length &&
          assigned_count < daily_limit &&
          due_date <= next_day
        ) {
          //  random assign
          const enable_capacity = daily_limit - assigned_count;
          // let chunk_count = ChunkContactMin;
          // if (enable_capacity > ChunkContactMax) {
          //   chunk_count = between(ChunkContactMin, ChunkContactMax);
          // } else {
          //   chunk_count = enable_capacity;
          // }
          let chunk_count = daily_limit;
          if (enable_capacity < daily_limit) {
            chunk_count = enable_capacity;
          }

          // console.log({
          //   user: currentUser.id,
          //   contacts: contacts.slice(0, chunk_count),
          //   status: 'active',
          //   campaign: campaign.id,
          //   due_date,
          // });
          console.log('chunk count', chunk_count);
          const campaign_job = new CampaignJob({
            user: currentUser.id,
            contacts: contacts.slice(0, chunk_count),
            status: 'active',
            campaign: campaign.id,
            due_date,
          });
          campaign_job.save().catch((err) => {
            console.log('campaign job save err', err.message);
          });
          if (!setFirstJob) {
            setFirstJob = true;
            campaign.due_start = due_date;
            campaign.save().catch(() => {
              console.log('campaign due start time update failed');
            });
          }
          contacts.splice(0, chunk_count);

          // calculate next due date
          const gap_time = between(TimeGapMin, TimeGapMax);
          due_date = moment(due_date).add(gap_time, 'minute').toDate();
          // assigned contacts
          assigned_count += chunk_count;
        }
        // calculate next due start
        due_start = next_day;
      }

      const result = { ...campaign._doc };
      if (result.contacts && result.contacts.length) {
        result.contacts = result.contacts.length;
      } else {
        result.contacts = 0;
      }
      if (result.sent && result.sent.length) {
        result.sent = result.sent.length;
      } else {
        result.sent = 0;
      }
      if (result.failed && result.failed.length) {
        result.failed = result.failed.length;
      } else {
        result.failed = 0;
      }

      return res.send({
        status: true,
        data: result,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message || 'Internal server error',
      });
    });
};

const removeSession = async (req, res) => {
  const { currentUser } = req;
  const { campaign, session, mode } = req.body;
  const { year, month, day } = session;
  if (!year) {
    return res.status(400).send({
      status: false,
      error: `Couldn't find the session.`,
    });
  }
  const startTime = new Date(
    `${year}-${numPad(month)}-${numPad(day)}T00:00:00.000Z`
  );
  const endTime = new Date(
    `${year}-${numPad(month)}-${numPad(day)}T23:59:59.999Z`
  );
  console.log('start time and end time', startTime, endTime);

  if (mode === 'remove') {
    const campaignJobs = await CampaignJob.find({
      campaign,
      due_date: { $gte: startTime, $lte: endTime },
    }).catch((err) => {
      console.log('campaign job finding is failed.', err.message);
    });
    let contacts = [];
    campaignJobs.forEach((e) => {
      contacts = [...contacts, ...e.contacts];
    });
    await CampaignJob.deleteMany({
      campaign,
      due_date: { $gte: startTime, $lte: endTime },
    }).catch((err) => {
      console.log('campaign job deleting is failed.', err.message);
    });
    await Campaign.updateOne(
      {
        _id: campaign,
      },
      {
        $pull: { contacts: { $in: contacts } },
      }
    ).catch((err) => {
      console.log('campaign contact remove is failed', err.message);
    });
    return res.send({
      status: true,
      data: {
        contacts: contacts.length,
      },
    });
  } else {
    const campaginJobs = await CampaignJob.find({
      campaign,
      due_date: { $gte: startTime, $lte: endTime },
      status: { $ne: 'done' },
    }).catch((err) => {
      console.log('campaign job finding is failed.', err.message);
    });
    let contacts = [];
    campaginJobs.forEach((e) => {
      contacts = [...contacts, ...e.contacts];
    });
    console.log('contacts', contacts);
    await CampaignJob.deleteMany({
      campaign,
      due_date: { $gte: startTime, $lte: endTime },
      status: { $ne: 'done' },
    }).catch((err) => {
      console.log('campaign job deleting is failed.', err.message);
    });
    await Campaign.updateOne(
      {
        _id: campaign,
      },
      {
        $pull: { contacts: { $in: contacts } },
      }
    ).catch((err) => {
      console.log('campaign contacts is failed.', err.message);
    });
    return res.send({
      status: true,
      data: {
        contacts: contacts.length,
      },
    });
  }
};

const removeContact = async (req, res) => {
  const { currentUser } = req;
  const { campaign, contact } = req.body;

  Campaign.updateMany(
    {
      _id: campaign,
    },
    {
      $pull: { contacts: { $in: [contact] } },
    }
  ).catch((err) => {
    console.log('campaign contacts is failed.', err.message);
  });
  const updatedJob = await CampaignJob.findOne({
    campaign,
    contacts: { $in: [contact] },
  }).catch((err) => {
    console.log('campaign contacts is failed.', err.message);
  });
  CampaignJob.updateOne(
    {
      campaign,
      contacts: { $in: [contact] },
    },
    {
      $pull: { contacts: { $in: [contact] } },
    },
    { returnOriginal: true }
  ).catch((err) => {
    console.log('campaign contacts is failed.', err.message);
  });

  return res.send({
    status: true,
    data: updatedJob ? updatedJob.due_date : null,
  });
};

const publish = async (req, res) => {
  const { currentUser } = req;
  const { id } = req.body;

  const garbage = await Garbage.findOne({
    user: currentUser.id,
  });
  const daily_limit =
    garbage.smtp_info.daily_limit || system_settings.CAMPAIGN_MAIL_START.SMTP;

  const campaign = await Campaign.findOne({
    _id: id,
  }).catch((err) => {
    console.log('campaign finding is failed.', err.message);
  });

  if (!campaign) {
    // Create campaign and publish
    const data = { ...req.body, id: undefined };
    const new_campaign = new Campaign({
      ...data,
      user: currentUser.id,
      status: 'awaiting',
    });
    new_campaign.save().then(async (_res) => {
      await createCampaignJobs(
        currentUser._id,
        new_campaign,
        req.body.contacts,
        req.body.due_start,
        daily_limit
      ).catch((err) => {
        console.log('campaign jobs creation is failed', err.message);
      });

      const result = { ...new_campaign._doc };
      if (result.contacts && result.contacts.length) {
        result.contacts = result.contacts.length;
      } else {
        result.contacts = 0;
      }
      if (result.sent && result.sent.length) {
        result.sent = result.sent.length;
      } else {
        result.sent = 0;
      }
      if (result.failed && result.failed.length) {
        result.failed = result.failed.length;
      } else {
        result.failed = 0;
      }
      return res.send({
        status: true,
        data: result,
      });
    });
  } else {
    if (campaign.user + '' !== currentUser._id + '') {
      return res.status(400).send({
        status: false,
        error: 'Invalid permission for this campaign.',
      });
    }

    // Update and publish
    const data = { ...req.body, id: undefined };
    for (const key in data) {
      campaign[key] = data[key];
    }
    campaign['status'] = 'awaiting';

    campaign.save().then(async (_res) => {
      await createCampaignJobs(
        currentUser._id,
        campaign,
        req.body.contacts,
        req.body.due_start,
        daily_limit
      ).catch((err) => {
        console.log('campaign jobs creation is failed', err.message);
      });

      const result = { ...campaign._doc };
      if (result.contacts && result.contacts.length) {
        result.contacts = result.contacts.length;
      } else {
        result.contacts = 0;
      }
      if (result.sent && result.sent.length) {
        result.sent = result.sent.length;
      } else {
        result.sent = 0;
      }
      if (result.failed && result.failed.length) {
        result.failed = result.failed.length;
      } else {
        result.failed = 0;
      }
      return res.send({
        status: true,
        data: result,
      });
    });
  }
};
const saveDraft = async (req, res) => {
  const { currentUser } = req;
  const { id } = req.body;
  console.log('save draft');
  if (!id) {
    const new_campaign = new Campaign({
      ...req.body,
      user: currentUser.id,
      status: 'draft',
    });
    new_campaign.save().then(async (campaign) => {
      const result = { ...campaign._doc };
      if (result.contacts && result.contacts.length) {
        result.contacts = result.contacts.length;
      } else {
        result.contacts = 0;
      }
      if (result.sent && result.sent.length) {
        result.sent = result.sent.length;
      } else {
        result.sent = 0;
      }
      if (result.failed && result.failed.length) {
        result.failed = result.failed.length;
      } else {
        result.failed = 0;
      }
      return res.send({
        status: true,
        data: result,
      });
    });
  } else {
    const campaign = await Campaign.findOne({
      _id: id,
    }).catch((err) => {
      console.log('campaign finding is failed.', err.message);
    });
    if (!campaign) {
      const data = { ...req.body, id: undefined };
      const new_campaign = new Campaign({
        ...data,
        user: currentUser.id,
        status: 'draft',
      });
      new_campaign.save().then(async (campaign) => {
        const result = { ...campaign._doc };
        if (result.contacts && result.contacts.length) {
          result.contacts = result.contacts.length;
        } else {
          result.contacts = 0;
        }
        if (result.sent && result.sent.length) {
          result.sent = result.sent.length;
        } else {
          result.sent = 0;
        }
        if (result.failed && result.failed.length) {
          result.failed = result.failed.length;
        } else {
          result.failed = 0;
        }
        return res.send({
          status: true,
          data: result,
        });
      });
    } else {
      if (campaign.user + '' !== currentUser._id + '') {
        return res.status(400).send({
          status: false,
          error: 'Invalid permission for this campaign.',
        });
      }

      // Update and publish
      const data = { ...req.body, id: undefined };
      for (const key in data) {
        campaign[key] = data[key];
      }
      campaign['status'] = 'draft';

      campaign.save().then(async (_res) => {
        const result = { ...campaign._doc };
        if (result.contacts && result.contacts.length) {
          result.contacts = result.contacts.length;
        } else {
          result.contacts = 0;
        }
        if (result.sent && result.sent.length) {
          result.sent = result.sent.length;
        } else {
          result.sent = 0;
        }
        if (result.failed && result.failed.length) {
          result.failed = result.failed.length;
        } else {
          result.failed = 0;
        }
        return res.send({
          status: true,
          data: result,
        });
      });
    }
  }
};
const remove = (req, res) => {
  const { currentUser } = req;
  const { id } = req.body;

  CampaignJob.deleteMany({ campaign: id, user: currentUser._id }).catch(
    (err) => {
      console.log('campaign job deleting is failed.', err.message);
    }
  );

  Campaign.deleteOne({ _id: id, user: currentUser._id }).catch((err) => {
    console.log('campaign deleting is failed.', err.message);
  });

  return res.send({
    status: true,
  });
};
const loadDraft = async (req, res) => {
  const { currentUser } = req;
  const { id } = req.body;

  const campaign = await Campaign.findOne({
    _id: id,
    user: currentUser._id,
  })
    .populate({
      path: 'email_template',
    })
    .populate({
      path: 'newsletter',
    })
    .catch((err) => {
      console.log('campaign loading is failed', err.message);
    });
  if (!campaign) {
    return res.send({
      status: false,
      error: `Not found the campaign or invalid permission`,
    });
  }
  const firstPageContacts = campaign.contacts.slice(0, 50);
  const contacts = await Contact.find({
    _id: { $in: firstPageContacts },
  })
    .select({
      _id: true,
      first_name: true,
      last_name: true,
      email: true,
      cell_phone: true,
    })
    .catch((err) => {
      console.log('contacts loading is failed', err.message);
    });

  return res.send({
    status: true,
    data: {
      campaign,
      contacts,
    },
  });
};
const loadDraftContacts = async (req, res) => {
  const { currentUser } = req;
  const { id } = req.body;

  const campaign = await Campaign.findOne({
    _id: id,
    user: currentUser._id,
  }).catch((err) => {
    console.log('campaign loading is failed', err.message);
  });
  if (!campaign) {
    return res.send({
      status: false,
      error: `Not found the campaign or invalid permission`,
    });
  }
  const contacts = await Contact.find({
    _id: { $in: campaign.contacts },
  })
    .select({
      _id: true,
      first_name: true,
      last_name: true,
      email: true,
      cell_phone: true,
    })
    .catch((err) => {
      console.log('contacts loading is failed', err.message);
    });

  return res.send({
    status: true,
    data: contacts,
  });
};

const createCampaignJobs = async (
  user,
  campaign,
  contacts,
  start_date,
  daily_limit
) => {
  /**
   * Email Campaign daily limit startup count
   */
  // Find the assigned date status
  let dueStartDate;
  const currentDate = dayOfDate(new Date());
  const dayStatus = await CampaignJob.aggregate([
    {
      $match: {
        user,
        due_date: { $gte: currentDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$due_date' },
          month: { $month: '$due_date' },
          day: { $dayOfMonth: '$due_date' },
        },
        count: { $sum: 1 },
        contacts_count: { $sum: { $size: '$contacts' } },
        last_due_date: { $last: '$due_date' },
      },
    },
  ]);
  // convert the above result to date => Status JSON
  const assigned_dates = {};
  if (dayStatus && dayStatus.length) {
    dayStatus.forEach((day) => {
      const dateString = `${day._id.year}-${day._id.month}-${day._id.day}`;
      assigned_dates[dateString] = day;
    });
  }
  // Adjust the start date (if start date is today, it would be changed to the time that is 1 hour later)
  const possible_today = new Date(new Date().getTime() + 300 * 1000);
  const _start_date = new Date(start_date + '');
  let due_start =
    _start_date <= possible_today ? possible_today : dayOfDate(_start_date);
  const ChunkContactMax = 15;
  const ChunkContactMin = Math.floor(ChunkContactMax / 2);
  // let ChunkContactMax = 4;
  // let ChunkContactMin = 1;
  // let TimeGapMax = Math.floor(
  //   (24 * 60) / Math.ceil(daily_limit / ChunkContactMin)
  // );
  // let TimeGapMin = Math.floor(TimeGapMax / 2);
  // if (TimeGapMax < 20) {
  //   ChunkContactMin = Math.ceil(daily_limit / 72);
  //   ChunkContactMax = ChunkContactMin * 2;
  //   TimeGapMax = 20;
  //   TimeGapMin = 10;
  // }
  const TimeGapMax = 6;
  const TimeGapMin = 2;
  // Assign Contacts
  while (contacts.length) {
    const due_date_day = dayOfDate(due_start);
    // the contacts count for the campaign job that is assigned this day already
    const due_date_string =
      due_date_day.getUTCFullYear() +
      '-' +
      (due_date_day.getUTCMonth() + 1) +
      '-' +
      due_date_day.getUTCDate();
    const used_capacity = assigned_dates[due_date_string]
      ? assigned_dates[due_date_string]['contacts_count'] || 0
      : 0;
    // the assignable time calculate
    if (used_capacity >= daily_limit) {
      // Increase due_start
      due_start = moment(due_start).add(1, 'day').toDate();
      continue;
    }
    // assign the contacts to the campaign job while the capacity is true or date is true
    const next_day = moment(due_start).add(1, 'day').toDate();
    if (
      used_capacity &&
      assigned_dates[due_date_string] &&
      assigned_dates[due_date_string]['last_due_date']
    ) {
      due_start = moment(assigned_dates[due_date_string]['last_due_date'])
        .add(TimeGapMin, 'minute')
        .toDate();
    }
    let due_date = due_start;
    let assigned_count = used_capacity;
    while (
      contacts.length &&
      assigned_count < daily_limit &&
      due_date <= next_day
    ) {
      //  random assign
      const enable_capacity = daily_limit - assigned_count;
      // let chunk_count = ChunkContactMin;
      // if (enable_capacity > ChunkContactMax) {
      //   chunk_count = between(ChunkContactMin, ChunkContactMax);
      // } else {
      //   chunk_count = enable_capacity;
      // }
      let chunk_count = daily_limit;
      if (enable_capacity < daily_limit) {
        chunk_count = enable_capacity;
      }

      // console.log({
      //   user: currentUser.id,
      //   contacts: contacts.slice(0, chunk_count),
      //   status: 'active',
      //   campaign: campaign.id,
      //   due_date,
      // });
      if (!dueStartDate) {
        dueStartDate = due_date;
        campaign.due_start = due_date;
        campaign.save();
      }
      const campaign_job = new CampaignJob({
        user,
        contacts: contacts.slice(0, chunk_count),
        status: 'active',
        campaign: campaign.id,
        due_date,
      });
      campaign_job.save().catch((err) => {
        console.log('campaign job save err', err.message);
      });
      contacts.splice(0, chunk_count);

      // calculate next due date
      const gap_time = between(TimeGapMin, TimeGapMax);
      due_date = moment(due_date).add(gap_time, 'minute').toDate();
      // assigned contacts
      assigned_count += chunk_count;
    }
    // calculate next due start
    due_start = next_day;
  }
};

function between(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function dayOfDate(date) {
  const dateMili = 24 * 3600 * 1000;
  let dateTime;
  if (date instanceof Date) {
    dateTime = date.getTime();
  } else {
    dateTime = date.valueOf();
  }
  return new Date(Math.floor(dateTime / dateMili) * dateMili);
}

function numPad(input) {
  const num = parseInt(input + '');
  if (num < 10) {
    return '0' + num;
  } else {
    return num + '';
  }
}

module.exports = {
  getAll,
  get,
  create,
  update,
  loadContactsByActivity,
  loadSessions,
  loadActivities,
  removeSession,
  removeContact,
  getDayStatus,
  loadDraft,
  publish,
  saveDraft,
  remove,
  loadDraftContacts,
  getAwaitingCampaigns,
};
