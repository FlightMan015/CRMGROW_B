const Notification = require('../models/notification');
const Task = require('../models/task');
const Text = require('../models/text');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const Automation = require('../models/automation');
const Contact = require('../models/contact');
const CampaignJob = require('../models/campaign_job');
const Timeline = require('../models/time_line');
const { createNotification } = require('../helpers/notification');
const _ = require('lodash');

const create = async (req, res) => {
  const { currentUser } = req;
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

const get = async (req, res) => {
  const { currentUser } = req;
  const { limit } = req.query;
  const personal_notifications = await Notification.find({
    user: currentUser.id,
    is_read: false,
  }).limit(parseInt(limit));

  const system_notifications = await Notification.find({
    type: 'global',
    del: false,
  }).sort({ updated_at: -1 });

  res.send({
    status: true,
    personal_notifications,
    system_notifications,
  });
};

const bulkRead = (req, res) => {
  const { ids, mode } = req.body;
  const { currentUser } = req;
  let userNotificationQuery;
  let ownerNotificationQuery;
  if (mode === 'all') {
    userNotificationQuery = {
      user: currentUser.id,
    };
    ownerNotificationQuery = {
      owner: currentUser.id,
    };
  } else {
    userNotificationQuery = {
      _id: { $in: ids },
      user: currentUser.id,
    };
    ownerNotificationQuery = {
      _id: { $in: ids },
      owner: currentUser.id,
    };
  }
  Notification.updateMany(
    userNotificationQuery,
    {
      $set: { is_read: true },
    },
    {
      timestamps: false,
    }
  )
    .then(() => {
      Notification.updateMany(
        ownerNotificationQuery,
        {
          $set: {
            ['read_status.' + currentUser._id]: true,
          },
        },
        {
          timestamps: false,
        }
      ).catch((err) => {
        console.log('multi owner notifications update is failed', err.message);
      });
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

const bulkUnread = (req, res) => {
  const { ids } = req.body;
  const { currentUser } = req;
  Notification.updateMany(
    {
      _id: { $in: ids },
      type: 'personal',
      user: currentUser.id,
    },
    { is_read: false },
    {
      timestamps: false,
    }
  )
    .then(() => {
      Notification.updateMany(
        {
          _id: { $in: ids },
          owner: currentUser.id,
        },
        {
          $set: {
            ['read_status.' + currentUser._id]: false,
          },
        },
        {
          timestamps: false,
        }
      ).catch((err) => {
        console.log('multi owner notifications update is failed', err.message);
      });
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

const bulkRemove = (req, res) => {
  const { ids, mode } = req.body;
  const { currentUser } = req;
  let userNotificationQuery;
  let ownerNotificationQuery;
  if (mode === 'all') {
    userNotificationQuery = {
      user: currentUser.id,
    };
    ownerNotificationQuery = {
      owner: currentUser.id,
    };
  } else {
    userNotificationQuery = {
      _id: { $in: ids },
      user: currentUser.id,
    };
    ownerNotificationQuery = {
      _id: { $in: ids },
      owner: currentUser.id,
    };
  }
  Notification.deleteMany(userNotificationQuery)
    .then(async () => {
      Notification.updateMany(ownerNotificationQuery, {
        $pull: { owner: currentUser.id },
      }).catch((err) => {
        console.log(
          'multiple owner notification remove is failed.',
          err.message
        );
      });

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

const getNotificationDetails = async (notifications) => {
  const promise_array = [];

  for (let i = 0; i < notifications.length; i++) {
    const notification = notifications[i];
    let detailNotification;
    let promise;
    let pathField;
    let selectField;
    let trackField;
    switch (notification['criteria']) {
      case 'bulk_sms':
        // TODO: 5 contacts populate for succeed and failed
        promise = new Promise((resolve) => {
          resolve(notification);
        });
        break;
      case 'bulk_email':
        // TODO: 5 contacts populate for succeed and failed
        promise = new Promise((resolve) => {
          resolve(notification);
        });
        break;
      case 'team_invited':
      case 'team_accept':
      case 'team_reject':
      case 'team_requested':
      case 'join_accept':
      case 'join_reject':
        detailNotification = await Notification.findById(notification['_id'])
          .populate({
            path: 'creator',
            select: '_id user_name email cell_phone picture_profile',
          })
          .populate({
            path: 'team',
            select: '_id name picture',
          });
        promise = new Promise((resolve) => {
          resolve(detailNotification);
        });
        break;
      case 'share_automation':
      case 'stop_share_automation':
        detailNotification = await Notification.findById(notification['_id'])
          .populate({
            path: 'creator',
            select: '_id user_name email cell_phone picture_profile',
          })
          .populate({
            path: 'team',
            select: '_id name picture',
          })
          .populate({
            path: 'action.automation',
            select: '_id title',
          });
        promise = new Promise((resolve) => {
          resolve(detailNotification);
        });
        break;
      case 'share_template':
      case 'stop_share_template':
        detailNotification = await Notification.findById(notification['_id'])
          .populate({
            path: 'creator',
            select: '_id user_name email cell_phone picture_profile',
          })
          .populate({
            path: 'team',
            select: '_id name picture',
          })
          .populate({
            path: 'action.template',
            select: '_id title subject',
          });
        promise = new Promise((resolve) => {
          resolve(detailNotification);
        });
        break;
      case 'share_material':
      case 'stop_share_material':
        if (notification.action.object) {
          pathField = 'action.' + notification.action.object;
          detailNotification = await Notification.findById(notification['_id'])
            .populate({
              path: 'creator',
              select: '_id user_name email cell_phone picture_profile',
            })
            .populate({
              path: 'team',
              select: '_id name picture',
            })
            .populate({
              path: pathField,
              select: '_id title preview thumbnail',
            });
          promise = new Promise((resolve) => {
            resolve(detailNotification);
          });
        } else {
          detailNotification = await Notification.findById(notification['_id'])
            .populate({
              path: 'creator',
              select: '_id user_name email cell_phone picture_profile',
            })
            .populate({
              path: 'team',
              select: '_id name picture',
            })
            .populate({
              path: 'action.pdf',
              select: '_id title preview thumbnail',
            })
            .populate({
              path: 'action.video',
              select: '_id title preview thumbnail duration',
            })
            .populate({
              path: 'action.image',
              select: '_id title preview thumbnail',
            })
            .populate({
              path: 'action.folder',
              select: '_id title preview thumbnail',
            });
          promise = new Promise((resolve) => {
            resolve(detailNotification);
          });
        }
        break;
      case 'contact_shared':
      case 'stop_share_contact':
        detailNotification = await Notification.findById(notification['_id'])
          .populate({
            path: 'creator',
            select: '_id user_name email cell_phone picture_profile',
          })
          .populate({
            path: 'team',
            select: '_id name picture',
          })
          .populate({
            path: 'contact',
            select: '_id first_name last_name email cell_phone',
          });
        promise = new Promise((resolve) => {
          resolve(detailNotification);
        });
        break;
      case 'open_email':
      case 'click_link':
      case 'unsubscribe':
        pathField = 'action.' + notification.action.object;
        selectField = '';
        if (notification.action.object === 'email') {
          selectField = '_id subject content';
        } else {
          selectField = '_id title preview thumbnail';
        }
        detailNotification = await Notification.findById(notification['_id'])
          .populate({
            path: 'contact',
            select: '_id first_name last_name email cell_phone',
          })
          .populate({
            path: pathField,
            select: selectField,
          })
          .populate({
            path: 'email_tracker',
          });
        promise = new Promise((resolve) => {
          resolve(detailNotification);
        });
        break;
      case 'material_track':
        pathField = 'action.' + notification.action.object;
        selectField = '';
        trackField = notification.action.object + '_tracker';
        if (notification.action.object === 'email') {
          selectField = '_id subject content';
        } else {
          selectField = '_id title preview thumbnail duration';
        }
        detailNotification = await Notification.findById(notification['_id'])
          .populate({
            path: 'contact',
            select: '_id first_name last_name email cell_phone',
          })
          .populate({
            path: pathField,
            select: selectField,
          })
          .populate({
            path: trackField,
          });
        promise = new Promise((resolve) => {
          resolve(detailNotification);
        });
        break;
      case 'automation_completed':
        detailNotification = await Notification.findById(notification['_id'])
          .populate({
            path: 'contact',
            select: '_id first_name last_name email cell_phone',
          })
          .populate({
            path: 'deal',
            select: '_id title',
          });
        promise = new Promise((resolve) => {
          resolve(detailNotification);
        });
        break;
      default:
        promise = new Promise((resolve) => {
          resolve(notification);
        });
    }
    promise_array.push(promise);
  }

  return Promise.all(promise_array);
};

const getPage = async (req, res) => {
  const { currentUser } = req;
  let { page } = req.params;
  const id = req.query.id;

  if (id) {
    const selectedOne = await Notification.findOne(
      { _id: id },
      { updated_at: 1 }
    ).catch((err) => {
      console.log('selected notification does not exist.', err.message);
    });
    if (!selectedOne && !page) {
      page = 1;
    } else {
      const lastCount = await Notification.countDocuments({
        $or: [
          {
            user: currentUser.id,
          },
          {
            owner: currentUser.id,
          },
        ],
        del: false,
        updated_at: { $gt: selectedOne.updated_at },
      }).catch((err) => {
        console.log('page count could not be got.', err.message);
      });
      if (!lastCount) {
        page = 1;
      } else {
        if (!lastCount % 15) {
          page = lastCount / 15 + 1;
        } else {
          page = Math.ceil(lastCount / 15);
        }
      }
    }
  }

  const notifications = await Notification.find({
    $or: [
      {
        user: currentUser.id,
      },
      {
        owner: currentUser.id,
      },
    ],
    del: false,
  })
    .sort({ updated_at: -1 })
    .skip((page - 1) * 15)
    .limit(15);
  const total = await Notification.countDocuments({
    $or: [
      {
        user: currentUser.id,
      },
      {
        owner: currentUser.id,
      },
    ],
    del: false,
  });

  getNotificationDetails(notifications)
    .then(async (_notifications) => {
      // Automation Detail information catching
      const automationIds = [];
      notifications.forEach((e) => {
        if (e.detail && e.detail.automation) {
          automationIds.push(e.detail.automation);
        }
      });
      const automations = await Automation.find({
        _id: { $in: automationIds },
      })
        .select({ _id: true, title: true })
        .catch((err) => {
          console.log('Getting the running automation is failed.', err);
        });
      const automationObj = {};
      automations.forEach((e) => {
        automationObj[e._id] = e;
      });
      notifications.forEach((e) => {
        if (e.detail && e.detail.automation) {
          e.detail = { ...automationObj[e.detail.automation], ...e.detail };
        }
      });

      return res.json({
        status: true,
        notifications: _notifications,
        total,
        page,
      });
    })
    .catch((err) => {
      console.log('Notifications detail getting is failed', err);
    });
};
const getAll = async (req, res) => {
  const { currentUser } = req;
  const notifications = await Notification.find({
    $or: [
      {
        user: currentUser.id,
      },
      {
        owner: currentUser.id,
      },
    ],
    del: false,
  }).sort({ updated_at: -1 });
  return res.json({
    status: true,
    result: notifications,
  });
};
const loadNotifications = async (req, res) => {
  const { currentUser } = req;
  const skip = parseInt(req.params.skip) || 0;
  const TYPES = [
    'team_invited',
    'team_accept',
    'team_reject',
    'team_requested',
    'join_accept',
    'join_reject',
    'team_remove',
    'team_member_remove',
    'team_role_change',
    'share_automation',
    'stop_share_automation',
    'share_template',
    'stop_share_template',
    'share_material',
    'stop_share_material',
    'contact_shared',
    'stop_share_contact',
    'open_email',
    'click_link',
    'unsubscribe',
    'material_track',
    'dialer_call',
  ];

  const notifications = await Notification.find({
    $or: [
      {
        user: currentUser.id,
      },
      {
        owner: currentUser.id,
      },
    ],
    del: false,
    criteria: { $in: TYPES },
  })
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(15);

  getNotificationDetails(notifications)
    .then(async (_notifications) => {
      // Automation Detail information catching
      const automationIds = [];
      notifications.forEach((e) => {
        if (e.detail && e.detail.automation) {
          automationIds.push(e.detail.automation);
        }
      });
      const automations = await Automation.find({
        _id: { $in: automationIds },
      })
        .select({ _id: true, title: true })
        .catch((err) => {
          console.log('Getting the running automation is failed.', err);
        });
      const automationObj = {};
      automations.forEach((e) => {
        automationObj[e._id] = e;
      });
      notifications.forEach((e) => {
        if (e.detail && e.detail.automation) {
          e.detail = { ...automationObj[e.detail.automation], ...e.detail };
        }
      });

      return res.json({
        status: true,
        notifications: _notifications,
      });
    })
    .catch((err) => {
      console.log('Notifications detail getting is failed', err);
    });
};

const getDelivery = async (req, res) => {
  const { currentUser } = req;
  const sms = await Notification.find({
    user: currentUser.id,
    criteria: 'bulk_sms',
  })
    .populate('contact')
    .catch((err) => {
      console.log('notification find err', err.message);
    });

  return res.send({
    status: true,
    notification: {
      sms,
    },
  });
};

const getStatus = async (req, res) => {
  const { currentUser } = req;

  const Tasks = await Task.aggregate([
    {
      $match: {
        user: currentUser._id,
        type: {
          $in: ['send_text', 'send_email'],
        },
      },
    },
    {
      $group: {
        _id: '$process',
        details: { $last: '$action' },
        tasks: {
          $push: {
            _id: '$_id',
            contacts: '$contacts',
            exec_result: '$exec_result',
            status: '$status',
            updated_at: '$updated_at',
            created_at: '$created_at',
            due_date: '$due_date',
          },
        },
        exp_end: { $last: '$due_date' },
        exp_start: { $first: '$due_date' },
        contacts: { $sum: { $size: '$contacts' } },
        exp_time: { $last: '$due_date' },
        type: { $last: '$type' },
        sort_date: { $last: '$updated_at' },
      },
    },
    { $sort: { sort_date: -1 } },
    { $limit: 6 },
  ]);

  const unreadCount = await Text.countDocuments({
    user: currentUser._id,
    type: 1,
    status: 0,
  }).catch((err) => {
    console.log('received text count getting is failed', err);
  });
  let unreadMessages = [];
  if (unreadCount) {
    unreadMessages = await Text.aggregate([
      {
        $match: {
          user: currentUser._id,
          type: 1,
          status: 0,
        },
      },
      {
        $group: {
          _id: '$contacts',
          content: { $last: '$content' },
          created_at: { $last: '$created_at' },
          updated_at: { $last: '$updated_at' },
          text_id: { $last: '$id' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'contacts',
          localField: '_id',
          foreignField: '_id',
          as: 'contacts',
        },
      },
      {
        $sort: { created_at: -1 },
      },
      {
        $limit: 5,
      },
    ]);
  }

  const response = {
    // emails: emailTasks,
    // texts: textTasks,
    tasks: Tasks,
    unread: unreadCount,
    unreadMessages,
  };

  let notifications = await Notification.find({
    $or: [
      { user: currentUser._id, is_read: false },
      {
        owner: currentUser._id,
        ['read_status.' + currentUser._id]: { $ne: true },
      },
    ],
  })
    .sort({ updated_at: -1 })
    .limit(10)
    .catch((err) => {
      console.log('Getting unread notifications', err);
    });
  if (notifications && notifications.length) {
    response.unreadNotifications = notifications.length;
  } else {
    notifications = await Notification.find({
      $or: [{ user: currentUser._id }, { owner: currentUser._id }],
    })
      .sort({ updated_at: -1 })
      .limit(5)
      .catch((err) => {
        console.log('Getting Latest notifications', err);
      });
    response.unreadNotifications = 0;
  }
  const formatted_notifications = await getNotificationDetails(
    notifications
  ).catch((err) => {
    console.log('Notification Detail getting is failed', err);
  });
  response.notifications = formatted_notifications;

  const system_notifications = await Notification.find({
    type: 'global',
    del: false,
  }).sort({ updated_at: -1 });

  /**
  let v2_announce;
  if (currentUser.user_version === 'v1') {
    v2_announce = {
      content: `<a href="https://app.crmgrow.com">Click here</a> to go back to crmgrow version 1.0. Please register live training for v2 by <a href="https://crmgrow.com/demo">clicking here</a>`,
    };
  } else {
    v2_announce = {
      content: `Welcome to crmgrow! Please register live training for v2 by <a href="https://crmgrow.com/demo">clicking here</a>`,
    };
  }

  if (system_notifications.length === 0) {
    system_notifications = [v2_announce];
  } else {
    system_notifications.push(v2_announce);
  }
   */

  response.system_notifications = system_notifications;

  return res.send(response);
};

/**
 * Load the queued task status or sub task list
 * @param {*} req: request data
 * @param {*} res
 * @returns
 */
const loadQueueTask = async (req, res) => {
  const { currentUser } = req;
  const { id, limit, page, mode, type } = req.body;

  let skip = (page - 1) * limit;
  skip = skip < 0 ? 0 : skip;
  let taskCount;
  let taskStatus;
  let automation;

  if (mode === 'init') {
    taskCount = await Task.countDocuments({
      process: id,
      user: currentUser._id,
    }).catch((err) => {
      console.log('error is failed', err.message);
    });

    if (!taskCount) {
      return res.status(404).send({
        status: false,
        error: 'not_found',
      });
    }

    taskStatus = await Task.aggregate([
      {
        $match: { process: id, user: currentUser._id },
      },
      {
        $sort: { due_date: 1 },
      },
      {
        $group: {
          _id: '$process',
          contacts: {
            $sum: {
              $cond: {
                if: { $in: ['$status', ['active', 'draft']] },
                then: { $size: '$contacts' },
                else: 0,
              },
            },
          },
          failed: {
            $sum: { $size: { $ifNull: ['$exec_result.failed', []] } },
          },
          notExecuted: {
            $sum: { $size: { $ifNull: ['$exec_result.notExecuted', []] } },
          },
          succeed: {
            $sum: { $size: { $ifNull: ['$exec_result.succeed', []] } },
          },
          action: {
            $last: '$action',
          },
          set_recurrence: { $last: '$set_recurrence' },
          source: { $last: '$source' },
          recurrence_mode: { $last: '$recurrence_mode' },
          tasks: { $sum: 1 },
          active: {
            $sum: {
              $cond: {
                if: { $eq: ['$status', 'active'] },
                then: 1,
                else: 0,
              },
            },
          },
          done: {
            $sum: {
              $cond: {
                if: { $in: ['$status', ['done', 'completed']] },
                then: 1,
                else: 0,
              },
            },
          },
          draft: {
            $sum: {
              $cond: {
                if: { $eq: ['$status', 'draft'] },
                then: 1,
                else: 0,
              },
            },
          },
          last_executed: {
            $push: {
              $cond: {
                if: { $in: ['$status', ['done', 'completed']] },
                then: '$due_date',
                else: null,
              },
            },
          },
          next_due_date: {
            $push: {
              $cond: {
                if: { $in: ['$status', ['active', 'draft']] },
                then: '$due_date',
                else: null,
              },
            },
          },
        },
      },
    ]);
    taskStatus = taskStatus && taskStatus.length ? taskStatus[0] : {};
  }

  const tasks = await Task.find({
    process: id,
    user: currentUser._id,
  })
    .select({
      action: false,
    })
    .skip(skip)
    .limit(limit)
    .catch((err) => {
      console.log('error is failed', err.message);
    });

  if (mode === 'init') {
    res.send({
      status: true,
      data: {
        status: taskStatus,
        count: taskCount,
        tasks,
        automation,
      },
    });
  } else {
    res.send({
      status: true,
      data: tasks,
    });
  }
};

const loadEmailQueueContacts = async (req, res) => {
  const { currentUser } = req;
  const { id, limit, page, category, source } = req.body;
  const skip = (page - 1) * limit;
  let contactIds = [];
  let status = [];
  if (source === 'notification') {
    const notification = await Notification.findOne({
      process: id,
    });
    if (notification) {
      if (category === 'all') {
        contactIds = (notification.deliver_status.contacts || []).slice(
          skip,
          skip + limit
        );
      } else if (category === 'failed') {
        status = notification.deliver_status.failed.slice(skip, skip + limit);
        contactIds = status.map(
          (e) => (e.contact && (e.contact._id || e.contact)) || e
        );
        if (notification.deliver_status.errors) {
          status = notification.deliver_status.errors.slice(skip, skip + limit);
        }
      } else if (category === 'delivered') {
        contactIds = notification.deliver_status.succeed.slice(
          skip,
          skip + limit
        );
      } else if (category === 'awaiting') {
        const failed = notification.deliver_status
          ? notification.deliver_status.failed || []
          : [];
        const succeed = notification.deliver_status
          ? notification.deliver_status.succeed || []
          : [];
        const notExecuted = notification.deliver_status
          ? notification.deliver_status.notExecuted || []
          : [];
        const awaiting = _.differenceBy(
          notification.contact,
          [...failed, ...succeed, ...notExecuted],
          (e) => e + ''
        );
        contactIds = awaiting.slice(skip, skip + limit);
      }
    } else {
      return res.send({
        status: false,
        error: 'Notification not found',
      });
    }
  } else {
    let getQuery = {};
    let searchQuery = {};
    if (category === 'all') {
      getQuery = {
        contacts: {
          $push: { $ifNull: ['$contacts', []] },
        },
      };
    } else if (category === 'awaiting') {
      getQuery = {
        contacts: {
          $push: { $ifNull: ['$contacts', []] },
        },
      };
      searchQuery = { status: { $in: ['active', 'draft'] } };
    } else if (category === 'delivered') {
      getQuery = {
        contacts: {
          $push: { $ifNull: ['$exec_result.succeed', []] },
        },
      };
    } else if (category === 'failed') {
      getQuery = {
        contacts: {
          $push: { $ifNull: ['$exec_result.failed', []] },
        },
      };
    }
    const result = await Task.aggregate([
      {
        $match: { process: id, ...searchQuery },
      },
      {
        $group: {
          _id: { process: '$process' },
          ...getQuery,
        },
      },
    ]);
    if (result && result[0]) {
      let contactsData = [];
      (result[0].contacts || []).forEach((contacts) => {
        contactsData = contactsData.concat(contacts);
      });
      if (category === 'failed') {
        status = contactsData;
        contactIds = status.map((e) => e.contact._id);
      } else {
        contactIds = contactsData;
      }
      contactIds = contactIds.slice(skip, skip + limit);
    }
  }
  if (contactIds && contactIds.length) {
    const contacts = await Contact.find({
      _id: { $in: contactIds },
    })
      .populate('last_activity')
      .sort({ first_name: 1 })
      .catch((err) => {
        console.log('contacts loading is failed', err.message);
      });
    return res.send({
      status: true,
      data: {
        contacts,
        status,
      },
    });
  } else {
    return res.send({
      status: true,
    });
  }
};

const loadEmailTaskContacts = async (req, res) => {
  const { currentUser } = req;
  const { process_id, task_id } = req.body;

  const task = await Task.findOne({
    process: process_id,
    _id: task_id,
  }).catch((err) => {
    console.log('Task finding is failed.', err.message);
  });
  if (!task) {
    return res.send({
      status: true,
      data: [],
    });
  } else {
    const contactIds = task.contacts;
    let failed = [];
    let notExecuted = [];
    let succeed = [];
    if (task.status === 'active') {
      if (task.exec_result) {
        failed = task.exec_result.failed || [];
        notExecuted = task.exec_result.notExecuted || [];
        succeed = task.exec_result.succeed || [];
      }
      failed.forEach((e) => {
        if (e.contact && e.contact._id) {
          contactIds.push(e.contact._id);
        }
      });
      notExecuted.forEach((e) => {
        contactIds.push(e);
      });
      succeed.forEach((e) => {
        contactIds.push(e);
      });

      const contacts = await Contact.find({
        _id: { $in: contactIds },
      }).catch((err) => {
        console.log('contacts getting is failed', err.message);
      });
      return res.send({
        status: true,
        data: {
          contacts,
          failed,
          notExecuted,
          succeed,
        },
      });
    } else {
      const contactIds = task.contacts;
      const contacts = await Contact.find({
        _id: { $in: contactIds },
      })
        .populate('last_activity')
        .sort({ first_name: 1 })
        .catch((err) => {
          console.log('contacts loading is failed', err.message);
        });
      return res.send({
        status: true,
        data: {
          contacts,
          ...task.exec_result,
        },
      });
    }
  }
};

const removeEmailTask = async (req, res) => {
  const { currentUser } = req;
  const { process, id, mode } = req.body;

  const selectedTask = await Task.findOne({ _id: id }).catch((err) => {
    console.log('Task finding is failed.', err);
  });
  const contacts = selectedTask.contacts;

  await Task.deleteOne({
    _id: id,
  });

  // Update the notification details
  Notification.updateOne(
    { process },
    { $pull: { contact: { $in: contacts } } }
  ).catch((err) => {
    console.log('Update notification is failed.', err);
  });

  const activeTasksCount = await Task.countDocuments({
    process,
    status: 'active',
  }).catch((err) => {
    console.log('task counting is failed', err.message);
  });
  if (!activeTasksCount) {
    handleEmailTasks(process, currentUser._id);
  }

  return res.send({
    status: true,
  });
};
const removeEmailContact = async (req, res) => {
  const { currentUser } = req;
  const { process, contact } = req.body;

  const task = await Task.findOne({
    status: 'active',
    process,
    contacts: { $in: [contact] },
  }).catch((err) => {
    console.log('task finding is failed', err.message);
  });

  if (task) {
    const pos = task.contacts.indexOf(contact);
    if (pos !== -1 && task.contacts.length === 1) {
      await Task.deleteOne({
        _id: task._id,
      }).catch((err) => {
        console.log('task is deleted', err.message);
      });

      // Update the contact from notification
      Notification.updateOne(
        { process },
        { $pull: { contact: { $in: [contact] } } }
      ).catch((err) => {
        console.log('Update notification is failed.', err);
      });

      const activeTasksCount = await Task.countDocuments({
        process,
        status: 'active',
      }).catch((err) => {
        console.log('task counting is failed', err.message);
      });
      if (!activeTasksCount) {
        handleEmailTasks(process, currentUser._id);
      }
    } else {
      await Task.updateOne(
        {
          _id: task._id,
        },
        {
          $pull: { contacts: { $in: [contact] } },
        }
      ).catch((err) => {
        console.log('task is updated', err.message);
      });

      Notification.updateOne(
        { process },
        { $pull: { contact: { $in: [contact] } } }
      ).catch((err) => {
        console.log('Update notification is failed.', err);
      });
    }
  }

  const activeTasksCount = await Task.countDocuments({
    process,
    status: 'active',
  }).catch((err) => {
    console.log('task counting is failed');
  });
  if (!activeTasksCount) {
    handleEmailTasks(process, currentUser._id, task.action);
  }

  return res.send({
    status: true,
    data: task._id,
  });
};

const handleEmailTasks = async (process, user) => {
  Notification.updateOne({ process }, { $set: { status: 'completed' } }).catch(
    (err) => {
      console.log('update notification with completed mark', err);
    }
  );
  const currentTasks = await Task.countDocuments({ process }).catch((err) => {
    console.log('current tasks count in db', err);
  });
  if (!currentTasks) {
    Notification.deleteMany({ process }).catch((err) => {
      console.log('Task deleting is failed.', err);
    });
  } else {
    Task.deleteMany({ process }).catch((err) => {
      console.log('Task deleting is failed.', err);
    });
  }
};

const makeNotification = (req, res) => {
  const { currentUser } = req;
  createNotification(req.body.type, req.body.notification, currentUser);
  res.send({
    status: true,
  });
};

const loadTasks = async (req, res) => {
  const { currentUser } = req;
  const tasks = await Task.aggregate([
    {
      $match: {
        user: currentUser._id,
        type: {
          $in: ['send_text', 'send_email'],
        },
      },
    },
    {
      $group: {
        _id: '$process',
        details: { $last: '$action' },
        tasks: {
          $push: {
            _id: '$_id',
            contacts: { $size: '$contacts' },
            status: '$status',
            due_date: '$due_date',
          },
        },
        exp_end: { $last: '$due_date' },
        exp_start: { $first: '$due_date' },
        contacts: { $sum: { $size: '$contacts' } },
        type: { $last: '$type' },
        set_recurrence: { $first: '$set_recurrence' },
        recurrence_mode: { $first: '$recurrence_mode' },
        draft: {
          $sum: {
            $cond: {
              if: { $eq: ['$status', 'draft'] },
              then: 1,
              else: 0,
            },
          },
        },
      },
    },
    { $sort: { exp_start: -1 } },
  ]);

  return res.send({
    status: true,
    data: tasks,
  });
};

const loadEmailQueues = async (req, res) => {
  const { currentUser } = req;
  Task.aggregate([
    {
      $match: {
        user: currentUser._id,
        type: 'send_email',
      },
    },
    {
      $group: {
        _id: '$process',
        details: { $last: '$action' },
        tasks: {
          $push: {
            _id: '$_id',
            contacts: '$contacts',
            exec_result: '$exec_result',
            status: '$status',
            updated_at: '$updated_at',
            created_at: '$created_at',
            due_date: '$due_date',
          },
        },
        exp_end: { $last: '$due_date' },
        exp_start: { $first: '$due_date' },
        contacts: { $sum: { $size: '$contacts' } },
      },
    },
  ])
    .then((_data) => {
      return res.send({
        status: true,
        data: _data,
      });
    })
    .catch((err) => {
      console.log('loading email tasks is failed', err);
    });
};

const loadTextQueues = (req, res) => {
  const { currentUser } = req;
  Task.aggregate([
    {
      $match: {
        user: currentUser._id,
        type: { $in: ['bulk_sms', 'send_text'] },
      },
    },
    {
      $group: {
        _id: '$process',
        details: { $last: '$action' },
        tasks: {
          $push: {
            _id: '$_id',
            contacts: '$contacts',
            exec_result: '$exec_result',
            status: '$status',
            updated_at: '$updated_at',
            created_at: '$created_at',
            due_date: '$due_date',
          },
        },
        exp_time: { $last: '$due_date' },
      },
    },
  ])
    .then((_data) => {
      return res.send({
        status: true,
        data: _data,
      });
    })
    .catch((err) => {
      console.log('loading text queue is failed.', err);
    });
};

const loadUnreadTexts = async (req, res) => {
  const { currentUser } = req;
  const unreadCount = await Text.countDocuments({
    user: currentUser._id,
    type: 1,
    status: 0,
  }).catch((err) => {
    console.log('received text count getting is failed', err);
  });
  if (unreadCount) {
    Text.aggregate([
      {
        $match: {
          user: currentUser._id,
          type: 1,
          status: 0,
        },
      },
      {
        $group: {
          _id: '$contacts',
          content: { $last: '$content' },
          created_at: { $last: '$created_at' },
          updated_at: { $last: '$updated_at' },
          text_id: { $last: '$id' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'contacts',
          localField: '_id',
          foreignField: '_id',
          as: 'contacts',
        },
      },
      {
        $sort: { created_at: -1 },
      },
      {
        $limit: 6,
      },
    ])
      .then((_data) => {
        return res.send({
          status: true,
          data: _data,
        });
      })
      .catch((err) => {
        console.log('unread messages loading is failed.', err);
      });
  } else {
    return res.send({
      status: true,
      data: [],
    });
  }
};

// TO REMOVE
const loadAutomationQueues = (req, res) => {
  const { currentUser } = req;
  Task.aggregate([
    {
      $match: {
        user: currentUser._id,
        type: 'assign_automation',
      },
    },
    {
      $group: {
        _id: '$process',
        details: { $last: '$action' },
        tasks: {
          $push: {
            _id: '$_id',
            contacts: '$contacts',
            exec_result: '$exec_result',
            status: '$status',
            updated_at: '$updated_at',
            created_at: '$created_at',
            due_date: '$due_date',
          },
        },
        exp_time: { $last: '$due_date' },
      },
    },
  ])
    .then(async (_data) => {
      const ids = [];
      _data.forEach((e) => {
        if (e.details && (e.details.automation_id || e.details.automation)) {
          ids.push(e.details.automation_id || e.details.automation);
        }
      });
      const automations = await Automation.find({ _id: { $in: ids } })
        .select({ _id: true, title: true })
        .catch((err) => {
          console.log('Getting the running automation is failed.', err);
        });
      return res.send({
        status: true,
        data: _data,
        automations,
      });
    })
    .catch((err) => {
      console.log('loading text queue is failed.', err);
    });
};
// --- End Remove ---

/**
 * Update the task actiond data
 * @param {*} req: action payload, id param (process id)
 * @param {*} res
 */
const updateTaskQueue = (req, res) => {
  const { currentUser } = req;
  const payload = req.body;
  const id = req.params.id;

  const updateQuery = {};
  for (const key in payload) {
    updateQuery['action.' + key] = payload[key];
  }
  Task.updateMany(
    { user: currentUser._id, process: id, status: 'active' },
    { $set: updateQuery }
  )
    .then(() => {
      return res.send({
        status: true,
        data: true,
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
 * Reset the time to another
 * @param {*} req | {id: process id, time: miliseconds to the new scheduled time, payload: additional update data}
 * @param {*} res
 */
const rescheduleTaskQueue = (req, res) => {
  const { currentUser } = req;
  const { id, time, payload } = req.body;

  Task.aggregate([
    {
      $match: {
        user: currentUser._id,
        process: id,
        status: { $in: ['active', 'draft'] },
      },
    },
    {
      $project: { _id: true, due_date: { $add: ['$due_date', time] } },
    },
  ])
    .then((data) => {
      const promises = [];
      for (let i = 0; i < data.length; i++) {
        const promise = new Promise((res, rej) => {
          Task.updateOne(
            { _id: data[i]['_id'] },
            { $set: { due_date: data[i]['due_date'], ...payload } }
          )
            .then(() => {
              res();
            })
            .catch(() => {
              rej();
            });
        });
        promises.push(promise);
      }
      Promise.all(promises).then(() => {
        return res.send({
          status: true,
        });
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
 * Make the task queues as Draft or Active
 * @param {*} req | { id: process id, status: 'active' | 'draft', payload: additional update data }
 * @param {*} res
 */
const updateTaskQueueStatus = (req, res) => {
  const { currentUser } = req;

  const { id, status, payload } = req.body;
  const updateQuery = {
    ...payload,
  };
  if (status) {
    updateQuery['status'] = status;
  }
  Task.updateMany(
    {
      user: currentUser._id,
      process: id,
      status: { $nin: ['done', 'completed'] },
    },
    {
      $set: updateQuery,
    }
  )
    .then(() => {
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

const checkTaskCount = async (req, res) => {
  const { currentUser } = req;
  const taskCount = await Task.countDocuments({
    user: currentUser._id,
    type: {
      $in: ['send_text', 'send_email'],
    },
    status: { $in: ['active', 'draft'] },
    due_date: { $gte: new Date() },
  });
  if (taskCount) {
    return res.send({
      status: true,
      data: true,
    });
  } else {
    const automationCount = await Timeline.countDocuments({
      user: currentUser._id,
      status: 'active',
      due_date: { $gte: new Date() },
    });
    const campaignCount = await CampaignJob.countDocuments({
      user: currentUser._id,
      status: 'active',
      due_date: { $gte: new Date() },
    });
    if (campaignCount || automationCount) {
      return res.send({
        status: true,
        data: true,
      });
    }
  }

  return res.send({
    status: true,
    data: false,
  });
};

const removeTask = (req, res) => {
  const { currentUser } = req;
  const process_id = req.params.id;
  Task.deleteMany({
    process: process_id,
    user: currentUser._id,
  })
    .then(() => {
      return res.send({
        status: true,
        data: true,
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
  create,
  get,
  getPage,
  getAll,
  loadNotifications,
  getDelivery,
  bulkRead,
  bulkUnread,
  bulkRemove,
  getStatus,
  loadQueueTask,
  removeEmailTask,
  removeEmailContact,
  loadEmailQueueContacts,
  loadEmailTaskContacts,
  makeNotification,
  loadEmailQueues,
  loadTextQueues,
  loadAutomationQueues,
  updateTaskQueue,
  rescheduleTaskQueue,
  updateTaskQueueStatus,
  loadUnreadTexts,
  checkTaskCount,
  loadTasks,
  removeTask,
};
