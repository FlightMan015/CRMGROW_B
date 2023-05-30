const mongoose = require('mongoose');
const User = require('../models/user');
const TimeLine = require('../models/time_line');
const Automation = require('../models/automation');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

const CronJob = require('cron').CronJob;

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

const due_date = '2021-04-14T21:04:00.000+00:00';
const due_date_old = '2021-04-14T21:03:00.000+00:00';
const time_line = async () => {
  const time_lines = await TimeLine.find({
    user: mongoose.Types.ObjectId('606cc58a3ae225640fd0e2d5'),
    due_date: { $lte: new Date(due_date), $gt: new Date(due_date_old) },
  });
  console.log('time_lines', time_lines);
};

// time_line();

const timesheet_check = new CronJob(
  '* * * * *',
  async () => {
    const due_date = new Date();
    // due_date.setSeconds(0)
    // due_date.setMilliseconds(000)
    const timelines = await TimeLine.find({
      status: 'active',
      contact: mongoose.Types.ObjectId('60e273d089dc480cd80f87d5'),
      due_date: { $lte: due_date },
    });

    if (timelines) {
      for (let i = 0; i < timelines.length; i++) {
        const timeline = timelines[i];
        try {
          runTimeline(timeline);

          if (timeline.ref) {
            const next_data = {
              contact: timeline.contact,
              ref: timeline.ref,
            };
            activeNext(next_data);
          } else if (timeline.status === 'completed') {
            TimeLine.deleteOne({
              _id: timeline.id,
            }).catch((err) => {
              console.log('timeline remove err', err.message);
            });
          }
          if (timeline.condition && timeline.condition.answer === false) {
            const pair_timeline = await TimeLine.findOne({
              parent_ref: timeline.parent_ref,
              contact: timeline.contact,
              'condition.answer': true,
            });
            if (pair_timeline) {
              disableNext(pair_timeline.id);
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

const activeAutomationCheck = async () => {
  const users = await User.find({
    del: false,
  });

  const admin_ids = [
    '5e8e1b770b78d62cf7afdb23',
    '5e8dfe3a55680f716d915f69',
    '5e82a1ddefb6b226f4ded0dd',
    '5e8e9ac1f5ba3d316776af45',
    '5e8e9b97f5ba3d316776af48',
  ];

  const automation_admins = await Automation.find({
    _id: { $in: admin_ids },
  });

  // automation_admins.forEach((e) => {
  //   admin_ids.push(e._id);
  // });

  const migrated_users = [
    'todd.watkins@eXpRealty.com',
    'hello@sylviadana.com',
    'pyattandassociates@gmail.com',
    'wade.kelley@exprealty.com',
    'clayton@missionrealty.com',
    'Holly.Gerchen@eXprealty.com',
    'daniel@solidapproachrealty.com',
    'chris@texasidealproperties.com',
    'cheyanne@onelakeave.com',
    'brentwallgren@gmail.com',
    'johnsonrealtygroup.co@gmail.com',
    'joedbenson@gmail.com',
    'Gary.Jordan@exprealty.com',
    'Jeff@RussellRealtyGrp.com',
    'mike@877callmike.com',
    'chris.soignier@exprealty.com',
    'james@xrevolution.com',
    'michael.cabras@exprealty.com',
    'david.bordeaux@exprealty.com',
    'holly.brink@exprealty.com',
    'terry.reager@exprealty.com',
    'jaynelsonteam.dean@gmail.com',
    'victor.purdy@exprealty.com',
    'brad@pagepropertiesteam.com',
    'sandra.hunt@exprealty.com',
    'expteamlee@gmail.com',
    'jdavidelwood@gmail.com',
    'chadhanna@reachestateproperties.com',
    'brian@nvbrian.com',
    'haceehughes@gmail.com',
    'scott.williamson@exprealty.com',
    'leorobles.reo@gmail.com',
    'jaymasonrealestate@gmail.com',
    'rosie.rodriguez@exprealty.com',
    'charlaexprealty@gmail.com',
    'tommayhew@gmail.com',
    'harriet@ilovemyhome.com',
    'kelijameslv@gmail.com',
    'john.vallesteros@exprealty.com',
    'jane@janearmstrong.com',
    'mde@edwardsgrouptx.com',
    'mail@keitheveritt.com',
    'jacob.harris@exprealty.com',
    'support@joemendozateam.com',
    'kelvin@verrett4homes.com',
    'christi@davidsonregroup.com',
    'Kim.Kershaw@exprealty.com',
    'fraemagtaas@gmail.com',
  ];

  const user_emails = [
    'amandathetravelingrealtor@gmail.com',
    'Jessica@brookenieto.com',
    'rick.blakeley@exprealty.com',
    'syasin@bcelitegroup.com',
    'agent@phillip-williams.com',
    'christopher.hipps@exprealty.com',
    'bill.schall@exprealty.com',
    'richard.santos@exprealty.com',
    'bryan.decker@exprealty.com',
    'chandra.pallikan@exprealty.com',
    'Soldbyjoe@live.com',
    'realtorronkauai@gmail.com',
    'paula.piskie@exprealty.com',
    '4sailrealty@gmail.com',
    'Ameer@ameerelaheehomes.com',
    'todd@teamschroth.com',
    'Sally@HansonRealEstate.Net',
    'theremergroup@gmail.com',
    'TexasHomesAndRanches@gmail.com',
    'Abraham.Williams@exprealty.com',
    'chris.song@exprealty.com',
    'Keithflanagan1977@gmail.com',
    'ray.meyer@exprealty.com',
    'craig@thefiteam.com',
    'Diana@landbankproperty.com',
    'keithsalkeldexprealty@gmail.com',
    'elissa.stone@exprealty.com',
  ];
  for (let i = 0; i < user_emails.length; i++) {
    const user = await User.findOne({
      email: user_emails[i],
      del: false,
    });

    // const timeline = await TimeLine.findOne({
    //   user,
    //   automation: { $in: admin_ids },
    // });

    if (user) {
      automation_admins.forEach((automation_admin) => {
        const myJSON = JSON.stringify(automation_admin);
        const new_automation = JSON.parse(myJSON);
        delete new_automation['role'];
        delete new_automation['company'];
        delete new_automation['_id'];
        console.log('new_automation', user_emails[i]);
        const _automation = new Automation({
          ...new_automation,
          user: user.id,
        });

        _automation.save().catch((err) => {
          console.log('new automation save err', err.message);
        });
      });
    }

    // if (timeline) {
    // console.log(user.email);
    // automation_admins.forEach((automation_admin) => {
    //   const new_automation = automation_admin;
    //   new_automation['user'] = user.id;
    //   delete new_automation['role'];
    //   delete new_automation['company'];
    //   console.log('new_automation', new_automation);
    //   new_automation.save().catch((err) => {
    //     console.log('new automation save err', err.message);
    //   });
    // });
    // }
  }
};

activeAutomationCheck();
// timesheet_check.start();
// activeAutomationCheck();
