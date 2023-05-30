// const mongoose = require('mongoose');
// const User = require('../models/user')
// const { DB_PORT } = require('../config/database');

// mongoose.set('useCreateIndex', true)
// mongoose.connect(DB_PORT, {useNewUrlParser: true})
// .then(() => console.log('Connecting to database successful'))
// .catch(err => console.error('Could not connect to mongo DB', err))
// //Fetch or read data from
// const migrate = async() => {
//   const users = await User.find({}).catch(err=>{
//     console.log('err', err)
//   })
//   for(let i=0; i<users.length; i++){
//     const user = users[i]
//     user['del'] = false
//     if(user.payment.length===0){
//       user.payment = undefined
//     }
//     user.save().catch(err=>{
//       console.log('err', err)
//     })
//   }
// }
// migrate();
// const mongoose = require('mongoose');
// const User = require('../models/user')
// const { DB_PORT } = require('../config/database');

// mongoose.set('useCreateIndex', true)
// mongoose.connect(DB_PORT, {useNewUrlParser: true})
// .then(() => console.log('Connecting to database successful'))
// .catch(err => console.error('Could not connect to mongo DB', err))
// //Fetch or read data from
// const migrate = async() => {
//   const users = await User.find({}).catch(err=>{
//     console.log('err', err)
//   })
//   for(let i=0; i<users.length; i++){
//     const user = users[i]
//     user['admin_loggin'] = false
//     user.save().catch(err=>{
//       console.log('err', err)
//     })
//   }
// }
// migrate();

const mongoose = require('mongoose');

const Contact = require('../models/contact');
const { ENV_PATH } = require('../config/path');
// const { addOnboard } = require('../helpers/user');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const User = require('../models/user');
// Fetch or read data from
const migrate = async () => {
  User.updateMany(
    {
      del: false,
    },
    {
      $set: {
        'text_info.count': 0,
      },
    }
  )
    .then(() => {
      console.log('text count update finished');
    })
    .catch((err) => {
      console.log('user update err', err.message);
    });
};

const migrateOldusers = async () => {
  const users = await User.find({
    del: false,
    user_version: 2,
  });
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    // addOnboard(user.id);
  }
};

const wavvTrial = async () => {
  const users = await User.countDocuments({
    del: false,
    'dialer_info.is_enabled': true,
  });
  console.log('users', users);
};

const addNickname = async () => {
  const users = await User.find({ del: false });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (!user.nick_name) {
      let nick_name;
      nick_name = user.user_name.toLowerCase().trim().replace(/\s/g, '');

      const nick_users = await User.find({
        nick_name: { $regex: nick_name + '.*', $options: 'i' },
      });

      if (nick_users.length > 0) {
        console.log('nick_name', nick_name);
        nick_name = `${nick_name}${nick_users.length}`;
      }

      User.updateOne(
        {
          _id: user.id,
        },
        {
          $set: {
            nick_name,
          },
        }
      )
        .then(() => {
          console.log('user updated', user.email);
        })
        .catch((err) => {
          console.log('nick name update error', err.message);
        });
    }
  }
};

const setLiteUser = () => {
  User.updateMany(
    {
      package_level: 'LITE',
    },
    {
      $set: {
        'scheduler_info.is_enabled': false,
      },
    }
  )
    .then((res) => {
      console.log('res', res);
    })
    .catch((err) => {
      console.log('schedulear info set false err', err.message);
    });
};

const setEliteUser = () => {
  User.updateMany(
    {
      package_level: 'ELITE',
    },
    {
      $set: {
        'scheduler_info.max_count': 3,
      },
    }
  )
    .then((res) => {
      console.log('res', res);
    })
    .catch((err) => {
      console.log('schedulear info set false err', err.message);
    });
};

// migrate();
// migrateOldusers();
// wavvTrial();
// setLiteUser();
setEliteUser();
// addNickname();
