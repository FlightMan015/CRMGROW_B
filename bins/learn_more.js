// const mongoose = require('mongoose');
// const User = require('../models/user');
// const { DB_PORT } = require('../config/database');

// mongoose.set('useCreateIndex', true);
// mongoose
//   .connect(DB_PORT, { useNewUrlParser: true })
//   .then(() => console.log('Connecting to database successful'))
//   .catch((err) => console.error('Could not connect to mongo DB', err));
// //Fetch or read data from
// const migrate = async () => {
//   const users = await User.find({}).catch((err) => {
//     console.log('err', err);
//   });
//   for (let i = 0; i < users.length; i++) {
//     let user = users[i];
//     let user_name = user['user_name'];
//     let career_link =
//       user_name.split(/,\s|\s,|,|\s/)[0] +
//       user_name.split(/,\s|\s,|,|\s/)[1] +
//       '.exprealty.careers';
//     user['learn_more'] = career_link;
//     user.save();
//   }
// };
// migrate();
