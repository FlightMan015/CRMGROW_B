const moment = require('moment-timezone');
const mongoose = require('mongoose');
const TimeLine = require('../models/time_line');
const Automation = require('../models/automation');
const Contact = require('../models/contact');
const Deal = require('../models/deal');
const Task = require('../models/task');
const Notification = require('../models/notification');
const {
  runTimeline,
  activeNext,
  assignTimeline,
} = require('../helpers/automation');
const system_settings = require('../config/system_settings');
const uuidv1 = require('uuid/v1');
const _ = require('lodash');

const create = async (req, res) => {
  const { currentUser } = req;
  const {
    automation_id,
    contacts: inputContacts,
    deals: inputDeals,
  } = req.body;

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

  if (!currentUser.primary_connected) {
    return res.status(406).json({
      status: false,
      error: 'no connected',
    });
  }

  if (!currentUser['twilio_number']) {
    return res.status(408).json({
      status: false,
      error: 'No phone',
    });
  }

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
      const currentActions = await TimeLine.find({
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
      if (currentActions && currentActions.length) {
        // Split From Here
        last_due = currentActions[0].due_date;
        assignsToTemp = [...assigns];
        assigns = [];
        if (new Date(last_due).getTime() < Date.now()) {
          last_due = new Date();
        }
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
          Math.floor(Math.random() * (CHUNK_COUNT - MIN_CHUNK)) + MIN_CHUNK;

        if (inputContacts) {
          // Order Timeline in future
          assignTimeline({
            user_id: currentUser._id,
            assign_array: assignsToTemp.slice(taskIndex, taskIndex + chunk),
            automation_id,
            required_unique: true,
            scheduled_time: due_date,
          });
        } else {
          // Order Deal Timeline in future
          assignTimeline({
            user_id: currentUser._id,
            assign_array: assignsToTemp.slice(taskIndex, taskIndex + chunk),
            automation_id,
            required_unique: true,
            scheduled_time: due_date,
          });
        }

        taskIndex += chunk;
        const timeIndex = Math.floor(Math.random() * TIME_GAPS.length);
        delay += TIME_GAPS[timeIndex];
      }

      if (!assigns.length) {
        // TO REMOVE
        let notification;

        if (inputContacts) {
          notification = new Notification({
            user: currentUser._id,
            type: 'personal',
            criteria: 'assign_automation',
            status: 'pending',
            process: taskProcessId,
            contact: [...inputData],
            detail: {
              automation: automation_id,
            },
            deliver_status: {
              succeed: [],
              failed: [],
              not_executed: [],
            },
          });
        } else {
          notification = new Notification({
            user: currentUser._id,
            type: 'personal',
            criteria: 'assign_automation',
            status: 'pending',
            process: taskProcessId,
            deal: [...inputData],
            detail: {
              automation: automation_id,
            },
            deliver_status: {
              succeed: [],
              failed: [],
              not_executed: [],
            },
          });
        }
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
        ...req.body,
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
            const failed = error.map((e) => e.contact && e.contact._id);
            const not_executed = [...notRunnedAssignIds];
            const succeed = _.differenceBy(
              assigns,
              [...failed, ...notRunnedAssignIds],
              (e) => e + ''
            );

            let notification;
            if (inputContacts) {
              notification = new Notification({
                user: currentUser._id,
                type: 'personal',
                criteria: 'assign_automation',
                status: 'pending',
                process: taskProcessId,
                contact: [...inputData],
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
            } else {
              notification = new Notification({
                user: currentUser._id,
                type: 'personal',
                criteria: 'assign_automation',
                status: 'pending',
                process: taskProcessId,
                deal: [...inputData],
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
            }

            notification.save().catch((err) => {
              console.log(
                'Bulk assign automation notification creation is failed.',
                err
              );
            });

            let task;

            if (inputContacts) {
              task = new Task({
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
            } else {
              task = new Task({
                user: currentUser._id,
                deals: assigns,
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
            }

            task.save().catch((err) => {
              console.log('Some assign is processed immediately', err);
            });
          }

          if (error.length > 0) {
            return res.status(405).json({
              status: false,
              error,
              notExecuted: notRunnedAssignIds,
            });
          } else {
            return res.send({
              status: true,
            });
          }
        })
        .catch((err) => {
          console.log('bulk automation assigning is failed', err);
          return res.status(500).json({
            status: false,
            error: err,
          });
        });
    }
  } else {
    return res.status(400).json({
      status: false,
      error: 'Automation not found',
    });
  }
};

const cancelContact = (req, res) => {
  const { contact } = req.params;

  TimeLine.deleteMany({
    contact,
    type: { $ne: 'deal' },
    automation: { $ne: null },
  })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    });
};

const recreate = async (req, res) => {
  const { currentUser } = req;
  const { contacts, deals, automation_id, primary_contact } = req.body;

  if (deals) {
    await TimeLine.deleteMany({
      deal: { $in: deals },
      automation: { $ne: null },
    }).catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
  } else {
    await TimeLine.deleteMany({
      contact: contacts[0],
      type: { $ne: 'deal' },
      automation: { $ne: null },
    }).catch((err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    });
  }

  const _automation = await Automation.findOne({ _id: automation_id }).catch(
    (err) => {
      console.log('err', err);
      return res.status(400).json({
        status: false,
        error: err.message || 'Automation found err',
      });
    }
  );

  if (_automation) {
    const { automations } = _automation;
    if (_automation.type === 'contact') {
      for (let i = 0; i < automations.length; i++) {
        const automation = automations[i];
        let time_line;
        if (automation.status === 'active') {
          const { period } = automation;
          const now = moment();
          const due_date = now.add(period, 'hours');
          due_date.set({ second: 0, millisecond: 0 });
          const _time_line = new TimeLine({
            ...automation,
            ref: automation.id,
            parent_ref: automation.parent,
            user: currentUser.id,
            contact: contacts[0],
            automation: automation_id,
            due_date,
            created_at: new Date(),
            updated_at: new Date(),
          });
          _time_line
            .save()
            .then((timeline) => {
              if (timeline.period === 0) {
                try {
                  runTimeline(timeline);
                  const data = {
                    contact: contacts[0],
                    ref: timeline.ref,
                  };
                  activeNext(data);
                } catch (err) {
                  console.log('err', err);
                }
              }
            })
            .catch((err) => {
              console.log('err', err);
            });
        } else {
          time_line = new TimeLine({
            ...automation,
            ref: automation.id,
            parent_ref: automation.parent,
            user: currentUser.id,
            contact: contacts[0],
            automation: automation_id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          time_line.save().catch((err) => {
            console.log('err', err);
          });
        }
      }
    } else {
      for (let i = 0; i < deals.length; i++) {
        const deal = await Deal.findOne({ _id: deals[i] });

        // set primary contact for decision maker.
        if (primary_contact) {
          deal.primary_contact = primary_contact;
          await deal.save();
        }

        for (let j = 0; j < automations.length; j++) {
          const automation = automations[j];
          let time_line;
          if (automation.status === 'active') {
            const { period } = automation;
            const now = moment();
            // let tens = parseInt(now.minutes() / 10)
            // now.set({ minute: tens*10, second: 0, millisecond: 0 })
            now.set({ second: 0, millisecond: 0 });
            const due_date = now.add(period, 'hours');
            due_date.set({ second: 0, millisecond: 0 });

            const _time_line = new TimeLine({
              ...automation,
              type: 'deal',
              ref: automation.id,
              parent_ref: automation.parent,
              user: currentUser.id,
              automation: automation_id,
              deal: deals[i],
              due_date,
            });

            _time_line
              .save()
              .then(async (timeline) => {
                if (timeline.period === 0) {
                  try {
                    runTimeline(timeline);
                    const data = {
                      contact: contacts[i],
                      ref: timeline.ref,
                      deal: deal._id,
                    };
                    activeNext(data);
                  } catch (err) {
                    console.log('err', err);
                  }
                }
              })
              .catch((err) => {
                console.log('err', err);
              });
          } else {
            time_line = new TimeLine({
              ...automation,
              ref: automation.id,
              type: 'deal',
              parent_ref: automation.parent,
              user: currentUser.id,
              deal: deals[i],
              automation: automation_id,
            });
            time_line.save().catch((err) => {
              console.log('err', err);
            });
          }
        }
      }
    }
    return res.send({
      status: true,
    });
  }
  res.status(400).json({
    status: false,
    error: 'Automation not found',
  });
};

const cancelDeal = (req, res) => {
  const { deal } = req.params;
  const { currentUser } = req;

  TimeLine.deleteMany({
    type: 'deal',
    deal,
    user: currentUser.id,
    automation: { $ne: null },
  })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    });
};

const getActiveCount = (req, res) => {
  const { currentUser } = req;
  TimeLine.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(currentUser._id),
      },
    },
    {
      $group: {
        _id: { contact: '$contact' },
      },
    },
    {
      $project: { _id: 1 },
    },
    {
      $count: 'total',
    },
  ])
    .then((_data) => {
      const count = (_data && _data[0] && _data[0]['total']) || 0;
      return res.send({
        status: true,
        data: count,
      });
    })
    .catch((err) => {
      return res.statu(500).send({
        status: false,
        error: err.message || err,
      });
    });
};

const load = (req, res) => {
  const { currentUser } = req;
  const { skip, limit } = req.body;

  TimeLine.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(currentUser._id),
        status: 'active',
      },
    },
    {
      $sort: { due_date: -1 },
    },
    {
      $group: {
        _id: { contact: '$contact' },
        automation: { $first: '$automation' },
        due_date: { $first: '$due_date' },
      },
    },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'contacts',
        localField: '_id.contact',
        foreignField: '_id',
        as: 'contact',
      },
    },
    {
      $lookup: {
        from: 'automations',
        localField: 'automation',
        foreignField: '_id',
        as: 'detail',
      },
    },
    {
      $unwind: '$contact',
    },
    {
      $unwind: '$detail',
    },
    {
      $project: {
        due_date: 1,
        'detail._id': 1,
        'detail.title': 1,
        'contact._id': 1,
        'contact.first_name': 1,
        'contact.last_name': 1,
        'contact.cell_phone': 1,
        'contact.email': 1,
        'contact.label': 1,
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
      return res.status(500).send({
        status: false,
        error: err.message || err,
      });
    });
};

module.exports = {
  create,
  recreate,
  cancelContact,
  cancelDeal,
  getActiveCount,
  load,
};
