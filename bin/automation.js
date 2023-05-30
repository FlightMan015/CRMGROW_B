const mongoose = require('mongoose');
const CronJob = require('cron').CronJob;

const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });

const { DB_PORT } = require('../config/database');
const moment = require('moment-timezone');
const TimeLine = require('../models/time_line');
const {
  runTimeline,
  disableNext,
  activeNext,
} = require('../helpers/automation');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const timesheet_check = new CronJob(
  '* * * * *',
  async () => {
    const due_date = new Date();
    // due_date.setSeconds(0)
    // due_date.setMilliseconds(000)
    const timelines = await TimeLine.find({
      status: 'active',
      due_date: { $lte: due_date },
    });

    if (timelines) {
      for (let i = 0; i < timelines.length; i++) {
        const timeline = timelines[i];
        try {
          runTimeline(timeline);
          if (
            timeline.ref &&
            timeline.action &&
            timeline.action.type !== 'automation'
          ) {
            const next_data = {
              deal: timeline.deal,
              ref: timeline.ref,
              contact: timeline.contact,
            };
            activeNext(next_data);
          }
          if (timeline.condition && timeline.condition.answer === false) {
            if (timeline.contact) {
              const _timeline = await TimeLine.findOne({
                contact: timeline.contact,
                parent_ref: timeline.parent_ref,
                'condition.answer': true,
              }).catch((err) => {
                console.log('time line find err', err.message);
              });

              if (_timeline) {
                const next_data = {
                  contact: timeline.contact,
                  ref: _timeline.ref,
                };

                disableNext(next_data);
              }
            } else if (timeline.deal) {
              const _timeline = await TimeLine.findOne({
                deal: timeline.deal,
                parent_ref: timeline.parent_ref,
                'condition.answer': true,
              }).catch((err) => {
                console.log('time line find err', err.message);
              });
              if (_timeline) {
                const next_data = {
                  deal: timeline.deal,
                  ref: _timeline.ref,
                };

                disableNext(next_data);
              }
            }
          }
        } catch (err) {
          console.log('run timeline err', err.message);
          // read file
        }
      }
    }
  },
  function () {
    console.log('Reminder Job finished.');
  },
  false,
  'US/Central'
);

timesheet_check.start();
