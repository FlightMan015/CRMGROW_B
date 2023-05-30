const phone = require('phone');
const mongoose = require('mongoose');

const User = require('../models/user');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const Text = require('../models/text');
const Payment = require('../models/payment');
const PaymentCtrl = require('./payment');
const urls = require('../constants/urls');
const api = require('../config/api');
const system_settings = require('../config/system_settings');

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);
const moment = require('moment-timezone');
const { RestClient } = require('@signalwire/node');

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});

const VideoTracker = require('../models/video_tracker');
const { sendNotificationEmail } = require('../helpers/email');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
const Video = require('../models/video');
const Image = require('../models/image');
const PDF = require('../models/pdf');
const Garbage = require('../models/garbage');

const { sendText, updateUserTextCount } = require('../helpers/text');

const { createCharge } = require('./payment');
const {
  releaseSignalWireNumber,
  releaseTwilioNumber,
} = require('../helpers/text');
const { createNotification } = require('../helpers/notification');
const { assignTimeline } = require('../helpers/automation');

const getAll = async (req, res) => {
  const { currentUser } = req;
  const data = [];
  const contacts = await Text.aggregate([
    {
      $match: {
        user: currentUser._id,
      },
    },
    {
      $group: {
        _id: '$contacts',
        content: { $last: '$content' },
        created_at: { $last: '$created_at' },
        updated_at: { $last: '$updated_at' },
        type: { $last: '$type' },
        text_id: { $last: '$id' },
        status: { $last: '$status' },
      },
    },
    {
      $lookup: {
        from: 'contacts',
        localField: '_id',
        foreignField: '_id',
        as: 'contacts',
      },
    },
    {
      $sort: { created_at: -1 },
    },
  ]);

  return res.send({
    status: true,
    data: contacts,
  });
};

const getContactMessageOfCount = async (req, res) => {
  const { currentUser } = req;

  let search = '';
  const getCount = req.body.count || 5;
  const skipNum = req.body.skip || 0;
  const searchStr = req.body.searchStr || '';
  let phoneSearchStr = '';
  if (searchStr) {
    search = searchStr.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
    phoneSearchStr = searchStr.replace(/[.*+\-?^${}()|[\]\\\s]/g, '');
  }

  const data = [];
  let contacts;
  if (search) {
    if (search.split(' ').length > 1) {
      contacts = await Text.aggregate([
        {
          $match: {
            user: currentUser._id,
          },
        },
        { $unwind: '$contacts' },
        {
          $group: {
            _id: '$contacts',
            content: { $last: '$content' },
            created_at: { $last: '$created_at' },
            updated_at: { $last: '$updated_at' },
            type: { $last: '$type' },
            text_id: { $last: '$id' },
            status: { $last: '$status' },
            send_status: { $last: '$send_status' },
          },
        },
        {
          $lookup: {
            from: 'contacts',
            localField: '_id',
            foreignField: '_id',
            as: 'contacts',
          },
        },
        { $unwind: '$contacts' },
        {
          $match: {
            $or: [
              {
                'contacts.first_name': {
                  $regex: '.*' + search + '.*',
                  $options: 'i',
                },
              },
              {
                'contacts.last_name': {
                  $regex: '.*' + search + '.*',
                  $options: 'i',
                },
              },
              {
                'contacts.first_name': {
                  $regex: '.*' + search.split(' ')[0] + '.*',
                  $options: 'i',
                },
                'contacts.last_name': {
                  $regex: '.*' + search.split(' ')[1] + '.*',
                  $options: 'i',
                },
              },
              {
                'contacts.cell_phone': {
                  $regex: '.*' + phoneSearchStr + '.*',
                  $options: 'i',
                },
              },
            ],
          },
        },
        {
          $sort: { created_at: -1 },
        },
        { $skip: skipNum },
        { $limit: getCount },
      ]);
    } else {
      contacts = await Text.aggregate([
        {
          $match: {
            user: currentUser._id,
          },
        },
        { $unwind: '$contacts' },
        {
          $group: {
            _id: '$contacts',
            content: { $last: '$content' },
            created_at: { $last: '$created_at' },
            updated_at: { $last: '$updated_at' },
            type: { $last: '$type' },
            text_id: { $last: '$id' },
            status: { $last: '$status' },
          },
        },
        {
          $lookup: {
            from: 'contacts',
            localField: '_id',
            foreignField: '_id',
            as: 'contacts',
          },
        },
        { $unwind: '$contacts' },
        {
          $match: {
            $or: [
              {
                'contacts.first_name': {
                  $regex: '.*' + search + '.*',
                  $options: 'i',
                },
              },
              {
                'contacts.last_name': {
                  $regex: '.*' + search + '.*',
                  $options: 'i',
                },
              },
              {
                'contacts.cell_phone': {
                  $regex: '.*' + phoneSearchStr + '.*',
                  $options: 'i',
                },
              },
            ],
          },
        },
        {
          $sort: { created_at: -1 },
        },
        { $skip: skipNum },
        { $limit: getCount },
      ]);
    }
  } else {
    contacts = await Text.aggregate([
      {
        $match: {
          user: currentUser._id,
        },
      },
      { $unwind: '$contacts' },
      {
        $group: {
          _id: '$contacts',
          content: { $last: '$content' },
          created_at: { $last: '$created_at' },
          updated_at: { $last: '$updated_at' },
          type: { $last: '$type' },
          text_id: { $last: '$id' },
          status: { $last: '$status' },
        },
      },
      {
        $lookup: {
          from: 'contacts',
          localField: '_id',
          foreignField: '_id',
          as: 'contacts',
        },
      },
      { $unwind: '$contacts' },
      {
        $sort: { created_at: -1 },
      },
      { $skip: skipNum },
      { $limit: getCount },
    ]);
  }

  return res.send({
    status: true,
    data: contacts,
    count: getCount,
  });
};

const send = async (req, res) => {
  const { currentUser } = req;
  const { text } = req.body;
  const contact = await Contact.findOne({ _id: req.params.id }).catch((err) => {
    console.log('err', err);
  });
  const e164Phone = phone(contact.cell_phone)[0];
  let fromNumber = currentUser['proxy_number'];

  if (!fromNumber) {
    const areaCode = currentUser.cell_phone.substring(1, 4);
    const data = await twilio.availablePhoneNumbers('US').local.list({
      areaCode,
    });

    const number = data[0];
    const proxy_number = await twilio.incomingPhoneNumbers.create({
      phoneNumber: number.phoneNumber,
      smsUrl: urls.SMS_RECEIVE_URL,
    });
    currentUser['proxy_number'] = proxy_number.phoneNumber;
    fromNumber = currentUser['proxy_number'];
    currentUser.save().catch((err) => {
      console.log('err', err);
    });
  }

  console.info(`Send SMS: ${fromNumber} -> ${contact.cell_phone} :`, text);

  if (!e164Phone) {
    return res.status(400).send({
      status: false,
      error: 'Invalid phone number',
    });
  }

  await twilio.messages
    .create({ from: fromNumber, body: text, to: e164Phone })
    .catch((err) => {
      console.log('err', err);
    });

  const new_text = new Text({
    content: req.body.text,
    contact: req.params.id,
    to: e164Phone,
    from: fromNumber,
    user: currentUser.id,
  });

  new_text
    .save()
    .then((_sms) => {
      const activity = new Activity({
        content: currentUser.user_name + ' sent text',
        contacts: _sms.contact,
        user: currentUser.id,
        type: 'texts',
        text: _sms.id,
      });

      activity.save().then((_activity) => {
        const myJSON = JSON.stringify(_sms);
        const data = JSON.parse(myJSON);
        data.activity = _activity;
        res.send({
          status: true,
          data,
        });
      });
    })
    .catch((e) => {
      let errors;
      if (e.errors) {
        errors = e.errors.map((err) => {
          delete err.instance;
          return err;
        });
      }
      return res.status(500).send({
        status: false,
        error: errors || e,
      });
    });
};

const receive = async (req, res) => {
  const text = req.body['Body'];
  const from = req.body['From'];
  const to = req.body['To'];

  const currentUser = await User.findOne({ twilio_number: to }).catch((err) => {
    console.log('current user found err sms', err.message);
  });

  if (currentUser != null) {
    const phoneNumber = req.body['From'];

    const contact = await Contact.findOne({
      cell_phone: phoneNumber,
      user: currentUser.id,
    }).catch((err) => {
      console.log('contact found err sms reply', err);
    });

    // let phoneNumberString
    // if(currentUser.phone) {
    //   const userPhone = currentUser.phone
    //   phoneNumberString = userPhone.internationalNumber
    // } else {
    //   phoneNumberString = TextHelper.matchUSPhoneNumber(currentUser.cell_phone)
    // }

    // if (!e164Phone) {
    //   const error = {
    //     error: 'Invalid Phone Number'
    //   }

    //   throw error // Invalid phone number
    // }

    if (contact) {
      const content =
        contact.first_name +
        ', please call/text ' +
        currentUser.user_name +
        ' back at: ' +
        currentUser.cell_phone;
      await twilio.messages
        .create({ from: to, body: content, to: from })
        .catch((err) => {
          console.log('sms reply err', err);
        });
    }

    // const sms = new SMS({
    //   content: text,
    //   contact: contact.id,
    //   to: currentUser.cell_phone,
    //   from: from,
    //   user: currentUser.id,
    //   updated_at: new Date(),
    //   created_at: new Date(),
    // })

    // const _sms = await sms.save()

    // const activity = new Activity({
    //   content: contact.first_name + ' replied text',
    //   contacts: contact.id,
    //   user: currentUser.id,
    //   type: 'sms',
    //   sms: _sms.id,
    //   created_at: new Date(),
    //   updated_at: new Date(),
    // })

    // activity.save()
  }
  return res.send({
    status: true,
  });
};

const receive1 = async (req, res) => {
  const text = req.body['Body'];
  const from = req.body['From'];
  const to = req.body['To'];

  const currentUser = await User.findOne({ proxy_number: to }).catch((err) => {
    console.log('current user found err sms', err.message);
  });

  if (currentUser != null) {
    const phoneNumber = req.body['From'];

    const contact = await Contact.findOne({
      cell_phone: phoneNumber,
      user: currentUser.id,
    }).catch((err) => {
      console.log('contact found err sms reply', err);
    });

    if (contact) {
      if (text.toLowerCase() === 'stop') {
        const activity = new Activity({
          content: 'unsubscribed sms',
          contacts: contact.id,
          user: currentUser.id,
          type: 'sms_trackers',
          created_at: new Date(),
          updated_at: new Date(),
        });

        const _activity = await activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: _activity.id },
            $push: { tags: { $each: ['unsubscribed'] } },
          }
        ).catch((err) => {
          console.log('err', err);
        });
        const content =
          'You have successfully been unsubscribed. You will not receive any more messages from this number.';

        await client.messages
          .create({
            from: to,
            to: from,
            body: content,
          })
          .catch((err) => {
            console.log('sms reply err', err);
          });
      } else {
        const content =
          contact.first_name +
          ', please call/text ' +
          currentUser.user_name +
          ' back at: ' +
          currentUser.cell_phone;

        await client.messages
          .create({
            from: to,
            to: from,
            body: content,
          })
          .catch((err) => {
            console.log('sms reply err', err);
          });
      }
    }
  }
  return res.send({
    status: true,
  });
};

const get = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.body;
  const textSelectPath = {
    user: 1,
    deal: 1,
    phone: 1,
    content: 1,
    from: 1,
    type: 1,
    status: 1,
    has_shared: 1,
    shared_text: 1,
    video_tracker: 1,
    pdf_tracker: 1,
    image_tracker: 1,
    service_type: 1,
    created_at: 1,
    updated_at: 1,
    ['send_status.' + contact]: 1,
  };
  const data = await Text.find({
    user: currentUser.id,
    contacts: contact,
  }).select(textSelectPath);

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Contact doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const handleSmartCode = async (user_id, smart_code, contact_id) => {
  // send auto-reply message
  const website = urls.DOMAIN_ADDR;
  if (smart_code['message']) {
    const videoIds = [];
    const pdfIds = [];
    const imageIds = [];

    const videoReg = new RegExp(website + '/video[?]video=\\w+', 'g');
    const pdfReg = new RegExp(website + '/pdf[?]pdf=\\w+', 'g');
    const imageReg = new RegExp(website + '/image[?]image=\\w+', 'g');

    let matches = smart_code['message'].match(videoReg);
    if (matches && matches.length) {
      matches.forEach((e) => {
        const videoId = e.replace(website + '/video?video=', '');
        videoIds.push(videoId);
      });
    }
    matches = smart_code['message'].match(pdfReg);
    if (matches && matches.length) {
      matches.forEach((e) => {
        const pdfId = e.replace(website + '/pdf?pdf=', '');
        pdfIds.push(pdfId);
      });
    }
    matches = smart_code['message'].match(imageReg);
    if (matches && matches.length) {
      matches.forEach((e) => {
        const imageId = e.replace(website + '/image?image=', '');
        imageIds.push(imageId);
      });
    }

    const text_data = {
      user: user_id,
      content: smart_code['message'],
      contacts: [contact_id],
      videoIds,
      pdfIds,
      imageIds,
    };

    sendText(text_data)
      .then((_res) => {
        const errors = [];
        let sentCount = 0;
        const sendStatus = {};
        const invalidContacts = [];
        const textResult = _res.splice(-1);
        _res.forEach((e) => {
          if (!e.status && !e.type) {
            errors.push(e);
          }
          if (e.isSent || e.status) {
            sentCount++;
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
          if (invalidContacts.length === 1) {
            Text.deleteOne({ _id: textResult[0]['text'] }).catch((err) => {
              console.log('remove texting is failed', err);
            });
          } else {
            Text.updateOne({ _id: textResult[0]['text'] }, query).catch(
              (err) => {
                console.log('texting result saving is failed', err);
              }
            );
          }
        }

        if (sentCount) {
          updateUserTextCount(user_id, sentCount).catch((err) => {
            console.log('update user text info is failed.', err);
          });
        }
      })
      .catch((err) => {
        console.log('send text err', err);
      });
  }

  // automation trigger
  if (smart_code['automation']) {
    const data = {
      assign_array: [contact_id],
      automation_id: smart_code['automation'],
      user_id,
      required_unique: true,
    };

    assignTimeline(data)
      .then((_res) => {
        if (!_res[0].status) {
          console.log('automation assign err', _res[0].error);
        }
      })
      .catch((err) => {
        console.log('assign automation err', err.message);
      });
  }
};

const receiveTextSignalWire = async (req, res) => {
  let text = req.body['Body'];
  const from = req.body['From'];
  const to = req.body['To'];

  const currentUser = await User.findOne({ proxy_number: to }).catch((err) => {
    console.log('current user found err text', err.message);
  });

  if (currentUser) {
    const phoneNumber = req.body['From'];

    const contact = await Contact.findOne({
      $or: [
        { cell_phone: phoneNumber, user: currentUser.id },
        { cell_phone: phoneNumber, shared_members: currentUser.id },
      ],
    }).catch((err) => {
      console.log('contact found err sms reply', err);
    });

    if (contact) {
      if (text.toLowerCase() === 'stop') {
        const activity = new Activity({
          content: 'unsubscribed sms',
          contacts: contact.id,
          user: currentUser.id,
          type: 'text_trackers',
          created_at: new Date(),
          updated_at: new Date(),
        });

        activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: activity.id },
            $push: { tags: { $each: ['unsubscribed'] } },
          }
        ).catch((err) => {
          console.log('err', err);
        });
        const content =
          'You have successfully been unsubscribed. You will not receive any more messages from this number.';

        await client.messages
          .create({
            from: to,
            to: from,
            body: content,
          })
          .catch((err) => {
            console.log('sms reply err', err);
          });

        createNotification(
          'unsubscribe_text',
          {
            criteria: 'unsubscribe_text',
            user: currentUser,
            contact,
          },
          currentUser
        );
      } else {
        let segmentInfo;
        const segmentReg = /\((\d+)\/(\d+)\)/;
        if (segmentReg.test(text)) {
          // prev check
          const matches = text.match(segmentReg);
          if (matches.length && matches.index === 0) {
            const segmentIndex = parseInt(matches[1]);
            const segmentCounts = parseInt(matches[2]);
            if (segmentIndex > 1) {
              const currentDate = new Date(new Date().getTime() - 30000);
              const prevText = await Text.findOne(
                {
                  user: currentUser.id,
                  contacts: contact.id,
                  type: 1,
                  updated_at: { $gte: currentDate },
                },
                {},
                { sort: { created_at: -1 } }
              ).catch((err) => {
                console.log('latest text find', err);
              });
              console.log('prev text', prevText);
              if (
                prevText &&
                prevText.segment &&
                prevText.segment.index === segmentIndex - 1 &&
                prevText.segment.total === segmentCounts
              ) {
                const newText = text.replace(`${matches[0]}`, '');
                const updatedText = prevText.content + newText;
                Text.updateOne(
                  { _id: prevText._id },
                  {
                    $set: {
                      content: updatedText,
                      'segment.index': segmentIndex,
                    },
                  }
                ).catch((err) => {
                  console.log('update text error ', err.message);
                });
                return res.send();
              }
            } else {
              text = text.replace(`${matches[0]}`, '');
              segmentInfo = { index: segmentIndex, total: segmentCounts };
            }
          }
        }

        const garbage = await Garbage.findOne({
          user: currentUser.id,
        });

        if (garbage.smart_codes) {
          const code = text.toLowerCase().trim();
          if (code && garbage.smart_codes[code]) {
            const smart_code = garbage.smart_codes[code];
            handleSmartCode(currentUser, smart_code, contact);

            if (smart_code['tag']) {
              Contact.updateOne(
                {
                  _id: contact.id,
                },
                {
                  $addToSet: { tags: { $each: smart_code['tag'].split(',') } },
                }
              ).catch((err) => {
                console.log('smart tag update err', err.message);
              });
            }
          }
        }

        const new_text = new Text({
          user: currentUser.id,
          contacts: contact.id,
          content: text,
          status: 0,
          type: 1,
          segment: segmentInfo,
        });

        new_text.save().catch((err) => {
          console.log('new text save err', err.message);
        });

        const activity = new Activity({
          content: 'received text',
          contacts: contact.id,
          user: currentUser.id,
          type: 'texts',
          texts: new_text.id,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: activity.id },
          }
        ).catch((err) => {
          console.log('err', err);
        });

        // ============================ Web Push, Email, Text Notification =================
        console.log('receive text');
        createNotification(
          'receive_text',
          {
            criteria: 'receive_text',
            user: currentUser,
            text,
            contact,
          },
          currentUser
        );
      }
    } else {
      let tags = ['textlead'];
      const contact = new Contact({
        user: currentUser.id,
        cell_phone: phoneNumber,
        first_name: phoneNumber,
        tags,
      });

      contact.save().catch((err) => {
        console.log('contact create err sms reply', err);
      });

      const garbage = await Garbage.findOne({
        user: currentUser.id,
      });

      if (garbage.smart_codes) {
        const code = text.toLowerCase().trim();
        if (code && garbage.smart_codes[code]) {
          const smart_code = garbage.smart_codes[code];
          const smart_code_tags = smart_code['tag']
            ? smart_code['tag'].split(',')
            : [];
          tags = [...tags, smart_code_tags];

          handleSmartCode(currentUser.id, smart_code, contact.id);
        }
      }

      const new_text = new Text({
        user: currentUser.id,
        contacts: contact.id,
        content: text,
        status: 0,
        type: 1,
      });

      new_text.save().catch((err) => {
        console.log('new text save err', err.message);
      });

      const activity = new Activity({
        content: 'LEAD CAPTURE - received text',
        contacts: contact.id,
        user: currentUser.id,
        type: 'texts',
        texts: new_text.id,
      });

      activity.save().catch((err) => {
        console.log('contact create err sms reply', err);
      });

      Contact.updateOne(
        { _id: contact.id },
        {
          $set: {
            last_activity: activity.id,
            tags,
          },
        }
      ).catch((err) => {
        console.log('err', err);
      });

      createNotification(
        'receive_text',
        {
          criteria: 'receive_text',
          user: currentUser,
          text,
          contact,
        },
        currentUser
      );
    }
  }
  return res.send();
};

const receiveTextTwilio = async (req, res) => {
  let text = req.body['Body'];
  const from = req.body['From'];
  const to = req.body['To'];

  const currentUser = await User.findOne({ twilio_number: to }).catch((err) => {
    console.log('current user found err sms', err.message);
  });

  if (currentUser != null) {
    const phoneNumber = req.body['From'];

    const contact = await Contact.findOne({
      $or: [
        { cell_phone: phoneNumber, user: currentUser.id },
        { cell_phone: phoneNumber, shared_members: currentUser.id },
      ],
    }).catch((err) => {
      console.log('contact found err sms reply', err);
    });

    if (contact) {
      if (text.toLowerCase() === 'stop') {
        const activity = new Activity({
          content: 'unsubscribed sms',
          contacts: contact.id,
          user: currentUser.id,
          type: 'text_trackers',
          created_at: new Date(),
          updated_at: new Date(),
        });

        const _activity = await activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: _activity.id },
            $push: { tags: { $each: ['unsubscribed'] } },
          }
        ).catch((err) => {
          console.log('err', err);
        });
        const content =
          'You have successfully been unsubscribed. You will not receive any more messages from this number.';

        await client.messages
          .create({
            from: to,
            to: from,
            body: content,
          })
          .catch((err) => {
            console.log('sms reply err', err);
          });

        createNotification(
          'unsubscribe_text',
          {
            criteria: 'unsubscribe_text',
            user: currentUser,
            contact,
          },
          currentUser
        );
      } else {
        let segmentInfo;
        const segmentReg = /\((\d+)\/(\d+)\)/;
        if (segmentReg.test(text)) {
          // prev check
          const matches = text.match(segmentReg);
          if (matches.length && matches.index === 0) {
            const segmentIndex = parseInt(matches[1]);
            const segmentCounts = parseInt(matches[2]);
            if (segmentIndex > 1) {
              const currentDate = new Date(new Date().getTime() - 30000);
              const prevText = await Text.findOne(
                {
                  user: currentUser.id,
                  contacts: contact.id,
                  type: 1,
                  updated_at: { $gte: currentDate },
                },
                {},
                { sort: { created_at: -1 } }
              ).catch((err) => {
                console.log('latest text find', err);
              });
              console.log('prev text', prevText);
              if (
                prevText &&
                prevText.segment &&
                prevText.segment.index === segmentIndex - 1 &&
                prevText.segment.total === segmentCounts
              ) {
                const newText = text.replace(`${matches[0]}`, '');
                const updatedText = prevText.content + newText;
                Text.updateOne(
                  { _id: prevText._id },
                  {
                    $set: {
                      content: updatedText,
                      'segment.index': segmentIndex,
                    },
                  }
                ).catch((err) => {
                  console.log('update text error ', err.message);
                });
                return res.send();
              }
            } else {
              text = text.replace(`${matches[0]}`, '');
              segmentInfo = { index: segmentIndex, total: segmentCounts };
            }
          }
        }

        const garbage = await Garbage.findOne({
          user: currentUser.id,
        });

        if (garbage.smart_codes) {
          const code = text.toLowerCase().trim();
          if (code && garbage.smart_codes[code]) {
            const smart_code = garbage.smart_codes[code];
            handleSmartCode(currentUser.id, smart_code, contact.id);

            if (smart_code['tag']) {
              Contact.updateOne(
                {
                  _id: contact.id,
                },
                {
                  $addToSet: { tags: { $each: smart_code['tag'].split(',') } },
                }
              ).catch((err) => {
                console.log('smart tag update err', err.message);
              });
            }
          }
        }

        const new_text = new Text({
          user: currentUser.id,
          contacts: contact.id,
          content: text,
          status: 0,
          type: 1,
          segment: segmentInfo,
        });

        new_text.save().catch((err) => {
          console.log('new text save err', err.message);
        });

        const activity = new Activity({
          content: 'received text',
          contacts: contact.id,
          user: currentUser.id,
          type: 'texts',
          texts: new_text.id,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: activity.id },
          }
        ).catch((err) => {
          console.log('err', err);
        });

        // ============================ Web Push, Email, Text Notification =================
        createNotification(
          'receive_text',
          {
            criteria: 'receive_text',
            user: currentUser,
            text,
            contact,
          },
          currentUser
        );
      }
    } else {
      let tags = ['textlead'];
      const contact = new Contact({
        user: currentUser.id,
        cell_phone: phoneNumber,
        first_name: phoneNumber,
        tags,
      });

      contact.save().catch((err) => {
        console.log('contact create err sms reply', err);
      });

      const garbage = await Garbage.findOne({
        user: currentUser.id,
      });

      if (garbage.smart_codes) {
        const code = text.toLowerCase().trim();
        if (code && garbage.smart_codes[code]) {
          const smart_code = garbage.smart_codes[code];
          const smart_code_tags = smart_code['tag']
            ? smart_code['tag'].split(',')
            : [];
          tags = [...tags, smart_code_tags];

          handleSmartCode(currentUser, smart_code, contact);
        }
      }

      const new_text = new Text({
        user: currentUser.id,
        contacts: contact.id,
        content: text,
        status: 0,
        type: 1,
      });

      new_text.save().catch((err) => {
        console.log('new text save err', err.message);
      });

      const activity = new Activity({
        content: 'LEAD CAPTURE - received text',
        contacts: contact.id,
        user: currentUser.id,
        type: 'texts',
        texts: new_text.id,
      });

      activity.save().catch((err) => {
        console.log('contact create err sms reply', err);
      });

      Contact.updateOne(
        { _id: contact.id },
        {
          $set: {
            last_activity: activity.id,
            tags,
          },
        }
      ).catch((err) => {
        console.log('err', err);
      });

      createNotification(
        'receive_text',
        {
          criteria: 'receive_text',
          user: currentUser,
          text,
          contact,
        },
        currentUser
      );

      // const content =
      //   'Please call/text ' +
      //   currentUser.user_name +
      //   ' back at: ' +
      //   currentUser.cell_phone;

      // await twilio.messages
      //   .create({ from: to, body: content, to: from })
      //   .catch((err) => {
      //     console.log('sms reply err', err);
      //   });
    }
  }
  return res.send();
};

const searchNumbers = async (req, res) => {
  const { currentUser } = req;
  let areaCode;
  let countryCode;
  const data = [];
  const phone = currentUser.phone;
  if (phone && phone.number) {
    areaCode = phone.number.substring(0, 3);
    countryCode = phone.countryCode;
  } else {
    areaCode = currentUser.cell_phone.substring(1, 4);
    countryCode = 'US';
  }

  const search_code = req.body.searchCode || areaCode;

  if (search_code) {
    twilio
      .availablePhoneNumbers(countryCode)
      .local.list({
        areaCode: search_code,
      })
      .then(async (response) => {
        const number = response[0];

        if (typeof number === 'undefined' || number === '+') {
          return res.send({
            status: true,
            data: [],
          });
        } else {
          const length = response.length > 5 ? 5 : response.length;
          for (let i = 0; i < length; i++) {
            data.push({
              number: response[i].phoneNumber,
              region: response[i].region,
              locality: response[i].locality,
            });
          }

          return res.send({
            status: true,
            data,
          });
        }
      })
      .catch((err) => {
        return res.status(500).json({
          status: false,
          error: err.message || err,
        });
      });
  } else {
    return res.send({
      status: true,
      data,
    });
  }

  /** 
  if (countryCode === 'US' || countryCode === 'CA') {
    client
      .availablePhoneNumbers(countryCode)
      .local.list({
        areaCode: search_code,
      })
      .then(async (available_phone_numbers) => {
        if (available_phone_numbers && available_phone_numbers.length > 0) {
          available_phone_numbers.forEach((number) => {
            data.push({
              number: number.phoneNumber,
              region: number.region,
              service: 'signalwire',
            });
          });

          for (let i = 0; i < 3; i++) {
            const number = available_phone_numbers[i];
            if (number) {
              data.push({
                number: number.phoneNumber,
                region: number.region,
                service: 'signalwire',
              });
            }
          }
          return res.send({
            status: true,
            data,
          });
        } else {
          twilio
            .availablePhoneNumbers(countryCode)
            .local.list({
              areaCode: search_code,
            })
            .then((response) => {
              const number = response[0];
              if (typeof number === 'undefined' || number === '+') {
                return res.status(400).json({
                  status: false,
                  error: 'Numbers not found',
                });
              } else {
                for (let i = 0; i < 3; i++) {
                  const number = response[i];
                  if (number) {
                    data.push({
                      number: number.phoneNumber,
                      region: number.region,
                      service: 'twilio',
                    });
                  }
                }

                return res.send({
                  status: true,
                  data,
                });
              }
            })
            .catch((err) => {
              return res.status(500).json({
                status: false,
                error: err.message || err,
              });
            });
        }
      })
      .catch((err) => {
        console.log('phone number get err', err);
      });
  } else {
    twilio
      .availablePhoneNumbers(countryCode)
      .local.list({
        areaCode,
      })
      .then(async (response) => {
        const number = data[0];

        if (typeof number === 'undefined' || number === '+') {
          return res.status(400).json({
            status: false,
            error: 'Numbers not found',
          });
        } else {
          response.forEach((number) => {
            data.push({
              number: number.phoneNumber,
              service: 'twilio',
            });
          });
          return res.send({
            status: true,
            data,
          });
        }
      })
      .catch((err) => {
        return res.status(500).json({
          status: false,
          error: err.message || err,
        });
      });
  }
  */
};

const buyNumbers = async (req, res) => {
  const { currentUser } = req;
  // if (req.body.service === 'signalwire') {
  //   client.incomingPhoneNumbers
  //     .create({
  //       friendlyName: currentUser.user_name,
  //       phoneNumber: req.body.number,
  //       smsUrl: urls.SMS_RECEIVE_URL1,
  //     })
  //     .then((incoming_phone_number) => {
  //       User.updateOne(
  //         { _id: currentUser.id },
  //         {
  //           $set: {
  //             proxy_number: req.body.number,
  //             proxy_number_id: incoming_phone_number.sid,
  //           },
  //         }
  //       ).catch((err) => {
  //         console.log('err', err.message);
  //       });

  //       return res.send({
  //         status: true,
  //       });
  //     })
  //     .catch((err) => {
  //       return res.status(400).json({
  //         status: false,
  //         error: err.message,
  //       });
  //     });
  // } else {
  if (!currentUser.is_free && !currentUser.payment) {
    return res.status(400).json({
      status: false,
      error: 'Please connect your card',
    });
  }

  let exchange_number = true;
  if (currentUser.twilio_number) {
    exchange_number = true;
  } else {
    exchange_number = false;
  }

  if (currentUser.payment && exchange_number) {
    const payment = await Payment.findOne({
      _id: currentUser.payment,
    }).catch((err) => {
      console.log('payment find err', err.message);
    });

    if (!payment) {
      return res.status(400).json({
        status: false,
        error: 'Please connect your card',
      });
    }

    const amount = system_settings.TWILIO_EXCHANGE_NUMBER;
    const description = 'Update Phone number';

    const data = {
      card_id: payment.card_id,
      customer_id: payment.customer_id,
      receipt_email: currentUser.email,
      amount,
      description,
    };

    createCharge(data)
      .then(() => {
        twilio.incomingPhoneNumbers
          .create({
            friendlyName: currentUser.user_name,
            phoneNumber: req.body.number,
            smsUrl: urls.SMS_RECEIVE_URL,
            voiceUrl: urls.CALL_RECEIVE_URL,
          })
          .then((incoming_phone_number) => {
            if (currentUser.proxy_number_id) {
              releaseSignalWireNumber(currentUser.proxy_number_id);
            }

            if (currentUser.twilio_number_id) {
              releaseTwilioNumber(currentUser.twilio_number_id);
            }

            User.updateOne(
              { _id: currentUser.id },
              {
                $set: {
                  twilio_number: req.body.number,
                  twilio_number_id: incoming_phone_number.sid,
                },
                $unset: {
                  proxy_number: true,
                  proxy_number_id: true,
                },
              }
            ).catch((err) => {
              console.log('err', err.message);
            });

            return res.send({
              status: true,
            });
          })
          .catch((err) => {
            console.log('proxy number error', err);
          });
      })
      .catch((err) => {
        console.log('card payment err', err);
        return res.status(400).json({
          status: false,
          error: err.message,
        });
      });
  } else {
    if (currentUser.twilio_number_id) {
      releaseTwilioNumber(currentUser.twilio_number_id);
    }

    twilio.incomingPhoneNumbers
      .create({
        friendlyName: currentUser.user_name,
        phoneNumber: req.body.number,
        smsUrl: urls.SMS_RECEIVE_URL,
        voiceUrl: urls.CALL_RECEIVE_URL,
      })
      .then((incoming_phone_number) => {
        User.updateOne(
          { _id: currentUser.id },
          {
            $set: {
              twilio_number: req.body.number,
              twilio_number_id: incoming_phone_number.sid,
            },
          }
        ).catch((err) => {
          console.log('err', err.message);
        });

        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('proxy number error', err);
      });
  }

  // }
};

const buyCredit = async (req, res) => {
  const { currentUser } = req;
  let payment;

  if (currentUser.payment) {
    payment = await Payment.findOne({ _id: currentUser.payment }).catch(
      (err) => {
        console.log('by sms credit err', err.message);
      }
    );
  }

  if (payment) {
    let price;
    let amount;
    const description = 'Buy sms credit';

    if (req.body.option === 1) {
      price = system_settings.SMS_CREDIT[0].PRICE;
      amount = system_settings.SMS_CREDIT[0].AMOUNT;
    } else if (req.body.option === 2) {
      price = system_settings.SMS_CREDIT[1].PRICE;
      amount = system_settings.SMS_CREDIT[1].AMOUNT;
    } else if (req.body.option === 3) {
      price = system_settings.SMS_CREDIT[2].PRICE;
      amount = system_settings.SMS_CREDIT[2].AMOUNT;
    }

    const data = {
      card_id: payment.card_id,
      customer_id: payment.customer_id,
      receipt_email: currentUser.email,
      amount: price,
      description,
    };

    PaymentCtrl.createCharge(data)
      .then((_res) => {
        let { additional_credit } = currentUser.text_info;
        if (additional_credit) {
          additional_credit.updated_at = new Date();
          additional_credit.amount += amount;
        } else {
          additional_credit = {
            updated_at: new Date(),
            amount,
          };
        }

        User.updateOne(
          { _id: currentUser.id },
          {
            $set: {
              'text_info.additional_credit': additional_credit,
            },
          }
        ).catch((err) => {
          console.log('user paid demo update err', err.message);
        });

        const time_zone = currentUser.time_zone_info
          ? JSON.parse(currentUser.time_zone_info).tz_name
          : system_settings.TIME_ZONE;

        const data = {
          template_data: {
            user_name: currentUser.user_name,
            created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
            last_4_cc: payment.last4,
            invoice_id: _res.invoice || '',
            amount: price / 100,
          },
          template_name: 'PaymentNotification',
          required_reply: true,
          email: currentUser.email,
        };

        sendNotificationEmail(data);

        return res.send({
          status: true,
        });
      })
      .catch((_err) => {
        console.log('buys sms err', _err.message);
        return res.status(400).json({
          status: false,
          error: 'Payment faild, please contact support team',
        });
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Payment information isn`t correct, please contact support team',
    });
  }
};

const markAsRead = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.body;
  Text.updateOne(
    {
      _id: req.params.id,
      user: currentUser._id,
      contacts: contact,
    },
    {
      $set: {
        status: 1,
      },
    }
  ).catch((err) => {
    console.log('text update err', err.message);
  });
  Text.updateMany(
    {
      _id: { $lte: req.params.id },
      user: currentUser._id,
      contacts: contact,
    },
    { $set: { status: 1 } }
  ).catch((err) => {
    console.log('text update err', err.message);
  });

  return res.send({
    status: true,
  });
};

const loadFiles = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.body;

  const videoIds = [];
  const pdfIds = [];
  const imageIds = [];
  let videos = [];
  let pdfs = [];
  let images = [];
  let videoTrackers = [];
  let imageTrackers = [];
  let pdfTrackers = [];
  const videoActivities = [];
  const pdfActivities = [];
  const imageActivities = [];
  const sendAtIndex = {};
  const texts = await Text.find({
    user: currentUser._id,
    contacts: contact,
  })
    .select('_id')
    .catch((err) => {
      console.log('Finding contact text is failed', err);
    });
  if (texts && texts.length) {
    const textIds = texts.map((e) => e._id);
    const sendActivities = await Activity.find({
      texts: { $in: textIds },
      type: { $in: ['videos', 'pdfs', 'images'] },
    }).catch((err) => {
      console.log('Sending Activity getting is failed', err);
    });

    sendActivities.forEach((e) => {
      switch (e.type) {
        case 'videos':
          videoIds.push(e.videos[0]);
          videoActivities.push(e._id);
          if (sendAtIndex[e.videos[0]]) {
            sendAtIndex[e.videos[0]].push(e.updated_at);
          } else {
            sendAtIndex[e.videos[0]] = [e.updated_at];
          }
          break;
        case 'pdfs':
          pdfIds.push(e.pdfs[0]);
          pdfActivities.push(e._id);
          if (sendAtIndex[e.pdfs[0]]) {
            sendAtIndex[e.pdfs[0]].push(e.updated_at);
          } else {
            sendAtIndex[e.pdfs[0]] = [e.updated_at];
          }
          break;
        case 'images':
          imageIds.push(e.images[0]);
          imageActivities.push(e._id);
          if (sendAtIndex[e.images[0]]) {
            sendAtIndex[e.images[0]].push(e.updated_at);
          } else {
            sendAtIndex[e.images[0]] = [e.updated_at];
          }
          break;
      }
    });

    if (videoActivities.length) {
      videoTrackers = await VideoTracker.find({
        contact,
        activity: { $in: videoActivities },
      }).catch((err) => {
        console.log('Video Tracking getting failed');
      });
      videos = await Video.find({
        _id: { $in: videoIds },
      })
        .select('_id title preview thumbnail duration')
        .catch((err) => {
          console.log('video getting failed');
        });
    }
    if (pdfActivities.length) {
      pdfTrackers = PDFTracker.find({
        contact,
        activity: { $in: pdfActivities },
      }).catch((err) => {
        console.log('PDF Tracking getting failed');
      });
      pdfs = await PDF.find({
        _id: { $in: pdfIds },
      })
        .select('_id title preview')
        .catch((err) => {
          console.log('pdf getting failed');
        });
    }
    if (imageActivities.length) {
      imageTrackers = ImageTracker.find({
        contact,
        activity: { $in: imageActivities },
      }).catch((err) => {
        console.log('Image Tracking getting failed');
      });
      images = await Image.find({
        _id: { $in: imageIds },
      })
        .select('_id title preview')
        .catch((err) => {
          console.log('image getting failed');
        });
    }
  }

  return res.send({
    status: true,
    data: {
      videos,
      pdfs,
      images,
      videoTrackers,
      imageTrackers,
      pdfTrackers,
      sendAtIndex,
    },
  });
};

module.exports = {
  get,
  getAll,
  send,
  receive,
  receive1,
  searchNumbers,
  buyNumbers,
  buyCredit,
  receiveTextSignalWire,
  receiveTextTwilio,
  markAsRead,
  loadFiles,
  getContactMessageOfCount,
};
