const { validationResult } = require('express-validator/check');
const moment = require('moment-timezone');
const FollowUp = require('../../models/follow_up');
const Contact = require('../../models/contact');
const Activity = require('../../models/activity');

const get = async (req, res) => {
  const { currentUser } = req;
  const _follow_up = await FollowUp.find({
    user: currentUser.id,
    status: 0,
  }).sort({ due_date: -1 });
  const data = [];

  for (let i = 0; i < _follow_up.length; i++) {
    const _contact = await Contact.findOne({ _id: _follow_up[i].contact });
    const myJSON = JSON.stringify(_follow_up[i]);
    const follow_up = JSON.parse(myJSON);
    delete follow_up.contact;
    follow_up.contact = _contact;
    data.push(follow_up);
  }

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'FollowUp doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const followUp = new FollowUp({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  followUp
    .save()
    .then((_followup) => {
      const activity = new Activity({
        content: `${currentUser.user_name} added task`,
        contacts: _followup.contact,
        user: currentUser.id,
        type: 'follow_ups',
        follow_ups: _followup.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity
        .save()
        .then((_activity) => {
          const myJSON = JSON.stringify(_followup);
          const data = JSON.parse(myJSON);
          data.activity = _activity;
          res.send({
            status: true,
            data,
          });
        })
        .catch((e) => {
          return res.status(500).send({
            status: false,
            error: e,
          });
        });
    })
    .catch((e) => {
      return res.status(500).send({
        status: false,
        error: e,
      });
    });
};

const getByDate = async (req, res) => {
  const { currentUser } = req;

  // TODO: query condition should be defined in route
  // TODO: limit access to users
  const allowed_queries = [
    'overdue',
    'today',
    'tomorrow',
    'next_week',
    'next_month',
    'future',
  ];
  const query = { ...req.query };
  const cquery = { ...query };
  const { due_date } = query;
  const { time_zone } = currentUser;

  // Check valid queries
  if (!allowed_queries.includes(due_date)) {
    // Other queries
    console.error('Query not allowed:', cquery);
    return res.status(400).send({
      status: false,
      error: {
        msg: 'Query not allowed',
        data: cquery,
      },
    });
  }

  switch (due_date) {
    case 'overdue': {
      const current_time = moment().tz(time_zone);
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $lt: current_time },
      });

      const data = [];

      for (let i = 0; i < _follow_up.length; i++) {
        const _contact = await Contact.findOne({ _id: _follow_up[i].contact });
        console.log('contact', _contact);
        const myJSON = JSON.stringify(_follow_up[i]);
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact;
        follow_up.contact = _contact;
        data.push(follow_up);
      }

      if (!data) {
        return res.status(400).json({
          status: false,
          error: 'OverDue doesn`t exist',
        });
      }

      res.send({
        status: true,
        data,
      });
      break;
    }
    case 'today': {
      console.log('moment', moment().tz(8));
      const start = moment().tz((time_zone).startOf('day'); // set to 12:00 am today
      const end = moment().tz((time_zone).endOf('day'); // set to 23:59 pm today
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $gte: start, $lt: end },
      });

      const data = [];

      for (let i = 0; i < _follow_up.length; i++) {
        const _contact = await Contact.findOne({ _id: _follow_up[i].contact });
        const myJSON = JSON.stringify(_follow_up[i]);
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact;
        follow_up.contact = _contact;
        data.push(follow_up);
      }

      if (!data) {
        return res.status(400).json({
          status: false,
          error: 'FollowUp doesn`t exist on Today',
        });
      }

      res.send({
        status: true,
        data,
      });
      break;
    }
    case 'tomorrow': {
      const today_start = moment().tz((time_zone).startOf('day'); // set to 12:00 am today
      const today_end = moment().endOf('day'); // set to 23:59 pm today
      const tomorrow_start = today_start.add(1, 'days');
      const tomorrow_end = today_end.add(1, 'days');
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $gte: tomorrow_start, $lt: tomorrow_end },
      });

      const data = [];

      for (let i = 0; i < _follow_up.length; i++) {
        const _contact = await Contact.findOne({ _id: _follow_up[i].contact });
        console.log('contact', _contact);
        const myJSON = JSON.stringify(_follow_up[i]);
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact;
        follow_up.contact = _contact;
        data.push(follow_up);
      }

      if (!data) {
        return res.status(400).json({
          status: false,
          error: 'FollowUp doesn`t exist on Tomorrow',
        });
      }

      res.send({
        status: true,
        data,
      });
      break;
    }
    case 'next_week': {
      const next_week_start = moment()
        .utcOffset(time_zone)
        .add(2, 'days')
        .startOf('day');
      const next_week_end = moment()
        .utcOffset(time_zone)
        .add(7, 'days')
        .endOf('day');
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $gte: next_week_start, $lt: next_week_end },
      });

      const data = [];

      for (let i = 0; i < _follow_up.length; i++) {
        const _contact = await Contact.findOne({ _id: _follow_up[i].contact });
        console.log('contact', _contact);
        const myJSON = JSON.stringify(_follow_up[i]);
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact;
        follow_up.contact = _contact;
        data.push(follow_up);
      }

      if (!data) {
        return res.status(400).json({
          status: false,
          error: 'FollowUp doesn`t exist on Tomorrow',
        });
      }

      res.send({
        status: true,
        data,
      });
      break;
    }
    case 'next_month': {
      const start_month = moment()
        .utcOffset(time_zone)
        .startOf('month')
        .add(1, 'months');
      const end_month = moment()
        .utcOffset(time_zone)
        .add(1, 'months')
        .endOf('month');
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $gte: start_month, $lt: end_month },
      });

      const data = [];

      for (let i = 0; i < _follow_up.length; i++) {
        const _contact = await Contact.findOne({ _id: _follow_up[i].contact });
        console.log('contact', _contact);
        const myJSON = JSON.stringify(_follow_up[i]);
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact;
        follow_up.contact = _contact;
        data.push(follow_up);
      }

      if (!data) {
        return res.status(400).json({
          status: false,
          error: 'FollowUp doesn`t exist on Tomorrow',
        });
      }

      res.send({
        status: true,
        data,
      });
      break;
    }
    case 'future': {
      const current_time = moment().tz(time_zone);
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $gte: current_time },
      });

      const data = [];

      for (let i = 0; i < _follow_up.length; i++) {
        const _contact = await Contact.findOne({ _id: _follow_up[i].contact });
        console.log('contact', _contact);
        const myJSON = JSON.stringify(_follow_up[i]);
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact;
        follow_up.contact = _contact;
        data.push(follow_up);
      }

      if (!data) {
        return res.status(400).json({
          status: false,
          error: 'OverDue doesn`t exist',
        });
      }

      res.send({
        status: true,
        data,
      });
      break;
    }
    default:
  }
};
const updateChecked = async (req, res) => {
  const { currentUser } = req;
  const _follow_up = await FollowUp.findOne({ _id: req.params.id });

  if (!_follow_up) {
    return res.status(400).json({
      status: false,
      error: 'FollowUp doesn`t exist',
    });
  }

  _follow_up.status = 1;
  _follow_up.save();

  const activity = new Activity({
    content: _follow_up.content,
    contacts: _follow_up.contact,
    user: currentUser.id,
    type: 'follow_ups',
    follow_ups: _follow_up._id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  const _contact = await Contact.findOne({ _id: activity.contacts });

  activity
    .save()
    .then((_activity) => {
      const myJSON = JSON.stringify(_activity);
      const data = JSON.parse(myJSON);
      data.contact = _contact;
      res.send({
        status: true,
        data,
      });
    })
    .catch((e) => {
      return res.status(500).send({
        status: false,
        error: e,
      });
    });
};

module.exports = {
  get,
  create,
  getByDate,
  updateChecked,
};
