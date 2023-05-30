const Activity = require('../models/activity');
const Contact = require('../models/contact');
const VideoTracker = require('../models/video_tracker');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
const mongoose = require('mongoose');
const get = async (req, res) => {
  const { currentUser } = req;
  const shared_contacts = await Contact.find({
    shared_members: currentUser.id,
  }).catch((err) => {
    console.log('get shared contacts err', err.message);
  });

  let count;
  if (shared_contacts && shared_contacts.length > 0) {
    count = await Activity.countDocuments({
      user: currentUser.id,
      contacts: { $in: shared_contacts },
    });
  } else {
    count = await Activity.countDocuments({
      user: currentUser.id,
    });
  }
  let activity;
  if (typeof req.params.id === 'undefined') {
    activity = await Activity.find({ user: currentUser.id })
      .sort({ updated_at: -1 })
      .populate('contacts')
      .limit(20);
  } else {
    const id = parseInt(req.params.id);
    activity = await Activity.find({ user: currentUser.id })
      .sort({ updated_at: -1 })
      .populate('contacts')
      .skip(id)
      .limit(20);
  }

  return res.send({
    status: true,
    data: {
      activity,
      count,
    },
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const activity = new Activity({
    ...req.body,
    user: currentUser.id,
  });

  activity
    .save()
    .then((_res) => {
      if (_res.contacts) {
        Contact.updateOne(
          { _id: _res.contacts },
          { $set: { last_activity: _res.id } }
        ).catch((err) => {
          console.log('err', err);
        });
      }
      const data = _res;
      res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const contactActivity = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.body;
  const _activity_list = await Activity.find({
    user: currentUser.id,
    contacts: contact,
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

  return res.send({
    status: true,
    data: _activity_detail_list,
  });
};

const removeBulk = async (req, res) => {
  const { contact, activities } = req.body;
  Activity.deleteMany({ _id: { $in: activities } })
    .then(async () => {
      const lastActivity = await Activity.findOne(
        { contacts: contact },
        {},
        { sort: { _id: -1 } }
      ).catch((err) => {
        console.log('err', err);
      });
      Contact.updateOne(
        {
          _id: contact,
        },
        {
          $set: { last_activity: lastActivity.id },
        }
      )
        .then((data) => {
          return res.send({
            status: true,
            data: lastActivity,
          });
        })
        .catch((err) => {
          console.log('err', err);
        });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Error in remove all activities',
      });
    });
};

const removeAll = async (req, res) => {
  const { contact, option } = req.body;
  Activity.deleteMany({ contacts: contact, type: { $nin: ['contacts'] } })
    .then(async () => {
      const contactActivity = await Activity.findOne({
        contacts: contact,
        type: { $in: ['contacts'] },
      }).catch((err) => {
        console.log('err', err);
      });
      Contact.updateOne(
        { _id: contact },
        {
          $set: { last_activity: contactActivity.id },
        }
      )
        .then(() => {
          return res.send({
            status: true,
            data: contactActivity,
          });
        })
        .catch((err) => {
          console.log('err', err);
        });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Error in remove all activities',
      });
    });
};

const load = async (req, res) => {
  const { currentUser } = req;
  const { starting_after, ending_before } = req.body;
  let skip = req.body.skip || 0;
  const size = req.body.size || 50;

  const shared_contacts = await Contact.find({
    shared_members: currentUser.id,
  });

  // const count = await Activity.countDocuments({
  //   $or: [{ user: currentUser.id }, { contacts: { $in: shared_contacts } }],
  // });

  let activity_list;
  const data = [];

  const latest_activity = await Activity.find({
    $or: [{ user: currentUser.id }, { contacts: { $in: shared_contacts } }],
    send_type: { $ne: 2 },
  })
    .sort({ _id: -1 })
    .limit(1);

  while (data.length < 50) {
    if (!starting_after && !ending_before) {
      activity_list = await Activity.find({
        $or: [{ user: currentUser.id }, { contacts: { $in: shared_contacts } }],
      })
        .sort({ _id: -1 })
        .populate('contacts')
        .skip(skip)
        .limit(size * 5);
    } else if (starting_after) {
      activity_list = await Activity.find({
        _id: { $lt: starting_after },
        $or: [{ user: currentUser.id }, { contacts: { $in: shared_contacts } }],
      })
        .sort({ _id: -1 })
        .populate('contacts')
        .skip(skip)
        .limit(size * 5);
    } else if (ending_before) {
      activity_list = await Activity.find({
        _id: { $gt: ending_before },
        $or: [{ user: currentUser.id }, { contacts: { $in: shared_contacts } }],
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
const update = async (req, res) => {
  const { currentUser } = req;
  const { track, contacts } = req.body;
  Activity.updateOne(
    {
      _id: track._id,
      user: currentUser._id,
    },
    {
      $set: { contacts: mongoose.Types.ObjectId(contacts[0]) },
    }
  ).catch((err) => {
    console.log('err', err);
  });
  const video_trackers = await VideoTracker.find({
    activity: mongoose.Types.ObjectId(track._id),
  });
  const pdf_trackers = await PDFTracker.find({
    activity: mongoose.Types.ObjectId(track._id),
  });
  const image_trackers = await ImageTracker.find({
    activity: mongoose.Types.ObjectId(track._id),
  });
  let data;
  if (video_trackers.length) {
    const video_tracker_ids = video_trackers.map((e) => e._id);
    await VideoTracker.updateMany(
      { _id: { $in: video_tracker_ids } },
      { $set: { contact: [mongoose.Types.ObjectId(contacts[0])] } }
    ).catch((err) => {
      console.log('err', err);
    });
    await Activity.updateMany(
      {
        user: currentUser._id,
        content: 'watched video',
        video_trackers: { $in: video_tracker_ids },
      },
      { $set: { contacts: mongoose.Types.ObjectId(contacts[0]) } }
    ).catch((err) => {
      console.log('err', err);
    });
    data = await Activity.findOne({ _id: track._id })
      .populate('contacts')
      .populate('video_trackers');
  }
  if (pdf_trackers.length) {
    const pdf_tracker_ids = pdf_trackers.map((e) => e._id);
    await PDFTracker.updateMany(
      { _id: { $in: pdf_tracker_ids } },
      { $set: { contact: [mongoose.Types.ObjectId(contacts[0])] } }
    ).catch((err) => {
      console.log('err', err);
    });
    await Activity.updateMany(
      {
        user: currentUser._id,
        content: 'reviewed pdf',
        pdf_trackers: { $in: pdf_tracker_ids },
      },
      { $set: { contacts: mongoose.Types.ObjectId(contacts[0]) } }
    ).catch((err) => {
      console.log('err', err);
    });
    data = await Activity.findOne({ _id: track._id })
      .populate('contacts')
      .populate('pdf_trackers');
  }
  if (image_trackers.length) {
    const image_tracker_ids = image_trackers.map((e) => e._id);
    await ImageTracker.updateMany(
      { _id: { $in: image_tracker_ids } },
      { $set: { contact: [mongoose.Types.ObjectId(contacts[0])] } }
    ).catch((err) => {
      console.log('err', err);
    });
    await Activity.updateMany(
      {
        user: currentUser._id,
        content: 'reviewed image',
        image_trackers: { $in: image_tracker_ids },
      },
      { $set: { contacts: mongoose.Types.ObjectId(contacts[0]) } }
    ).catch((err) => {
      console.log('err', err);
    });
    data = await Activity.findOne({ _id: track._id })
      .populate('contacts')
      .populate('image_trackers');
  } else {
    data = await Activity.findOne({ _id: track._id }).populate('contacts');
  }

  return res.send({
    status: true,
    data,
  });
};
module.exports = {
  get,
  create,
  load,
  removeBulk,
  removeAll,
  contactActivity,
  update,
};
