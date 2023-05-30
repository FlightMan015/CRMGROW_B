const moment = require('moment-timezone');
const { google } = require('googleapis');

const api = require('../config/api');
const urls = require('../constants/urls');
const { time_zone, days } = require('../constants/variable');
const mail_contents = require('../constants/mail_contents');
const system_settings = require('../config/system_settings');
const Appointment = require('../models/appointment');
const Activity = require('../models/activity');
// const Reminder = require('../models/reminder');
const User = require('../models/user');
const Contact = require('../models/contact');
const graph = require('@microsoft/microsoft-graph-client');
const _ = require('lodash');

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};

const oauth2 = require('simple-oauth2')(credentials);

const getAll = async (req, res) => {
  const { currentUser } = req;

  let { date, mode } = req.query;
  if (!mode) {
    mode = 'week';
  }

  if (!date) {
    date = moment().tz().startOf(mode);
  } else {
    date = moment(date).startOf(mode);
  }

  if (currentUser.calendar_connected && currentUser.calendar_list) {
    const { calendar_list } = currentUser;
    const promise_array = [];

    for (let i = 0; i < calendar_list.length; i++) {
      const { connected_calendar_type } = calendar_list[i];
      if (connected_calendar_type === 'outlook') {
        let accessToken;
        const { connected_email, outlook_refresh_token } = calendar_list[i];
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
          due_start: date,
          due_end,
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
        const { google_refresh_token, connected_email } = calendar;
        const token = JSON.parse(google_refresh_token);
        oauth2Client.setCredentials({ refresh_token: token.refresh_token });
        const due_end = moment(date).add(1, `${mode}s`);
        const calendar_data = {
          auth: oauth2Client,
          due_start: date,
          due_end,
          connected_email,
        };

        const google_calendar = googleCalendarList(calendar_data);
        promise_array.push(google_calendar);
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

const googleCalendarList = (calendar_data) => {
  const { connected_email, auth, due_start, due_end } = calendar_data;
  const data = [];

  const calendar = google.calendar({ version: 'v3', auth });
  return new Promise((resolve) => {
    calendar.calendarList.list(
      {
        maxResults: 100,
      },
      function (err, result) {
        if (err) {
          console.log(`The API returned an error: ${err}`);
          resolve({
            status: false,
            error: connected_email,
          });
        }

        const calendars = result.data.items;
        if (calendars) {
          const promise_array = [];

          for (let i = 0; i < calendars.length; i++) {
            if (calendars[i].accessRole === 'owner') {
              const promise = new Promise(async (resolve) => {
                const calendar_data = {
                  id: calendars[i].id,
                  title: calendars[i].summary,
                  time_zone: calendars[i].timeZone,
                  color: calendars[i].backgroundColor,
                  items: [],
                };

                calendar.events.list(
                  {
                    calendarId: calendars[i].id,
                    timeMin: due_start.toISOString(),
                    timeMax: due_end.toISOString(),
                    singleEvents: true,
                  },
                  async (err, _res) => {
                    if (err) {
                      console.log(`The API returned an error: ${err}`);
                      data.push(calendar_data);
                      resolve();
                    } else {
                      const events = _res.data.items;
                      const recurrence_event = [];
                      if (events.length) {
                        for (let j = 0; j < events.length; j++) {
                          const event = events[j];
                          const guests = [];

                          if (event.attendees) {
                            for (let j = 0; j < event.attendees.length; j++) {
                              const guest = event.attendees[j].email;
                              const response =
                                event.attendees[j].responseStatus;
                              guests.push({ email: guest, response });
                            }
                          }
                          const _gmail_calendar_data = {};
                          _gmail_calendar_data.title = event.summary;
                          _gmail_calendar_data.description = event.description;
                          _gmail_calendar_data.location = event.location;
                          _gmail_calendar_data.due_start =
                            event.start.dateTime || event.start.date;
                          _gmail_calendar_data.due_end =
                            event.end.dateTime || event.end.date;
                          _gmail_calendar_data.guests = guests;
                          _gmail_calendar_data.timezone =
                            event.start.timeZone || event.end.timeZone;

                          if (event.recurringEventId) {
                            recurrence_event.push({
                              id: event.recurringEventId,
                              index: calendar_data.items.length,
                            });
                            _gmail_calendar_data.recurrence_id =
                              event.recurringEventId;
                          }

                          if (event.organizer) {
                            _gmail_calendar_data.organizer =
                              event.organizer.email;
                            if (event.organizer.email === calendars[i].id) {
                              _gmail_calendar_data.is_organizer = true;
                            }
                          }

                          _gmail_calendar_data.calendar_id = calendars[i].id;
                          _gmail_calendar_data.event_id = event.id;
                          calendar_data.items.push(_gmail_calendar_data);
                        }
                        if (recurrence_event.length > 0) {
                          calendar.events.list(
                            {
                              calendarId: calendars[i].id,
                              timeMin: due_start.toISOString(),
                              timeMax: due_end.toISOString(),
                              singleEvents: false,
                            },
                            (err, _res) => {
                              if (err) {
                                console.log(
                                  `The API returned an error: ${err}`
                                );
                                resolve();
                              }
                              const events = _res.data.items;
                              for (
                                let j = 0;
                                j < recurrence_event.length;
                                j++
                              ) {
                                events.map((event) => {
                                  if (event.id === recurrence_event[j].id) {
                                    if (event.recurrence) {
                                      const index = recurrence_event[j].index;
                                      if (
                                        event.recurrence[0].indexOf('DAILY') !==
                                        -1
                                      ) {
                                        calendar_data.items[index].recurrence =
                                          'DAILY';
                                      } else if (
                                        event.recurrence[0].indexOf(
                                          'WEEKLY'
                                        ) !== -1
                                      ) {
                                        calendar_data.items[index].recurrence =
                                          'WEEKLY';
                                      } else if (
                                        event.recurrence[0].indexOf(
                                          'MONTHLY'
                                        ) !== -1
                                      ) {
                                        calendar_data.items[index].recurrence =
                                          'MONTHLY';
                                      } else if (
                                        event.recurrence[0].indexOf(
                                          'YEARLY'
                                        ) !== -1
                                      ) {
                                        calendar_data.items[index].recurrence =
                                          'YEARLY';
                                      }
                                    }
                                  }
                                });
                              }
                              data.push(calendar_data);
                              resolve();
                            }
                          );
                        } else {
                          data.push(calendar_data);
                          resolve();
                        }
                      } else {
                        console.log('No upcoming events found.');
                        resolve();
                      }
                    }
                  }
                );
              });
              promise_array.push(promise);
            }
          }
          Promise.all(promise_array).then(() => {
            resolve({
              status: true,
              calendar: {
                email: connected_email,
                data,
              },
            });
          });
        }
      }
    );
  });
};

const outlookCalendarList = (calendar_data) => {
  const { client, connected_email, due_start, due_end } = calendar_data;
  const data = [];
  const promise_array = [];

  return new Promise((resolve) => {
    client
      .api('/me/calendars')
      // .header('Prefer', `outlook.timezone="${ctz}"`)
      .get()
      .then(async (outlook_calendars) => {
        const calendars = outlook_calendars.value;

        if (calendars.length > 0) {
          // The start and end date are passed as query parameters
          const startDateTime = due_start.toISOString();
          const endDateTime = due_end.toISOString();

          for (let i = 0; i < calendars.length; i++) {
            const calendar = calendars[i];

            if (calendar.canEdit) {
              const promise = new Promise(async (resolve) => {
                const calendar_data = {
                  id: calendar.id,
                  title: calendar.name,
                  color:
                    calendar.hexColor === '' ? undefined : calendar.hexColor,
                  items: [],
                };

                const outlook_events = await client
                  .api(
                    `/me/calendars/${calendar.id}/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&top=1000`
                  )
                  // .header('Prefer', `outlook.timezone="${ctz}"`)
                  .get()
                  .catch((err) => {
                    console.log('outlook calendar events get err', err);
                  });

                if (outlook_events && outlook_events.value) {
                  const recurrence_event = [];
                  const calendar_events = outlook_events.value;

                  for (let j = 0; j < calendar_events.length; j++) {
                    const guests = [];
                    const calendar_event = calendar_events[j];

                    if (
                      calendar_event.attendees &&
                      calendar_event.attendees.length > 0
                    ) {
                      const attendees = calendar_event.attendees;
                      for (let j = 0; j < attendees.length; j++) {
                        const guest = attendees[j].emailAddress.address;
                        let response = '';
                        switch (attendees[j].status.response) {
                          case 'none':
                            response = 'needsAction';
                            break;
                          case 'organizer':
                            response = 'accepted';
                            break;
                          case 'declined':
                            response = 'declined';
                            break;
                          case 'accepted':
                            response = 'accepted';
                            break;
                          case 'tentativelyAccepted':
                            response = 'tentative';
                            break;
                          case 'notResponded':
                            response = 'needsAction';
                            break;
                          default:
                            response = 'needsAction';
                            break;
                        }
                        guests.push({ email: guest, response });
                      }
                    }
                    const _outlook_calendar_data = {
                      service_type: 'outlook',
                    };
                    _outlook_calendar_data.title = calendar_event.subject;
                    if (calendar_event.body) {
                      _outlook_calendar_data.description =
                        calendar_event.body.content;
                    } else {
                      _outlook_calendar_data.description = '';
                    }
                    if (calendar_event.location) {
                      _outlook_calendar_data.location =
                        calendar_event.location.displayName;
                    } else {
                      _outlook_calendar_data.location = '';
                    }
                    _outlook_calendar_data.timezone =
                      calendar_event.originalStartTimeZone ||
                      calendar_event.originalEndTimeZone;
                    if (calendar_event.start) {
                      if (calendar_event.isAllDay) {
                        _outlook_calendar_data.due_start = moment(
                          calendar_event.start.dateTime
                        ).format('YYYY-MM-DD');
                      } else {
                        _outlook_calendar_data.due_start =
                          calendar_event.start.dateTime;
                      }
                      // _outlook_calendar_data.time_zone =
                      //   calendar_event.start.timezone;
                      // _outlook_calendar_data.due_start = moment
                      //   .tz(
                      //     _outlook_calendar_data.due_start,
                      //     _outlook_calendar_data.time_zone
                      //   )
                      //   .toISOString();
                    } else {
                      _outlook_calendar_data.due_start = '';
                    }
                    if (calendar_event.end) {
                      if (calendar_event.isAllDay) {
                        _outlook_calendar_data.due_end = moment(
                          calendar_event.end.dateTime
                        )
                          .subtract(1, 'days')
                          .format('YYYY-MM-DD');
                      } else {
                        _outlook_calendar_data.due_end =
                          calendar_event.end.dateTime;
                      }
                      // _outlook_calendar_data.due_end =
                      //   calendar_event.end.dateTime;
                      // _outlook_calendar_data.time_zone =
                      //   calendar_event.end.timezone;
                      // _outlook_calendar_data.due_end = moment
                      //   .tz(
                      //     _outlook_calendar_data.due_end,
                      //     _outlook_calendar_data.time_zone
                      //   )
                      //   .toISOString();
                    } else {
                      _outlook_calendar_data.due_end = '';
                    }
                    if (calendar_event.organizer) {
                      _outlook_calendar_data.organizer =
                        calendar_event.organizer.emailAddress.address;
                      if (
                        calendar_event.organizer.emailAddress.address ===
                        connected_email
                      ) {
                        _outlook_calendar_data.is_organizer = true;
                      }
                    }

                    _outlook_calendar_data.guests = guests;
                    _outlook_calendar_data.event_id = calendar_event.id;
                    _outlook_calendar_data.calendar_id = calendar.id;
                    if (calendar_event.seriesMasterId) {
                      _outlook_calendar_data.recurrence_id =
                        calendar_event.seriesMasterId;
                      recurrence_event.push({
                        id: calendar_event.seriesMasterId,
                        index: calendar_data.items.length,
                      });
                    }

                    calendar_data.items.push(_outlook_calendar_data);
                  }
                  if (recurrence_event.length > 0) {
                    for (let j = 0; j < recurrence_event.length; j++) {
                      const master_id = recurrence_event[j].id;
                      const master_event = await client
                        .api(`/me/events/${master_id}`)
                        // .header('Prefer', `outlook.timezone="${ctz}"`)
                        .get()
                        .catch((err) => {
                          console.log('outlook calendar events get err', err);
                        });
                      if (master_event.recurrence) {
                        const index = recurrence_event[j].index;
                        if (
                          master_event.recurrence.pattern &&
                          master_event.recurrence.pattern.type.indexOf(
                            'daily'
                          ) !== -1
                        ) {
                          calendar_data.items[index].recurrence = 'DAILY';
                        } else if (
                          master_event.recurrence.pattern &&
                          master_event.recurrence.pattern.type.indexOf(
                            'weekly'
                          ) !== -1
                        ) {
                          calendar_data.items[index].recurrence = 'WEEKLY';
                        } else if (
                          master_event.recurrence.pattern &&
                          master_event.recurrence.pattern.type.indexOf(
                            'Monthly'
                          ) !== -1
                        ) {
                          calendar_data.items[index].recurrence = 'MONTHLY';
                        } else if (
                          master_event.recurrence.pattern &&
                          master_event.recurrence.pattern.type.indexOf(
                            'absoluteYearly'
                          ) !== -1
                        ) {
                          calendar_data.items[index].recurrence = 'YEARLY';
                        }
                      }
                    }
                  }
                }
                data.push(calendar_data);
                resolve();
              });
              promise_array.push(promise);
            }
          }
        }
        Promise.all(promise_array).then(() => {
          resolve({
            status: true,
            calendar: {
              email: connected_email,
              data,
            },
          });
        });
      })
      .catch((err) => {
        console.log('calendar event err', err);
      });
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  let event_id;
  let recurrence_id;
  let service_type;

  // if (!req.body.contacts) {
  //   return res.status(400).json({
  //     status: false,
  //     error: 'Contacts required',
  //   });
  // }

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

    // const ctz = currentUser.time_zone_info
    //   ? JSON.parse(currentUser.time_zone_info).tz_name
    //   : system_settings.TIME_ZONE;

    if (calendar.connected_calendar_type === 'outlook') {
      const { new_event_id, new_recurrence_id } = await addOutlookCalendarById(
        // ctz,
        _appointment,
        calendar,
        calendar_id
      );
      event_id = new_event_id;
      recurrence_id = new_recurrence_id;
      service_type = 'outlook';
    } else {
      const token = JSON.parse(calendar.google_refresh_token);

      const { new_event_id, new_recurrence_id } = await addGoogleCalendarById(
        token.refresh_token,
        // ctz,
        _appointment,
        calendar_id
      );
      event_id = new_event_id;
      recurrence_id = new_recurrence_id;
      service_type = 'google';
    }

    if (req.body.contacts) {
      const contacts = req.body.contacts;

      let outlookTime = {};
      if (service_type === 'outlook') {
        const { due_end, due_start, timezone } = req.body;
        const due_start_time = moment.tz(due_start, timezone).toDate();
        const due_end_time = moment.tz(due_end, timezone).toDate();
        outlookTime = {
          due_start: due_start_time,
          due_end: due_end_time,
        };
      }
      const appointment = new Appointment({
        ...req.body,
        contacts,
        user: currentUser.id,
        type: 0,
        event_id,
        recurrence_id,
        service_type,
        ...outlookTime,
      });

      appointment.save().catch((err) => {
        console.log('appointment save err', err.message);
      });

      for (let i = 0; i < contacts.length; i++) {
        const activity = new Activity({
          content: 'added meeting',
          contacts: contacts[i],
          appointments: appointment.id,
          user: currentUser.id,
          type: 'appointments',
        });

        activity.save().then((_activity) => {
          Contact.updateOne(
            {
              _id: contacts[i],
            },
            {
              $set: { last_activity: _activity.id },
            }
          ).catch((err) => {
            console.log('err', err);
          });
        });
      }
    }
    return res.send({
      status: true,
      event_id,
    });
  } else {
    return res.status(407).json({
      status: false,
      error: 'You must connect gmail/outlook',
    });
  }
};

const addGoogleCalendarById = async (
  refresh_token,
  appointment,
  calendar_id
) => {
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );
  oauth2Client.setCredentials({ refresh_token });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const attendees = [];
  if (appointment.guests) {
    for (let j = 0; j < appointment.guests.length; j++) {
      const addendee = {
        email: appointment.guests[j],
      };
      attendees.push(addendee);
    }
  }
  // if (appointment.contacts) {
  //   const contacts = await Contact.find({
  //     _id: appointment.contacts,
  //   }).catch((err) => {
  //     console.log('appointment contacts find err', err.messages);
  //   });
  //   for (let j = 0; j < contacts.length; j++) {
  //     if (contacts[j].email) {
  //       const addendee = {
  //         email: contacts[j].email,
  //       };
  //       attendees.push(addendee);
  //     }
  //   }
  // }

  let recurrence;
  if (appointment.recurrence) {
    recurrence = [`RRULE:FREQ=${appointment.recurrence};`];
  }

  const event = {
    summary: appointment.title,
    location: appointment.location,
    description: appointment.description,
    start: {
      dateTime: appointment.due_start,
      timeZone: appointment.timezone,
    },
    end: {
      dateTime: appointment.due_end,
      timeZone: appointment.timezone,
    },
    attendees,
    recurrence,
  };
  return new Promise((resolve, reject) => {
    calendar.events.insert(
      {
        auth: oauth2Client,
        calendarId: calendar_id,
        sendNotifications: true,
        resource: event,
      },
      function (err, event) {
        if (err) {
          console.log(
            `There was an error contacting the Calendar service: ${err}`
          );
          reject(err);
        }

        resolve({
          new_event_id: event.data.id,
          new_recurrence_id: event.data.id,
        });
      }
    );
  });
};

const addOutlookCalendarById = async (
  // ctz,
  appointment,
  calendar,
  calendar_id
) => {
  const attendees = [];
  if (appointment.guests) {
    for (let j = 0; j < appointment.guests.length; j++) {
      const addendee = {
        emailAddress: {
          Address: appointment.guests[j],
        },
      };
      attendees.push(addendee);
    }
  }

  let recurrence;
  if (appointment.recurrence) {
    let type;
    let daysOfWeek;
    let dayOfMonth;
    let month;
    switch (appointment.recurrence) {
      case 'DAILY':
        type = 'daily';
        break;
      case 'WEEKLY':
        type = 'weekly';
        daysOfWeek = [days[moment(appointment.due_start).day()]];
        break;
      case 'MONTHLY':
        type = 'absoluteMonthly';
        dayOfMonth = moment(appointment.due_start).date();
        break;
      case 'YEARLY':
        type = 'absoluteYearly';
        dayOfMonth = moment(appointment.due_start).date();
        month = moment(appointment.due_start).month() + 1;
        break;
      default:
        console.log('no matching');
    }

    recurrence = {
      pattern: {
        type,
        interval: 1,
        daysOfWeek,
        dayOfMonth,
        month,
      },
      range: {
        type: 'noEnd',
        startDate: moment(appointment.due_start).format('YYYY-MM-DD'),
      },
    };
  }

  const newEvent = {
    subject: appointment.title,
    body: {
      contentType: 'HTML',
      content: appointment.description,
    },
    location: {
      displayName: appointment.location,
    },
    start: {
      dateTime: appointment.due_start,
      timeZone: appointment.timezone,
    },
    end: {
      dateTime: appointment.due_end,
      timeZone: appointment.timezone,
    },
    attendees,
    recurrence,
  };

  return new Promise(async (resolve, reject) => {
    let accessToken;
    const token = oauth2.accessToken.create({
      refresh_token: calendar.outlook_refresh_token,
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
        reject(error);
      });

    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    const new_event = await client
      .api(`/me/calendars/${calendar_id}/events`)
      .header('Prefer', `outlook.timezone="${appointment.timezone}"`)
      .post(newEvent);

    resolve({ new_event_id: new_event.id, new_recurrence_id: new_event.id });
  });
};

const edit = async (req, res) => {
  const { currentUser } = req;

  if (currentUser.calendar_connected) {
    const { recurrence_id, connected_email, calendar_id, guests } = req.body;

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

    const edit_data = req.body;

    const event_id = recurrence_id || req.params.id;

    if (calendar.connected_calendar_type === 'outlook') {
      let accessToken;
      const token = oauth2.accessToken.create({
        refresh_token: calendar.outlook_refresh_token,
        expires_in: 0,
      });

      await new Promise((resolve, reject) => {
        token.refresh((error, result) => {
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
          return res.status(407).send({
            status: false,
            error: 'not connected',
          });
        });

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      const attendees = [];
      if (guests) {
        for (let j = 0; j < guests.length; j++) {
          const addendee = {
            emailAddress: {
              address: guests[j],
            },
          };
          attendees.push(addendee);
        }
      }

      // const ctz = currentUser.time_zone_info
      //   ? JSON.parse(currentUser.time_zone_info).tz_name
      //   : system_settings.TIME_ZONE;

      const event = {
        subject: edit_data.title,
        body: {
          contentType: 'HTML',
          content: edit_data.description,
        },
        location: {
          displayName: edit_data.location,
        },
        start: {
          dateTime: edit_data.due_start,
          timeZone: edit_data.timezone,
        },
        end: {
          dateTime: edit_data.due_end,
          timeZone: edit_data.timezone,
        },
        attendees,
      };
      let res = await client
        .api(`/me/calendars/${calendar_id}/events/${event_id}`)
        .update(event);
    } else {
      const token = JSON.parse(calendar.google_refresh_token);
      // const ctz = currentUser.time_zone_info
      //   ? JSON.parse(currentUser.time_zone_info).tz_name
      //   : system_settings.TIME_ZONE;

      const data = {
        refresh_token: token.refresh_token,
        event_id,
        appointment: edit_data,
        calendar_id,
      };
      await updateGoogleCalendarById(data);
    }

    if (edit_data.contacts && edit_data.contacts.length > 0) {
      const appointment = await Appointment.findOne({
        user: currentUser.id,
        event_id: req.params.id,
      }).catch((err) => {
        console.log('appointment find err', err.message);
      });

      if (appointment) {
        let outlookTime = {};
        if (req.body.service_type === 'outlook') {
          const { due_end, due_start, timezone } = req.body;
          const due_start_time = moment.tz(due_start, timezone).toDate();
          const due_end_time = moment.tz(due_end, timezone).toDate();
          outlookTime = {
            due_start: due_start_time,
            due_end: due_end_time,
          };
        }
        Appointment.updateOne(
          {
            _id: appointment.id,
          },
          {
            $set: {
              ...req.body,
              ...outlookTime,
            },
          }
        ).catch((err) => {
          console.log('appointment update err', err.message);
        });

        const contacts = appointment.contacts;

        for (let i = 0; i < edit_data.contacts.length; i++) {
          const contact = edit_data.contacts[i];
          if (contacts && contacts.indexOf(contact) !== -1) {
            const activity = new Activity({
              content: 'updated meeting',
              contacts: contact,
              appointments: appointment._id,
              user: currentUser.id,
              type: 'appointments',
            });

            contacts.splice(contacts.indexOf(contact), 1);

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
              .catch((err) => {
                console.log('activity save err', err.message);
              });
          } else {
            const activity = new Activity({
              content: 'added meeting',
              contacts: contact,
              appointments: appointment.id,
              user: currentUser.id,
              type: 'appointments',
            });

            activity.save().then((_activity) => {
              Contact.updateOne(
                {
                  _id: contact,
                },
                {
                  $set: { last_activity: _activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
              });
            });
          }
        }

        if (contacts && contacts.length > 0) {
          Activity.deleteMany({
            contacts: { $in: contacts },
            appointments: appointment._id,
            type: 'appointments',
          }).catch((err) => {
            console.log('activity remove err', err.message);
          });
        }
      }
      return res.send({
        status: true,
      });
    } else {
      return res.send({
        status: true,
      });
    }
  } else {
    return res.status(400).json({
      status: false,
      error: 'Invalid calendar',
    });
  }
};

const remove = async (req, res) => {
  const { currentUser } = req;

  if (currentUser.calendar_connected) {
    const { event_id, recurrence_id, calendar_id, connected_email } = req.body;

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

    const remove_id = recurrence_id || event_id;
    if (calendar.connected_calendar_type === 'outlook') {
      let accessToken;
      const token = oauth2.accessToken.create({
        refresh_token: calendar.outlook_refresh_token,
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
          return res.status(407).send({
            status: false,
            error: 'not connected',
          });
        });

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      let res = await client
        .api(`/me/calendars/${calendar_id}/events/${remove_id}`)
        .delete()
        .catch((err) => {
          console.log('remove err', err);
        });
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );
      oauth2Client.setCredentials(JSON.parse(calendar.google_refresh_token));
      const data = { oauth2Client, calendar_id, remove_id };
      await removeGoogleCalendarById(data).catch((err) => {
        console.log('event remove err', err.message);
        return res.status(400).json({
          status: false,
          error: err,
        });
      });
    }

    // remove activity
    const appointment = await Appointment.findOne({
      user: currentUser.id,
      event_id,
    }).catch((err) => {
      console.log('remove appointment find err', err.message);
    });

    if (appointment) {
      Activity.deleteMany({
        appointments: appointment.id,
        user: currentUser.id,
      }).catch((err) => {
        console.log('appointment activity remove', err.message);
      });

      Appointment.deleteOne({
        user: currentUser.id,
        event_id,
      }).catch((err) => {
        console.log('appointment update err', err.message);
      });
    }

    return res.send({
      status: true,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Appointment remove error',
    });
  }
};

const removeContact = async (req, res) => {
  const { currentUser } = req;

  if (currentUser.calendar_connected) {
    const {
      event_id,
      recurrence_id,
      calendar_id,
      connected_email,
      contact_id,
      contact_email,
    } = req.body;

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

    const edit_id = recurrence_id || event_id;
    if (calendar.connected_calendar_type === 'outlook') {
      let accessToken;
      const token = oauth2.accessToken.create({
        refresh_token: calendar.outlook_refresh_token,
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
          return res.status(407).send({
            status: false,
            error: 'not connected',
          });
        });

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      const event_object = await getOutlookEventById({
        calendar_id,
        // ctz: system_settings.TIME_ZONE,
        calendar_event_id: edit_id,
        calendar,
      });
      if (event_object) {
        // Remove attendee (contact email) from guests
        const attendees = event_object.attendees || [];
        for (let i = attendees.length - 1; i >= 0; i--) {
          const attendee = attendees[i];
          const email = attendee.emailAddress.address;
          if (email === contact_email) {
            attendees.splice(i, 1);
            break;
          }
        }
        const payload = {
          attendees,
        };
        await client
          .api(`/me/calendars/${calendar_id}/events/${edit_id}`)
          .update(payload)
          .catch((err) => {
            console.log('remove err', err);
          });
      }
      console.log('event_object', event_object);
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );
      oauth2Client.setCredentials(JSON.parse(calendar.google_refresh_token));
      const data = { oauth2Client, calendar_id, calendar_event_id: edit_id };
      const event_object = await getGoogleEventById(data);
      if (event_object) {
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        // event object finding
        const attendees = event_object.attendees || [];
        const new_attendees = [];
        for (let i = attendees.length - 1; i >= 0; i--) {
          const attendee = attendees[i];
          const email = attendee.email;
          if (email !== contact_email) {
            new_attendees.push({
              email,
            });
          }
        }
        const payload = {
          attendees: new_attendees,
        };
        const params = {
          calendarId: calendar_id,
          eventId: edit_id,
          sendNotifications: true,
          resource: payload,
        };
        await calendar.events.patch(params, function (err) {
          console.log('google calendar update', err);
        });
      }
    }

    // remove activity
    const appointment = await Appointment.findOne({
      user: currentUser.id,
      event_id: edit_id,
    }).catch((err) => {
      console.log('remove appointment find err', err.message);
    });

    if (appointment) {
      const current_contact_ids = appointment.contacts || [];
      const new_contacts = current_contact_ids.filter(
        (e) => e + '' !== contact_id
      );
      if (new_contacts.length) {
        Appointment.updateOne(
          {
            user: currentUser.id,
            event_id: edit_id,
          },
          {
            $pull: {
              contacts: { $in: [contact_id] },
              guests: { $in: [contact_email] },
            },
          }
        ).catch((err) => {
          console.log('remove appointment find err', err.message);
        });
        Activity.deleteMany({
          appointments: appointment.id,
          user: currentUser.id,
          contacts: contact_id,
        }).catch((err) => {
          console.log('appointment activity remove', err.message);
        });
      } else {
        Appointment.deleteOne({
          user: currentUser.id,
          event_id: edit_id,
        }).catch(() => {
          console.log('empty appointment removing failed');
        });
        Activity.deleteMany({
          user: currentUser.id,
          appointments: appointment.id,
        }).catch(() => {
          console.log('empty appointment activity removing failed');
        });
      }
    }

    return res.send({
      status: true,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Appointment remove error',
    });
  }
};

const removeGoogleCalendarById = async (data) => {
  const { oauth2Client, calendar_id, remove_id } = data;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const params = {
    calendarId: calendar_id,
    eventId: remove_id,
    sendNotifications: true,
  };
  // calendar.events.delete(params, function (err) {
  //   if (err) {
  //     console.log(`There was an error contacting the Calendar service: ${err}`);
  //   }
  // });
  return new Promise((resolve, reject) => {
    calendar.events.delete(params, function (err) {
      if (err) {
        console.log(
          `There was an error contacting the Calendar service: ${err}`
        );
        reject(err);
      }
      resolve();
    });
  });
};

const updateGoogleCalendarById = async (data) => {
  const { refresh_token, event_id, appointment, calendar_id } = data;

  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );

  oauth2Client.setCredentials({ refresh_token });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const attendees = [];
  if (appointment.guests) {
    for (let j = 0; j < appointment.guests.length; j++) {
      const addendee = {
        email: appointment.guests[j],
      };
      attendees.push(addendee);
    }
  }
  const event = {
    summary: appointment.title,
    location: appointment.location,
    description: appointment.description,
    start: {
      dateTime: appointment.due_start,
      timeZone: appointment.timezone,
    },
    end: {
      dateTime: appointment.due_end,
      timeZone: appointment.timezone,
    },
    attendees,
  };
  const params = {
    calendarId: calendar_id,
    eventId: event_id,
    resource: event,
    sendNotifications: true,
  };
  return new Promise((resolve, reject) => {
    calendar.events.patch(params, function (err) {
      if (err) {
        console.log(
          `There was an error contacting the Calendar service: ${err}`
        );
        reject(err);
      }
      resolve();
    });
  });
};

const updateOutlookCalendarById = async (data) => {
  const { appointment, event_id, calendar } = data;

  const attendees = [];
  if (appointment.guests) {
    for (let j = 0; j < appointment.guests.length; j++) {
      const addendee = {
        emailAddress: {
          address: appointment.guests[j],
        },
      };
      attendees.push(addendee);
    }
  }

  const event = {
    subject: appointment.title,
    body: {
      contentType: 'HTML',
      content: appointment.description,
    },
    location: {
      displayName: appointment.location,
    },
    start: {
      dateTime: appointment.due_start,
      timeZone: appointment.timezone,
    },
    end: {
      dateTime: appointment.due_end,
      timeZone: appointment.timezone,
    },
    attendees,
  };

  let accessToken;
  const token = oauth2.accessToken.create({
    refresh_token: calendar.outlook_refresh_token,
    expires_in: 0,
  });

  return new Promise(async (resolve, reject) => {
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
        reject(error);
      });

    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    const res = client
      .api(`/me/calendars/${appointment.calendar_id}/events/${event_id}`)
      .header('Prefer', `outlook.timezone="${appointment.timezone}"`)
      .update(event);

    resolve(res.id);
  });
};

const accept = async (req, res) => {
  const { currentUser } = req;

  if (currentUser.calendar_connected) {
    const { recurrence_id, connected_email, calendar_id } = req.body;

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

    const event_id = recurrence_id || req.body.event_id;

    if (calendar.connected_calendar_type === 'outlook') {
      let accessToken;
      const token = oauth2.accessToken.create({
        refresh_token: calendar.outlook_refresh_token,
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
          return res.status(407).send({
            status: false,
            error: 'not connected',
          });
        });

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      const accept = {
        sendResponse: true,
      };
      client
        .api(`/me/calendars/${calendar_id}/events/${event_id}/accept`)
        .post(accept)
        .then(async () => {
          if (req.body.organizer) {
            const contact = await Contact.findOne({
              user: currentUser.id,
              email: req.body.organizer,
            });

            if (contact) {
              const appointment = new Appointment({
                contact: contact._id,
                user: currentUser.id,
                type: 1,
                event_id,
              });

              appointment.save().catch((err) => {
                console.log('appointment save err', err.message);
              });

              const activity = new Activity({
                content: 'accepted appointment',
                contacts: contact._id,
                appointments: appointment.id,
                user: currentUser.id,
                type: 'appointments',
              });

              activity
                .save()
                .then((_activity) => {
                  Contact.updateOne(
                    {
                      _id: contact._id,
                    },
                    {
                      $set: { last_activity: _activity.id },
                    }
                  ).catch((err) => {
                    console.log('err', err);
                  });
                })
                .catch((err) => {
                  console.log('appointment save err', err.message);
                  return res.status(500).send({
                    status: false,
                    error: err.message,
                  });
                });
            }
          }

          return res.send({
            status: true,
          });
        })
        .catch((err) => {
          return res.status(400).json({
            status: false,
            error: err.message,
          });
        });
    } else if (calendar.connected_calendar_type === 'google') {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GOOGLE_CALENDAR_AUTHORIZE_URL
      );

      const token = JSON.parse(calendar.google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: token.refresh_token });

      const client = google.calendar({ version: 'v3', auth: oauth2Client });

      const event = {
        attendees: [
          {
            email: calendar.connected_email,
            responseStatus: 'accepted',
          },
        ],
      };

      const params = {
        calendarId: calendar_id,
        eventId: event_id,
        resource: event,
        sendNotifications: true,
      };

      client.events.patch(params, async (err) => {
        if (err) {
          console.log(
            `There was an error contacting the Calendar service: ${err}`
          );
          return res.status(400).json({
            status: false,
            error: err,
          });
        } else {
          console.log('calendar update');

          if (req.body.organizer) {
            const contact = await Contact.findOne({
              user: currentUser.id,
              email: req.body.organizer,
            });

            if (contact) {
              const appointment = new Appointment({
                contact: contact._id,
                user: currentUser.id,
                type: 1,
                event_id,
              });

              appointment.save().catch((err) => {
                console.log('appointment save err', err.message);
              });

              const activity = new Activity({
                content: 'accepted appointment',
                contacts: contact._id,
                appointments: appointment.id,
                user: currentUser.id,
                type: 'appointments',
              });

              activity
                .save()
                .then((_activity) => {
                  Contact.updateOne(
                    {
                      _id: contact._id,
                    },
                    {
                      $set: { last_activity: _activity.id },
                    }
                  ).catch((err) => {
                    console.log('err', err);
                  });
                })
                .catch((err) => {
                  console.log('appointment save err', err.message);
                  return res.status(500).send({
                    status: false,
                    error: err.message,
                  });
                });
            }
          }

          return res.send({
            status: true,
          });
        }
      });
    }
  }
};

const decline = async (req, res) => {
  const { currentUser } = req;

  if (currentUser.calendar_connected) {
    const { recurrence_id, connected_email, calendar_id } = req.body;

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

    const event_id = recurrence_id || req.body.event_id;

    if (calendar.connected_calendar_type === 'outlook') {
      let accessToken;
      const token = oauth2.accessToken.create({
        refresh_token: calendar.outlook_refresh_token,
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
          return res.status(407).send({
            status: false,
            error: 'not connected',
          });
        });

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      const decline = {
        sendResponse: true,
      };
      client
        .api(`/me/calendars/${calendar_id}/events/${event_id}/decline`)
        .post(decline)
        .then(() => {
          return res.send({
            status: true,
          });
        })
        .catch((err) => {
          return res.status(400).json({
            status: false,
            error: err.message,
          });
        });
    } else if (calendar.connected_calendar_type === 'google') {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GOOGLE_CALENDAR_AUTHORIZE_URL
      );

      const token = JSON.parse(calendar.google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: token.refresh_token });

      const client = google.calendar({ version: 'v3', auth: oauth2Client });

      const event = {
        attendees: [
          {
            email: calendar.connected_email,
            responseStatus: 'declined',
          },
        ],
      };

      const params = {
        calendarId: calendar_id,
        eventId: event_id,
        resource: event,
        sendNotifications: true,
      };

      client.events.patch(params, function (err) {
        if (err) {
          console.log(
            `There was an error contacting the Calendar service: ${err}`
          );
          return res.status(400).json({
            status: false,
            error: err,
          });
        } else {
          return res.send({
            status: true,
          });
        }
      });
    }
  }
};

const getCalendarList = async (req, res) => {
  const { currentUser } = req;

  if (currentUser.calendar_connected && currentUser.calendar_list) {
    const { calendar_list } = currentUser;
    const promise_array = [];
    const data = [];

    for (let i = 0; i < calendar_list.length; i++) {
      const { connected_calendar_type } = calendar_list[i];
      if (connected_calendar_type === 'outlook') {
        let accessToken;
        const { connected_email, outlook_refresh_token } = calendar_list[i];
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

        const outlook_calendar = new Promise((resolve) => {
          client
            .api('/me/calendars')
            .header()
            .get()
            .then(async (outlook_calendars) => {
              const calendars = outlook_calendars.value;
              if (calendars.length > 0) {
                const calendar = {
                  email: connected_email,
                  data: [],
                };
                for (let i = 0; i < calendars.length; i++) {
                  if (calendars[i].canEdit) {
                    calendar.data.push({
                      id: calendars[i].id,
                      title: calendars[i].name,
                      color:
                        calendars[i].hexColor === ''
                          ? undefined
                          : calendars[i].hexColor,
                    });
                  }
                }
                data.push(calendar);
                resolve();
              } else {
                resolve();
              }
            });
        });

        promise_array.push(outlook_calendar);
      } else {
        const oauth2Client = new google.auth.OAuth2(
          api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
          api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
          urls.GMAIL_AUTHORIZE_URL
        );
        const { google_refresh_token, connected_email } = calendar_list[i];
        const token = JSON.parse(google_refresh_token);
        oauth2Client.setCredentials({ refresh_token: token.refresh_token });

        const client = google.calendar({ version: 'v3', auth: oauth2Client });
        const google_calendar = new Promise((resolve) => {
          client.calendarList.list(
            {
              maxResults: 100,
            },
            function (err, result) {
              if (err) {
                console.log(`The API returned an error: ${err}`);
                resolve({
                  status: false,
                  error: connected_email,
                });
              }

              const calendars = result.data.items;
              if (calendars) {
                const calendar = {
                  email: connected_email,
                  data: [],
                };

                for (let i = 0; i < calendars.length; i++) {
                  if (calendars[i].accessRole === 'owner') {
                    const calendar_data = {
                      id: calendars[i].id,
                      title: calendars[i].summary,
                      time_zone: calendars[i].timeZone,
                      color: calendars[i].backgroundColor,
                    };
                    calendar.data.push(calendar_data);
                  }
                }
                data.push(calendar);
                resolve();
              }
            }
          );
        });

        promise_array.push(google_calendar);
      }
    }
    Promise.all(promise_array)
      .then(() => {
        return res.send({
          status: true,
          data,
        });
      })
      .catch((err) => {
        console.log('get calendar err', err);
        return res.status(400).json({
          status: false,
          error: err,
        });
      });
  } else {
    return res.send({
      status: true,
      data: [],
    });
  }
};

const getEventById = async (req, res) => {
  const { currentUser } = req;
  if (currentUser.calendar_connected) {
    const { event_id, recurrence_id, calendar_id, connected_email } = req.body;

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

    // const ctz = currentUser.time_zone_info
    //   ? JSON.parse(currentUser.time_zone_info).tz_name
    //   : system_settings.TIME_ZONE;

    const calendar_event_id = recurrence_id || event_id;
    if (calendar.connected_calendar_type === 'outlook') {
      await getOutlookEventById({
        calendar_id,
        // ctz,
        calendar_event_id,
        calendar,
      })
        .then(async (event) => {
          const guests = [];

          if (event.attendees && event.attendees.length > 0) {
            const attendees = event.attendees;
            for (let i = 0; i < attendees.length; i++) {
              const guest = attendees[i].emailAddress.address;
              let response = '';
              switch (attendees[i].status.response) {
                case 'none':
                  response = 'needsAction';
                  break;
                case 'organizer':
                  response = 'accepted';
                  break;
                case 'declined':
                  response = 'declined';
                  break;
                case 'accepted':
                  response = 'accepted';
                  break;
                case 'tentativelyAccepted':
                  response = 'tentative';
                  break;
                case 'notResponded':
                  response = 'needsAction';
                  break;
                default:
                  response = 'needsAction';
                  break;
              }
              guests.push({ email: guest, response });
            }
          }
          const _outlook_calendar_data = {
            service_type: 'outlook',
          };
          _outlook_calendar_data.title = event.subject;
          if (event.body) {
            _outlook_calendar_data.description = event.body.content;
          } else {
            _outlook_calendar_data.description = '';
          }
          if (event.location) {
            _outlook_calendar_data.location = event.location.displayName;
          } else {
            _outlook_calendar_data.location = '';
          }
          _outlook_calendar_data.timezone =
            event.originalStartTimeZone || event.originalEndTimeZone;
          if (event.start) {
            _outlook_calendar_data.due_start = event.start.dateTime;
            // _outlook_calendar_data.time_zone =
            //   calendar_event.start.timezone;
            // _outlook_calendar_data.due_start = moment
            //   .tz(
            //     _outlook_calendar_data.due_start,
            //     _outlook_calendar_data.time_zone
            //   )
            //   .toISOString();
          } else {
            _outlook_calendar_data.due_start = '';
          }
          if (event.end) {
            _outlook_calendar_data.due_end = event.end.dateTime;
            // _outlook_calendar_data.time_zone =
            //   calendar_event.end.timezone;
            // _outlook_calendar_data.due_end = moment
            //   .tz(
            //     _outlook_calendar_data.due_end,
            //     _outlook_calendar_data.time_zone
            //   )
            //   .toISOString();
          } else {
            _outlook_calendar_data.due_end = '';
          }

          if (event.organizer) {
            _outlook_calendar_data.organizer =
              event.organizer.emailAddress.address;
            if (event.organizer.emailAddress.address === connected_email) {
              _outlook_calendar_data.is_organizer = true;
            }
          }

          if (event.recurrence) {
            if (
              event.recurrence.pattern &&
              event.recurrence.pattern.type.indexOf('daily') !== -1
            ) {
              _outlook_calendar_data.recurrence = 'DAILY';
            } else if (
              event.recurrence.pattern &&
              event.recurrence.pattern.type.indexOf('weekly') !== -1
            ) {
              _outlook_calendar_data.recurrence = 'WEEKLY';
            } else if (
              event.recurrence.pattern &&
              event.recurrence.pattern.type.indexOf('Monthly') !== -1
            ) {
              _outlook_calendar_data.recurrence = 'MONTHLY';
            } else if (
              event.recurrence.pattern &&
              event.recurrence.pattern.type.indexOf('absoluteYearly') !== -1
            ) {
              _outlook_calendar_data.recurrence = 'YEARLY';
            }
          }

          _outlook_calendar_data.calendar_id = calendar_id;
          _outlook_calendar_data.guests = guests;
          _outlook_calendar_data.event_id = event.id;

          return res.send({
            status: true,
            data: _outlook_calendar_data,
          });
        })
        .catch((err) => {
          console.log('event getting err', err.message);
          return res.status(400).json({
            status: false,
            error: err,
          });
        });
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );
      oauth2Client.setCredentials(JSON.parse(calendar.google_refresh_token));
      const data = { oauth2Client, calendar_id, calendar_event_id };
      await getGoogleEventById(data)
        .then((event) => {
          const guests = [];

          if (event.attendees) {
            for (let j = 0; j < event.attendees.length; j++) {
              const guest = event.attendees[j].email;
              const response = event.attendees[j].responseStatus;
              guests.push({ email: guest, response });
            }
          }
          const _gmail_calendar_data = {};
          _gmail_calendar_data.title = event.summary;
          _gmail_calendar_data.description = event.description;
          _gmail_calendar_data.location = event.location;
          _gmail_calendar_data.due_start =
            event.start.dateTime || event.start.date;
          _gmail_calendar_data.due_end = event.end.dateTime || event.end.date;
          _gmail_calendar_data.guests = guests;
          _gmail_calendar_data.timezone =
            event.start.timeZone || event.end.timeZone;

          if (event.organizer) {
            _gmail_calendar_data.organizer = event.organizer.email;
            if (event.organizer.email === calendar_id) {
              _gmail_calendar_data.is_organizer = true;
            }
          }

          if (event.recurrence) {
            if (event.recurrence[0].indexOf('DAILY') !== -1) {
              _gmail_calendar_data.recurrence = 'DAILY';
            } else if (event.recurrence[0].indexOf('WEEKLY') !== -1) {
              _gmail_calendar_data.recurrence = 'WEEKLY';
            } else if (event.recurrence[0].indexOf('MONTHLY') !== -1) {
              _gmail_calendar_data.recurrence = 'MONTHLY';
            } else if (event.recurrence[0].indexOf('YEARLY') !== -1) {
              _gmail_calendar_data.recurrence = 'YEARLY';
            }
          }

          _gmail_calendar_data.calendar_id = calendar_id;
          _gmail_calendar_data.event_id = event.id;

          return res.send({
            status: true,
            data: _gmail_calendar_data,
          });
        })
        .catch((err) => {
          console.log('event getting err', err.message);
          return res.status(500).json({
            status: false,
            error: err.message,
          });
        });
    }
  } else {
    return res.status(400).json({
      status: false,
      error: 'Appointment remove error',
    });
  }
};

const removeOutlookCalendarById = async (data) => {
  const { calendar_id, remove_id, calendar } = data;

  let accessToken;
  const token = oauth2.accessToken.create({
    refresh_token: calendar.outlook_refresh_token,
    expires_in: 0,
  });

  return new Promise(async (resolve, reject) => {
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
        reject(error);
      });

    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    await client
      .api(`/me/calendars/${calendar_id}/events/${remove_id}`)
      .delete()
      .catch((err) => {
        console.log('remove err', err);
      });
    resolve();
  });
};

const getOutlookEventById = async (data) => {
  const {
    calendar_id,
    // ctz,
    calendar_event_id: outlook_event_id,
    calendar,
  } = data;

  let accessToken;
  const token = oauth2.accessToken.create({
    refresh_token: calendar.outlook_refresh_token,
    expires_in: 0,
  });

  return new Promise(async (resolve, reject) => {
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
        reject(error);
      });

    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    const event = await client
      .api(`/me/calendars/${calendar_id}/events/${outlook_event_id}`)
      // .header('Prefer', `outlook.timezone="${ctz}"`)
      .get()
      .catch((err) => {
        console.log('remove err', err);
      });
    resolve(event);
  });
};

const getGoogleEventById = async (data) => {
  const { oauth2Client, calendar_id, calendar_event_id } = data;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const params = {
    calendarId: calendar_id,
    eventId: calendar_event_id,
  };

  return new Promise((resolve, reject) => {
    calendar.events.get(params, {}, function (err, response) {
      if (err) {
        console.log(
          `There was an error contacting the Calendar service: ${err}`
        );
        reject(err);
      } else {
        resolve(response.data);
      }
    });
  });
};

const getCalendarListByUser = async (user_id) => {
  const currentUser = await User.findOne({ _id: user_id });
  const { calendar_list } = currentUser;
  const promise_array = [];
  const data = [];

  for (let i = 0; i < calendar_list.length; i++) {
    const { connected_calendar_type } = calendar_list[i];
    if (connected_calendar_type === 'outlook') {
      let accessToken;
      const { connected_email, outlook_refresh_token } = calendar_list[i];
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

      const outlook_calendar = new Promise((resolve) => {
        client
          .api('/me/calendars')
          .header()
          .get()
          .then(async (outlook_calendars) => {
            const calendars = outlook_calendars.value;
            if (calendars.length > 0) {
              for (let i = 0; i < calendars.length; i++) {
                if (calendars[i].canEdit) {
                  data.push({
                    email: connected_email,
                    calendar_id: calendars[i].id,
                  });
                }
              }
              resolve();
            } else {
              resolve();
            }
          });
      });

      promise_array.push(outlook_calendar);
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );
      const { google_refresh_token, connected_email } = calendar_list[i];
      const token = JSON.parse(google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: token.refresh_token });

      const client = google.calendar({ version: 'v3', auth: oauth2Client });
      const google_calendar = new Promise((resolve) => {
        client.calendarList.list(
          {
            maxResults: 100,
          },
          function (err, result) {
            if (err) {
              console.log(
                `The API returned an error: ${err} ${connected_email}`
              );
              resolve({
                status: false,
                error: connected_email,
              });
            }

            const calendars = result.data.items;
            if (calendars) {
              for (let i = 0; i < calendars.length; i++) {
                if (calendars[i].accessRole === 'owner') {
                  data.push({
                    email: connected_email,
                    calendar_id: calendars[i].id,
                  });
                }
              }
              resolve();
            }
          }
        );
      });
      promise_array.push(google_calendar);
    }
  }

  return new Promise((resolve) => {
    Promise.all(promise_array)
      .then(() => {
        return resolve({
          status: true,
          data,
        });
      })
      .catch((err) => {
        console.log('get calendar err', err);
        return resolve({
          status: false,
          error: err,
        });
      });
  });
};

module.exports = {
  getAll,
  getCalendarList,
  getCalendarListByUser,
  create,
  edit,
  remove,
  removeContact,
  accept,
  decline,
  addOutlookCalendarById,
  addGoogleCalendarById,
  updateGoogleCalendarById,
  updateOutlookCalendarById,
  removeGoogleCalendarById,
  removeOutlookCalendarById,
  getEventById,
  googleCalendarList,
  outlookCalendarList,
};
