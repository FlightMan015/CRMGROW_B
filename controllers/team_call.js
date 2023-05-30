const mongoose = require('mongoose');
const urls = require('../constants/urls');
const mail_contents = require('../constants/mail_contents');
const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const api = require('../config/api');
const Activity = require('../models/activity');
const Team = require('../models/team');
const User = require('../models/user');
const Contact = require('../models/contact');
const Notification = require('../models/notification');
const TeamCall = require('../models/team_call');
const TimeLine = require('../models/time_line');
const { uploadBase64Image, removeFile } = require('../helpers/fileUpload');
const { getAvatarName } = require('../helpers/utility');

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const requestCall = async (req, res) => {
  const { currentUser } = req;
  let leader;
  let contacts;

  if (req.body.leader) {
    leader = await User.findOne({ _id: req.body.leader }).catch((err) => {
      console.log('leader find err', err.message);
    });
  }

  if (req.body.contacts && req.body.contacts.length > 0) {
    contacts = await Contact.find({ _id: { $in: req.body.contacts } }).catch(
      (err) => {
        console.log('contact find err', err.message);
      }
    );
  }

  const team_call = new TeamCall({
    user: currentUser.id,
    ...req.body,
  });

  team_call
    .save()
    .then((data) => {
      if (leader) {
        let guests = '';
        if (contacts) {
          for (let i = 0; i < contacts.length; i++) {
            if (contacts[i]) {
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
        data,
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

const acceptCall = async (req, res) => {
  const { currentUser } = req;
  const { call_id } = req.body;

  const team_call = await TeamCall.findOne({ _id: call_id })
    .populate('user')
    .catch((err) => {
      console.log('call find error', err.message);
    });

  if (team_call) {
    const user = team_call.user;
    TeamCall.updateOne(
      {
        _id: call_id,
      },
      {
        $set: {
          ...req.body,
          status: 'planned',
        },
      }
    )
      .then(() => {
        const contacts = team_call.contacts;
        for (let i = 0; i < team_call.length; i++) {
          const new_activity = new Activity({
            team_calls: team_call.id,
            user: currentUser.id,
            contacts: contacts[i],
            content: 'accepted a group call',
            type: 'team_calls',
          });

          new_activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });

          Contact.updateOne(
            {
              _id: contacts[i],
            },
            {
              $set: { last_activity: new_activity.id },
            }
          ).catch((err) => {
            console.log('contact update err', err.message);
          });
        }

        const templatedData = {
          leader_name: currentUser.user_name,
          created_at: moment().format('h:mm MMMM Do, YYYY'),
          user_name: user.user_name,
          due_start: moment(team_call.due_start).format('h:mm MMMM Do, YYYY'),
          organizer: user.user_name,
          subject: team_call.subject,
          description: team_call.description,
        };

        const params = {
          Destination: {
            ToAddresses: [user.email],
          },
          Source: mail_contents.NO_REPLAY,
          Template: 'TeamCallInvitation',
          TemplateData: JSON.stringify(templatedData),
          ReplyToAddresses: [currentUser.email],
        };

        // Create the promise and SES service object

        ses.sendTemplatedEmail(params).promise();

        /** **********
         *  Creat dashboard notification to the inviated users
         *  */

        const notification = new Notification({
          user: user.id,
          team_call: call_id,
          criteria: 'team_call',
          content: `${currentUser.user_name} has accepted to join a call.`,
        });

        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });

        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('team update err', err.message);
      });
  }
};

const rejectCall = async (req, res) => {
  const { currentUser } = req;
  const { call_id } = req.body;

  const team_call = await TeamCall.findOne({ _id: call_id })
    .populate('user')
    .catch((err) => {
      console.log('call find error', err.message);
    });

  if (team_call) {
    const user = team_call.user;
    TeamCall.updateOne(
      {
        _id: call_id,
      },
      {
        status: 'canceled',
      }
    )
      .then(() => {
        /** **********
         *  Send email notification to the inviated users
         *  */
        const templatedData = {
          leader_name: currentUser.user_name,
          created_at: moment().format('h:mm MMMM Do YYYY'),
          team_call: team_call.subject,
          user_name: user.user_name,
          call_url: urls.TEAM_CALLS + team_call.id,
        };

        const params = {
          Destination: {
            ToAddresses: [user.email],
          },
          Source: mail_contents.NO_REPLAY,
          Template: 'TeamCallInquiryFailed',
          TemplateData: JSON.stringify(templatedData),
          ReplyToAddresses: [currentUser.email],
        };

        // Create the promise and SES service object

        ses.sendTemplatedEmail(params).promise();

        /** **********
         *  Creat dashboard notification to the inviated users
         *  */

        const notification = new Notification({
          user: user.id,
          team_call: call_id,
          criteria: 'team_call',
          content: `${currentUser.user_name} has rejected to join a call.`,
        });

        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });

        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('team update err', err.message);
      });
  }
};

const updateCall = async (req, res) => {
  const { currentUser } = req;
  const team_call = await TeamCall.findOne({
    $or: [{ user: currentUser.id }, { leader: currentUser.id }],
    _id: req.params.id,
  });

  if (!team_call) {
    return res.status(400).json({
      status: false,
      error: 'Team call found err',
    });
  }
  TeamCall.updateOne(
    {
      _id: req.params.id,
    },
    {
      ...req.body,
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('team call update err', err.message);
      return res.send(500).json({
        status: false,
        error: err,
      });
    });
};

const removeCall = async (req, res) => {
  const { currentUser } = req;
  TeamCall.deleteOne({
    _id: req.params.id,
    $or: [{ user: currentUser.id }, { leader: currentUser.id }],
  })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('team call delte err', err.message);
      return res.send(500).json({
        status: false,
        error: err,
      });
    });
};

const getInquireCall = async (req, res) => {
  const { currentUser } = req;
  let id = 0;

  if (req.params.id) {
    id = parseInt(req.params.id);
  }

  const total = await TeamCall.countDocuments({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['pending'] },
  });

  const data = await TeamCall.find({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['pending'] },
  })
    .populate([
      {
        path: 'leader',
        select: { user_name: 1, picture_profile: 1, email: 1 },
      },
      { path: 'user', select: { user_name: 1, picture_profile: 1 } },
      // { path: 'guests', select: { user_name: 1, picture_profile: 1 } },
      { path: 'contacts' },
    ])
    .skip(id)
    .limit(8);

  return res.send({
    status: true,
    data,
    total,
  });
};

const getDetailInquireCall = async (req, res) => {
  const data = await TeamCall.findOne({
    _id: req.params.id,
  }).populate([
    { path: 'leader', select: { user_name: 1, picture_profile: 1 } },
    { path: 'user', select: { user_name: 1, picture_profile: 1 } },
    // { path: 'guests', select: { user_name: 1, picture_profile: 1 } },
    { path: 'contacts' },
  ]);

  return res.send({
    status: true,
    data,
  });
};

const getPlannedCall = async (req, res) => {
  const { currentUser } = req;
  let id = 0;
  if (req.params.id) {
    id = parseInt(req.params.id);
  }
  const data = await TeamCall.find({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['planned'] },
  })
    .populate([
      { path: 'leader', select: { user_name: 1, picture_profile: 1 } },
      { path: 'user', select: { user_name: 1, picture_profile: 1 } },
      // { path: 'guests', select: { user_name: 1, picture_profile: 1 } },
      { path: 'contacts' },
    ])
    .skip(id)
    .limit(8);

  const total = await TeamCall.countDocuments({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['planned'] },
  });

  return res.send({
    status: true,
    data,
    total,
  });
};

const getFinishedCall = async (req, res) => {
  const { currentUser } = req;
  let id = 0;
  if (req.params.id) {
    id = parseInt(req.params.id);
  }
  const data = await TeamCall.find({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['finished', 'canceled'] },
  })
    .populate([
      { path: 'leader', select: { user_name: 1, picture_profile: 1 } },
      { path: 'user', select: { user_name: 1, picture_profile: 1 } },
      // { path: 'guests', select: { user_name: 1, picture_profile: 1 } },
      { path: 'contacts' },
    ])
    .skip(id)
    .limit(8);

  const total = await TeamCall.countDocuments({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['finished', 'canceled'] },
  });

  return res.send({
    status: true,
    data,
    total,
  });
};

const loadCalls = async (req, res) => {
  const { currentUser } = req;
  const { type, skip, count } = req.body;
  let query;
  switch (type) {
    case 'inquiry':
      query = {
        leader: currentUser.id,
        status: 'pending',
      };
      break;
    case 'sent':
      query = {
        user: currentUser.id,
        status: 'pending',
      };
      break;
    case 'scheduled':
      query = {
        $or: [{ user: currentUser.id }, { leader: currentUser.id }],
        status: { $in: ['planned'] },
      };
      break;
    case 'completed':
      query = {
        $or: [{ user: currentUser.id }, { leader: currentUser.id }],
        status: { $in: ['finished'] },
      };
      break;
    case 'canceled':
      query = {
        $or: [{ user: currentUser.id }, { leader: currentUser.id }],
        status: { $in: ['canceled'] },
      };
      break;
    case 'denied':
      query = {
        $or: [{ user: currentUser.id }, { leader: currentUser.id }],
        status: { $in: ['declined'] },
      };
      break;
  }
  const data = await TeamCall.find(query)
    .populate([
      {
        path: 'leader',
        select: {
          user_name: 1,
          picture_profile: 1,
          email: 1,
          phone: 1,
          company: 1,
          location: 1,
          time_zone_info: 1,
        },
      },
      {
        path: 'user',
        select: {
          user_name: 1,
          picture_profile: 1,
          email: 1,
          phone: 1,
          company: 1,
          location: 1,
          time_zone_info: 1,
        },
      },
      { path: 'contacts' },
    ])
    .skip(skip)
    .limit(count || 10);

  const total = await TeamCall.countDocuments(query);

  return res.send({
    status: true,
    data,
    total,
  });
};

module.exports = {
  requestCall,
  acceptCall,
  rejectCall,
  updateCall,
  removeCall,
  getInquireCall,
  getPlannedCall,
  getFinishedCall,
  getDetailInquireCall,
  loadCalls,
};
