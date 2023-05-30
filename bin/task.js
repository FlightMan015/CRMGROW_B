const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const mongoose = require('mongoose');
const CronJob = require('cron').CronJob;
const moment = require('moment-timezone');
const Task = require('../models/task');
const Activity = require('../models/activity');
const FollowUp = require('../models/follow_up');
const Automation = require('../models/automation');
const Notification = require('../models/notification');
const Garbage = require('../models/garbage');
const TimeLine = require('../models/time_line');
const Contact = require('../models/contact');
const Text = require('../models/text');
const User = require('../models/user');
const Deal = require('../models/deal');
const ActivityHelper = require('../helpers/activity');
const EmailHelper = require('../helpers/email');
const { completeFollowup } = require('../helpers/followup');
const TextHelper = require('../helpers/text');
const AutomationHelper = require('../helpers/automation');
const uuidv1 = require('uuid/v1');
const _ = require('lodash');
const { DB_PORT } = require('../config/database');
const {
  AUTOMATION_BRANCH_LIMIT,
  AUTOMATION_ASSIGN_LIMIT,
} = require('../config/system_settings');
// const { createNotification } = require('../helpers/notification');
const { runTimeline, activeNext } = require('../helpers/automation');
const { createCronNotification } = require('../helpers/notificationImpl');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const RECURR_UNITS = {
  DAILY: 'day',
  MONTHLY: 'month',
  YEARLY: 'year',
  WEEKLY: 'week',
};

const onCompleteTask = (
  { _id, process, source, recurrence_mode },
  exec_result
) => {
  Task.countDocuments({
    process,
    status: { $in: ['active', 'draft'] },
    _id: { $ne: _id },
  }).then((_count) => {
    if (_count) {
      Task.updateOne(
        { _id },
        { $set: { status: 'completed', exec_result } }
      ).catch((err) => {
        console.log('complete error', err);
      });
    } else {
      if (source === 'schedule' && recurrence_mode) {
        Task.find({
          process,
        }).then((tasks) => {
          tasks.forEach((e) => {
            const unit = RECURR_UNITS[recurrence_mode];
            const newTime = moment(e.due_date).add(unit, 1);
            e.due_date = newTime;
            e.status = 'active';
            e.save();
          });
        });
      } else {
        Task.deleteMany({ process }).catch((err) => {
          console.log('Delete tasks error: ', err);
        });
      }
    }
  });
};

const task_check = new CronJob(
  '* * * * *',
  async () => {
    const due_date = new Date();
    const tasks = await Task.find({
      status: 'active',
      due_date: { $lte: due_date },
    });
    if (tasks) {
      for (let i = 0; i < tasks.length; i++) {
        const timeline = tasks[i];
        const action = timeline['action'];
        let data;
        if (!action) {
          continue;
        }
        switch (timeline.type) {
          case 'send_email': {
            data = {
              ...action,
              user: timeline.user,
              contacts: timeline.contacts,
            };

            EmailHelper.sendEmail(data)
              .then(async (res) => {
                // Getting task exec status
                const errors = [];
                const succeedContactIds = [];
                let notRunnedContactIds = [];
                const runnedContactIds = [];
                const failedContactIds = [];
                res.forEach((_res) => {
                  if (!_res.status) {
                    errors.push({
                      contact: _res.contact,
                      error: _res.error,
                    });
                    _res.contact &&
                      _res.contact._id &&
                      failedContactIds.push(_res.contact._id);
                  } else {
                    succeedContactIds.push(_res.contact._id);
                  }
                  if (_res.contact && _res.contact._id) {
                    runnedContactIds.push(_res.contact._id);
                  }
                });
                if (res.length !== timeline.contacts.length) {
                  notRunnedContactIds = _.differenceBy(
                    timeline.contacts,
                    runnedContactIds,
                    (e) => e + ''
                  );
                }
                // const data = {
                //   task: timeline.id,
                // };

                // completeFollowup(data);
                // Update tasks

                EmailHelper.updateUserCount(
                  timeline.user,
                  res.length - errors.length
                ).catch((err) => {
                  console.log('Update user email count failed.', err);
                });
                // Current Task Update with the running result
                const exec_result = {
                  failed: [...errors],
                  succeed: succeedContactIds,
                  notExecuted: notRunnedContactIds,
                };
                // Checking the same process tasks, if same doesn't exist, remove all tasks
                const anotherProcessTasks = await Task.find({
                  process: timeline.process,
                  status: 'active',
                  _id: { $nin: [timeline._id] },
                });
                // Task Status Update Handler
                if (anotherProcessTasks && anotherProcessTasks.length) {
                  // Current Task Update command
                  Task.updateOne(
                    { _id: timeline._id },
                    { $set: { status: 'completed', exec_result } }
                  ).catch((err) => {
                    console.log('timeline saving is failed', err.message);
                  });
                } else {
                  // TODO: Notification create for the task completeion
                  if (
                    timeline.source === 'schedule' &&
                    timeline.recurrence_mode
                  ) {
                    // if recurrence tasks, reset the status
                    Task.find({
                      process: timeline.process,
                    }).then((tasks) => {
                      tasks.forEach((e) => {
                        const unit = RECURR_UNITS[timeline.recurrence_mode];
                        const newTime = moment(e.due_date).add(unit, 1);
                        e.due_date = newTime;
                        e.status = 'active';
                        e.save();
                      });
                    });
                  } else {
                    // if schedule or normal send task, remove them
                    Task.deleteMany({ process: timeline.process }).catch(
                      (err) => {
                        console.log('Delete tasks error: ', err);
                      }
                    );
                  }
                }
              })
              .catch((err) => {
                console.log('resolve error', err);
                timeline['status'] = 'error';
                timeline['updated_at'] = new Date();
                timeline.save().catch((err) => {
                  console.log('err', err);
                });
              });
            break;
          }
          case 'send_text': {
            data = {
              ...action,
              user: timeline.user,
              contacts: timeline.contacts,
            };

            TextHelper.sendText(data)
              .then(async (_res) => {
                let sentCount = 0;
                const errors = [];
                const succeed = [];
                const failed = [];
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
                  if (invalidContacts.length === timeline.contacts.length) {
                    Text.deleteOne({ _id: textResult[0]['text'] }).catch(
                      (err) => {
                        console.log('remove texting is failed', err);
                      }
                    );
                  } else {
                    Text.updateOne({ _id: textResult[0]['text'] }, query).catch(
                      (err) => {
                        console.log('texting result saving is failed', err);
                      }
                    );
                  }
                }

                const contacts = timeline.contacts;
                const textProcessId = new Date().getTime() + '_' + uuidv1();

                if (contacts.length && contacts.length > 1) {
                  // Notification for bulk sms create
                  const notification = new Notification({
                    user: timeline.user,
                    type: 'personal',
                    criteria: 'bulk_text',
                    status: 'pending',
                    process: textProcessId,
                    contact: [...contacts],
                    detail: {
                      video_ids: data.video_ids || [],
                      pdf_ids: data.video_ids || [],
                      image_ids: data.video_ids || [],
                      content: data.content,
                    },
                    deliver_status: {
                      succeed,
                      errors,
                      failed,
                    },
                  });
                  notification.save().catch((err) => {
                    console.log(
                      'Bulk Email notification creation is failed.',
                      err
                    );
                  });
                }

                // const data = {
                //   task: timeline.id,
                // };

                // completeFollowup(data);

                if (sentCount) {
                  TextHelper.updateUserTextCount(
                    timeline.user,
                    sentCount
                  ).catch((err) => {
                    console.log('update user text info is failed.', err);
                  });
                }

                onCompleteTask(timeline, {
                  succeed,
                  errors,
                  failed,
                });
              })
              .catch((err) => {
                console.log('Sending SMS error', err);
              });
            break;
          }
          case 'bulk_sms': {
            const { message_sid, service, activities, activity, text, tasks } =
              timeline.action;
            TextHelper.getStatus(message_sid, service)
              .then(async (res) => {
                const succeed = [];
                const failed = [];
                const errors = [];
                const updateQuery = { $set: {} };
                if (res.status === 'delivered') {
                  TextHelper.handleDeliveredText(
                    timeline.contacts[0],
                    activities,
                    activity,
                    text
                  );
                  TextHelper.updateDeliverStatus(text, timeline.contacts[0], 2);
                  updateQuery['$set']['status'] = 'delivered';
                  succeed.push(timeline.contacts[0]);
                } else if (res.status === 'sent') {
                  const beginning_time = moment(timeline.due_date).add(
                    3,
                    'minutes'
                  );
                  const now = moment();
                  if (beginning_time.isBefore(now)) {
                    TextHelper.handleFailedText(
                      activities,
                      activity,
                      text,
                      3,
                      tasks || []
                    );
                    TextHelper.updateDeliverStatus(
                      text,
                      timeline.contacts[0],
                      3
                    );

                    updateQuery['$set']['status'] = 'sent';
                    updateQuery['$set']['exec_result'] = {
                      description:
                        res.errorMessage ||
                        'Could`t get delivery result from carrier',
                      content: 'Failed texting material',
                      status: 'sent',
                    };

                    failed.push(timeline.contacts[0]);
                    errors.push({
                      contact: { _id: timeline.contacts[0] },
                      error:
                        res.errorMessage ||
                        'Could`t get delivery result from carrier',
                    });
                  }
                } else if (
                  res.status === 'undelivered' ||
                  res.status === 'failed'
                ) {
                  TextHelper.handleFailedText(
                    activities,
                    activity,
                    text,
                    4,
                    tasks || []
                  );
                  TextHelper.updateDeliverStatus(text, timeline.contacts[0], 4);
                  updateQuery['$set']['status'] = 'failed';
                  updateQuery['$set']['exec_result'] = {
                    description:
                      res.errorMessage ||
                      'Could`t get delivery result from carrier',
                    content: 'Failed texting material',
                    status: 'failed',
                  };
                  failed.push(timeline.contacts[0]);
                  errors.push({
                    contact: { _id: timeline.contacts[0] },
                    error:
                      res.errorMessage ||
                      'Could`t get delivery result from carrier',
                  });
                }

                await Task.updateOne({ _id: timeline._id }, updateQuery).catch(
                  (err) => {
                    console.log('Fail: texting check update is failed', err);
                  }
                );
                Notification.updateOne(
                  { process: timeline.process },
                  {
                    $push: {
                      'deliver_status.succeed': { $each: succeed },
                      'deliver_status.errors': { $each: errors },
                      'deliver_status.failed': { $each: failed },
                    },
                  }
                )
                  .then(() => {
                    createCronNotification(
                      'bulk_text_progress',
                      {
                        process: timeline.process,
                      },
                      { _id: timeline.user }
                    );
                  })
                  .catch((err) => {
                    console.log('Fail: update the task running result', err);
                  });
                Task.find({
                  process: timeline.process,
                  status: 'active',
                })
                  .then((_tasks) => {
                    if (!_tasks.length) {
                      Task.deleteMany({
                        process: timeline.process,
                      }).catch((err) => {
                        console.log(
                          'Bulk texting tasks removing is failed',
                          err
                        );
                      });
                      Notification.updateOne(
                        { process: timeline.process },
                        {
                          $set: {
                            status: 'completed',
                          },
                        }
                      )
                        .then(() => {
                          createCronNotification(
                            'bulk_text',
                            {
                              process: timeline.process,
                            },
                            { _id: timeline.user }
                          );
                        })
                        .catch((err) => {
                          console.log(
                            'Fail: update notifications as completed',
                            err
                          );
                        });
                    }
                  })
                  .catch((err) => {
                    console.log('Same process are failed.', err);
                  });
              })
              .catch((err) => {
                console.log('Getting SMS Status is failed', err);
              });
            break;
          }
          case 'auto_follow_up1':
          case 'auto_follow_up2': {
            let follow_due_date;
            if (action.due_date) {
              follow_due_date = action.due_date;
            } else {
              const now = moment();
              now.set({ second: 0, millisecond: 0 });
              follow_due_date = now.add(action.due_duration, 'hours');
              follow_due_date.set({ second: 0, millisecond: 0 });
            }

            const garbage = await Garbage.findOne({
              user: timeline.user,
            }).catch((err) => {
              console.log('err', err);
            });
            let reminder_before = 30;
            if (garbage) {
              reminder_before = garbage.reminder_before;
            }
            const startdate = moment(follow_due_date);
            const remind_at = startdate.subtract(reminder_before, 'mins');

            const followUp = new FollowUp({
              content: action.content,
              contact: timeline.contact,
              user: timeline.user,
              type: action.task_type,
              due_date: follow_due_date,
              remind_at,
            });

            followUp
              .save()
              .then(async (_followup) => {
                let detail_content = 'added task';
                detail_content = ActivityHelper.automationLog(detail_content);
                const activity = new Activity({
                  content: detail_content,
                  contacts: _followup.contact,
                  user: timeline.user,
                  type: 'follow_ups',
                  follow_ups: _followup.id,
                });

                activity
                  .save()
                  .then((_activity) => {
                    timeline['status'] = 'completed';
                    timeline['updated_at'] = new Date();
                    timeline.save().catch((err) => {
                      console.log('err', err);
                    });
                    Contact.updateOne(
                      { _id: _followup.contact },
                      { $set: { last_activity: _activity.id } }
                    ).catch((err) => {
                      console.log('contact update err', err.message);
                    });
                  })
                  .catch((err) => {
                    console.log('follow error', err.message);
                  });

                TimeLine.updateMany(
                  {
                    contact: timeline.contact,
                    'action.ref_id': timeline.ref,
                  },
                  {
                    $set: { 'action.follow_up': _followup.id },
                  }
                )
                  .then(() => {
                    console.log('follow up updated');
                  })
                  .catch((err) => {
                    console.log('follow error', err.message);
                  });
              })
              .catch((err) => {
                timeline['status'] = 'error';
                timeline['updated_at'] = new Date();
                timeline.save().catch((err) => {
                  console.log('err', err.message);
                });
                console.log('follow error', err.message);
              });
            break;
          }
          case 'resend_email_video1':
            data = {
              user: timeline.user,
              content: action.content,
              subject: action.subject,
              activity: action.activity,
              video: action.video,
              contact: timeline.contacts[0],
            };

            EmailHelper.resendVideo(data)
              .then((res) => {
                if (res.status) {
                  console.log('Resend Video is successed.');
                  Task.deleteOne({
                    _id: timeline.id,
                  }).catch((err) => {
                    console.log('timeline remove err', err.message);
                  });
                } else {
                  console.log('Resend video is failed', res);
                  Task.updateOne(
                    {
                      _id: timeline.id,
                    },
                    {
                      $set: {
                        exec_result: res,
                        status: 'failed',
                      },
                    }
                  ).catch((err) => {
                    console.log('timeline remove err', err.message);
                  });
                }
              })
              .catch((err) => {
                console.log('email resend video err', err.message);
              });
            break;
          case 'resend_text_video1':
            data = {
              user: timeline.user,
              content: action.content,
              activity: action.activity,
              video: action.video,
              contact: timeline.contacts[0],
            };
            TextHelper.resendVideo(data)
              .then((res) => {
                console.log(res);
                if (res.status) {
                  console.log('resend text video(watch case) is successed');
                  Task.deleteOne({
                    _id: timeline.id,
                  }).catch((err) => {
                    console.log('timeline remove err', err.message);
                  });
                  TextHelper.updateUserTextCount(timeline.user, 1).catch(
                    (err) => {
                      console.log('update user text info is failed.', err);
                    }
                  );
                } else {
                  console.log('resend text video(unwatched case) is failed');
                  Task.updateOne(
                    {
                      _id: timeline.id,
                    },
                    {
                      $set: {
                        exec_result: res,
                        status: 'failed',
                      },
                    }
                  ).catch((err) => {
                    console.log('timeline remove err', err.message);
                  });
                }
              })
              .catch((err) => {
                console.log('text resend video err', err.message);
              });
            break;
          case 'resend_email_video2':
            data = {
              user: timeline.user,
              content: action.content,
              subject: action.subject,
              activity: action.activity,
              video: action.video,
              contact: timeline.contacts[0],
            };

            EmailHelper.resendVideo(data)
              .then((res) => {
                if (res.status) {
                  console.log('resend video(unwatched case) is successed');
                  Task.deleteOne({
                    _id: timeline.id,
                  }).catch((err) => {
                    console.log('timeline remove err', err.message);
                  });
                } else {
                  console.log('resend video(unwatched case) is failed');
                  Task.updateOne(
                    {
                      _id: timeline.id,
                    },
                    {
                      $set: {
                        exec_result: res,
                        status: 'failed',
                      },
                    }
                  ).catch((err) => {
                    console.log('timeline remove err', err.message);
                  });
                }
              })
              .catch((err) => {
                console.log('email resend video err', err.message);
              });
            break;
          case 'resend_text_video2':
            data = {
              user: timeline.user,
              content: action.content,
              activity: action.activity,
              video: action.video,
              contact: timeline.contacts[0],
            };
            TextHelper.resendVideo(data)
              .then((res) => {
                if (res.status) {
                  console.log('resend text video(unwatched case) is successed');
                  Task.deleteOne({
                    _id: timeline.id,
                  }).catch((err) => {
                    console.log('timeline remove err', err.message);
                  });
                  TextHelper.updateUserTextCount(timeline.user, 1).catch(
                    (err) => {
                      console.log('update user text info is failed.', err);
                    }
                  );
                } else {
                  console.log('resend text video(unwatched case) is failed');
                  Task.updateOne(
                    {
                      _id: timeline.id,
                    },
                    {
                      $set: {
                        exec_result: res,
                        status: 'failed',
                      },
                    }
                  ).catch((err) => {
                    console.log('timeline remove err', err.message);
                  });
                }
              })
              .catch((err) => {
                console.log('text resend video err', err.message);
              });
            break;
          case 'assign_automation':
            if (tasks[i] && tasks[i].action) {
              const data = {
                user_id: tasks[i].user,
                assign_array: tasks[i].contacts,
                automation_id: tasks[i].action.automation_id,
                required_unique: tasks[i].action.required_unique,
              };
              AutomationHelper.assignTimeline(data)
                .then(async (result) => {
                  const errors = [];
                  const succeedContactIds = [];
                  const runnedContactIds = [];
                  const failedContactIds = [];
                  let notRunnedContactIds = [];
                  result.forEach((_res) => {
                    if (!_res.status) {
                      errors.push({
                        contact: _res.contact,
                        error: _res.error,
                        type: _res.type,
                      });
                      _res.contact &&
                        _res.contact._id &&
                        failedContactIds.push(_res.contact._id);
                    } else {
                      _res.contact &&
                        _res.contact._id &&
                        succeedContactIds.push(_res.contact._id);
                    }
                    _res.contact &&
                      _res.contact._id &&
                      runnedContactIds.push(_res.contact._id);
                  });

                  if (result.length !== timeline.contacts.length) {
                    notRunnedContactIds = _.differenceBy(
                      timeline.contacts,
                      runnedContactIds,
                      (e) => e + ''
                    );
                  }

                  // TODO: Update the assign automation limit
                  // Current Task Update with the running result
                  const exec_result = {
                    failed: [...errors],
                    succeed: succeedContactIds,
                    notExecuted: notRunnedContactIds,
                  };
                  // Notification Update with the running result
                  Notification.updateOne(
                    { process: timeline.process },
                    {
                      $push: {
                        'deliver_status.succeed': { $each: succeedContactIds },
                        'deliver_status.errors': { $each: errors },
                        'deliver_status.failed': { $each: failedContactIds },
                        'deliver_status.not_executed': {
                          $each: notRunnedContactIds,
                        },
                      },
                    }
                  ).catch((err) => {
                    console.log('Fail: update the task running result', err);
                  });
                  // Checking the current processing tasks, and remove
                  const anotherProcessTasks = await Task.find({
                    process: timeline.process,
                    status: 'active',
                    _id: { $nin: [timeline._id] },
                  });
                  // Task Status Update Handler
                  if (anotherProcessTasks && anotherProcessTasks.length) {
                    // Current Task Update command
                    Task.updateOne(
                      { _id: timeline._id },
                      { $set: { status: 'completed', exec_result } }
                    ).catch((err) => {
                      console.log('timeline saving is failed', err.message);
                    });
                    // Emit to update the queue status to the users
                    createCronNotification(
                      'assign_automation_progress',
                      {
                        process: timeline.process,
                      },
                      { _id: timeline.user }
                    );
                  } else {
                    Task.deleteMany({ process: timeline.process }).catch(
                      (err) => {
                        console.log('Delete tasks error: ', err);
                      }
                    );
                    Notification.updateOne(
                      { process: timeline.process },
                      {
                        $set: {
                          status: 'completed',
                        },
                      }
                    )
                      .then(() => {
                        // Emit to display this notification to the users
                        createCronNotification(
                          'assign_automation',
                          {
                            process: timeline.process,
                          },
                          { _id: timeline.user }
                        );
                      })
                      .catch((err) => {
                        console.log(
                          'Fail: update notifications as completed',
                          err
                        );
                      });
                  }
                })
                .catch((err) => {
                  console.log('bulk automation assigning is failed', err);
                });
            }
        }

        if (timeline.set_recurrence) {
          const today = moment(timeline.due_date);
          let update_date;

          switch (timeline.recurrence_mode) {
            case 'DAILY': {
              update_date = today.add(1, 'days');
              break;
            }
            case 'WEEKLY': {
              update_date = today.add(7, 'days');
              break;
            }
            case 'MONTHLY': {
              update_date = today.add(1, 'months');
              break;
            }
            case 'YEARLY': {
              update_date = today.add(1, 'years');
              break;
            }
          }

          Task.updateOne(
            {
              _id: tasks[i].id,
            },
            {
              $set: { due_date: update_date },
            }
          ).catch((err) => {
            console.log('task update error', err.message);
          });
        } else {
          Task.updateOne(
            {
              _id: tasks[i].id,
            },
            {
              $set: { status: 'completed' },
            }
          ).catch((err) => {
            console.log('task update error', err.message);
          });
        }
      }
    }
  },
  () => {
    console.log('Task check Job finished.');
  },
  false,
  'US/Central'
);

task_check.start();
