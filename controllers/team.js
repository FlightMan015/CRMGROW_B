const sgMail = require('@sendgrid/mail');
const mongoose = require('mongoose');
const urls = require('../constants/urls');
const mail_contents = require('../constants/mail_contents');
const short = require('short-uuid');
const moment = require('moment-timezone');
const api = require('../config/api');
const Activity = require('../models/activity');
const Team = require('../models/team');
const User = require('../models/user');
const Image = require('../models/image');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Folder = require('../models/folder');
const Automation = require('../models/automation');
const EmailTemplate = require('../models/email_template');
const VideoTracker = require('../models/video_tracker');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
const Contact = require('../models/contact');
const Notification = require('../models/notification');
const TeamCall = require('../models/team_call');
const TimeLine = require('../models/time_line');
const { uploadBase64Image, removeFile } = require('../helpers/fileUpload');
const { getAvatarName } = require('../helpers/utility');
const { sendNotificationEmail } = require('../helpers/email');
const system_settings = require('../config/system_settings');
const { createCronNotification } = require('../helpers/notificationImpl');
const { getMaterials } = require('../helpers/automation');

const getAll = (req, res) => {
  const { currentUser } = req;

  Team.find({
    $or: [
      {
        members: currentUser.id,
      },
      { owner: currentUser.id },
    ],
  })
    .populate([
      {
        path: 'owner',
        select: {
          _id: 1,
          user_name: 1,
          picture_profile: 1,
          email: 1,
          phone: 1,
        },
      },
      {
        path: 'members',
        select: {
          _id: 1,
          user_name: 1,
          picture_profile: 1,
          email: 1,
          phone: 1,
        },
      },
      {
        path: 'editors',
        select: {
          _id: 1,
          user_name: 1,
          picture_profile: 1,
          email: 1,
          phone: 1,
        },
      },
    ])
    .then((data) => {
      return res.send({
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

const getInvitedTeam = (req, res) => {
  const { currentUser } = req;

  Team.find({ invites: currentUser.id })
    .populate('owner')
    .then((data) => {
      return res.send({
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

const getRequestedTeam = (req, res) => {
  const { currentUser } = req;
  Team.find({ requests: currentUser.id })
    .then((data) => {
      return res.send({
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

const getTeam = (req, res) => {
  const { currentUser } = req;
  Team.find({
    $or: [
      {
        members: req.params.id,
      },
      { owner: req.params.id },
    ],
  })
    .populate({ path: 'owner' })
    .then((data) => {
      return res.send({
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

const get = (req, res) => {
  const { currentUser } = req;

  Team.findOne({
    $or: [
      {
        _id: req.params.id,
        members: currentUser.id,
      },
      {
        _id: req.params.id,
        owner: currentUser.id,
      },
      {
        _id: req.params.id,
        invites: currentUser.id,
      },
    ],
  })
    .populate([
      {
        path: 'owner',
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
        path: 'members',
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
        path: 'invites',
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
        path: 'requests',
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
    ])
    .then(async (data) => {
      if (data && !data.join_link) {
        const join_link = short.generate();
        Team.updateOne(
          { _id: req.params.id },
          {
            $set: { join_link },
          }
        ).catch((err) => {
          console.log('team join link update err', err.message);
        });

        return res.send({
          status: true,
          data: { ...data._doc, join_link },
        });
      } else {
        return res.send({
          status: true,
          data,
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

const get1 = async (req, res) => {
  const { currentUser } = req;
  const team_id = req.params.id;
  Team.findById(team_id)
    .then(async (_team) => {
      if (
        _team.owner.indexOf(currentUser.id) !== -1 ||
        _team.members.indexOf(currentUser.id) !== -1
      ) {
        const owner = await User.findById(_team.owner);
        const members = await User.find({ _id: { $in: _team.members } });
        const videos = await Video.find({ _id: { $in: _team.videos } });
        const pdfs = await PDF.find({ _id: { $in: _team.pdfs } });
        const images = await Image.find({ _id: { $in: _team.images } });
        const automations = await Automation.find({
          _id: { $in: _team.automations },
        });
        const contacts = await Contact.find({ _id: { $in: _team.contacts } });
        const templates = await EmailTemplate.find({
          _id: { $in: _team.email_templates },
        });
        return res.send({
          status: true,
          data: {
            ..._team._doc,
            owner,
            members,
            videos,
            pdfs,
            images,
            automations,
            contacts,
            templates,
          },
        });
      } else {
        return res.status(400).send({
          status: false,
          error: 'Invalid Permission',
        });
      }
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const numberOfOldTeam = await Team.countDocuments({
    owner: currentUser.id,
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message,
    });
  });

  if (numberOfOldTeam >= currentUser.team_info.max_count) {
    return res.status(400).send({
      status: false,
      error: 'You can create only ' + currentUser.team_info.max_count + 'teams',
    });
  }

  const teamReq = req.body;
  let picture = '';
  if (teamReq.picture) {
    picture = await uploadBase64Image(teamReq.picture);
  }

  const join_link = short.generate();
  const team = new Team({
    ...teamReq,
    picture,
    owner: currentUser.id,
    join_link,
  });

  team
    .save()
    .then((_team) => {
      return res.send({
        status: true,
        data: _team,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const update = async (req, res) => {
  const { currentUser } = req;

  const team = await Team.findOne({
    _id: req.params.id,
    owner: currentUser.id,
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (!team) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  let picture;
  if (req.body.picture) {
    picture = await uploadBase64Image(req.body.picture);
  } else {
    picture = team.picture;
  }

  Team.findOneAndUpdate(
    {
      _id: req.params.id,
      owner: currentUser.id,
    },
    {
      $set: {
        ...req.body,
        picture,
      },
    },
    { new: true }
  )
    .then((data) => {
      return res.send({
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

const cancelRequest = async (req, res) => {
  const { currentUser } = req;
  await Team.updateOne(
    { _id: req.params.id },
    {
      $pull: { requests: { $in: [currentUser.id] } },
    }
  ).catch((err) => {
    console.log(err.message);
  });

  return res.send({
    status: true,
  });
};

const bulkInvites = async (req, res) => {
  const { currentUser } = req;
  const { emails } = req.body;

  const team = await Team.findOne({
    _id: req.params.id,
    $or: [
      {
        members: currentUser.id,
      },
      {
        owner: currentUser.id,
      },
    ],
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (!team) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  const inviteIds = team.invites;
  const newInvites = [];
  const invites = [];
  const referrals = [];

  for (const email of emails) {
    const user = await User.findOne({
      email,
      del: false,
    }).select({
      _id: 1,
      user_name: 1,
      time_zone_info: 1,
      picture_profile: 1,
      phone: 1,
      location: 1,
      email: 1,
      company: 1,
    });
    if (user) {
      if (
        team.members.indexOf(user._id) < 0 &&
        team.owner.indexOf(user._id) < 0
      ) {
        invites.push(user);
      }
    } else {
      referrals.push(email);
    }
  }

  invites.forEach((e) => {
    if (inviteIds.indexOf(e._id) === -1) {
      inviteIds.push(e._id);
      newInvites.push(e);
    }
  });

  const referralEmails = team.referrals;
  const newReferrals = [];
  referrals.forEach((e) => {
    if (referralEmails.indexOf(e) === -1) {
      referralEmails.push(e);
      newReferrals.push(e);
    }
  });

  Team.updateOne(
    {
      _id: req.params.id,
    },
    {
      $set: {
        invites: inviteIds,
        referrals: referralEmails,
      },
    }
  )
    .then(async () => {
      const invitedUsers = await User.find({
        _id: { $in: newInvites },
        del: false,
      });

      /** **********
       *  Send email notification to the inviated users
       *  */
      for (let i = 0; i < invitedUsers.length; i++) {
        const invite = invitedUsers[i];
        const user_name = invite.user_name
          ? invite.user_name.split(' ')[0]
          : '';
        const time_zone = invite.time_zone_info
          ? JSON.parse(invite.time_zone_info).tz_name
          : system_settings.TIME_ZONE;

        const data = {
          template_data: {
            user_name,
            created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
            team_name: team.name,
            site_url: urls.LOGIN_URL,
            team_url: urls.TEAM_LIST_URL,
          },
          template_name: 'TeamInvitation',
          required_reply: false,
          email: invite.email,
        };

        sendNotificationEmail(data)
          .then(() => {
            console.log('invite team email has been sent out successfully');
          })
          .catch((err) => {
            console.log('invite team email send err', err);
          });
      }

      /** **********
       *  Send email notification to the referral users
       *  */

      const site_url = currentUser.affiliate
        ? currentUser.affiliate.link
        : urls.DOMAIN_URL;

      const time_zone = currentUser.time_zone_info
        ? JSON.parse(currentUser.time_zone_info).tz_name
        : system_settings.TIME_ZONE;
      for (let i = 0; i < referrals.length; i++) {
        const referral = referrals[i];
        const data = {
          template_data: {
            user_name: '',
            created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
            team_name: team.name,
            site_url,
            team_url: site_url,
          },
          template_name: 'TeamInvitation',
          required_reply: false,
          email: referral,
        };

        sendNotificationEmail(data)
          .then(() => {
            console.log('invite team email has been sent out successfully');
          })
          .catch((err) => {
            console.log('invite team email send err', err);
          });
      }

      /** **********
       *  Creat dashboard notification to the invited users
       *  */
      for (let i = 0; i < invitedUsers.length; i++) {
        const invite = invitedUsers[i];
        const team_url = `<a href="${urls.TEAM_URL}">${team.name}</a>`;
        const notification = new Notification({
          creator: currentUser._id,
          user: invite,
          team: team.id,
          criteria: 'team_invited',
          content: `${currentUser.user_name} has invited you to join team ${team_url} in CRMGrow`,
        });
        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });
        createCronNotification(
          'team_invited',
          {
            process: notification,
          },
          { _id: invite._id }
        );
      }
      res.send({
        status: true,
        data: {
          invites: newInvites,
          referrals: newReferrals,
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

const cancelInvite = async (req, res) => {
  const { currentUser } = req;
  const { emails } = req.body;
  const team = await Team.findOne({
    _id: req.params.id,
    $or: [
      {
        members: currentUser.id,
      },
      {
        owner: currentUser.id,
      },
    ],
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (!team) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  for (const email of emails) {
    const user = await User.findOne({
      email,
    });
    if (user) {
      if (
        team.members.indexOf(user._id) < 0 &&
        team.owner.indexOf(user._id) < 0
      ) {
        const index = team.invites.findIndex((item) => item === user._id);
        team.invites.splice(index, 1);
      }
    } else {
      const index = team.referrals.findIndex((item) => item === email);
      team.referrals.splice(index, 1);
    }
  }

  team.save();

  return res.send({
    status: true,
  });
};

const acceptInviation = async (req, res) => {
  const { currentUser } = req;
  const team = await Team.findOne({
    _id: req.params.id,
    invites: currentUser.id,
  })
    .populate('owner')
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Team found err',
      });
    });

  if (!team) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  const members = team.members;
  const invites = team.invites;
  if (members.indexOf(currentUser.id) === -1) {
    members.push(currentUser.id);
  }
  if (invites.indexOf(currentUser.id) !== -1) {
    const pos = invites.indexOf(currentUser.id);
    invites.splice(pos, 1);
  }

  Team.updateOne(
    {
      _id: req.params.id,
    },
    {
      $set: {
        members,
        invites,
      },
    }
  )
    .then(async () => {
      /** **********
       *  Send email accept notification to the inviated users
       *  */
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const owners = team.owner;
      for (let i = 0; i < owners.length; i++) {
        const owner = owners[i];
        const msg = {
          to: owner.email,
          from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
          templateId: api.SENDGRID.TEAM_ACCEPT_NOTIFICATION,
          dynamic_template_data: {
            subject: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name}`,
            activity: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name} has accepted your invitation to join ${team.name} in CRMGrow`,
            team:
              "<a href='" +
              urls.TEAM_URL +
              team.id +
              "'><img src='" +
              urls.DOMAIN_URL +
              "assets/images/team.png'/></a>",
          },
        };

        sgMail
          .send(msg)
          .then()
          .catch((err) => {
            console.log('send message err: ', err);
          });
      }

      /** **********
       *  Mark read true dashboard notification for accepted users
       *  */

      const inviteNotification = await Notification.findOne({
        team: team.id,
        user: currentUser.id,
        criteria: 'team_invited',
      }).catch((err) => {
        console.log('invite notification getting err', err);
      });
      if (inviteNotification) {
        inviteNotification['is_read'] = true;
        inviteNotification.save().catch((err) => {
          console.log('mark as read failed', err);
        });

        const acceptNotification = new Notification({
          team: team.id,
          creator: currentUser._id,
          user: inviteNotification['creator'],
          criteria: 'team_accept',
        });
        acceptNotification.save().catch((err) => {
          console.log('accept notification is failed.', err);
        });
      } else {
        for (let i = 0; i < owners.length; i++) {
          const acceptNotification = new Notification({
            team: team.id,
            creator: currentUser._id,
            user: owners[i]._id,
            criteria: 'team_accept',
          });
          acceptNotification.save().catch((err) => {
            console.log('accept notification is failed.', err);
          });
        }
      }

      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const declineInviation = async (req, res) => {
  const { currentUser } = req;
  const team = await Team.findOne({
    _id: req.params.id,
    invites: currentUser.id,
  })
    .populate('owner')
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Team found err',
      });
    });

  if (!team) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  const invites = team.invites;

  if (invites.indexOf(currentUser.id) !== -1) {
    const pos = invites.indexOf(currentUser.id);
    invites.splice(pos, 1);
  }

  Team.updateOne(
    {
      _id: req.params.id,
    },
    {
      $set: {
        invites,
      },
    }
  )
    .then(async () => {
      /** **********
       *  Send email accept notification to the inviated users
       *  */
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const owners = team.owner;
      for (let i = 0; i < owners.length; i++) {
        const owner = owners[i];
        const msg = {
          to: owner.email,
          from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
          templateId: api.SENDGRID.TEAM_ACCEPT_NOTIFICATION,
          dynamic_template_data: {
            subject: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name}`,
            activity: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name} has accepted your invitation to join ${team.name} in CRMGrow`,
            team:
              "<a href='" +
              urls.TEAM_URL +
              team.id +
              "'><img src='" +
              urls.DOMAIN_URL +
              "assets/images/team.png'/></a>",
          },
        };

        sgMail
          .send(msg)
          .then()
          .catch((err) => {
            console.log('send message err: ', err);
          });
      }

      /** **********
       *  Mark read true dashboard notification for accepted users
       *  */
      const inviteNotification = await Notification.findOne({
        team: team.id,
        user: currentUser.id,
        criteria: 'team_invited',
      }).catch((err) => {
        console.log('invite notification getting err', err);
      });
      if (inviteNotification) {
        inviteNotification['is_read'] = true;
        inviteNotification.save().catch((err) => {
          console.log('mark as read failed', err);
        });

        const rejectNotification = new Notification({
          team: team.id,
          creator: currentUser._id,
          user: inviteNotification['creator'],
          criteria: 'team_reject',
        });
        rejectNotification.save().catch((err) => {
          console.log('accept notification is failed.', err);
        });
      } else {
        for (let i = 0; i < owners.length; i++) {
          const rejectNotification = new Notification({
            team: team.id,
            creator: currentUser._id,
            user: owners[i]._id,
            criteria: 'team_reject',
          });
          rejectNotification.save().catch((err) => {
            console.log('accept notification is failed.', err);
          });
        }
      }

      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const acceptRequest = async (req, res) => {
  const { currentUser } = req;
  const { team_id, request_id } = req.body;

  const team = await Team.findOne({
    _id: team_id,
    $or: [{ owner: currentUser.id }, { editors: currentUser.id }],
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (!team) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }
  const request = await User.findOne({ _id: request_id, del: false });

  if (!request) {
    return res.status(400).send({
      status: false,
      error: 'No exist user',
    });
  }

  const members = team.members;
  const requests = team.requests;
  if (members.indexOf(request_id) === -1) {
    members.push(request_id);
  }
  if (requests.indexOf(request_id) !== -1) {
    const pos = requests.indexOf(request_id);
    requests.splice(pos, 1);
  }

  Team.updateOne(
    {
      _id: team_id,
    },
    {
      $set: {
        members,
        requests,
      },
    }
  )
    .then(async () => {
      const time_zone = currentUser.time_zone_info
        ? JSON.parse(currentUser.time_zone_info).tz_name
        : system_settings.TIME_ZONE;

      const data = {
        template_data: {
          user_name: request.user_name,
          created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
          team_name: team.name,
          team_url: urls.TEAM_URL + team.id,
        },
        template_name: 'TeamRequestAccepted',
        required_reply: false,
        email: request.email,
      };

      sendNotificationEmail(data);

      /** **********
       *  Mark read true dashboard notification for accepted users
       *  */
      const requestNotification = await Notification.findOne({
        team: team.id,
        user: currentUser.id,
        criteria: 'team_requested',
      }).catch((err) => {
        console.log('invite notification getting err', err);
      });
      if (requestNotification) {
        requestNotification['is_read'] = true;
        requestNotification.save().catch((err) => {
          console.log('mark as read failed', err);
        });

        const acceptNotification = new Notification({
          team: team.id,
          creator: currentUser._id,
          user: request.id,
          criteria: 'join_accept',
        });
        acceptNotification.save().catch((err) => {
          console.log('accept notification is failed.', err);
        });
      } else {
        const acceptNotification = new Notification({
          team: team.id,
          creator: currentUser._id,
          user: request.id,
          criteria: 'join_accept',
        });
        acceptNotification.save().catch((err) => {
          console.log('accept notification is failed.', err);
        });
      }

      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const declineRequest = async (req, res) => {
  const { currentUser } = req;
  const { team_id, request_id } = req.body;

  const team = await Team.findOne({
    _id: team_id,
    $or: [{ owner: currentUser.id }, { editors: currentUser.id }],
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (!team) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }
  const request = await User.findOne({ _id: request_id, del: false });

  if (!request) {
    return res.status(400).send({
      status: false,
      error: 'No exist user',
    });
  }

  const requests = team.requests;

  if (requests.indexOf(request_id) !== -1) {
    const pos = requests.indexOf(request_id);
    requests.splice(pos, 1);
  }

  Team.updateOne(
    {
      _id: team_id,
    },
    {
      $set: {
        requests,
      },
    }
  )
    .then(async () => {
      const time_zone = currentUser.time_zone_info
        ? JSON.parse(currentUser.time_zone_info).tz_name
        : system_settings.TIME_ZONE;

      const data = {
        template_data: {
          user_name: request.user_name,
          created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
          team_name: team.name,
        },
        template_name: 'TeamRequestDeclined',
        required_reply: false,
        email: request.email,
      };

      sendNotificationEmail(data);

      /** **********
       *  Mark read true dashboard notification for accepted users
       *  */
      const requestNotification = await Notification.findOne({
        team: team.id,
        user: currentUser.id,
        criteria: 'team_requested',
      }).catch((err) => {
        console.log('invite notification getting err', err);
      });
      if (requestNotification) {
        requestNotification['is_read'] = true;
        requestNotification.save().catch((err) => {
          console.log('mark as read failed', err);
        });

        const rejectNotification = new Notification({
          team: team.id,
          creator: currentUser._id,
          user: request.id,
          criteria: 'join_reject',
        });
        rejectNotification.save().catch((err) => {
          console.log('accept notification is failed.', err);
        });
      } else {
        const rejectNotification = new Notification({
          team: team.id,
          creator: currentUser._id,
          user: request.id,
          criteria: 'join_reject',
        });
        rejectNotification.save().catch((err) => {
          console.log('accept notification is failed.', err);
        });
      }

      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

// const shareVideos = async (req, res) => {
//   const { currentUser } = req;
//   const { video_ids, team_ids } = req.body;

//   const teams = await Team.find({
//     _id: { $in: team_ids },
//     $or: [
//       {
//         owner: currentUser.id,
//       },
//       { editors: currentUser.id },
//     ],
//   }).catch((err) => {
//     return res.status(500).send({
//       status: false,
//       error: err.message || 'Team found err',
//     });
//   });

//   if (teams.length === 0) {
//     return res.status(400).send({
//       status: false,
//       error: 'Invalid Permission',
//     });
//   }

//   await Video.updateMany(
//     {
//       _id: { $in: video_ids },
//       user: currentUser.id,
//     },
//     {
//       $set: { role: 'team' },
//     }
//   );

//   const failedTeams = [];
//   const updatedData = [];
//   for (let i = 0; i < teams.length; i++) {
//     const team = teams[i];
//     const videoIds = team.videos;
//     const newTeamVideos = [];
//     video_ids.forEach((e) => {
//       if (videoIds.indexOf(e) === -1) {
//         videoIds.push(e);
//         newTeamVideos.push(e);
//       }
//     });

//     await Team.updateOne(
//       { _id: team._id },
//       {
//         $addToSet: {
//           videos: { $each: video_ids },
//         },
//       }
//     )
//       .then(async (_data) => {
//         const data = [];
//         const updatedVideos = await Video.find({ _id: { $in: newTeamVideos } });

//         // for (let i = 0; i < updatedVideos.length; i++) {
//         //   const video = updatedVideos[i];
//         //   if (video) {
//         //     const views = await VideoTracker.countDocuments({
//         //       video: video.id,
//         //       user: currentUser.id,
//         //     });

//         //     const video_detail = {
//         //       ...video._doc,
//         //       views,
//         //       material_type: 'video',
//         //     };

//         //     data.push(video_detail);
//         //   }
//         // }

//         if (updatedVideos.length > 0) {
//           updatedData.push(updatedVideos);
//         }

//         /**
//          * Create Notification for the Material Share
//          */
//         let team_owners = [];
//         if (team.owner instanceof Array) {
//           team_owners = team.owner;
//         } else {
//           team_owners = [team.owner];
//         }
//         const notification = new Notification({
//           creator: currentUser._id,
//           owner: [...team.members, ...team_owners],
//           criteria: 'share_material',
//           team: team.id,
//           action: {
//             object: 'video',
//             video: newTeamVideos,
//           },
//         });
//         notification.save().catch((err) => {
//           console.log('video sharing notification is failed', err);
//         });

//         for (let i = 0; i < notification.owner.length; i++) {
//           createCronNotification(
//             'share_material',
//             {
//               process: notification,
//             },
//             { _id: notification.owner[i] }
//           );
//         }
//         // res.send({
//         //   status: true,
//         //   data,
//         // });
//       })
//       .catch((err) => {
//         console.log('err', err.message);
//         // res.status(500).json({
//         //   status: false,
//         //   error: err.message,
//         // });
//         failedTeams.push(team);
//       });
//   }
//   if (failedTeams.length > 0) {
//     res.send({
//       status: false,
//       error: failedTeams,
//     });
//   } else {
//     res.send({
//       status: true,
//       data: updatedData,
//     });
//   }
// };

// const sharePdfs = async (req, res) => {
//   const { currentUser } = req;
//   const { pdf_ids, team_ids } = req.body;

//   const teams = await Team.find({
//     _id: { $in: team_ids },
//     $or: [
//       {
//         owner: currentUser.id,
//       },
//       { editors: currentUser.id },
//     ],
//   }).catch((err) => {
//     return res.status(500).send({
//       status: false,
//       error: err.message || 'Team found err',
//     });
//   });

//   if (teams.length === 0) {
//     return res.status(400).send({
//       status: false,
//       error: 'Invalid Permission',
//     });
//   }

//   await PDF.updateMany(
//     { _id: { $in: pdf_ids } },
//     {
//       $set: { role: 'team' },
//     }
//   );

//   const failedTeams = [];
//   const updatedData = [];
//   for (let i = 0; i < teams.length; i++) {
//     const team = teams[i];
//     const pdfIds = team.pdfs;
//     const newTeamPdfs = [];
//     pdf_ids.forEach((e) => {
//       if (pdfIds.indexOf(e) === -1) {
//         pdfIds.push(e);
//         newTeamPdfs.push(e);
//       }
//     });

//     await Team.updateOne(
//       { _id: team._id },
//       {
//         $addToSet: {
//           pdfs: { $each: pdf_ids },
//         },
//       }
//     )
//       .then(async (_data) => {
//         const data = [];

//         const updatedPdfs = await PDF.find({ _id: { $in: newTeamPdfs } });
//         // for (let i = 0; i < updatedPdfs.length; i++) {
//         //   const pdf = updatedPdfs[i];
//         //   const views = await PDFTracker.countDocuments({
//         //     pdf: pdf.id,
//         //     user: currentUser.id,
//         //   });

//         //   const video_detail = {
//         //     ...pdf._doc,
//         //     views,
//         //     material_type: 'video',
//         //   };

//         //   data.push(video_detail);
//         // }

//         if (updatedPdfs.length > 0) {
//           updatedData.push(updatedPdfs);
//         }

//         /**
//          * Create Notification for the Material Share
//          */
//         let team_owners = [];
//         if (team.owner instanceof Array) {
//           team_owners = team.owner;
//         } else {
//           team_owners = [team.owner];
//         }
//         const notification = new Notification({
//           creator: currentUser._id,
//           owner: [...team.members, ...team_owners],
//           criteria: 'share_material',
//           team: team.id,
//           action: {
//             object: 'pdf',
//             pdf: newTeamPdfs,
//           },
//         });
//         notification.save().catch((err) => {
//           console.log('video sharing notification is failed', err);
//         });
//         for (let i = 0; i < notification.owner.length; i++) {
//           createCronNotification(
//             'share_material',
//             {
//               process: notification,
//             },
//             { _id: notification.owner[i] }
//           );
//         }

//         // return res.send({
//         //   status: true,
//         //   data,
//         // });
//       })
//       .catch((err) => {
//         console.log('err', err.message);
//         // res.status(500).json({
//         //   status: false,
//         //   error: err.message,
//         // });
//         failedTeams.push(team);
//       });
//   }
//   if (failedTeams.length > 0) {
//     res.send({
//       status: false,
//       error: failedTeams,
//     });
//   } else {
//     res.send({
//       status: true,
//       data: updatedData,
//     });
//   }
// };

// const shareImages = async (req, res) => {
//   const { currentUser } = req;
//   const { image_ids, team_ids } = req.body;

//   const teams = await Team.find({
//     _id: { $in: team_ids },
//     $or: [
//       {
//         owner: currentUser.id,
//       },
//       { editors: currentUser.id },
//     ],
//   }).catch((err) => {
//     return res.status(500).send({
//       status: false,
//       error: err.message || 'Team found err',
//     });
//   });

//   if (teams.length === 0) {
//     return res.status(400).send({
//       status: false,
//       error: 'Invalid Permission',
//     });
//   }

//   await Image.updateMany(
//     { _id: { $in: image_ids } },
//     {
//       $set: { role: 'team' },
//     }
//   );

//   const failedTeams = [];
//   const updatedData = [];
//   for (let i = 0; i < teams.length; i++) {
//     const team = teams[i];
//     const imageIds = team.images;
//     const newTeamImages = [];
//     image_ids.forEach((e) => {
//       if (imageIds.indexOf(e) === -1) {
//         imageIds.push(e);
//         newTeamImages.push(e);
//       }
//     });

//     await Team.updateOne(
//       { _id: team._id },
//       {
//         $addToSet: {
//           images: { $each: image_ids },
//         },
//       }
//     )
//       .then(async (_data) => {
//         const updatedImages = await Image.find({ _id: { $in: newTeamImages } });
//         if (updatedImages.length > 0) {
//           updatedData.push(updatedImages);
//         }

//         /**
//          * Create Notification for the Material Share
//          */
//         let team_owners = [];
//         if (team.owner instanceof Array) {
//           team_owners = team.owner;
//         } else {
//           team_owners = [team.owner];
//         }
//         const notification = new Notification({
//           creator: currentUser._id,
//           owner: [...team.members, ...team_owners],
//           criteria: 'share_material',
//           team: team.id,
//           action: {
//             object: 'image',
//             image: newTeamImages,
//           },
//         });
//         notification.save().catch((err) => {
//           console.log('image sharing notification is failed', err);
//         });
//         for (let i = 0; i < notification.owner.length; i++) {
//           createCronNotification(
//             'share_material',
//             {
//               process: notification,
//             },
//             { _id: notification.owner[i] }
//           );
//         }

//         // res.send({
//         //   status: true,
//         //   data: updatedData,
//         // });
//       })
//       .catch((err) => {
//         console.log('err', err.message);
//         // res.status(500).json({
//         //   status: false,
//         //   error: err.message,
//         // });
//         failedTeams.push(team);
//       });
//   }

//   if (failedTeams.length > 0) {
//     res.send({
//       status: false,
//       error: failedTeams,
//     });
//   } else {
//     res.send({
//       status: true,
//       data: updatedData,
//     });
//   }
// };

const shareTeamMaterials = async (req, res) => {
  const { currentUser } = req;
  const { material_ids, team_ids, type } = req.body;

  const teams = await Team.find({
    _id: { $in: team_ids },
    $or: [
      {
        owner: currentUser.id,
      },
      { editors: currentUser.id },
    ],
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (teams.length === 0) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  if (type === 'video') {
    await Video.updateMany(
      {
        _id: { $in: material_ids },
        user: currentUser.id,
      },
      {
        $set: { role: 'team' },
      }
    );
  }

  if (type === 'pdf') {
    await PDF.updateMany(
      {
        _id: { $in: material_ids },
        user: currentUser.id,
      },
      {
        $set: { role: 'team' },
      }
    );
  }

  if (type === 'image') {
    await Image.updateMany(
      {
        _id: { $in: material_ids },
        user: currentUser.id,
      },
      {
        $set: { role: 'team' },
      }
    );
  }

  const failedTeams = [];
  const updatedData = [];
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const videoIds = team.videos;
    const pdfIds = team.pdfs;
    const imageIds = team.images;
    const newTeamMaterials = [];
    let query;

    if (type === 'video') {
      material_ids.forEach((e) => {
        if (videoIds.indexOf(e) === -1) {
          videoIds.push(e);
          newTeamMaterials.push(e);
        }
      });
      query = {
        $addToSet: {
          videos: { $each: material_ids },
        },
      };
    }

    if (type === 'pdf') {
      material_ids.forEach((e) => {
        if (pdfIds.indexOf(e) === -1) {
          pdfIds.push(e);
          newTeamMaterials.push(e);
        }
      });
      query = {
        $addToSet: {
          pdfs: { $each: material_ids },
        },
      };
    }

    if (type === 'image') {
      material_ids.forEach((e) => {
        if (imageIds.indexOf(e) === -1) {
          imageIds.push(e);
          newTeamMaterials.push(e);
        }
      });
      query = {
        $addToSet: {
          images: { $each: material_ids },
        },
      };
    }

    await Team.updateOne({ _id: team._id }, query)
      .then(async (_data) => {
        const data = [];

        let updatedMaterials = [];
        let action;
        if (type === 'video') {
          updatedMaterials = await Video.find({
            _id: { $in: newTeamMaterials },
          });
          action = {
            object: type,
            video: newTeamMaterials,
          };
        }

        if (type === 'pdf') {
          updatedMaterials = await PDF.find({ _id: { $in: newTeamMaterials } });
          action = {
            object: type,
            pdf: newTeamMaterials,
          };
        }

        if (type === 'image') {
          updatedMaterials = await Image.find({
            _id: { $in: newTeamMaterials },
          });
          action = {
            object: type,
            image: newTeamMaterials,
          };
        }

        if (updatedMaterials.length > 0) {
          updatedData.push(updatedMaterials);
        }

        /**
         * Create Notification for the Material Share
         */
        let team_owners = [];
        if (team.owner instanceof Array) {
          team_owners = team.owner;
        } else {
          team_owners = [team.owner];
        }
        const notification = new Notification({
          creator: currentUser._id,
          owner: [...team.members, ...team_owners],
          criteria: 'share_material',
          team: team.id,
          action,
        });
        notification.save().catch((err) => {
          console.log('video sharing notification is failed', err);
        });

        for (let i = 0; i < notification.owner.length; i++) {
          createCronNotification(
            'share_material',
            {
              process: notification,
            },
            { _id: notification.owner[i] }
          );
        }
      })
      .catch((err) => {
        console.log('err', err.message);
        failedTeams.push(team);
      });
  }
  if (failedTeams.length > 0) {
    res.send({
      status: false,
      error: failedTeams,
    });
  } else {
    res.send({
      status: true,
      data: updatedData,
    });
  }
};

const shareMaterials = async (req, res) => {
  const { currentUser } = req;
  const { data, team_id } = req.body;
  const { folders, videos, pdfs, images } = data;

  const _team = await Team.findOne({
    _id: team_id,
    $or: [
      {
        owner: currentUser.id,
      },
      { editors: currentUser.id },
    ],
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team Found Err',
    });
  });

  if (!_team) {
    return res.status(400).send({
      status: false,
      error: 'Not Found Team',
    });
  }
  let _folders = [];
  let _videos = [];
  let _pdfs = [];
  let _images = [];
  let _folderVideos = [];
  let _folderPdfs = [];
  let _folderImages = [];
  let _folderIds = [];
  let _videoIds = [];
  let _imageIds = [];
  let _pdfIds = [];
  // let _teamVideos = [];
  // let _teamImages = [];
  // let _teamPdfs = [];

  if (folders && folders.length) {
    _folders = await Folder.find({ _id: { $in: folders } });
    _folders.forEach((_folder) => {
      _folderVideos = [..._folderVideos, ..._folder.videos];
      _folderImages = [..._folderImages, ..._folder.images];
      _folderPdfs = [..._folderPdfs, ..._folder.pdfs];
    });
    _folderIds = _folders.map((e) => e._id);
  }
  if (videos && videos.length) {
    _videos = await Video.find({ _id: { $in: videos } });
    _videoIds = _videos.map((e) => e._id);
  }
  if (pdfs && pdfs.length) {
    _pdfs = await PDF.find({ _id: { $in: pdfs } });
    _pdfIds = _pdfs.map((e) => e._id);
  }
  if (images && images.length) {
    _images = await Image.find({ _id: { $in: images } });
    _imageIds = _images.map((e) => e._id);
  }

  Team.updateOne(
    { _id: team_id },
    {
      $push: {
        videos: { $each: _videoIds },
        images: { $each: _imageIds },
        pdfs: { $each: _pdfIds },
        folders: { $each: _folderIds },
      },
    }
  ).then(async () => {
    const responseData = [];
    const _updatedVideoIds = [..._folderVideos, ..._videoIds];
    const _updatedImageIds = [..._folderImages, ..._imageIds];
    const _updatedPdfIds = [..._folderPdfs, ..._pdfIds];

    const updatedVideos = await Video.find({
      _id: { $in: _updatedVideoIds },
      user: currentUser._id,
      del: false,
    });
    const updatedImages = await Image.find({
      _id: { $in: _updatedImageIds },
      user: currentUser._id,
      del: false,
    });
    const updatedPdfs = await PDF.find({
      _id: { $in: _updatedPdfIds },
      user: currentUser._id,
      del: false,
    });

    for (let i = 0; i < updatedVideos.length; i++) {
      const video = updatedVideos[i];
      if (video) {
        const views = await VideoTracker.countDocuments({
          video: video.id,
          user: currentUser.id,
        });
        const video_detail = {
          ...video._doc,
          views,
          material_type: 'video',
        };
        responseData.push(video_detail);
      }
    }
    for (let i = 0; i < updatedPdfs.length; i++) {
      const pdf = updatedPdfs[i];
      if (pdf) {
        const views = await PDFTracker.countDocuments({
          pdf: pdf.id,
          user: currentUser.id,
        });
        const pdf_detail = {
          ...pdf._doc,
          views,
          material_type: 'pdf',
        };
        responseData.push(pdf_detail);
      }
    }
    for (let i = 0; i < updatedImages.length; i++) {
      const image = updatedImages[i];
      if (image) {
        const views = await ImageTracker.countDocuments({
          image: image.id,
          user: currentUser.id,
        });
        const image_detail = {
          ...image._doc,
          views,
          material_type: 'image',
        };
        responseData.push(image_detail);
      }
    }
    _folders.forEach((e) => {
      e.material_type = 'folder';
      responseData.push(e);
    });

    let team_owners = [];
    if (_team.owner instanceof Array) {
      team_owners = _team.owner;
    } else {
      team_owners = [_team.owner];
    }
    const notification = new Notification({
      creator: currentUser._id,
      owner: [..._team.members, ...team_owners],
      criteria: 'share_material',
      team: _team.id,
      action: {
        video: videos,
        pdf: pdfs,
        image: images,
        folder: folders,
      },
    });
    notification.save().catch((err) => {
      console.log('video sharing notification is failed', err);
    });

    return res.send({
      status: true,
      data: responseData,
    });
  });
};

const shareAutomations = async (req, res) => {
  const { currentUser } = req;
  const { automation_ids, team_ids } = req.body;
  const teams = await Team.find({
    _id: { $in: team_ids },
    $or: [
      {
        owner: currentUser.id,
      },
      { editors: currentUser.id },
    ],
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (teams.length === 0) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }
  const ids = automation_ids;
  const data = await getMaterials(automation_ids, ids, [], [], [], currentUser);
  const videoIds = [];
  const imageIds = [];
  const pdfIds = [];
  const all_automation_ids = [];
  data['ids'].forEach((e) => {
    if (all_automation_ids.indexOf(e) === -1) {
      all_automation_ids.push(e);
    }
  });
  data['videos'].forEach((e) => {
    if (videoIds.indexOf(e) === -1) {
      videoIds.push(e);
    }
  });
  data['images'].forEach((e) => {
    if (imageIds.indexOf(e) === -1) {
      imageIds.push(e);
    }
  });
  data['pdfs'].forEach((e) => {
    if (pdfIds.indexOf(e) === -1) {
      pdfIds.push(e);
    }
  });
  await Automation.updateMany(
    { _id: { $in: all_automation_ids }, user: currentUser.id },
    {
      $set: { role: 'team' },
    }
  );
  await Video.updateMany(
    {
      _id: { $in: videoIds },
      user: currentUser.id,
    },
    {
      $set: { role: 'team' },
    }
  );
  await PDF.updateMany(
    {
      _id: { $in: pdfIds },
      user: currentUser.id,
    },
    {
      $set: { role: 'team' },
    }
  );
  await Image.updateMany(
    {
      _id: { $in: imageIds },
      user: currentUser.id,
    },
    {
      $set: { role: 'team' },
    }
  );

  const failedTeams = [];
  const updatedData = [];
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const automationIds = team.automations;
    const newTeamAutomations = [];
    all_automation_ids.forEach((e) => {
      if (automationIds.indexOf(e) === -1) {
        automationIds.push(e);
        newTeamAutomations.push(e);
      }
    });
    const newVideos = team.videos;
    videoIds.forEach((e) => {
      if (team.videos.indexOf(e) === -1) {
        newVideos.push(e);
      }
    });
    const newImages = team.images;
    imageIds.forEach((e) => {
      if (team.images.indexOf(e) === -1) {
        newImages.push(e);
      }
    });
    const newPdfs = team.pdfs;
    pdfIds.forEach((e) => {
      if (team.videos.indexOf(e) === -1) {
        newPdfs.push(e);
      }
    });
    await Team.updateOne(
      { _id: team._id },
      {
        $set: {
          automations: automationIds,
          videos: newVideos,
          images: newImages,
          pdfs: newPdfs,
        },
      }
    )
      .then(async (data) => {
        const updatedAutomations = await Automation.find({
          _id: { $in: newTeamAutomations },
        });

        if (updatedAutomations.length > 0) {
          updatedData.push(updatedAutomations);
        }
        /**
         * Create Notifications
         */
        let team_owners = [];
        if (team.owner instanceof Array) {
          team_owners = team.owner;
        } else {
          team_owners = [team.owner];
        }
        const notification = new Notification({
          creator: currentUser._id,
          owner: [...team.members, ...team_owners],
          criteria: 'share_automation',
          team: team.id,
          action: {
            object: 'automation',
            automation: newTeamAutomations,
          },
        });
        notification.save().catch((err) => {
          console.log('automation sharing notification is failed', err);
        });
        for (let i = 0; i < notification.owner.length; i++) {
          createCronNotification(
            'share_automation',
            {
              process: notification,
            },
            { _id: notification.owner[i] }
          );
        }

        // res.send({
        //   status: true,
        //   data: updatedAutomations,
        // });
      })
      .catch((err) => {
        console.log('err', err.message);
        // res.status(500).json({
        //   status: false,
        //   error: err.message,
        // });
        failedTeams.push(team);
      });
  }
  if (failedTeams.length > 0) {
    res.send({
      status: false,
      error: failedTeams,
    });
  } else {
    res.send({
      status: true,
      data: updatedData,
    });
  }
};

const shareEmailTemplates = async (req, res) => {
  const { currentUser } = req;
  const { template_ids, team_ids } = req.body;

  const teams = await Team.find({
    _id: { $in: team_ids },
    $or: [
      {
        owner: currentUser.id,
      },
      { editors: currentUser.id },
    ],
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (teams.length === 0) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  const updatedData = [];
  const failedTeams = [];
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];

    const templates = await EmailTemplate.find({ _id: { $in: template_ids } });

    const newVideos = team.videos;
    const newImages = team.images;
    const newPdfs = team.pdfs;

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      template['video_ids'].forEach((e) => {
        if (team.videos.indexOf(e) === -1) {
          newVideos.push(e);
        }
      });
      template['image_ids'].forEach((e) => {
        if (team.images.indexOf(e) === -1) {
          newImages.push(e);
        }
      });
      template['pdf_ids'].forEach((e) => {
        if (team.videos.indexOf(e) === -1) {
          newPdfs.push(e);
        }
      });

      Video.updateMany(
        {
          _id: { $in: template['video_ids'] },
          user: currentUser.id,
        },
        {
          $set: { role: 'team' },
        }
      );
      PDF.updateMany(
        {
          _id: { $in: template['pdf_ids'] },
          user: currentUser.id,
        },
        {
          $set: { role: 'team' },
        }
      );
      Image.updateMany(
        {
          _id: { $in: template['image_ids'] },
          user: currentUser.id,
        },
        {
          $set: { role: 'team' },
        }
      );
    }

    await EmailTemplate.updateMany(
      { _id: { $in: template_ids } },
      {
        $set: { role: 'team' },
      }
    ).catch((err) => {
      console.log('Error', err);
    });

    const templateIds = team.email_templates;
    const newTeamTemplates = [];
    template_ids.forEach((e) => {
      if (templateIds.indexOf(e) === -1) {
        templateIds.push(e);
        newTeamTemplates.push(e);
      }
    });

    await Team.updateOne(
      { _id: team._id },
      {
        $set: {
          email_templates: templateIds,
          videos: newVideos,
          images: newImages,
          pdfs: newPdfs,
        },
      }
    )
      .then(async () => {
        const updatedTemplates = await EmailTemplate.find({
          _id: { $in: newTeamTemplates },
        });

        if (updatedTemplates.length > 0) {
          updatedData.push(updatedTemplates);
        }
        /**
         * Create Notifications
         */
        let team_owners = [];
        if (team.owner instanceof Array) {
          team_owners = team.owner;
        } else {
          team_owners = [team.owner];
        }
        const notification = new Notification({
          creator: currentUser._id,
          owner: [...team.members, ...team_owners],
          criteria: 'share_template',
          team: team.id,
          action: {
            object: 'template',
            template: newTeamTemplates,
          },
        });
        notification.save().catch((err) => {
          console.log('automation sharing notification is failed', err);
        });
        for (let i = 0; i < notification.owner.length; i++) {
          createCronNotification(
            'share_template',
            {
              process: notification,
            },
            { _id: notification.owner[i] }
          );
        }
        // res.send({
        //   status: true,
        //   data: updatedTemplates,
        // });
      })
      .catch((err) => {
        console.log('err', err.message);
        // res.status(500).json({
        //   status: false,
        //   error: err.message,
        // });
        failedTeams.push(team);
      });
  }
  if (failedTeams.length > 0) {
    res.send({
      status: false,
      error: failedTeams,
    });
  } else {
    res.send({
      status: true,
      data: updatedData,
    });
  }
};

const shareFolders = async (req, res) => {
  const { currentUser } = req;
  const { folder_ids, team_ids } = req.body;

  const teams = await Team.find({
    _id: { $in: team_ids },
    $or: [
      {
        owner: currentUser.id,
      },
      { editors: currentUser.id },
    ],
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (!teams) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  Folder.updateMany(
    { _id: { $in: folder_ids } },
    {
      $set: { role: 'team' },
    }
  ).catch((err) => {
    console.log('Error', err);
  });

  Team.updateMany(
    { _id: { $in: teams } },
    {
      $addToSet: { folders: folder_ids },
    }
  )
    .then(async () => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

const searchTeam = async (req, res) => {
  const search = req.body.search;
  // const { currentUser } = req;
  const skip = req.body.skip || 0;

  /**
  const user_array = await User.find({
    $or: [
      {
        user_name: { $regex: '.*' + search + '.*', $options: 'i' },
        del: false,
      },
      {
        email: { $regex: '.*' + search.split(' ')[0] + '.*', $options: 'i' },
        del: false,
      },
      {
        cell_phone: {
          $regex:
            '.*' +
            search
              .split('')
              .filter((char) => /^[^\(\)\- ]$/.test(char))
              .join('') +
            '.*',
          $options: 'i',
        },
        del: false,
      },
    ],
    _id: { $nin: [currentUser.id] },
  })
    .sort({ user_name: 1 })
    .skip(skip)
    .limit(8)
    .catch((err) => {
      console.log('err', err);
    });
   */

  let team_array;

  if (search) {
    team_array = await Team.find({
      name: { $regex: '.*' + search + '.*', $options: 'i' },
      is_public: true,
    })
      .populate({ path: 'owner' })
      .limit(8)
      .skip(skip)
      .catch((err) => {
        console.log('err', err);
      });
  } else {
    team_array = await Team.find({
      is_public: true,
    })
      .populate({ path: 'owner' })
      .limit(8)
      .skip(skip)
      .catch((err) => {
        console.log('err', err);
      });
  }
  return res.send({
    status: true,
    // user_array,
    team_array,
  });
};

const requestTeam = async (req, res) => {
  const { currentUser } = req;
  const { searchedUser, team_id } = req.body;
  const team = await Team.findById(team_id);
  if (team.owner.indexOf(currentUser._id) !== -1) {
    return res.status(400).send({
      status: false,
      error: 'You are a owner already.',
    });
  }
  if (team.members.indexOf(currentUser._id) !== -1) {
    return res.status(400).send({
      status: false,
      error: 'You are a member already.',
    });
  }

  let owners;
  if (searchedUser && team.editors.indexOf(searchedUser) !== -1) {
    const editor = await User.findOne({ _id: searchedUser });
    owners = [editor];
  } else if (searchedUser && team.owner.indexOf(searchedUser) !== -1) {
    const owner = await User.findOne({ _id: searchedUser });
    owners = [owner];
  } else {
    const owner = await User.find({ _id: { $in: team.owner } });
    owners = owner;
  }
  for (let i = 0; i < owners.length; i++) {
    const owner = owners[i];

    const time_zone = owner.time_zone_info
      ? JSON.parse(owner.time_zone_info).tz_name
      : system_settings.TIME_ZONE;

    const data = {
      template_data: {
        owner_name: owner.user_name,
        user_name: currentUser.user_name,
        created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
        team_name: team.name,
        team_url: urls.TEAM_URL + team.id,
        accept_url: `${urls.TEAM_URL}${team.id}/request?join=accept&user=${currentUser.id}`,
        decline_url: `${urls.TEAM_URL}${team.id}/request?join=decline&user=${currentUser.id}`,
      },
      template_name: 'TeamRequest',
      required_reply: false,
      email: owner.email,
    };

    sendNotificationEmail(data);

    const team_url = `<a href="${urls.TEAM_URL}">${team.name}</a>`;
    const notification = new Notification({
      creator: currentUser._id,
      team: team.id,
      user: owner.id,
      criteria: 'team_requested',
      content: `${currentUser.user_name} has requested to join your ${team_url} in CRMGrow`,
    });
    notification.save().catch((err) => {
      console.log('notification save err', err.message);
    });
  }

  if (team.requests.indexOf(currentUser._id) === -1) {
    team.requests.push(currentUser._id);
    team.save().catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
  }
  return res.send({
    status: true,
  });
};

const remove = async (req, res) => {
  const team = await Team.findOne({ _id: req.params.id }).catch((err) => {
    console.log('team found error', err.message);
  });

  if (team.videos && team.videos.length > 0) {
    Video.updateMany(
      {
        _id: {
          $in: team.videos,
        },
        role: 'team',
      },
      { $unset: { role: true } }
    );
  }

  if (team.pdfs && team.pdfs.length > 0) {
    PDF.updateMany(
      {
        _id: { $in: team.pdfs },
        role: 'team',
      },
      { $unset: { role: true } }
    );
  }

  if (team.images && team.images.length > 0) {
    Image.updateMany(
      {
        _id: { $in: team.images },
        role: 'team',
      },
      { $unset: { role: true } }
    );
  }

  if (team.email_templates && team.email_templates.length > 0) {
    EmailTemplate.updateMany(
      {
        _id: { $in: team.email_templates },
        role: 'team',
      },
      { $unset: { role: true } }
    );
  }

  if (team.automations && team.automations.length > 0) {
    Automation.updateMany(
      {
        _id: { $in: team.automations },
        role: 'team',
      },
      { $unset: { role: true } }
    );
  }

  Contact.updateMany(
    {
      shared_team: req.params.id,
    },
    {
      $unset: {
        shared_members: true,
        shared_contact: true,
        shared_team: true,
      },
    }
  ).catch((err) => {
    console.log('contact update team member remove err', err.message);
  });

  Team.deleteOne({
    _id: req.params.id,
  })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

/**
 * Load the shared teams of data
 * @param {*} req: {body: {type: material type ('video' | 'pdfs' | 'images' ), id: material id}}
 * @param {*} res
 */
const loadSharedTeams = async (req, res) => {
  const { currentUser } = req;
  const { type, id } = req.body;

  const findQuery = { [type]: id };
  Team.find(findQuery)
    .select({ title: true, _id: true })
    .then((_teams) => {
      return res.send({
        status: true,
        data: _teams,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || err,
      });
    });
};

/**
 * Stop share the material from team
 * @param {*} req: {body: {type: material type ('video' | 'pdfs' | 'images' | 'email_templates' | 'automations'), id: material id, teams: team id array}}
 * @param {*} res
 */
const stopShare = async (req, res) => {
  const { currentUser } = req;
  const { type, id, teams } = req.body;

  const pullQuery = { [type]: mongoose.Types.ObjectId(id) };
  const findQuery = { [type]: id };
  Team.updateMany(
    {
      _id: { $in: teams },
    },
    { $pull: pullQuery }
  )
    .then(async () => {
      const sharedTeamCount = await Team.countDocuments(findQuery);
      if (!sharedTeamCount) {
        if (type === 'videos') {
          await Video.updateOne(
            {
              _id: id,
            },
            { $unset: { role: true } }
          );
        } else if (type === 'pdfs') {
          await PDF.updateOne(
            {
              _id: id,
            },
            { $unset: { role: true } }
          );
        } else if (type === 'images') {
          await Image.updateOne(
            {
              _id: id,
            },
            { $unset: { role: true } }
          );
        } else if (type === 'folders') {
          await Folder.updateOne(
            {
              _id: id,
            },
            { $unset: { role: true } }
          );
        } else if (type === 'email_templates') {
          await EmailTemplate.updateOne(
            {
              _id: id,
            },
            { $unset: { role: true } }
          );
        } else if (type === 'automations') {
          await Automation.updateOne(
            {
              _id: id,
            },
            { $unset: { role: true } }
          );
        }
      }

      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || err,
      });
    });
};

const removeVideos = async (req, res) => {
  const { currentUser } = req;
  const video = await Video.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!video) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }

  const teams = await Team.find({
    videos: req.params.id,
    $or: [{ owner: currentUser._id }, { editors: currentUser._id }],
  }).catch((err) => {
    console.log('team finding error', err);
  });

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];

    Team.updateOne(
      { videos: req.params.id },
      {
        $pull: { videos: mongoose.Types.ObjectId(req.params.id) },
      }
    ).catch((err) => {
      console.log('team remove video error', err.message);
    });

    /**
     * Create Notifications
     */
    let team_owners = [];
    if (team.owner instanceof Array) {
      team_owners = team.owner;
    } else {
      team_owners = [team.owner];
    }
    const notification = new Notification({
      creator: currentUser._id,
      owner: [...team.members, ...team_owners],
      criteria: 'stop_share_material',
      team: team.id,
      action: {
        object: 'video',
        video: [req.params.id],
      },
    });
    notification.save().catch((err) => {
      console.log('video stop sharing notification is failed', err);
    });
  }

  Video.updateOne(
    {
      _id: req.params.id,
      role: 'team',
    },
    { $unset: { role: true } }
  ).catch((err) => {
    console.log('err', err.message);
  });

  return res.send({
    status: true,
  });
};

const removePdfs = async (req, res) => {
  const { currentUser } = req;
  const pdf = await PDF.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!pdf) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }

  const teams = await Team.find({
    videos: req.params.id,
    $or: [{ owner: currentUser._id }, { editors: currentUser._id }],
  }).catch((err) => {
    console.log('team finding error', err);
  });

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];

    Team.updateOne(
      { pdfs: req.params.id },
      {
        $pull: { pdfs: mongoose.Types.ObjectId(req.params.id) },
      }
    ).catch((err) => {
      console.log('err', err.message);
    });

    /**
     * Create Notifications
     */
    let team_owners = [];
    if (team.owner instanceof Array) {
      team_owners = team.owner;
    } else {
      team_owners = [team.owner];
    }
    const notification = new Notification({
      creator: currentUser._id,
      owner: [...team.members, ...team_owners],
      criteria: 'stop_share_material',
      team: team.id,
      action: {
        object: 'pdf',
        pdf: [req.params.id],
      },
    });
    notification.save().catch((err) => {
      console.log('pdf stop sharing notification is failed', err);
    });
  }

  PDF.updateOne(
    {
      _id: req.params.id,
      role: 'team',
    },
    { $unset: { role: true } }
  ).catch((err) => {
    console.log('err', err.message);
  });

  return res.send({
    status: true,
  });
};

const removeImages = async (req, res) => {
  const { currentUser } = req;
  const image = await Image.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!image) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }

  const teams = await Team.find({
    videos: req.params.id,
    $or: [{ owner: currentUser._id }, { editors: currentUser._id }],
  }).catch((err) => {
    console.log('team finding error', err);
  });

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];

    Team.updateOne(
      { images: req.params.id },
      {
        $pull: { images: mongoose.Types.ObjectId(req.params.id) },
      }
    ).catch((err) => {
      console.log('err', err.message);
    });

    /**
     * Create Notifications
     */
    let team_owners = [];
    if (team.owner instanceof Array) {
      team_owners = team.owner;
    } else {
      team_owners = [team.owner];
    }
    const notification = new Notification({
      creator: currentUser._id,
      owner: [...team.members, ...team_owners],
      criteria: 'stop_share_material',
      team: team.id,
      action: {
        object: 'image',
        image: [req.params.id],
      },
    });
    notification.save().catch((err) => {
      console.log('image stop sharing notification is failed', err);
    });
  }

  Image.updateOne(
    {
      _id: req.params.id,
      role: 'team',
    },
    { $unset: { role: true } }
  ).catch((err) => {
    console.log('err', err.message);
  });

  return res.send({
    status: true,
  });
};

const removeFolders = async (req, res) => {
  const { currentUser } = req;
  const team_id = req.params.id;
  const { folder } = req.body;
  const _folder = await Folder.findOne({
    _id: folder,
    user: currentUser.id,
  });

  if (!_folder) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }

  const team = await Team.findOne({ _id: team_id }).catch((err) => {
    console.log('team finding error', err);
  });

  Team.updateOne(
    { _id: team_id },
    {
      $pull: { folders: mongoose.Types.ObjectId(folder) },
    }
  ).catch((err) => {
    console.log('err', err.message);
  });

  /**
   * Create Notifications
   */
  let team_owners = [];
  if (team.owner instanceof Array) {
    team_owners = team.owner;
  } else {
    team_owners = [team.owner];
  }
  const notification = new Notification({
    creator: currentUser._id,
    owner: [...team.members, ...team_owners],
    criteria: 'stop_share_material',
    team: team.id,
    action: {
      object: 'folder',
      folder: [folder],
    },
  });
  notification.save().catch((err) => {
    console.log('folder stop sharing notification is failed', err);
  });

  return res.send({
    status: true,
  });
};

const removeAutomations = async (req, res) => {
  const { currentUser } = req;
  const automation = await Automation.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!automation) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }

  const team = await Team.findOne({ automations: req.params.id }).catch(
    (err) => {
      console.log('team finding error', err);
    }
  );

  Team.updateOne(
    { automations: req.params.id },
    {
      $pull: { automations: mongoose.Types.ObjectId(req.params.id) },
    }
  ).catch((err) => {
    console.log('err', err.message);
  });

  Automation.updateOne(
    {
      _id: req.params.id,
      role: 'team',
    },
    { $unset: { role: true } }
  ).catch((err) => {
    console.log('err', err.message);
  });

  /**
   * Create Notifications
   */
  let team_owners = [];
  if (team.owner instanceof Array) {
    team_owners = team.owner;
  } else {
    team_owners = [team.owner];
  }
  const notification = new Notification({
    creator: currentUser._id,
    owner: [...team.members, ...team_owners],
    criteria: 'stop_share_automation',
    team: team.id,
    action: {
      object: 'automation',
      automation: [req.params.id],
    },
  });
  notification.save().catch((err) => {
    console.log('folder stop sharing notification is failed', err);
  });

  return res.send({
    status: true,
  });
};

const removeEmailTemplates = async (req, res) => {
  const { currentUser } = req;
  const email_template = await EmailTemplate.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!email_template) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }

  const team = await Team.findOne({ email_templates: req.params.id }).catch(
    (err) => {
      console.log('team finding error', err);
    }
  );

  Team.updateOne(
    { email_templates: req.params.id },
    {
      $pull: { email_templates: mongoose.Types.ObjectId(req.params.id) },
    }
  ).catch((err) => {
    console.log('err', err.message);
  });

  EmailTemplate.updateOne(
    {
      _id: req.params.id,
      role: 'team',
    },
    { $unset: { role: true } }
  ).catch((err) => {
    console.log('err', err.message);
  });

  /**
   * Create Notifications
   */
  let team_owners = [];
  if (team.owner instanceof Array) {
    team_owners = team.owner;
  } else {
    team_owners = [team.owner];
  }
  const notification = new Notification({
    creator: currentUser._id,
    owner: [...team.members, ...team_owners],
    criteria: 'stop_share_template',
    team: team.id,
    action: {
      object: 'template',
      template: [req.params.id],
    },
  });
  notification.save().catch((err) => {
    console.log('folder stop sharing notification is failed', err);
  });

  return res.send({
    status: true,
  });
};

const unshareFolders = (req, res) => {
  const folders = req.body.folders || [];

  Team.updateMany(
    { folders: { $elemMatch: { $in: folders } } },
    { $pull: { folders: { $in: folders } } }
  ).then(() => {
    Folder.updateMany(
      { _id: { $in: folders } },
      { $unset: { role: true } }
    ).then(() => {
      console.log('updated role');
    });
    return res.send({
      status: true,
    });
  });
};

const unshareTemplates = (req, res) => {
  const templates = req.body.templates || [];

  Team.updateMany(
    { email_templates: { $elemMatch: { $in: templates } } },
    { $pull: { email_templates: { $in: templates } } }
  ).then(() => {
    EmailTemplate.updateMany(
      { _id: { $in: templates } },
      { $unset: { role: true } }
    ).then(() => {
      console.log('updated role');
    });
    return res.send({
      status: true,
    });
  });
};

const unshareAutomations = (req, res) => {
  const automations = req.body.automations || [];

  Team.updateMany(
    { automations: { $elemMatch: { $in: automations } } },
    { $pull: { automations: { $in: automations } } }
  ).then(() => {
    Automation.updateMany(
      { _id: { $in: automations } },
      { $unset: { role: true } }
    ).then(() => {
      console.log('updated role');
    });
    return res.send({
      status: true,
    });
  });
};

const unshareMaterials = (req, res) => {
  const materials = req.body.materials || [];
  const material_type = req.body.type || 'videos';

  Team.updateMany(
    { [material_type]: { $elemMatch: { $in: materials } } },
    { $pull: { [material_type]: { $in: materials } } }
  ).then(() => {
    if (material_type === 'videos') {
      Video.updateMany(
        { _id: { $in: materials } },
        { $unset: { role: true } }
      ).then(() => {
        console.log('updated role');
      });
    } else if (material_type === 'pdfs') {
      PDF.updateMany(
        { _id: { $in: materials } },
        { $unset: { role: true } }
      ).then(() => {
        console.log('updated role');
      });
    } else if (material_type === 'images') {
      Image.updateMany(
        { _id: { $in: materials } },
        { $unset: { role: true } }
      ).then(() => {
        console.log('updated role');
      });
    }
    return res.send({
      status: true,
    });
  });
};

const updateTeam = (req, res) => {
  const { team_id, data } = req.body;
  Team.updateOne({ _id: team_id }, { $set: data })
    .then(res.send({ status: true }))
    .catch((err) => {
      res.status(500).send({ status: false, error: err.message });
    });
};

const getLeaders = (req, res) => {
  const { currentUser } = req;
  Team.find({
    $or: [
      {
        members: currentUser.id,
      },
      { owner: currentUser.id },
    ],
  })
    .populate([
      {
        path: 'owner',
        select: {
          _id: 1,
          user_name: 1,
          picture_profile: 1,
          email: 1,
          phone: 1,
        },
      },
      {
        path: 'editors',
        select: {
          _id: 1,
          user_name: 1,
          picture_profile: 1,
          email: 1,
          phone: 1,
        },
      },
    ])
    .then((data) => {
      let users = [];
      data.forEach((e) => {
        if (users.length) {
          users = [...users, ...e.editors, ...e.owner];
        } else {
          users = [...e.editors, ...e.owner];
        }
      });
      return res.send({
        status: true,
        data: users,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const getSharedContacts = async (req, res) => {
  const { currentUser } = req;
  const count = req.body.count || 50;
  const skip = req.body.skip || 0;

  const total = await Contact.countDocuments({
    $or: [
      {
        shared_contact: true,
        user: currentUser.id,
        shared_team: req.body.team,
      },
      {
        shared_members: currentUser.id,
        shared_team: req.body.team,
      },
    ],
  });

  const contacts = await Contact.find({
    $or: [
      {
        shared_members: currentUser.id,
        shared_team: req.body.team,
      },
      {
        shared_contact: true,
        user: currentUser.id,
        shared_team: req.body.team,
      },
    ],
  })
    .populate([
      {
        path: 'user',
        select:
          'user_name email picture_profile phone location time_zone_info company',
      },
      {
        path: 'last_activity',
      },
      {
        path: 'shared_members',
        select:
          'user_name email picture_profile phone location time_zone_info company',
      },
    ])
    .skip(skip)
    .limit(count)
    .catch((err) => {
      console.log('get shared contact', err.message);
    });

  return res.send({
    status: true,
    data: {
      count: total,
      contacts,
    },
  });
};

const searchContact = async (req, res) => {
  const { currentUser } = req;

  const searchStr = req.body.search;
  const search = searchStr.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  const phoneSearch = searchStr.replace(/[.*+\-?^${}()|[\]\\\s]/g, '');
  let contacts = [];

  const { share_by, share_with, team } = req.body;
  const teamQuery = [];
  if (
    (share_by && share_by.flag !== -1) ||
    (share_with && share_with.flag !== -1)
  ) {
    const shareWithQuery = {};
    const shareByQuery = {};
    if (share_with.flag !== -1) {
      shareWithQuery['user'] = currentUser._id;
      shareWithQuery['shared_team'] = [team];
      if (share_with.members && share_with.members.length) {
        shareWithQuery['shared_members'] = share_with.members;
      }
      teamQuery.push(shareWithQuery);
    }
    if (share_by.flag !== -1) {
      shareByQuery['user'] = currentUser._id;
      shareByQuery['shared_team'] = [team];
      if (share_by.members && share_by.members.length) {
        shareByQuery['user'] = { $in: share_by.members };
      }
      teamQuery.push(shareByQuery);
    }
  }

  var stringSearchQuery;
  if (search) {
    if (search.split(' ').length > 1) {
      stringSearchQuery = {
        $or: [
          {
            first_name: { $regex: search.split(' ')[0], $options: 'i' },
            last_name: { $regex: search.split(' ')[1], $options: 'i' },
            user: currentUser.id,
            shared_team: req.body.team,
            shared_contact: true,
          },
          {
            first_name: { $regex: search.split(' ')[0], $options: 'i' },
            last_name: { $regex: search.split(' ')[1], $options: 'i' },
            shared_members: currentUser.id,
            shared_team: req.body.team,
          },
          {
            first_name: { $regex: search, $options: 'i' },
            user: currentUser.id,
            shared_team: req.body.team,
            shared_contact: true,
          },
          {
            first_name: { $regex: search, $options: 'i' },
            shared_members: currentUser.id,
            shared_team: req.body.team,
          },
          {
            last_name: { $regex: search, $options: 'i' },
            user: currentUser.id,
            shared_team: req.body.team,
            shared_contact: true,
          },
          {
            last_name: { $regex: search, $options: 'i' },
            shared_members: currentUser.id,
            shared_team: req.body.team,
          },
          {
            cell_phone: {
              $regex: '.*' + phoneSearch + '.*',
              $options: 'i',
            },
            user: currentUser.id,
            shared_team: req.body.team,
            shared_contact: true,
          },
          {
            cell_phone: {
              $regex: '.*' + phoneSearch + '.*',
              $options: 'i',
            },
            shared_members: currentUser.id,
            shared_team: req.body.team,
          },
        ],
      };
    } else {
      stringSearchQuery = {
        $or: [
          {
            first_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
            user: currentUser.id,
            shared_team: req.body.team,
            shared_contact: true,
          },
          {
            first_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
            shared_members: currentUser.id,
            shared_team: req.body.team,
          },
          {
            email: {
              $regex: '.*' + search.split(' ')[0] + '.*',
              $options: 'i',
            },
            user: currentUser.id,
            shared_team: req.body.team,
            shared_contact: true,
          },
          {
            email: {
              $regex: '.*' + search.split(' ')[0] + '.*',
              $options: 'i',
            },
            shared_members: currentUser.id,
            shared_team: req.body.team,
          },
          {
            last_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
            user: currentUser.id,
            shared_team: req.body.team,
            shared_contact: true,
          },
          {
            last_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
            shared_members: currentUser.id,
            shared_team: req.body.team,
          },
          {
            cell_phone: {
              $regex: '.*' + phoneSearch + '.*',
              $options: 'i',
            },
            user: currentUser.id,
            shared_team: req.body.team,
            shared_contact: true,
          },
          {
            cell_phone: {
              $regex: '.*' + phoneSearch + '.*',
              $options: 'i',
            },
            shared_members: currentUser.id,
            shared_team: req.body.team,
          },
        ],
      };
    }
  }

  var query;
  if (teamQuery.length && stringSearchQuery) {
    query = {
      $and: [{ $or: teamQuery }, stringSearchQuery],
    };
  } else if (teamQuery.length && !stringSearchQuery) {
    query = { $or: teamQuery };
  } else if (!teamQuery.length && stringSearchQuery) {
    query = stringSearchQuery;
  }

  contacts = await Contact.find(query)
    .populate([
      {
        path: 'user',
        select: 'user_name email picture_profile phone',
      },
      {
        path: 'last_activity',
      },
      {
        path: 'shared_members',
        select: 'user_name email picture_profile phone',
      },
    ])
    .sort({ first_name: 1 });

  return res.send({
    status: true,
    data: {
      contacts,
      search,
    },
  });
};

const loadMaterial = async (req, res) => {
  const { currentUser } = req;
  const team = await Team.findOne({ _id: req.params.id }).catch((err) => {
    console.log('team find err', err.message);
  });

  const video_data = [];
  const pdf_data = [];
  const image_data = [];
  const folder_data = [];

  if (team.videos && team.videos.length > 0) {
    const video_ids = team.videos;
    for (let i = 0; i < video_ids.length; i++) {
      const video = await Video.findOne({
        _id: video_ids[i],
      }).catch((err) => {
        console.log('video find err', err.message);
      });

      if (video) {
        const views = await VideoTracker.countDocuments({
          video: video_ids[i],
          user: currentUser.id,
        });

        const video_detail = {
          ...video._doc,
          views,
          material_type: 'video',
        };

        video_data.push(video_detail);
      } else {
        Team.updateOne(
          {
            _id: req.params.id,
          },
          {
            $pull: { videos: { $in: video_ids[i] } },
          }
        ).catch((err) => {
          console.log('team update one', err.message);
        });
      }
    }
  }

  if (team.pdfs && team.pdfs.length > 0) {
    const pdf_ids = team.pdfs;
    for (let i = 0; i < pdf_ids.length; i++) {
      const pdf = await PDF.findOne({
        _id: pdf_ids[i],
      }).catch((err) => {
        console.log('pdf find err', err.message);
      });

      if (pdf) {
        const views = await PDFTracker.countDocuments({
          pdf: pdf_ids[i],
          user: currentUser.id,
        });

        const pdf_detail = {
          ...pdf._doc,
          views,
          material_type: 'pdf',
        };

        pdf_data.push(pdf_detail);
      } else {
        Team.updateOne(
          {
            _id: req.params.id,
          },
          {
            $pull: { pdfs: { $in: pdf_ids[i] } },
          }
        ).catch((err) => {
          console.log('team update one', err.message);
        });
      }
    }
  }

  if (team.images && team.images.length > 0) {
    const image_ids = team.images;
    for (let i = 0; i < image_ids.length; i++) {
      const image = await Image.findOne({
        _id: image_ids[i],
      }).catch((err) => {
        console.log('image find err', err.message);
      });

      if (image) {
        const views = await ImageTracker.countDocuments({
          image: image_ids[i],
          user: currentUser.id,
        });

        const image_detail = {
          ...image._doc,
          views,
          material_type: 'image',
        };

        image_data.push(image_detail);
      } else {
        Team.updateOne(
          {
            _id: req.params.id,
          },
          {
            $pull: { images: { $in: image_ids[i] } },
          }
        ).catch((err) => {
          console.log('team update one', err.message);
        });
      }
    }
  }

  let _folders = [];
  if (team.folders && team.folders.length) {
    _folders = await Folder.find({ _id: { $in: team.folders } });
    let _folderVideos = [];
    let _folderPdfs = [];
    let _folderImages = [];
    _folders.forEach((_folder) => {
      _folderVideos = [..._folderVideos, ..._folder.videos];
      _folderImages = [..._folderImages, ..._folder.images];
      _folderPdfs = [..._folderPdfs, ..._folder.pdfs];
      const folder_detail = {
        ..._folder._doc,
        material_type: 'folder',
      };
      folder_data.push(folder_detail);
    });

    const folderVideos = await Video.find({
      _id: { $in: _folderVideos },
      role: { $ne: 'admin' },
      del: false,
    });
    const folderImages = await Image.find({
      _id: { $in: _folderImages },
      role: { $ne: 'admin' },
      del: false,
    });
    const folderPdfs = await PDF.find({
      _id: { $in: _folderPdfs },
      role: { $ne: 'admin' },
      del: false,
    });

    for (let i = 0; i < folderVideos.length; i++) {
      const video = folderVideos[i];
      if (video) {
        const views = await VideoTracker.countDocuments({
          video: video.id,
          user: currentUser.id,
        });
        const video_detail = {
          ...video._doc,
          views,
          material_type: 'video',
        };
        video_data.push(video_detail);
      }
    }
    for (let i = 0; i < folderPdfs.length; i++) {
      const pdf = folderPdfs[i];
      if (pdf) {
        const views = await PDFTracker.countDocuments({
          pdf: pdf.id,
          user: currentUser.id,
        });
        const pdf_detail = {
          ...pdf._doc,
          views,
          material_type: 'pdf',
        };
        pdf_data.push(pdf_detail);
      }
    }
    for (let i = 0; i < folderImages.length; i++) {
      const image = folderImages[i];
      if (image) {
        const views = await ImageTracker.countDocuments({
          image: image.id,
          user: currentUser.id,
        });
        const image_detail = {
          ...image._doc,
          views,
          material_type: 'image',
        };
        image_data.push(image_detail);
      }
    }
  }

  return res.send({
    status: true,
    data: {
      video_data,
      pdf_data,
      image_data,
      folder_data,
    },
  });
};

const loadAutomation = async (req, res) => {
  const { currentUser } = req;
  const team = await Team.findOne({ _id: req.params.id }).catch((err) => {
    console.log('team find err', err.message);
  });

  const data = [];
  // get shared contacts first
  const shared_contacts = await Contact.find({
    shared_members: currentUser.id,
  });

  if (team.automations && team.automations.length > 0) {
    const automation_ids = team.automations;
    for (let i = 0; i < automation_ids.length; i++) {
      const automation = await Automation.findOne({
        _id: automation_ids[i],
      })
        .populate({
          path: 'user',
          select: { user_name: 1, picture_profile: 1 },
        })
        .catch((err) => {
          console.log('automation find err', err.message);
        });

      if (automation) {
        const total = await TimeLine.aggregate([
          {
            $match: {
              $or: [
                {
                  user: mongoose.Types.ObjectId(currentUser._id),
                  automation: mongoose.Types.ObjectId(automation._id),
                },
                {
                  contact: { $in: shared_contacts },
                  automation: mongoose.Types.ObjectId(automation._id),
                },
              ],
            },
          },
          {
            $group: {
              _id: { contact: '$contact' },
            },
          },
          {
            $group: {
              _id: '$_id.contact',
            },
          },
          {
            $project: { _id: 1 },
          },
          {
            $count: 'count',
          },
        ]);

        let automation_detail;

        if (automation._doc) {
          automation_detail = {
            ...automation._doc,
            contacts: total[0] ? total[0].count : 0,
          };
        } else {
          automation_detail = {
            ...automation,
            contacts: total[0] ? total[0].count : 0,
          };
        }

        data.push(automation_detail);
      }
    }
  }

  return res.send({
    status: true,
    data,
  });
};

const loadTemplate = async (req, res) => {
  const team = await Team.findOne({
    _id: req.params.id,
  })
    .populate({
      path: 'email_templates',
      populate: {
        path: 'user',
        select: { user_name: 1, picture_profile: 1 },
      },
    })
    .catch((err) => {
      console.log('team load err', err.message);
    });

  return res.send({
    status: true,
    data: team.email_templates,
  });
};

const getAllSharedContacts = async (req, res) => {
  const { currentUser } = req;

  const contacts = await Contact.find({
    $or: [
      {
        shared_members: currentUser.id,
        shared_team: req.body.team,
      },
      {
        shared_contact: true,
        user: currentUser.id,
        shared_team: req.body.team,
      },
    ],
  }).select({
    _id: 1,
    first_name: 1,
    last_name: 1,
    email: 1,
    phone: 1,
  });
  return res.send({
    status: true,
    data: contacts,
  });
};

module.exports = {
  getAll,
  getLeaders,
  getTeam,
  loadMaterial,
  loadAutomation,
  loadTemplate,
  getSharedContacts,
  getAllSharedContacts,
  searchContact,
  getInvitedTeam,
  getRequestedTeam,
  get,
  create,
  update,
  remove,
  cancelRequest,
  bulkInvites,
  cancelInvite,
  acceptInviation,
  declineInviation,
  acceptRequest,
  declineRequest,
  searchTeam,
  // shareVideos,
  // sharePdfs,
  // shareImages,
  shareAutomations,
  shareEmailTemplates,
  shareFolders,
  removeVideos,
  removePdfs,
  removeImages,
  removeFolders,
  removeAutomations,
  removeEmailTemplates,
  requestTeam,
  updateTeam,
  shareMaterials,
  unshareFolders,
  unshareTemplates,
  unshareAutomations,
  unshareMaterials,
  loadSharedTeams,
  stopShare,
  shareTeamMaterials,
};
