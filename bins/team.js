const mongoose = require('mongoose');
const User = require('../models/user');
const Team = require('../models/team');
const Contact = require('../models/contact');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

// Fetch or read data from
const team1 = async () => {
  const teams = await Team.find({}).catch((err) => {
    console.log('err', err);
  });

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    console.log('team', team.members);
    if (team.members && team.members.length >= 10) {
      console.log('team name', team.name);
    }
  }
};
team1();
