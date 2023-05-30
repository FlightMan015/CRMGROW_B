const User = require('../models/user');
const system_settings = require('../config/system_settings');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const Tag = require('../models/tag');
const FollowUp = require('../models/follow_up');
const TimeLine = require('../models/time_line');
const Appointment = require('../models/appointment');
const Text = require('../models/text');
const Notification = require('../models/notification');
const Deal = require('../models/deal');
const PaidDemo = require('../models/paid_demo');
const Task = require('../models/task');
const Note = require('../models/note');
const Team = require('../models/team');
const EventType = require('../models/event_type');
const api = require('../config/api');

const { releaseSignalWireNumber, releaseTwilioNumber } = require('./text');
const { removeMaterials } = require('./material');

const { cancelCustomer } = require('../controllers/payment');
const { cancelAffiliate } = require('../controllers/affiliate');
const { REPLY: REPLY_EMAIl } = require('../constants/mail_contents');
const Labels = require('../constants/label');
const AWS = require('aws-sdk');

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const setPackage = async (data) => {
  const { user, level } = data;

  let contact_info;
  let material_info;
  let automation_info;
  let calendar_info;
  let text_info;
  let assist_info;
  let capture_enabled;
  let link_track_enabled;
  let email_info;
  let team_info;
  let sub_account_info;
  let pipe_info;
  let scheduler_info;
  let material_track_info;
  let landing_page_info;
  let support_info;
  let ext_email_info;

  if (level.includes('ELITE')) {
    material_info = {
      'material_info.is_limit': false,
      'material_info.record_max_duration':
        data.video_record_limit || system_settings.VIDEO_RECORD_LIMIT[level],
    };

    contact_info = {
      'contact_info.is_limit': false,
    };

    scheduler_info = {
      'scheduler_info.is_limit': false,
    };

    support_info = {
      'support_info.feature_request': true,
    };

    if (!data.is_sub_account) {
      sub_account_info = {
        'sub_account_info.is_enabled': true,
        'sub_account_info.max_count': system_settings.SUB_ACCOUNT_LIMIT[level],
      };

      const demo_mode = 1;
      paidDemoSetup(user, demo_mode);
    }
  } else {
    if (!level.includes('EXT_')) {
      contact_info = {
        'contact_info.is_limit': true,
        'contact_info.max_count': system_settings.CONTACT_UPLOAD_LIMIT[level],
      };

      material_info = {
        'material_info.is_limit': true,
        'material_info.upload_max_count':
          system_settings.MATERIAL_UPLOAD_LIMIT[level],
        'material_info.record_max_duration':
          system_settings.VIDEO_RECORD_LIMIT[level],
      };

      scheduler_info = {
        'scheduler_info.is_limit': true,
        'scheduler_info.max_count': system_settings.SCHEDULER_LIMIT[level],
      };
    } else {
      material_info = {
        'material_info.is_limit': true,
        'material_info.upload_max_count':
          system_settings.MATERIAL_UPLOAD_LIMIT[level],
        'material_info.record_max_duration':
          system_settings.VIDEO_RECORD_LIMIT[level],
      };
    }

    sub_account_info = {
      'sub_account_info.is_enabled': false,
      'sub_account_info.max_count': 0,
    };

    support_info = {
      'support_info.feature_request': false,
    };
  }

  if (level === 'LITE' || level.includes('EXT_')) {
    automation_info = {
      'automation_info.is_enabled': false,
    };

    calendar_info = {
      'calendar_info.is_enabled': false,
    };

    text_info = {
      'text_info.is_enabled': false,
    };

    assist_info = {
      'assistant_info.is_enabled': false,
    };

    email_info = {
      'email_info.mass_enable': false,
    };

    team_info = {
      'team_info.owner_enabled': false,
    };

    scheduler_info = {
      'scheduler_info.is_enabled': false,
    };

    capture_enabled = false;
    link_track_enabled = false;

    const currentUser = await User.findOne({
      _id: user,
    });

    if (currentUser.twilio_number_id) {
      releaseTwilioNumber(currentUser.twilio_number_id);
    }
  } else {
    automation_info = {
      'automation_info.is_enabled': true,
      'automation_info.max_count':
        data.automation_assign_limit ||
        system_settings.AUTOMATION_ASSIGN_LIMIT[level],
    };

    calendar_info = {
      'calendar_info.is_enabled': true,
      'calendar_info.max_count':
        data.calendar_limit || system_settings.CALENDAR_LIMIT[level],
    };

    text_info = {
      'text_info.is_enabled': true,
      'text_info.max_count':
        data.text_monthly_limit || system_settings.TEXT_MONTHLY_LIMIT[level],
    };

    assist_info = {
      'assistant_info.is_enabled': true,
      'assistant_info.max_count':
        data.assistant_limit || system_settings.ASSISTANT_LIMIT[level],
    };

    landing_page_info = {
      'landing_page_info.is_enabled': true,
      'landing_page_info.max_count':
        data.landing_page_limit || system_settings.LANDING_PAGE_LIMIT[level],
    };

    email_info = {
      'email_info.mass_enable': true,
    };

    team_info = {
      'team_info.owner_enabled': true,
      'team_info.max_count':
        data.team_own_limit || system_settings.TEAM_OWN_LIMIT[level],
    };

    pipe_info = {
      'pipe_info.max_count':
        data.pipe_limit || system_settings.PIPE_LIMIT[level],
    };

    capture_enabled = true;
    link_track_enabled = true;
  }

  if (level === 'EXT_FREE') {
    material_track_info = {
      'material_track_info.is_limit': true,
      'material_track_info.max_count':
        system_settings.MATERIAL_TRACK_LIMIT[level],
    };

    ext_email_info = {
      'ext_email_info.is_limit': true,
      'ext_email_info.max_count': system_settings.EXT_EMAIL_LIMIT[level],
    };
  } else {
    material_track_info = {
      'material_track_info.is_limit': false,
    };

    ext_email_info = {
      'ext_email_info.is_limit': false,
    };
  }

  const query = {
    ...contact_info,
    ...material_info,
    ...automation_info,
    ...calendar_info,
    ...text_info,
    ...assist_info,
    ...email_info,
    ...team_info,
    ...sub_account_info,
    ...pipe_info,
    ...scheduler_info,
    ...landing_page_info,
    ...support_info,
    ...material_track_info,
    ...ext_email_info,
    capture_enabled,
    link_track_enabled,
  };

  return User.updateOne(
    {
      _id: user,
    },
    {
      $set: query,
    }
  );
};

const paidDemoSetup = async (user, demo_mode) => {
  const new_demo = new PaidDemo({
    user,
    demo_mode,
  });

  const currentUser = await User.findOne({
    _id: user,
  });

  const schedule_link = system_settings.SCHEDULE_LINK_1_HOUR;

  new_demo.save().then(() => {
    const templatedData = {
      user_name: currentUser.user_name,
      schedule_link,
    };

    const params = {
      Destination: {
        ToAddresses: [currentUser.email],
      },
      Source: REPLY_EMAIl,
      Template: 'OnboardCall1',
      TemplateData: JSON.stringify(templatedData),
    };

    // Create the promise and SES service object
    ses
      .sendTemplatedEmail(params)
      .promise()
      .then((response) => {
        console.log('success', response.MessageId);
      })
      .catch((err) => {
        console.log('ses send err', err);
      });
  });
};

const addOnboard = async (user_id) => {
  // const { user_id } = data;
  const onboard_account = await User.findOne({
    email: system_settings.ONBOARD_ACCOUNT,
    del: false,
  });
  const user = await User.findOne({
    _id: user_id,
  });

  const new_contact = new Contact({
    first_name: user.user_name.split(' ')[0],
    last_name: user.user_name.split(' ')[1],
    email: user.email,
    cell_phone: user.cell_phone,
    company: user.company,
    tags: [user.package_level],
    source: user.id,
    user: onboard_account.id,
  });

  new_contact.save().catch((err) => {
    console.log('new conatct save err', err.message);
  });

  const new_activity = new Activity({
    contacts: new_contact.id,
    user: onboard_account.id,
    type: 'contacts',
    content: 'added contact',
  });

  new_activity
    .save()
    .then(() => {
      Contact.updateOne(
        {
          _id: new_contact.id,
        },
        {
          $set: { last_activity: new_activity.id },
        }
      )
        .then(() => {
          console.log('added new contact', user.email);
        })
        .catch((err) => {
          console.log('conatct last activity update err', err.message);
        });
    })
    .catch((err) => {
      console.log('new contact add err', err.message);
    });
};

const addAdmin = async (user_id, data) => {
  // const { user_id } = data;
  let additional_tags = [];
  if (data && data.tags) {
    additional_tags = data.tags;
  }

  const onboard_account = await User.findOne({
    email: system_settings.ADMIN_ACCOUNT,
    role: 'admin',
  });
  const user = await User.findOne({
    _id: user_id,
  });

  const new_contact = new Contact({
    first_name: user.user_name.split(' ')[0],
    last_name: user.user_name.split(' ')[1],
    email: user.email,
    cell_phone: user.cell_phone,
    company: user.company,
    tags: [user.package_level, ...additional_tags],
    label: Labels[1].id,
    source: user.id,
    user: onboard_account.id,
  });

  new_contact.save().catch((err) => {
    console.log('new conatct save err', err.message);
  });

  const new_activity = new Activity({
    contacts: new_contact.id,
    user: onboard_account.id,
    type: 'contacts',
    content: 'added contact',
  });

  new_activity
    .save()
    .then(() => {
      Contact.updateOne(
        {
          _id: new_contact.id,
        },
        {
          $set: { last_activity: new_activity.id },
        }
      )
        .then(() => {
          console.log('added new contact', user.email);
        })
        .catch((err) => {
          console.log('conatct last activity update err', err.message);
        });
    })
    .catch((err) => {
      console.log('new contact add err', err.message);
    });
};

const clearAccount = async (user_id) => {
  const currentUser = await User.findOne({
    _id: user_id,
  }).catch((err) => {
    console.log('user find err', err.message);
  });

  if (!currentUser) {
    return new Promise((resolve) => {
      resolve({
        status: false,
        error: 'No existing user',
      });
    });
  }

  await TimeLine.deleteMany({ user: currentUser.id });
  await Task.deleteMany({ user: currentUser.id });
  await FollowUp.deleteMany({ user: currentUser.id });

  try {
    if (currentUser.proxy_number_id) {
      releaseSignalWireNumber(currentUser.proxy_number_id);
    }

    if (currentUser.twilio_number_id) {
      releaseTwilioNumber(currentUser.twilio_number_id);
    }

    if (currentUser.affiliate) {
      cancelAffiliate(currentUser.affiliate.id);
    }
    if (currentUser.payment) {
      cancelCustomer(currentUser.payment).catch((err) => {
        console.log('cancel payment err', err);
      });
    }
  } catch (err) {
    console.log('clear service account err', err.message);
  }

  User.updateOne(
    {
      _id: currentUser.id,
    },
    {
      $set: {
        del: true,
        data_cleaned: false,
        disabled_at: new Date(),
      },
      $unset: {
        proxy_number_id: true,
        proxy_number: true,
        twilio_number_id: true,
        twilio_number: true,
      },
    }
  ).catch((err) => {
    console.log('user update remove err', err.message);
  });
};

const clearData = async (user_id) => {
  const currentUser = await User.findOne({
    _id: user_id,
  }).catch((err) => {
    console.log('user find err', err.message);
  });

  if (!currentUser) {
    return new Promise((resolve) => {
      resolve({
        status: false,
        error: 'No existing user',
      });
    });
  }

  await Contact.deleteMany({ user: currentUser.id });
  await Activity.deleteMany({ user: currentUser.id });
  await Appointment.deleteMany({ user: currentUser.id });
  await Tag.deleteMany({ user: currentUser.id });
  await Text.deleteMany({ user: currentUser.id });
  await Notification.deleteMany({ user: currentUser.id });
  await Note.deleteMany({ user: currentUser.id });
  await Deal.deleteMany({ user: currentUser.id });
  await Team.deleteMany({ user: currentUser.id });
  await Team.updateMany(
    {
      members: currentUser.id,
    },
    {
      $pull: { members: [currentUser.id] },
    }
  );
  await EventType.deleteMany({ user: currentUser.id });

  removeMaterials(currentUser.id);

  User.updateOne(
    {
      _id: currentUser.id,
    },
    {
      $set: {
        data_cleaned: true,
      },
    }
  ).catch((err) => {
    console.log('user update remove err', err.message);
  });

  return Promise((resolve) => {
    resolve({
      status: true,
    });
  });
};

const promocodeCheck = (package_level, promo) => {
  if (package_level.includes('EVO')) {
    if (system_settings.PRO_CODE['EVO'] === promo) {
      return true;
    } else {
      return false;
    }
  } else {
    return true;
  }
};

const addNickName = async (user_id) => {
  const user = await User.findOne({ _id: user_id });

  if (!user.nick_name) {
    let nick_name;
    nick_name = user.user_name.toLowerCase().trim().replace(/\s/g, '');

    const nick_users = await User.find({
      nick_name: { $regex: nick_name + '.*', $options: 'i' },
    });

    if (nick_users.length > 0) {
      nick_name = `${nick_name}${nick_users.length}`;
    }

    User.updateOne(
      {
        _id: user_id,
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
};

module.exports = {
  setPackage,
  addOnboard,
  addAdmin,
  clearAccount,
  clearData,
  paidDemoSetup,
  promocodeCheck,
  addNickName,
};
