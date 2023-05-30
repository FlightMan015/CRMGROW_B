const access_key = 'AKIAQGFHZOADALSRUPO4';
const secret_key = 'BKGlVMo+IEgVGl1sg1Gg5WZEhmj+3LPZf4wHb2Y3Tat6';

var nodemailer = require('nodemailer');
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });

var mailOptions = {
  from: 'Tara Stone <tara.stone@exprealty.com>',
  to: 'super@crmgrow.com',
  text: 'This is some text',
  html: '<b>This is some HTML</b>',
};

const sesHostName = 'email-smtp.us-west-2.amazonaws.com';
const hostName = 'mx0.thehandyteam.co';
const user = 'user7zRv8Tbt4w68';
const password = 'smtp77e30c03a7b0';
const port = 587;
const ssl = 'None';

const eXpHostName = 'outbound.ore.mailhop.org';
const eXpuser = 'tara.stone@exprealty.com';
const eXppassword = 'expKzgGNMZupa';

// Send e-mail using SMTP
mailOptions.subject = 'Nodemailer SMTP transporter';

const smtpVerify = () => {
  var smtpTransporter = nodemailer.createTransport({
    port,
    host: eXpHostName,
    secure: false,
    auth: {
      user: eXpuser,
      pass: eXppassword,
    },
    tls: {
      // do not fail on invalid certs
      rejectUnauthorized: false,
    },
  });

  smtpTransporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log('success');
    }
  });

  smtpTransporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Message sent: ' + info.response);
    }
  });
};

const smtpConnect = () => {
  var smtpTransporter = nodemailer.createTransport({
    port,
    host: sesHostName,
    secure: false,
    auth: {
      user: access_key,
      pass: secret_key,
    },
  });

  smtpTransporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Message sent: ' + info.response);
    }
  });
};

smtpVerify();
// smtpConnect();
