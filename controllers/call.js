const twilio = require('twilio');
const { RestClient } = require('@signalwire/node');
const User = require('../models/user');

const forwardCallTwilio = async (req, res) => {
  const { Called } = req.body;

  const currentUser = await User.findOne({ twilio_number: Called }).catch(
    (err) => {
      console.log('current user found err sms', err.message);
    }
  );

  const response = new twilio.twiml.VoiceResponse();

  if (currentUser && currentUser.cell_phone) {
    response.dial(currentUser.cell_phone);
  } else {
    response.say('Sorry, you are calling to a wrong number. Good bye.');
  }

  res.set('Content-Type', 'text/xml');
  return res.send(response.toString());
};

const forwardCallSignalWire = async (req, res) => {
  const { Called } = req.body;

  const currentUser = await User.findOne({ proxy_number: Called }).catch(
    (err) => {
      console.log('current user found err sms', err.message);
    }
  );

  const response = new RestClient.LaML.VoiceResponse();
  if (currentUser && currentUser.cell_phone) {
    response.dial(currentUser.cell_phone);
  } else {
    response.say('Sorry, you are calling to a wrong number. Good bye.');
  }

  res.set('Content-Type', 'text/xml');
  return res.send(response.toString());
};

module.exports = {
  forwardCallTwilio,
  forwardCallSignalWire,
};
