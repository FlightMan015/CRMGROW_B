const moment = require('moment-timezone');
const { google } = require('googleapis');

const api = require('../config/api');
const urls = require('../constants/urls');
const system_settings = require('../config/system_settings');
const Appointment = require('../models/appointment');
const Activity = require('../models/activity');
const User = require('../models/user');
const Contact = require('../models/contact');
const EventType = require('../models/event_type');
const {
  addOutlookCalendarById,
  addGoogleCalendarById,
  googleCalendarList,
  outlookCalendarList,
  getCalendarListByUser,
} = require('./appointment');
const graph = require('@microsoft/microsoft-graph-client');

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};
const { assignTimeline } = require('../helpers/automation');
const oauth2 = require('simple-oauth2')(credentials);
const { sendNotificationEmail } = require('../helpers/email');
const Garbage = require('../models/garbage');

const create = async (req, res) => {
  const { user_id, event_type: event_type_id, due_start } = req.body;

  const currentUser = await User.findOne({ _id: user_id });

  if (currentUser) {
    const { scheduler_info } = currentUser;

    if (scheduler_info && scheduler_info.is_enabled) {
      if (
        currentUser.calendar_connected &&
        currentUser.calendar_list.length > 0
      ) {
        let event_id;
        let recurrence_id;
        const data = { user_id, event_type_id, date: due_start };

        checkConflict(data)
          .then(async (response) => {
            if (!response || !response.status) {
              return res.status(400).json({
                status: false,
                error: response.error,
              });
            }

            const _appointment = req.body;
            let { connected_email, calendar_id } = scheduler_info;
            let calendar;
            const calendar_list = currentUser.calendar_list;
            calendar = calendar_list[0];
            let found_calender = false;

            if (calendar_id) {
              calendar_list.some((_calendar) => {
                if (_calendar.connected_email === connected_email) {
                  calendar = _calendar;
                  found_calender = true;
                  return true;
                }
              });
            }

            if (!found_calender || !calendar_id) {
              const calender_list = await getCalendarListByUser(currentUser.id);
              calendar_id = calender_list.data[0]
                ? calender_list.data[0]['calendar_id']
                : null;
              connected_email = calender_list.data[0]
                ? calender_list.data[0]['email']
                : null;

              if (calendar_id) {
                User.updateOne(
                  { _id: currentUser.id },
                  {
                    $set: {
                      'scheduler_info.connected_email': connected_email,
                      'scheduler_info.calendar_id': calendar_id,
                    },
                  }
                ).catch((err) => {
                  console.log('user update err', err.message);
                });
              }
            }

            if (calendar_id) {
              if (calendar.connected_calendar_type === 'outlook') {
                const { new_event_id, new_recurrence_id } =
                  await addOutlookCalendarById(
                    _appointment,
                    calendar,
                    calendar_id
                  );
                event_id = new_event_id;
                recurrence_id = new_recurrence_id;
              } else if (calendar.connected_calendar_type === 'google') {
                const token = JSON.parse(calendar.google_refresh_token);

                const { new_event_id, new_recurrence_id } =
                  await addGoogleCalendarById(
                    token.refresh_token,
                    _appointment,
                    calendar_id
                  );
                event_id = new_event_id;
                recurrence_id = new_recurrence_id;
              }
            }

            try {
              const data = {
                appointment: req.body,
                user: user_id,
                event_type_id,
                event_id,
                recurrence_id,
              };

              leadContactByScheduler(data);

              return res.send({
                status: true,
              });
            } catch (err) {
              return res.status(400).json({
                status: false,
                error: err,
              });
            }
          })
          .catch((err) => {
            console.log('err occured', err);
            return res.status(400).json({
              status: false,
              error: err,
            });
          });
      } else {
        try {
          const data = {
            appointment: req.body,
            user: user_id,
            event_type_id,
          };

          leadContactByScheduler(data);

          return res.send({
            status: true,
          });
        } catch (err) {
          return res.status(400).json({
            status: false,
            error: err,
          });
        }
      }
    } else {
      return res.status(407).json({
        status: false,
        error: 'You must connect gmail/outlook',
      });
    }
  } else {
    return res.status(407).json({
      status: false,
      error: 'Invalid user',
    });
  }
};

const loadConflicts = async (req, res) => {
  const { date, user_id } = req.body;
  const mode = 'month';

  const currentUser = await User.findOne({
    _id: user_id,
    del: false,
  });

  if (
    currentUser &&
    currentUser.calendar_connected &&
    currentUser.calendar_list
  ) {
    const { calendar_list } = currentUser;
    const promise_array = [];

    for (let i = 0; i < calendar_list.length; i++) {
      const {
        connected_calendar_type,
        connected_email,
        check_conflict_scheduler,
      } = calendar_list[i];

      if (check_conflict_scheduler !== false) {
        if (connected_calendar_type === 'outlook') {
          let accessToken;
          const { outlook_refresh_token } = calendar_list[i];
          const token = oauth2.accessToken.create({
            refresh_token: outlook_refresh_token,
            expires_in: 0,
          });

          await new Promise((resolve, reject) => {
            token.refresh(function (error, result) {
              if (error) {
                reject(error);
              } else {
                resolve(result.token);
              }
            });
          })
            .then((token) => {
              accessToken = token.access_token;
            })
            .catch((error) => {
              console.log('error', error);
            });

          if (!accessToken) {
            promise_array.push(
              new Promise((resolve, reject) => {
                resolve({
                  status: false,
                  error: connected_email,
                });
              })
            );
            continue;
          }

          const client = graph.Client.init({
            // Use the provided access token to authenticate
            // requests
            authProvider: (done) => {
              done(null, accessToken);
            },
          });

          const due_end = moment(date).add(1, `${mode}s`);
          const calendar_data = {
            client,
            connected_email,
            due_start: moment(date).toDate(),
            due_end: due_end.toDate(),
          };

          const outlook_calendar = outlookCalendarList(calendar_data);
          promise_array.push(outlook_calendar);
        } else {
          const oauth2Client = new google.auth.OAuth2(
            api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
            api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
            urls.GMAIL_AUTHORIZE_URL
          );

          const calendar = calendar_list[i];
          const { google_refresh_token } = calendar;
          const token = JSON.parse(google_refresh_token);
          oauth2Client.setCredentials({ refresh_token: token.refresh_token });
          const due_end = moment(date).add(1, `${mode}s`);
          const calendar_data = {
            auth: oauth2Client,
            due_start: moment(date).toDate(),
            due_end: due_end.toDate(),
            connected_email,
          };

          const google_calendar = googleCalendarList(calendar_data);
          promise_array.push(google_calendar);
        }
      }
    }

    Promise.all(promise_array)
      .then((data) => {
        return res.send({
          status: true,
          data,
        });
      })
      .catch((err) => {
        return res.status(400).json({
          status: false,
        });
      });
  } else {
    return res.send({
      status: true,
      data: [],
    });
  }
};

const loadEvents = async (req, res) => {
  const { searchOption, user_id } = req.body;

  const currentUser = await User.findOne({ _id: user_id, del: false });

  const count = req.body.count || 20;
  const skip = req.body.skip || 0;

  if (!currentUser) {
    return res.status(400).json({
      status: false,
      error: 'User disabled',
    });
  }
  if (searchOption) {
    const { event_type, due_start, due_end } = searchOption;
    const query = {};
    if (Array.isArray(event_type) && event_type.length) {
      query.event_type = { $in: event_type };
    }

    if (due_end) {
      query.due_end = { $lte: new Date(due_end) };
    }

    if (due_start) {
      query.due_start = { $gte: new Date(due_start) };
    }

    const appointments = await Appointment.find({
      user: currentUser.id,
      type: 2,
      ...query,
    })
      .skip(skip)
      .limit(count)
      .populate('contacts')
      .populate('event_type');

    const total = await Appointment.find({
      user: currentUser.id,
      type: 2,
      ...query,
    }).count();

    return res.send({
      status: true,
      data: appointments,
      total,
    });
  } else {
    const appointments = await Appointment.find({
      user: currentUser.id,
      type: 2,
    })
      .populate('contacts')
      .skip(skip)
      .limit(count);

    const total = await Appointment.find({
      user: currentUser.id,
      type: 2,
    }).count();

    return res.send({
      status: true,
      data: appointments,
      total,
    });
  }
};

const checkConflict = async (data) => {
  const { user_id, event_type_id, date } = data;

  const event_type = await EventType.findOne({ _id: event_type_id });

  if (!event_type) {
    return Promise((resolve) => {
      resolve({
        status: false,
        error: 'invalid event type',
      });
    });
  }

  let due_start = date;
  let due_end = moment(date).add(event_type.duration, `minutes`);

  const { start, end } = event_type.gap;
  if (start.available) {
    due_start = moment(date).subtract(start.value, 'minutes');
  }

  if (end.available) {
    due_end = moment(due_end).add(end.value, 'minutes');
  }

  const currentUser = await User.findOne({ _id: user_id });
  const { calendar_list } = currentUser;
  const promise_array = [];

  for (let i = 0; i < calendar_list.length; i++) {
    const {
      connected_calendar_type,
      connected_email,
      check_conflict_scheduler,
    } = calendar_list[i];

    if (check_conflict_scheduler !== false) {
      if (connected_calendar_type === 'outlook') {
        let accessToken;
        const { outlook_refresh_token } = calendar_list[i];
        const token = oauth2.accessToken.create({
          refresh_token: outlook_refresh_token,
          expires_in: 0,
        });

        await new Promise((resolve, reject) => {
          token.refresh(function (error, result) {
            if (error) {
              reject(error);
            } else {
              resolve(result.token);
            }
          });
        })
          .then((token) => {
            accessToken = token.access_token;
          })
          .catch((error) => {
            console.log('error', error);
          });

        if (!accessToken) {
          promise_array.push(
            new Promise((resolve, reject) => {
              resolve({
                status: false,
                error: connected_email,
              });
            })
          );
          continue;
        }

        const client = graph.Client.init({
          // Use the provided access token to authenticate
          // requests
          authProvider: (done) => {
            done(null, accessToken);
          },
        });

        const calendar_data = {
          client,
          connected_email,
          due_start: moment(due_start).toDate(),
          due_end: moment(due_end).toDate(),
        };

        const outlook_calendar = outlookCalendarList(calendar_data);
        promise_array.push(outlook_calendar);
      } else {
        const oauth2Client = new google.auth.OAuth2(
          api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
          api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
          urls.GMAIL_AUTHORIZE_URL
        );

        const calendar = calendar_list[i];
        const { google_refresh_token } = calendar;
        const token = JSON.parse(google_refresh_token);
        oauth2Client.setCredentials({ refresh_token: token.refresh_token });

        const calendar_data = {
          auth: oauth2Client,
          due_start: moment(due_start).toDate(),
          due_end: moment(due_end).toDate(),
          connected_email,
        };

        const google_calendar = googleCalendarList(calendar_data);
        promise_array.push(google_calendar);
      }
    }
  }

  return new Promise((resolve) => {
    Promise.all(promise_array)
      .then(async (response_array) => {
        if (response_array.length > 0) {
          let scheduled = false;
          response_array.some((response) => {
            if (response.status) {
              const events = response.calendar ? response.calendar.data : [];
              if (events.length) {
                events.some((event) => {
                  const { items } = event;
                  if (items.length > 0) {
                    scheduled = true;
                    return true;
                  }
                });
              }
            }
          });

          if (!scheduled) {
            return resolve({
              status: true,
            });
          }

          if (event_type['type'] === 2) {
            const event = await Appointment.findOne({
              event_type: event_type_id,
              due_start: date,
              type: 2,
            });
            if (event) {
              return resolve({ status: true });
            } else {
              return resolve({
                status: false,
                error: 'another meeting time busy',
              });
            }
          } else {
            return resolve({
              status: false,
              error: 'another meeting time busy',
            });
          }
        } else {
          return resolve({
            status: true,
          });
        }
      })
      .catch((err) => {
        console.log('check event err', err);
        return resolve({
          status: false,
          error: 'check event err',
        });
      });
  });
};

const leadContactByScheduler = async (data) => {
  const { appointment, user, event_type_id, event_id, recurrence_id } = data;

  const currentUser = await User.findOne({ _id: user });
  // adding contact
  let contact = await Contact.findOne({
    email: appointment.email,
    user,
  });

  const event_type = await EventType.findOne({
    _id: event_type_id,
  }).catch((err) => {
    console.log('event type get err', err.message);
  });
  const tags = event_type.tags || ['schedulerlead'];

  if (!contact) {
    contact = new Contact({
      first_name: appointment.full_name.split(' ')[0],
      last_name: appointment.full_name.split(' ')[1] || '',
      email: appointment.email,
      tags,
      user,
      cell_phone: appointment.phone_number
        ? appointment.phone_number
        : undefined,
    });
    contact.save().catch((err) => {
      console.log('contact save err', err.message);
    });
  } else {
    Contact.updateOne(
      {
        _id: contact.id,
      },
      {
        $addToSet: { tags: { $each: tags } },
      }
    ).catch((err) => {
      console.log('contact update schedulerlead err', err.message);
    });
  }

  const garbage = await Garbage.findOne({ user }).catch((err) => {
    console.log('garbage find err', err.message);
  });
  let reminder_scheduler = 30;
  if (garbage) {
    reminder_scheduler = garbage.reminder_scheduler;
  }
  const remind_at = moment(appointment.due_start)
    .clone()
    .subtract(reminder_scheduler, 'minutes');

  const _appointment = new Appointment({
    ...appointment,
    contacts: contact.id,
    user,
    type: 2,
    event_type: event_type_id,
    event_id,
    recurrence_id,
    remind_at,
  });

  _appointment.save().catch((err) => {
    console.log('appointment save err', err.message);
  });

  const activity = new Activity({
    content: 'scheduled meeting',
    contacts: contact.id,
    appointments: _appointment.id,
    user,
    type: 'appointments',
  });

  activity.save().then((_activity) => {
    Contact.updateOne(
      {
        _id: contact.id,
      },
      {
        $set: { last_activity: _activity.id },
      }
    ).catch((err) => {
      console.log('err', err);
    });
  });

  if (event_type['automation']) {
    let multiple_by = 1;
    switch (event_type['auto_trigger_time']) {
      case 'days':
        multiple_by = 60 * 24;
        break;
      case 'hours':
        multiple_by = 60;
        break;
    }

    const trigger_duration_minutes =
      event_type['auto_trigger_duration'] * multiple_by;
    let custom_period = 0;
    switch (event_type['auto_trigger_type']) {
      case '1':
        custom_period = trigger_duration_minutes;
        break;
      case '2':
        custom_period =
          moment(appointment['due_start']).diff(moment(), 'minutes') -
          trigger_duration_minutes;
        break;
      case '3':
        custom_period =
          moment(appointment['due_start']).diff(moment(), 'minutes') +
          trigger_duration_minutes;
        break;
      case '4':
        custom_period =
          moment(appointment['due_end']).diff(moment(), 'minutes') +
          trigger_duration_minutes;
        break;
    }

    const timeline_data = {
      assign_array: [contact.id],
      automation_id: event_type['automation'],
      user_id: user,
      required_unique: true,
      custom_period,
    };

    assignTimeline(timeline_data)
      .then((_res) => {
        if (!_res[0].status) {
          console.log('automation assign err', _res[0].error);
        }
      })
      .catch((err) => {
        console.log('assign automation err', err.message);
      });
  }

  const time_zone = currentUser.time_zone_info
    ? JSON.parse(currentUser.time_zone_info).tz_name
    : system_settings.TIME_ZONE;

  const email_data = {
    template_data: {
      event_type_name: event_type.title,
      event_type_url: event_type.link,
      duration: event_type.duration + ' mins',
      scheduled_time: `${moment(appointment.due_start)
        .tz(time_zone)
        .format('hh:mm A')} - ${moment(appointment.due_end)
        .tz(time_zone)
        .format('hh:mm A dddd, MMMM DD, YYYY')}`,
      invite_name: appointment.full_name,
      invite_email: appointment.email,
      invite_description: appointment.description,
    },
    template_name: 'ScheduleEvent',
    required_reply: false,
    email: currentUser.email,
  };

  sendNotificationEmail(email_data)
    .then(() => {
      console.log('New scheduled event email has been sent out successfully');
    })
    .catch((err) => {
      console.log('New scheduled event email send err', err);
    });
};

module.exports = {
  create,
  checkConflict,
  loadConflicts,
  loadEvents,
};
