const { google } = require('googleapis');

var graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const Base64 = require('js-base64').Base64;
const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
const sgMail = require('@sendgrid/mail');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Email = require('../models/email');
const User = require('../models/user');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const Garbage = require('../models/garbage');
const Task = require('../models/task');
const ActivityHelper = require('./activity');
const mail_contents = require('../constants/mail_contents');
const system_settings = require('../config/system_settings');
const api = require('../config/api');
const urls = require('../constants/urls');
const nodemailer = require('nodemailer');

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};
const oauth2 = require('simple-oauth2')(credentials);
const cheerio = require('cheerio');

const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const EmailTemplate = require('../models/email_template');

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const isBlockedEmail = (email) => {
  const mac = /^[a-z0-9](\.?[a-z0-9]){2,}@mac\.com$/;
  const me = /^[a-z0-9](\.?[a-z0-9]){2,}@me\.com$/;
  const icloud = /^[a-z0-9](\.?[a-z0-9]){2,}@icloud\.com$/;
  const yahoo = /^[a-z0-9](\.?[a-z0-9]){2,}@yahoo\.com$/;
  return (
    mac.test(String(email).toLowerCase()) ||
    me.test(String(email).toLowerCase()) ||
    icloud.test(String(email).toLowerCase()) ||
    yahoo.test(String(email).toLowerCase())
  );
};

const makeBody = (to, from, subject, message) => {
  var str = [
    'Content-Type: text/html; charset="UTF-8"\n',
    'MIME-Version:1.0\n',
    'Content-Transfer-Encoding: 7bit\n',
    'to: ',
    to,
    '\n',
    'from: ',
    from,
    '\n',
    'subject: ',
    subject,
    '\n\n',
    message,
  ].join('');
  var encodedMail = Base64.encodeURI(str);
  return encodedMail;
};

const bulkEmail = async (data) => {
  const { user, subject, content, bcc, cc, contacts } = data;
  const promise_array = [];

  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('user find err', err.message);
    }
  );

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          error: 'User not found',
        });
      })
    );
  }
  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent email';
  detail_content = ActivityHelper.automationLog(detail_content);

  // Email object creation with contacts
  const email = new Email({
    content,
    subject,
    contacts,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  const _email = await email
    .save()
    .then()
    .catch((err) => {
      console.log('email found err', err.message);
    });

  if (!currentUser.primary_connected) {
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

    for (let i = 0; i < contacts.length; i++) {
      let email_content = content;
      let email_subject = subject;
      let promise;

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err');
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              status: false,
              contact: contacts[i],
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              status: false,
              contact: contacts[i],
              error: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      email_subject = email_subject
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.connected_email)
        .replace(/{user_phone}/gi, currentUser.cell_phone)
        .replace(/{contact_first_name}/gi, _contact.first_name)
        .replace(/{contact_last_name}/gi, _contact.last_name)
        .replace(/{contact_email}/gi, _contact.email)
        .replace(/{contact_phone}/gi, _contact.cell_phone);

      email_content = email_content
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.connected_email)
        .replace(/{user_phone}/gi, currentUser.cell_phone)
        .replace(/{contact_first_name}/gi, _contact.first_name)
        .replace(/{contact_last_name}/gi, _contact.last_name)
        .replace(/{contact_email}/gi, _contact.email)
        .replace(/{contact_phone}/gi, _contact.cell_phone);

      const _activity = new Activity({
        content: detail_content,
        contacts: contacts[i],
        user: currentUser.id,
        type: 'emails',
        emails: _email.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const activity = await _activity.save().catch((err) => {
        console.log('activity create err', err.message);
      });

      const msg = {
        from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
        to: _contact.email,
        replyTo: currentUser.connected_email,
        subject: email_subject,
        bcc,
        cc,
        html:
          email_content +
          '<br/><br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id),
        text: email_content,
      };

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then(async (_res) => {
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              Email.updateOne(
                { _id: _email.id },
                { $set: { message_id: _res[0].headers['x-message-id'] } }
              ).catch((err) => {
                console.log('email update err', err.message);
              });

              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: activity.id },
                }
              ).catch((err) => {
                console.log('err', err.message);
              });

              resolve({
                status: true,
                activity: activity.id,
              });
            } else {
              console.log('email sending err', msg.to + _res[0].statusCode);
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('err', err);
              });
              resolve({
                status: false,
                contact: contacts[i],
                error: _res[0].message,
              });
            }
          })
          .catch((err) => {
            console.log('email sending err', err.message);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              status: false,
              contact: contacts[i],
              error: err.msg || err.message,
            });
          });
      });
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (
    currentUser.connected_email_type === 'gmail' ||
    currentUser.connected_email_type === 'gsuit'
  ) {
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );

    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });

    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message);
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            error: err.message,
          });
        })
      );
    });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    for (let i = 0; i < contacts.length; i++) {
      let email_subject = subject;
      let email_content = content;
      let promise;

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              status: false,
              contact: contacts[i],
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              status: false,
              contact: contacts[i],
              error: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        email_subject = email_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        email_content = email_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'emails',
          emails: _email.id,
        });

        const activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const html_content =
          '<html><head><title>Email</title></head><body><p>' +
          email_content +
          generateOpenTrackLink(activity.id) +
          '</p><br/><br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>';

        promise = new Promise(async (resolve, reject) => {
          try {
            const body = createBody({
              headers: {
                To: _contact.email,
                From: `${currentUser.user_name} <${currentUser.connected_email}>`,
                Subject: email_subject,
              },
              textHtml: html_content,
              textPlain: email_content,
            });
            request({
              method: 'POST',
              uri: 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
              headers: {
                Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
                'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
              },
              body,
            })
              .then(async () => {
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                )
                  .then(() => {
                    resolve({
                      status: true,
                      activity: activity.id,
                    });
                  })
                  .catch((err) => {
                    console.log(
                      'contact update err gmail helper 306',
                      err.message
                    );
                  });
              })
              .catch((err) => {
                console.log('gmail send err helper 309', err.message);
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  contact: contacts[i],
                  error: err.message,
                });
              });
          } catch (err) {
            console.log('gmail send err helper', err.message);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              contact: contacts[i],
              error: err.message || err.mgs,
            });
          }
        }).catch((err) => {
          console.log('gmail promise err helper', err.message);
        });
      } else {
        promise = new Promise((resolve, reject) => {
          resolve({
            status: false,
            error: 'no contact found',
            contact: contacts[i],
          });
        });
      }
      promise_array.push(promise);
    }

    return Promise.all(promise_array);
  } else if (
    currentUser.connected_email_type === 'outlook' ||
    currentUser.connected_email_type === 'microsoft'
  ) {
    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });
    let accessToken;

    for (let i = 0; i < contacts.length; i++) {
      await new Promise((resolve, reject) => {
        token.refresh((error, result) => {
          if (error) {
            reject(error.message);
          } else {
            resolve(result.token);
          }
        });
      })
        .then((token) => {
          accessToken = token.access_token;
        })
        .catch((err) => {
          console.log('outlook token grant error', err.message);
          promise_array.push(
            new Promise((resolve, reject) => {
              resolve({
                status: false,
                error: err.message,
              });
            })
          );
        });

      if (promise_array.length > 0) {
        return Promise.all(promise_array);
      }

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      let email_content = content;
      let email_subject = subject;
      let promise;

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      email_subject = email_subject
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.connected_email)
        .replace(/{user_phone}/gi, currentUser.cell_phone)
        .replace(/{contact_first_name}/gi, _contact.first_name)
        .replace(/{contact_last_name}/gi, _contact.last_name)
        .replace(/{contact_email}/gi, _contact.email)
        .replace(/{contact_phone}/gi, _contact.cell_phone);

      email_content = email_content
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.connected_email)
        .replace(/{user_phone}/gi, currentUser.cell_phone)
        .replace(/{contact_first_name}/gi, _contact.first_name)
        .replace(/{contact_last_name}/gi, _contact.last_name)
        .replace(/{contact_email}/gi, _contact.email)
        .replace(/{contact_phone}/gi, _contact.cell_phone);

      const _activity = new Activity({
        content: detail_content,
        contacts: contacts[i],
        user: currentUser.id,
        type: 'emails',
        emails: _email.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err.message);
        });

      const html_content =
        '<html><head><title>Email</title></head><body><p>' +
        email_content +
        generateOpenTrackLink(activity.id) +
        '</p><br/><br/>' +
        currentUser.email_signature +
        generateUnsubscribeLink(activity.id) +
        '</body></html>';

      const sendMail = {
        message: {
          subject: email_subject,
          from: {
            emailAddress: {
              name: currentUser.user_name,
              address: currentUser.connected_email,
            },
          },
          body: {
            contentType: 'HTML',
            content: html_content,
          },

          toRecipients: [
            {
              emailAddress: {
                address: _contact.email,
              },
            },
          ],
        },
        saveToSentItems: 'true',
      };

      promise = new Promise((resolve, reject) => {
        client
          .api('/me/sendMail')
          .post(sendMail)
          .then(async () => {
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            resolve({
              status: true,
              activity: activity.id,
            });
          })
          .catch((err) => {
            console.log('bulk outlook err helper 493', err.message);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            if (err.code === 'ErrorMessageSubmissionBlocked') {
              resolve({
                status: false,
                contact: contacts[i],
                error:
                  err.message ||
                  'Please go to the login into your Email box and follow instruction',
              });
            } else {
              resolve({
                status: false,
                contact: contacts[i],
                error: err.message || err.msg,
              });
            }
          });
      });

      promise_array.push(promise);
    }

    return Promise.all(promise_array);
  }
};

const revertEmailing = (activities, email_activity, email_id, tasks) => {
  Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
    console.log('email material activity delete err', err.message);
  });
  Activity.deleteOne({ _id: email_activity }).catch((err) => {
    console.log('email activity delete err', err.message);
  });
  // Email.deleteOne({ _id: email_id }).catch((err) => {
  //   console.log('activity delete err', err.message);
  // });
  Task.deleteMany({ _id: { $in: tasks } }).catch((err) => {
    console.log('auto tasks delete err', err.message);
  });
};

const handleSuccessEmailing = (
  contact,
  activities,
  email_activity,
  email_id
) => {
  Activity.updateMany(
    { _id: { $in: activities } },
    {
      $set: { emails: email_id },
    }
  ).catch((err) => {
    console.log('activity update err', err.message);
  });

  Contact.updateOne(
    { _id: contact },
    { $set: { last_activity: email_activity } }
  ).catch((err) => {
    console.log('err', err.message);
  });
};

const bulkVideo = async (data) => {
  const { user, content, subject, videos, contacts } = data;
  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  const promise_array = [];

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          error: 'User not found',
        });
      })
    );
  }

  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent video using email';
  detail_content = ActivityHelper.automationLog(detail_content);

  if (!currentUser.primary_connected) {
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

    for (let i = 0; i < contacts.length; i++) {
      let promise;

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email removed',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let video_titles = '';
        let video_descriptions = '';
        let video_objects = '';
        let video_subject = subject;
        let video_content = content;
        let activity;
        for (let j = 0; j < videos.length; j++) {
          const video = videos[j];
          let preview;
          if (video['preview']) {
            preview = video['preview'];
          } else {
            preview = video['thumbnail'];
          }

          if (typeof video_content === 'undefined') {
            video_content = '';
          }

          video_subject = video_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          video_content = video_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video._id,
            subject: video_subject,
            description: video_content,
          });

          activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          if (videos.length >= 2) {
            video_titles = mail_contents.VIDEO_TITLE;
          } else {
            video_titles = `${video.title}`;
          }

          if (j < videos.length - 1) {
            video_descriptions += `${video.description}, `;
          } else {
            video_descriptions += video.description;
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
          const video_object = `<tr style="margin-top:10px;max-width:800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${preview}" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          video_objects += video_object;
        }

        if (video_subject === '') {
          video_subject = 'VIDEO: ' + video_titles;
        } else {
          video_subject = video_subject.replace(
            /{video_title}/gi,
            video_titles
          );
          video_subject = video_subject.replace(
            /{material_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_object}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_object}/gi,
            video_objects
          );
        } else {
          video_content = video_content + '<br/>' + video_objects;
        }

        if (video_content.search(/{video_title}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_description}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_description}/gi,
            video_descriptions
          );
        }

        const msg = {
          to: _contact.email,
          from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
          replyTo: currentUser.connected_email,
          subject: video_subject,
          html:
            '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
            video_content +
            '</tbody></table>' +
            currentUser.email_signature +
            generateUnsubscribeLink(activity.id) +
            '</body></html>',
          text: video_content,
        };

        promise = new Promise((resolve, reject) => {
          sgMail
            .send(msg)
            .then(async (_res) => {
              console.log('mailres.errorcode', _res[0].statusCode);
              if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
                console.log('status', _res[0].statusCode);
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: true,
                });
              } else {
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('err', err);
                });
                console.log('email sending err', msg.to + _res[0].statusCode);
                resolve({
                  status: false,
                  error: msg.to + _res[0].statusCode,
                  contact: contacts[i],
                });
              }
            })
            .catch((err) => {
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('err', err);
              });
              console.log('email sending err', msg.to);
              console.error(err);
              resolve({
                status: false,
                err,
                contact: contacts[i],
              });
            });
        });
        promise_array.push(promise);
      }
    }

    return Promise.all(promise_array);
  } else if (
    currentUser.connected_email_type === 'gmail' ||
    currentUser.connected_email_type === 'gsuit'
  ) {
    const promise_array = [];
    let promise;

    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );
    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message || err.msg);
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            err,
          });
        })
      );
    });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    for (let i = 0; i < contacts.length; i++) {
      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let video_titles = '';
        let video_descriptions = '';
        let video_objects = '';
        let video_subject = subject;
        let video_content = content;
        let activity;
        for (let j = 0; j < videos.length; j++) {
          const video = videos[j];
          let preview;
          if (video['preview']) {
            preview = video['preview'];
          } else {
            preview = video['thumbnail'] + '-resize';
          }

          if (typeof video_content === 'undefined') {
            video_content = '';
          }

          video_subject = video_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          video_content = video_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: video_subject,
            description: video_content,
          });

          activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err.message);
            });

          if (videos.length >= 2) {
            video_titles = mail_contents.VIDEO_TITLE;
          } else {
            video_titles = `${video.title}`;
          }

          if (j < videos.length - 1) {
            video_descriptions += `${video.description}, `;
          } else {
            video_descriptions += video.description;
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
          const video_object = `<tr style="margin-top:10px;max-width:800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${preview}" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          video_objects += video_object;
        }

        if (video_subject === '') {
          video_subject = 'VIDEO: ' + video_titles;
        } else {
          video_subject = video_subject.replace(
            /{video_title}/gi,
            video_titles
          );
          video_subject = video_subject.replace(
            /{material_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_object}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_object}/gi,
            video_objects
          );
        } else {
          video_content = video_content + '<br/>' + video_objects;
        }

        if (video_content.search(/{video_title}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_description}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_description}/gi,
            video_descriptions
          );
        }

        const email_content =
          '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
          video_content +
          '</tbody></table>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>';

        // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, video_subject, email_content );

        promise = new Promise((resolve, reject) => {
          try {
            const body = createBody({
              headers: {
                To: _contact.email,
                From: `${currentUser.user_name} <${currentUser.connected_email}>`,
                Subject: video_subject,
              },
              textHtml: email_content,
              textPlain: video_content,
            });
            request({
              method: 'POST',
              uri: 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
              headers: {
                Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
                'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
              },
              body,
            })
              .then(() => {
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('contact find err', err.message);
                });
                resolve({
                  status: true,
                });
              })
              .catch((err) => {
                console.log('err', err.message);
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: false,
                  err,
                  contact: contacts[i],
                });
              });
          } catch (err) {
            console.log('err', err.message);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            resolve({
              status: false,
              error: err.message,
              contact: contacts[i],
            });
          }
        });
      } else {
        promise = new Promise((resolve, reject) => {
          resolve({
            status: false,
            error: 'no contact found',
            contact: contacts[i],
          });
        });
      }
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (
    currentUser.connected_email_type === 'outlook' ||
    currentUser.connected_email_type === 'microsoft'
  ) {
    const promise_array = [];
    let promise;

    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });
    let accessToken;
    await new Promise((resolve, reject) => {
      token.refresh(function (error, result) {
        if (error) {
          reject(error.message);
        } else {
          resolve(result.token);
        }
      });
    })
      .then((token) => {
        accessToken = token.access_token;
      })
      .catch((err) => {
        console.log('outlook token grant error', err.message || err.msg);
        promise_array.push(
          new Promise((resolve, reject) => {
            resolve({
              status: false,
              error: err.message || err.msg,
            });
          })
        );
      });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    for (let i = 0; i < contacts.length; i++) {
      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let video_titles = '';
        let video_descriptions = '';
        let video_objects = '';
        let video_subject = subject;
        let video_content = content;
        let activity;
        for (let j = 0; j < videos.length; j++) {
          const video = videos[j];
          let preview;
          if (video['preview']) {
            preview = video['preview'];
          } else {
            preview = video['thumbnail'] + '-resize';
          }

          if (typeof video_content === 'undefined') {
            video_content = '';
          }

          video_subject = video_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          video_content = video_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: video_subject,
            description: video_content,
          });

          activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('activity found err', err.message);
            });

          if (videos.length >= 2) {
            video_titles = mail_contents.VIDEO_TITLE;
          } else {
            video_titles = `${video.title}`;
          }

          if (j < videos.length - 1) {
            video_descriptions += `${video.description}, `;
          } else {
            video_descriptions += video.description;
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
          const video_object = `<tr style="margin-top:10px;max-width:800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${preview}" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          video_objects += video_object;
        }

        if (video_subject === '') {
          video_subject = 'VIDEO: ' + video_titles;
        } else {
          video_subject = video_subject.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_object}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_object}/gi,
            video_objects
          );
        } else {
          video_content = video_content + '<br/>' + video_objects;
        }

        if (video_content.search(/{video_title}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_description}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_description}/gi,
            video_descriptions
          );
        }

        const sendMail = {
          message: {
            subject: video_subject,
            body: {
              contentType: 'HTML',
              content:
                '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
                video_content +
                '</tbody></table>' +
                currentUser.email_signature +
                generateUnsubscribeLink(activity.id) +
                '</body></html>',
            },
            toRecipients: [
              {
                emailAddress: {
                  address: _contact.email,
                },
              },
            ],
          },
          saveToSentItems: 'true',
        };

        promise = new Promise((resolve, reject) => {
          client
            .api('/me/sendMail')
            .post(sendMail)
            .then(() => {
              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: activity.id },
                }
              ).catch((err) => {
                console.log('err', err.message);
              });
              resolve({
                status: true,
              });
            })
            .catch((err) => {
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('activity delete err', err.message);
              });
              console.log('outlook send err', err.message);
              resolve({
                status: false,
                contact: contacts[i],
                error: err.message,
              });
            });
        });
        promise_array.push(promise);
      }
    }

    return Promise.all(promise_array);
  }
};

const bulkPDF = async (data) => {
  const { user, content, subject, pdfs, contacts } = data;
  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('user found err', err.message);
    }
  );

  const promise_array = [];

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          error: 'User not found',
        });
      })
    );
  }

  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent pdf using email';
  detail_content = ActivityHelper.automationLog(detail_content);

  if (!currentUser.primary_connected) {
    let promise;
    for (let i = 0; i < contacts.length; i++) {
      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });

        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact not found err',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_subject = subject;
      let pdf_content = content;
      let activity;

      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_subject = pdf_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        pdf_content = pdf_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: pdf_subject,
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('activity found err', err.message);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.PDF_TITLE;
        } else {
          pdf_titles = `${pdf.title}`;
        }

        if (j < pdfs.length - 1) {
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_descriptions += pdf.description;
        }
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`;
        const pdf_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${pdf.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${pdf_link}"><img src="${pdf.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        pdf_objects += pdf_object;
      }

      if (pdf_subject === '') {
        pdf_subject = 'PDF: ' + pdf_titles;
      } else {
        pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
        pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '<br/>' + pdf_objects;
      }

      if (content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
        replyTo: currentUser.connected_email,
        subject: pdf_subject,
        html:
          '<html><head><title>PDF Invitation</title></head><body><table><tbody>' +
          pdf_content +
          '</tbody></table>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>',
      };

      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then((_res) => {
            console.log('mailres.errorcode', _res[0].statusCode);
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              console.log('status', _res[0].statusCode);
              Contact.updateOne(
                { _id: contacts[i] },
                { $set: { last_activity: activity.id } }
              ).catch((err) => {
                console.log('contact found err', err.message);
              });
              resolve({
                status: true,
              });
            } else {
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('activity delete err', err.message);
              });

              console.log('email sending err', msg.to + _res[0].statusCode);
              resolve({
                status: false,
                error: _res[0].statusCode,
                contact: contacts[i],
              });
            }
          })
          .catch((err) => {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            console.log('email sending err', err.message);
            resolve({
              status: false,
              error: err.message,
              contact: contacts[i],
            });
          });
      });
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (
    currentUser.connected_email_type === 'gmail' ||
    currentUser.connected_email_type === 'gsuit'
  ) {
    let promise;
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );
    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message);
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            err,
          });
        })
      );
    });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    for (let i = 0; i < contacts.length; i++) {
      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact found err',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let pdf_titles = '';
        let pdf_descriptions = '';
        let pdf_objects = '';
        let pdf_subject = subject;
        let pdf_content = content;
        let activity;
        for (let j = 0; j < pdfs.length; j++) {
          const pdf = pdfs[j];

          if (typeof pdf_content === 'undefined') {
            pdf_content = '';
          }

          pdf_subject = pdf_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          pdf_content = pdf_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'pdfs',
            pdfs: pdf._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: pdf_subject,
            description: pdf_content,
          });

          activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

          if (pdfs.length >= 2) {
            pdf_titles = mail_contents.PDF_TITLE;
          } else {
            pdf_titles = `${pdf.title}`;
          }

          if (j < pdfs.length - 1) {
            pdf_descriptions += `${pdf.description}, `;
          } else {
            pdf_descriptions += pdf.description;
          }

          // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`
          // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`;
          const pdf_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${pdf.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${pdf_link}"><img src="${pdf.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          pdf_objects += pdf_object;
        }

        if (pdf_subject === '') {
          pdf_subject = 'PDF: ' + pdf_titles;
        } else {
          pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
          pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
        }

        if (pdf_content.search(/{pdf_object}/gi) !== -1) {
          pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
        } else {
          pdf_content = pdf_content + '<br/>' + pdf_objects;
        }

        if (pdf_content.search(/{pdf_title}/gi) !== -1) {
          pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
        }

        if (pdf_content.search(/{pdf_description}/gi) !== -1) {
          pdf_content = pdf_content.replace(
            /{pdf_description}/gi,
            pdf_descriptions
          );
        }

        const email_content =
          '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
          pdf_content +
          '</tbody></table>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>';
        // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, pdf_subject, email_content );

        promise = new Promise((resolve, reject) => {
          try {
            const body = createBody({
              headers: {
                To: _contact.email,
                From: `${currentUser.user_name} <${currentUser.connected_email}>`,
                Subject: pdf_subject,
              },
              textHtml: email_content,
              textPlain: pdf_content,
            });
            request({
              method: 'POST',
              uri: 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
              headers: {
                Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
                'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
              },
              body,
            })
              .then(() => {
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: true,
                });
              })
              .catch((err) => {
                console.log('err', err);
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: false,
                  err,
                  contact: contacts[i],
                });
              });
          } catch (err) {
            console.log('email send err', err.message || err.msg);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              status: false,
              err,
              contact: contacts[i],
            });
          }
        });
      } else {
        promise = new Promise((resolve, reject) => {
          resolve({
            status: false,
            error: 'no contact found',
            contact: contacts[i],
          });
        });
      }
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (
    currentUser.connected_email_type === 'outlook' ||
    currentUser.connected_email_type === 'microsoft'
  ) {
    let promise;

    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });

    for (let i = 0; i < contacts.length; i++) {
      let accessToken;
      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error.message);
          } else {
            resolve(result.token);
          }
        });
      })
        .then((token) => {
          accessToken = token.access_token;
        })
        .catch((err) => {
          console.log('outlook token grant error', err.message);
          promise_array.push(
            new Promise((resolve, reject) => {
              resolve({
                status: false,
                error: err.message || err.msg,
              });
            })
          );
        });

      if (promise_array.length > 0) {
        return Promise.all(promise_array);
      }

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_subject = subject;
      let pdf_content = content;
      let activity;
      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_subject = pdf_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        pdf_content = pdf_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: pdf_subject,
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('activity save err', err.message);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.PDF_TITLE;
        } else {
          pdf_titles = `${pdf.title}`;
        }

        if (j < pdfs.length - 1) {
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_descriptions += pdf.description;
        }

        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`;
        const pdf_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${pdf.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${pdf_link}"><img src="${pdf.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        pdf_objects += pdf_object;
      }

      if (pdf_subject === '') {
        pdf_subject = 'PDF: ' + pdf_titles;
      } else {
        pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
        pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '<br/>' + pdf_objects;
      }

      if (pdf_content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      const sendMail = {
        message: {
          subject: pdf_subject,
          body: {
            contentType: 'HTML',
            content:
              '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
              pdf_content +
              '</tbody></table>' +
              currentUser.email_signature +
              generateUnsubscribeLink(activity.id) +
              '</body></html>',
          },
          toRecipients: [
            {
              emailAddress: {
                address: _contact.email,
              },
            },
          ],
        },
        saveToSentItems: 'true',
      };

      promise = new Promise((resolve, reject) => {
        client
          .api('/me/sendMail')
          .post(sendMail)
          .then(() => {
            Contact.updateOne(
              { _id: contacts[i] },
              { $set: { last_activity: activity.id } }
            ).catch((err) => {
              console.log('contact update err', err.message);
            });
            resolve({
              status: true,
            });
          })
          .catch((err) => {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            console.log('email send err', err.message || err.msg);
            resolve({
              status: false,
              contact: contacts[i],
              err,
            });
          });
      });
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  }
};

const bulkImage = async (data) => {
  const { user, content, subject, images, contacts } = data;
  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('current user found err', err.message);
    }
  );

  const promise_array = [];

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          error: 'User not found',
        });
      })
    );
  }

  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent image using email';
  detail_content = ActivityHelper.automationLog(detail_content);

  if (!currentUser.primary_connected) {
    let promise;
    for (let i = 0; i < contacts.length; i++) {
      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact not found email',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      let image_titles = '';
      let image_descriptions = '';
      let image_objects = '';
      let image_subject = subject;
      let image_content = content;
      let activity;
      for (let j = 0; j < images.length; j++) {
        const image = images[j];

        if (!image_content) {
          image_content = '';
        }

        image_subject = image_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        image_content = image_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'images',
          images: image._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: image_subject,
          description: image_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

        if (images.length >= 2) {
          image_titles = mail_contents.IMAGE_TITLE;
        } else {
          image_titles = `${image.title}`;
        }

        if (j < images.length - 1) {
          image_descriptions += `${image.description}, `;
        } else {
          image_descriptions += image.description;
        }
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/>${image.description}<br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`;
        const image_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${image.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${image_link}"><img src="${image.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        image_objects += image_object;
      }

      if (subject === '') {
        image_subject = 'Image: ' + image_titles;
      } else {
        image_subject = image_subject.replace(/{image_title}/gi, image_titles);
        image_subject = image_subject.replace(
          /{material_title}/gi,
          image_titles
        );
      }

      if (image_content.search(/{image_object}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_object}/gi,
          image_objects
        );
      } else {
        image_content = image_content + '<br/>' + image_objects;
      }

      if (image_content.search(/{image_title}/gi) !== -1) {
        image_content = image_content.replace(/{image_title}/gi, image_titles);
      }

      if (image_content.search(/{image_description}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_description}/gi,
          image_descriptions
        );
      }

      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
        replyTo: currentUser.connected_email,
        subject: image_subject,
        html:
          '<html><head><title>Image Invitation</title></head><body><table><tbody>' +
          image_content +
          '</tbody></table>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>',
      };

      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then((_res) => {
            console.log('mailres.errorcode', _res[0].statusCode);
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              console.log('status', _res[0].statusCode);
              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
              });
              resolve({
                status: true,
              });
            } else {
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('activity found err', err.message);
              });
              console.log('email sending err', msg.to + _res[0].statusCode);
              resolve({
                status: false,
                error: _res[0].statusCode,
                contact: contacts[i],
              });
            }
          })
          .catch((err) => {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity found err', err.message);
            });
            console.error('email sending err', err.message);
            resolve({
              status: false,
              error: err.message,
              contact: contacts[i],
            });
          });
      });

      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (
    currentUser.connected_email_type === 'outlook' ||
    currentUser.connected_email_type === 'microsoft'
  ) {
    let promise;
    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });
    let accessToken;
    await new Promise((resolve, reject) => {
      token.refresh((error, result) => {
        if (error) {
          reject(error.message);
        } else {
          resolve(result.token);
        }
      });
    })
      .then((token) => {
        accessToken = token.access_token;
      })
      .catch((err) => {
        console.log('outlook token grant error', err.message);
        promise_array.push(
          new Promise((resolve, reject) => {
            resolve({
              status: false,
              error: err.message,
            });
          })
        );
      });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    for (let i = 0; i < contacts.length; i++) {
      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }
      let image_titles = '';
      let image_descriptions = '';
      let image_objects = '';
      let image_subject = subject;
      let image_content = content;
      let activity;
      for (let j = 0; j < images.length; j++) {
        const image = images[j];

        if (!image_content) {
          image_content = '';
        }

        image_subject = image_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        image_content = image_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'images',
          images: image._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: image_subject,
          description: image_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

        if (images.length >= 2) {
          image_titles = mail_contents.IMAGE_TITLE;
        } else {
          image_titles = `${image.title}`;
        }

        if (j < images.length - 1) {
          image_descriptions += `${image.description}, `;
        } else {
          image_descriptions += image.description;
        }
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/>${image.description}<br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`;
        const image_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${image.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${image_link}"><img src="${image.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
        image_objects += image_object;
      }

      if (image_subject === '') {
        image_subject = 'Image: ' + image_subject;
      } else {
        image_subject = image_subject.replace(/{image_title}/gi, image_titles);
        image_subject = image_subject.replace(
          /{material_title}/gi,
          image_titles
        );
      }

      if (image_content.search(/{image_object}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_object}/gi,
          image_objects
        );
      } else {
        image_content = image_content + '<br/>' + image_objects;
      }

      if (image_content.search(/{image_title}/gi) !== -1) {
        image_content = image_content.replace(/{image_title}/gi, image_titles);
      }

      if (image_content.search(/{image_description}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_description}/gi,
          image_descriptions
        );
      }

      const sendMail = {
        message: {
          subject: image_subject,
          body: {
            contentType: 'HTML',
            content:
              '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
              image_content +
              '</tbody></table>' +
              currentUser.email_signature +
              generateUnsubscribeLink(activity.id) +
              '</body></html>',
          },
          toRecipients: [
            {
              emailAddress: {
                address: _contact.email,
              },
            },
          ],
        },
        saveToSentItems: 'true',
      };

      promise = new Promise((resolve, reject) => {
        client
          .api('/me/sendMail')
          .post(sendMail)
          .then(() => {
            Contact.updateOne(
              { _id: contacts[i] },
              { $set: { last_activity: activity.id } }
            ).catch((err) => {
              console.log('contact update err', err.message);
              resolve({
                status: true,
              });
            });
          })
          .catch((err) => {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity not found err', err.message);
            });
            console.log('activity found err', err.message);
            resolve({
              status: false,
              error: err.message,
              contact: contacts[i],
            });
          });
      });

      promise_array.push(promise);
    }

    return Promise.all(promise_array);
  } else if (
    currentUser.connected_email_type === 'gmail' ||
    currentUser.connected_email_type === 'gsuit'
  ) {
    let promise;
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );
    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message);
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            err,
          });
        })
      );
    });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    for (let i = 0; i < contacts.length; i++) {
      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              error: 'contact not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let image_titles = '';
        let image_descriptions = '';
        let image_objects = '';
        let image_subject = subject;
        let image_content = content;
        let activity;
        for (let j = 0; j < images.length; j++) {
          const image = images[j];

          if (!image_content) {
            image_content = '';
          }

          image_subject = image_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          image_content = image_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'images',
            images: image._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: image_subject,
            description: image_content,
          });

          activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

          if (images.length >= 2) {
            image_titles = mail_contents.IMAGE_TITLE;
          } else {
            image_titles = `${image.title}`;
          }

          if (j < images.length - 1) {
            image_descriptions += `${image.description}, `;
          } else {
            image_descriptions += image.description;
          }
          // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/>${image.description}<br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`
          // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`;
          const image_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${image.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${image_link}"><img src="${image.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          image_objects += image_object;
        }

        if (image_subject === '') {
          image_subject = 'Image: ' + image_titles;
        } else {
          image_subject = image_subject.replace(
            /{image_title}/gi,
            image_titles
          );
          image_subject = image_subject.replace(
            /{material_title}/gi,
            image_titles
          );
        }

        if (image_content.search(/{image_object}/gi) !== -1) {
          image_content = image_content.replace(
            /{image_object}/gi,
            image_objects
          );
        } else {
          image_content = image_content + '<br/>' + image_objects;
        }

        if (content.search(/{image_title}/gi) !== -1) {
          image_content = image_content.replace(
            /{image_title}/gi,
            image_titles
          );
        }

        if (content.search(/{image_description}/gi) !== -1) {
          image_content = image_content.replace(
            /{image_description}/gi,
            image_descriptions
          );
        }

        const email_content =
          '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
          image_content +
          '</tbody></table>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>';
        // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, image_subject, email_content );

        promise = new Promise((resolve, reject) => {
          try {
            const body = createBody({
              headers: {
                To: _contact.email,
                From: `${currentUser.user_name} <${currentUser.connected_email}>`,
                Subject: image_subject,
              },
              textHtml: email_content,
              textPlain: image_content,
            });
            request({
              method: 'POST',
              uri: 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
              headers: {
                Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
                'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
              },
              body,
            })
              .then(() => {
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: true,
                });
              })
              .catch((err) => {
                console.log('gmail send err', err);
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: false,
                  err,
                  contact: contacts[i],
                });
              });
          } catch (err) {
            console.log('err', err);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              status: false,
              err,
              contact: contacts[i],
            });
          }
        });
      } else {
        promise = new Promise((resolve, reject) => {
          resolve({
            status: false,
            error: 'no contact found',
            contact: contacts[i],
          });
        });
      }
      promise_array.push(promise);
    }

    return Promise.all(promise_array);
  }
};

const resendVideo = async (data) => {
  const { user, content, subject, activity, video: video_id, contact } = data;
  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  const promise_array = [];
  let promise;

  if (!currentUser) {
    promise = new Promise((resolve) => {
      resolve({
        status: false,
        error: 'User not found',
      });
    });
    return promise;
  }

  const _contact = await Contact.findOne({
    _id: contact,
  }).catch((err) => {
    console.log('contact found err', err.message);
  });

  if (!_contact) {
    promise = new Promise((resolve) => {
      resolve({
        status: false,
        contact: {
          _id: contact,
        },
        error: 'Contact was removed.',
        type: 'not_found_contact',
      });
    });
    return promise;
  }

  if (_contact.tags.indexOf('unsubscribed') !== -1) {
    promise = new Promise((resolve) => {
      resolve({
        status: false,
        contact: {
          _id: contact,
          first_name: _contact.first_name,
          email: _contact.email,
        },
        error: 'contact email unsubscribed',
        type: 'unsubscribed_contact',
      });
    });
    return promise;
  }

  const video = await Video.findOne({ _id: video_id, del: false }).catch(
    (err) => {
      console.log('video find error', err.message);
    }
  );
  if (!video) {
    promise = new Promise((resolve) => {
      resolve({
        status: false,
        contact: {
          _id: contact,
          first_name: _contact.first_name,
          email: _contact.email,
        },
        error: 'Video was removed.',
        type: 'not_found_video',
      });
    });
    return promise;
  }

  let detail_content = 'resent video using email';
  detail_content = ActivityHelper.autoSettingLog(detail_content);

  let email_subject = subject;
  let email_content = content;
  const video_objects = '';

  email_subject = email_subject
    .replace(/{user_name}/gi, currentUser.user_name)
    .replace(/{user_email}/gi, currentUser.connected_email)
    .replace(/{user_phone}/gi, currentUser.cell_phone)
    .replace(/{contact_first_name}/gi, _contact.first_name)
    .replace(/{contact_last_name}/gi, _contact.last_name)
    .replace(/{contact_email}/gi, _contact.email)
    .replace(/{contact_phone}/gi, _contact.cell_phone);

  email_content = email_content
    .replace(/{user_name}/gi, currentUser.user_name)
    .replace(/{user_email}/gi, currentUser.connected_email)
    .replace(/{user_phone}/gi, currentUser.cell_phone)
    .replace(/{contact_first_name}/gi, _contact.first_name)
    .replace(/{contact_last_name}/gi, _contact.last_name)
    .replace(/{contact_email}/gi, _contact.email)
    .replace(/{contact_phone}/gi, _contact.cell_phone);

  email_subject = email_subject.replace(/{material_title}/gi, video.title);

  const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity;
  const video_object = `<tr style="margin-top:10px;max-width:800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${video.preview}" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;

  if (
    email_content.indexOf('{video_object}') !== -1 ||
    email_content.indexOf('{material_object}') !== -1
  ) {
    email_content = email_content.replace(/{video_object}/gi, video_object);
    email_content = email_content.replace(/{material_object}/gi, video_object);
  } else {
    email_content = email_content + '<br/><br/>' + video_object;
  }

  if (!currentUser.primary_connected) {
    // Send SG mail
    const msg = {
      to: _contact.email,
      from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
      replyTo: currentUser.connected_email,
      subject: email_subject,
      html:
        '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
        email_content +
        '</tbody></table>' +
        currentUser.email_signature +
        generateUnsubscribeLink(activity) +
        '</body></html>',
      text: email_content,
    };

    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);
    promise = new Promise((resolve, reject) => {
      sgMail
        .send(msg)
        .then(async (_res) => {
          console.log('mailres.errorcode', _res[0].statusCode);
          if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
            console.log('status', _res[0].statusCode);

            const _activity = new Activity({
              content: detail_content,
              contacts: contact,
              user: currentUser.id,
              type: 'videos',
              videos: video_id,
              subject: email_subject,
              description: email_content,
            });

            const resend_activity = await _activity
              .save()
              .then()
              .catch((err) => {
                console.log('resend activity err', err.message);
              });
            Contact.updateOne(
              { _id: contact },
              { $set: { last_activity: resend_activity.id } }
            ).catch((err) => {
              console.log('conatct update err', err.message);
            });
            resolve({
              status: true,
            });
          } else {
            resolve({
              status: false,
              error: msg.to + _res[0].statusCode,
              contact,
            });
          }
        })
        .catch((err) => {
          console.log('email sending err', msg.to);
          console.error(err);
          resolve({
            status: false,
            error: err.message || err,
            contact,
          });
        });
    });
    return promise;
  } else if (
    currentUser.connected_email_type === 'gmail' ||
    currentUser.connected_email_type === 'gsuit'
  ) {
    // Send Gmail
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );
    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message || err.msg);
      promise = new Promise((resolve) => {
        resolve({
          status: false,
          error: 'google_token_invalid',
        });
      });
    });
    if (promise) {
      return promise;
    }
    promise = new Promise((resolve, reject) => {
      try {
        const body = createBody({
          headers: {
            To: _contact.email,
            From: `${currentUser.user_name} <${currentUser.connected_email}>`,
            Subject: email_subject,
          },
          textHtml:
            '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
            email_content +
            '</tbody></table>' +
            currentUser.email_signature +
            generateUnsubscribeLink(activity) +
            '</body></html>',
          textPlain: email_content,
        });
        request({
          method: 'POST',
          uri: 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
          headers: {
            Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
            'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
          },
          body,
        })
          .then(async () => {
            const _activity = new Activity({
              content: detail_content,
              contacts: contact,
              user: currentUser.id,
              type: 'videos',
              videos: video_id,
              created_at: new Date(),
              updated_at: new Date(),
              subject: email_subject,
              description: email_content,
            });

            const resend_activity = await _activity
              .save()
              .then()
              .catch((err) => {
                console.log('resend activity err', err.message);
              });
            Contact.updateOne(
              { _id: contact },
              { $set: { last_activity: resend_activity.id } }
            ).catch((err) => {
              console.log('contact find err', err.message);
            });
            resolve({
              status: true,
            });
          })
          .catch((err) => {
            console.log('err', err.message);
            resolve({
              status: false,
              error: err.message || err,
              contact,
            });
          });
      } catch (err) {
        console.log('err', err.message);
        resolve({
          status: false,
          error: err.message,
          contact,
        });
      }
    });
    return promise;
  } else if (
    currentUser.connected_email_type === 'outlook' ||
    currentUser.connected_email_type === 'microsoft'
  ) {
    // Send Outlook mail
    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });
    let accessToken;
    await new Promise((resolve, reject) => {
      token.refresh(function (error, result) {
        if (error) {
          reject(error.message);
        } else {
          resolve(result.token);
        }
      });
    })
      .then((token) => {
        accessToken = token.access_token;
      })
      .catch((err) => {
        promise = new Promise((resolve, reject) => {
          resolve({
            status: false,
            error: err.message || err.msg,
          });
        });
      });
    if (promise) {
      return promise;
    }
    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    const sendMail = {
      message: {
        subject: email_subject,
        body: {
          contentType: 'HTML',
          content:
            '<html><head><title>Video Invitation</title></head><body><table><tbody>' +
            email_content +
            '</tbody></table>' +
            currentUser.email_signature +
            generateUnsubscribeLink(activity) +
            '</body></html>',
        },
        toRecipients: [
          {
            emailAddress: {
              address: _contact.email,
            },
          },
        ],
      },
      saveToSentItems: 'true',
    };

    promise = new Promise((resolve, reject) => {
      client
        .api('/me/sendMail')
        .post(sendMail)
        .then(async () => {
          const _activity = new Activity({
            content: detail_content,
            contacts: contact,
            user: currentUser.id,
            type: 'videos',
            videos: video_id,
            subject: email_subject,
            description: email_content,
          });

          const resend_activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('resend activity err', err.message);
            });
          Contact.updateOne(
            { _id: contact },
            {
              $set: { last_activity: resend_activity.id },
            }
          ).catch((err) => {
            console.log('err', err.message);
          });
          resolve({
            status: true,
          });
        })
        .catch((err) => {
          console.log('outlook send err', err.message);
          resolve({
            status: false,
            contact,
            error: err.message,
          });
        });
    });
    return promise;
  }
};

const addLinkTracking = (content, activity) => {
  const $ = cheerio.load(content);
  $('a[href]').each((index, elem) => {
    let url = $(elem).attr('href');

    const pattern = /^((http|https|ftp):\/\/)/;
    if (!pattern.test(url)) {
      url = 'http://' + url;
    }
    if (url.indexOf(urls.DOMAIN_NAME) === -1) {
      const attached_link =
        urls.CLICK_REDIRECT_URL + `?url=${url}&activity_id=${activity}`;
      $(elem).attr('href', attached_link);
    }
  });
  return $.html();
};

const generateUnsubscribeLink = (id) => {
  return `<p style="color: #222;margin-top: 20px;font-size: 11px;">If you'd like to unsubscribe and stop receiving these emails <a href="${urls.UNSUBSCRIPTION_URL}?activity=${id}" style="color: #222;"> Unsubscribe.</a></p>`;
  // <p style="color: #222;margin-top: 20px;font-size: 11px;">Or If you'd like to resubscribe receiving these emails <a href="${urls.RESUBSCRIPTION_URL}${id}" style="color: #222;"> Resubscribe.</a></p>`;
};

const generateOpenTrackLink = (id) => {
  return `<img src='${urls.TRACK_URL}${id}'/>`;
};

const sendEmail = async (data) => {
  const {
    user,
    contacts,
    video_ids,
    pdf_ids,
    image_ids,
    content,
    subject,
    cc,
    bcc,
    mode,
    attachments,
    shared_email,
    has_shared,
    is_guest,
  } = data;

  const currentUser = await User.findOne({ _id: user }).catch((err) => {
    console.log('user find err', err.message);
  });

  let email_count = currentUser['email_info']['count'] || 0;
  const max_email_count =
    currentUser['email_info']['max_count'] ||
    system_settings.EMAIL_DAILY_LIMIT.BASIC;
  const email_info = currentUser['email_info'] || {};

  const garbage = await Garbage.findOne({
    user: currentUser.id,
  }).catch((err) => {
    console.log('garbage find err', err.message);
  });

  const email = new Email({
    user: currentUser.id,
    subject,
    content,
    cc,
    bcc,
    shared_email,
    has_shared,
    contacts,
  });

  email.save().catch((err) => {
    console.log('email save err', err.message);
  });

  const promise_array = [];

  for (let i = 0; i < contacts.length; i++) {
    let promise;
    const activities = [];
    const autoResends = [];
    const autoFollowUps = [];

    const contact = await Contact.findOne({
      _id: contacts[i],
    }).catch((err) => {
      console.log('contact found err', err.message);
    });

    if (!contact) {
      promise = new Promise((resolve) => {
        resolve({
          status: false,
          contact: {
            _id: contacts[i],
          },
          error: 'Contact was removed.',
          type: 'not_found_contact',
        });
      });

      promise_array.push(promise);
      continue;
    }

    if (contact.tags.indexOf('unsubscribed') !== -1) {
      promise = new Promise((resolve) => {
        resolve({
          status: false,
          contact: {
            _id: contacts[i],
            first_name: contact.first_name,
            email: contact.email,
          },
          error: 'contact email unsubscribed',
          type: 'unsubscribed_contact',
        });
      });

      promise_array.push(promise);
      continue;
    }

    if (email_info['is_limit'] && email_count > max_email_count) {
      promise = new Promise((resolve) => {
        resolve({
          status: false,
          contact: {
            _id: contact._id,
            first_name: contact.first_name,
            email: contact.email,
          },
          error: 'email daily limit exceed!',
          type: 'email_daily_limit',
        });
      });
      promise_array.push(promise);
      break;
    }

    let email_subject = subject;
    let email_content = content || '';
    let material_title;
    let html_content = '';

    email_subject = email_subject
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{user_company}/gi, currentUser.company)
      .replace(/{contact_first_name}/gi, contact.first_name)
      .replace(/{contact_last_name}/gi, contact.last_name)
      .replace(/{contact_email}/gi, contact.email)
      .replace(/{contact_phone}/gi, contact.cell_phone)
      .replace(/{video_title}/gi, '{material_title}')
      .replace(/{pdf_title}/gi, '{material_title}')
      .replace(/{image_title}/gi, '{material_title}');

    email_content = email_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{user_company}/gi, currentUser.company)
      .replace(/{contact_first_name}/gi, contact.first_name)
      .replace(/{contact_last_name}/gi, contact.last_name)
      .replace(/{contact_email}/gi, contact.email)
      .replace(/{contact_phone}/gi, contact.cell_phone)
      .replace(/{video_title}/gi, '{material_title}')
      .replace(/{pdf_title}/gi, '{material_title}')
      .replace(/{image_title}/gi, '{material_title}');

    if (
      (video_ids && video_ids.length && pdf_ids && pdf_ids.length) ||
      (video_ids && video_ids.length && image_ids && image_ids.length) ||
      (pdf_ids && pdf_ids.length && image_ids && image_ids.length)
    ) {
      material_title = mail_contents.MATERIAL_TITLE;
      email_subject = email_subject.replace(
        /{material_title}/gi,
        material_title
      );
    }

    const material_count =
      (video_ids ? video_ids.length : 0) +
      (pdf_ids ? pdf_ids.length : 0) +
      (image_ids ? image_ids.length : 0);

    if (video_ids && video_ids.length) {
      let video_titles = '';
      const videos = await Video.find({ _id: { $in: video_ids } }).catch(
        (err) => {
          console.log('video find error', err.message);
        }
      );

      let activity_content = 'sent video using email';
      if (is_guest) {
        activity_content = ActivityHelper.assistantLog(activity_content);
      }
      switch (mode) {
        case 'automation':
          activity_content = ActivityHelper.automationLog(activity_content);
          break;
        case 'campaign':
          activity_content = ActivityHelper.campaignLog(activity_content);
          break;
        case 'api':
          activity_content = ActivityHelper.apiLog(activity_content);
          break;
      }

      if (videos.length >= 2) {
        video_titles = mail_contents.VIDEO_TITLE;
      } else {
        video_titles = videos[0].title;
      }

      if (!material_title) {
        email_subject = email_subject.replace(
          /{material_title}/gi,
          video_titles
        );
      }

      for (let j = 0; j < videos.length; j++) {
        const video = videos[j];

        const activity = new Activity({
          content: activity_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'videos',
          videos: video.id,
          subject: video.title,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;

        /**
        if (material_count === 1) {
          if (email_content.indexOf(`{{${video.id}}}`) === -1) {
            const material_html = `
              <div><strong>${video.title}</strong></div>
              <div>
                <a href="${video_link}" class="material-object" contenteditable="false">
                  <span contenteditable="false">
                    <img alt="Preview image went something wrong. Please click here" src="${video.preview}" width="320" height="176">
                  </span>
                </a>
              </div>
            `;
            email_content += `<br/><br/>${material_html}`;
          }
        }
        */

        email_content = email_content.replace(
          new RegExp(`{{${video.id}}}`, 'g'),
          video_link
        );

        activities.push(activity.id);
      }
    }

    if (pdf_ids && pdf_ids.length > 0) {
      let pdf_titles = '';
      const pdfs = await PDF.find({ _id: { $in: pdf_ids } }).catch((err) => {
        console.log('pdf find error', err.message);
      });

      let activity_content = 'sent pdf using email';

      if (is_guest) {
        activity_content = ActivityHelper.assistantLog(activity_content);
      }
      switch (mode) {
        case 'automation':
          activity_content = ActivityHelper.automationLog(activity_content);
          break;
        case 'campaign':
          activity_content = ActivityHelper.campaignLog(activity_content);
          break;
        case 'api':
          activity_content = ActivityHelper.apiLog(activity_content);
          break;
      }

      if (pdfs.length >= 2) {
        pdf_titles = mail_contents.PDF_TITLE;
      } else {
        pdf_titles = pdfs[0].title;
      }

      if (!material_title) {
        email_subject = email_subject.replace(/{material_title}/gi, pdf_titles);
      }
      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];
        const activity = new Activity({
          content: activity_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'pdfs',
          pdfs: pdf.id,
          subject: email_subject,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        /**
        if (material_count === 1) {
          if (email_content.indexOf(`{{${pdf.id}}}`) === -1) {
            const material_html = `
              <div><strong>${pdf.title}</strong></div>
              <div>
                <a href="${pdf_link}" class="material-object" contenteditable="false">
                  <span contenteditable="false">
                    <img alt="Preview image went something wrong. Please click here" src="${pdf.preview}" width="320" height="176">
                  </span>
                </a>
              </div>
            `;
            email_content += `<br/><br/>${material_html}`;
          }
        }
        */

        email_content = email_content.replace(
          new RegExp(`{{${pdf.id}}}`, 'g'),
          pdf_link
        );

        activities.push(activity.id);
      }
    }

    if (image_ids && image_ids.length > 0) {
      let image_titles = '';
      const images = await Image.find({ _id: { $in: image_ids } }).catch(
        (err) => {
          console.log('image find error', err.message);
        }
      );

      let activity_content = 'sent image using email';

      if (is_guest) {
        activity_content = ActivityHelper.assistantLog(activity_content);
      }
      switch (mode) {
        case 'automation':
          activity_content = ActivityHelper.automationLog(activity_content);
          break;
        case 'campaign':
          activity_content = ActivityHelper.campaignLog(activity_content);
          break;
        case 'api':
          activity_content = ActivityHelper.apiLog(activity_content);
          break;
      }

      if (images.length >= 2) {
        image_titles = mail_contents.IMAGE_TITLE;
      } else {
        image_titles = images[0].title;
      }

      if (!material_title) {
        email_subject = email_subject.replace(
          /{material_title}/gi,
          image_titles
        );
      }
      for (let j = 0; j < images.length; j++) {
        const image = images[j];
        const activity = new Activity({
          content: activity_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'images',
          images: image.id,
          subject: email_subject,
        });

        activity.save().catch((err) => {
          console.log('activity image err', err.message);
        });

        const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

        /**
        if (material_count === 1) {
          if (email_content.indexOf(`{{${image.id}}}`) === -1) {
            const material_html = `
              <div><strong>${image.title}</strong></div>
              <div>
                <a href="${image_link}" class="material-object" contenteditable="false">
                  <span contenteditable="false">
                    <img alt="Preview image went something wrong. Please click here" src="${image.preview}" width="320" height="176">
                  </span>
                </a>
              </div>
            `;
            email_content += `<br/><br/>${material_html}`;
          }
        }
         */

        email_content = email_content.replace(
          new RegExp(`{{${image.id}}}`, 'g'),
          image_link
        );

        activities.push(activity.id);
      }
    }

    let activity_content = 'sent email';

    if (is_guest) {
      activity_content = ActivityHelper.assistantLog(activity_content);
    }
    switch (mode) {
      case 'automation':
        activity_content = ActivityHelper.automationLog(activity_content);
        break;
      case 'campaign':
        activity_content = ActivityHelper.campaignLog(activity_content);
        break;
      case 'api':
        activity_content = ActivityHelper.apiLog(activity_content);
        break;
    }

    const activity = new Activity({
      content: activity_content,
      contacts: contacts[i],
      user: currentUser.id,
      type: 'emails',
      subject: email_subject,
      emails: email.id,
      videos: video_ids,
      pdfs: pdf_ids,
      images: image_ids,
    });

    activity.save().catch((err) => {
      console.log('email send err', err.message);
    });

    if ((cc && cc.length > 0) || (bcc && bcc.length > 0)) {
      html_content =
        '<html><head><title>Email</title></head><body><tbody><tr><td>' +
        email_content +
        '</td></tr><tr><td>' +
        currentUser.email_signature +
        '</td></tr><tr><td>' +
        generateUnsubscribeLink(activity.id) +
        '</td></tr></tbody></body></html>';
    } else {
      email_content = addLinkTracking(email_content, activity.id);
      html_content =
        '<html><head><title>Email</title></head><body><tbody><tr><td>' +
        email_content +
        '</td></tr><tr><td>' +
        generateOpenTrackLink(activity.id) +
        '</td></tr><tr><td>' +
        currentUser.email_signature +
        '</td></tr><tr><td>' +
        generateUnsubscribeLink(activity.id) +
        '</td></tr></tbody></body></html>';
    }

    if (
      currentUser.connected_email_type === 'gmail' ||
      currentUser.connected_email_type === 'gsuit'
    ) {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );

      const token = JSON.parse(currentUser.google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: token.refresh_token });

      await oauth2Client.getAccessToken().catch((err) => {
        console.log('get access err', err.message);
      });

      if (!oauth2Client.credentials.access_token) {
        promise = new Promise((resolve) => {
          resolve({
            status: false,
            contact: {
              _id: contact._id,
              first_name: contact.first_name,
              email: contact.email,
            },
            error: 'google access token invalid!',
            type: 'google_token_invalid',
          });
        });

        promise_array.push(promise);

        // Remove created activity and email
        revertEmailing(activities, activity._id, email._id, [
          ...autoResends,
          ...autoFollowUps,
        ]);
        break;
      }
      const attachment_array = [];
      if (attachments) {
        for (let i = 0; i < attachments.length; i++) {
          attachment_array.push({
            type: attachments[i].type,
            name: attachments[i].filename,
            data: attachments[i].content,
          });
        }
      }

      promise = new Promise((resolve) => {
        try {
          const body = createBody({
            headers: {
              To: contact.email,
              From: `${currentUser.user_name} <${currentUser.connected_email}>`,
              Subject: email_subject,
              Cc: cc || [],
              Bcc: bcc || [],
            },
            textHtml: html_content,
            textPlain: html_content,
            attachments: attachment_array,
          });

          request({
            method: 'POST',
            uri: 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
            headers: {
              Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
              'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
            },
            body,
          })
            .then(async () => {
              email_count += 1;

              handleSuccessEmailing(
                contact._id,
                activities,
                activity._id,
                email._id
              );

              resolve({
                status: true,
                contact: {
                  _id: contact._id,
                  email: contact.email,
                  first_name: contact.first_name,
                },
                data: activity.id,
              });
            })
            .catch((err) => {
              console.log('gmail video send err', err.message);

              revertEmailing(activities, activity._id, email._id, [
                ...autoResends,
                ...autoFollowUps,
              ]);
              if (err.statusCode === 403) {
                // no_connected = true;
                resolve({
                  status: false,
                  contact: {
                    _id: contact['_id'],
                    first_name: contact.first_name,
                    email: contact.email,
                  },
                  error: 'No Connected Gmail',
                  type: 'connection_failed',
                });
              } else if (err.statusCode === 400) {
                resolve({
                  status: false,
                  contact: {
                    _id: contact['_id'],
                    first_name: contact.first_name,
                    email: contact.email,
                  },
                  error: err.message,
                  type: 'general',
                });
              } else {
                console.log('email send err', err.error);
                const errorObj = JSON.parse(err.error);
                const errorMessage = errorObj.error
                  ? errorObj.error.message
                  : 'Unkown Error';
                resolve({
                  status: false,
                  contact: {
                    _id: contact['_id'],
                    first_name: contact.first_name,
                    email: contact.email,
                  },
                  error: errorMessage,
                  type: 'general',
                });
              }
            });
        } catch (err) {
          console.log('gmail video send err', err.message);

          revertEmailing(activities, activity._id, email._id, [
            ...autoResends,
            ...autoFollowUps,
          ]);
          resolve({
            status: false,
            contact: {
              _id: contact._id,
              first_name: contact.first_name,
              email: contact.email,
            },
            error: err.message,
            type: 'internal_error',
          });
        }
      });
      promise_array.push(promise);
    } else if (
      currentUser.connected_email_type === 'outlook' ||
      currentUser.connected_email_type === 'microsoft'
    ) {
      const token = oauth2.accessToken.create({
        refresh_token: currentUser.outlook_refresh_token,
        expires_in: 0,
      });

      let accessToken;

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
          promise = new Promise(async (resolve) => {
            resolve({
              status: false,
              contact: {
                _id: contact._id,
                first_name: contact.first_name,
                email: contact.email,
              },
              error: 'not connected',
              type: 'outlook_token_invalid',
            });
          });

          revertEmailing(activities, activity._id, email._id, [
            ...autoResends,
            ...autoFollowUps,
          ]);
          promise_array.push(promise);
        });

      if (!accessToken) {
        break;
      }

      const client = graph.Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      const attachment_array = [];
      const cc_array = [];
      const bcc_array = [];

      if (attachments) {
        for (let i = 0; i < attachments.length; i++) {
          const attachment = attachments[i];
          attachment_array.push({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.filename,
            contentType: attachment.type,
            contentBytes: attachment.content.replace(/^data:.+;base64,/, ''),
          });
        }
      }

      if (cc) {
        for (let i = 0; i < cc.length; i++) {
          cc_array.push({
            emailAddress: {
              address: cc[i],
            },
          });
        }
      }

      if (bcc) {
        for (let i = 0; i < bcc.length; i++) {
          bcc_array.push({
            emailAddress: {
              address: bcc[i],
            },
          });
        }
      }

      const sendMail = {
        message: {
          subject: email_subject,
          body: {
            contentType: 'HTML',
            content: html_content,
          },
          toRecipients: [
            {
              emailAddress: {
                address: contact.email,
              },
            },
          ],
          ccRecipients: cc_array || [],
          bccRecipients: bcc_array || [],
          attachments: attachment_array,
        },
        saveToSentItems: 'true',
      };

      promise = new Promise((resolve) => {
        client
          .api('/me/sendMail')
          .post(sendMail)
          .then(async () => {
            email_count += 1;

            handleSuccessEmailing(
              contact._id,
              activities,
              activity._id,
              email._id
            );

            resolve({
              status: true,
              contact: {
                _id: contact._id,
                email: contact.email,
                first_name: contact.first_name,
              },
              data: activity.id,
            });
          })
          .catch((err) => {
            revertEmailing(activities, activity._id, email._id, [
              ...autoResends,
              ...autoFollowUps,
            ]);
            console.log('microsoft email send error', err.message);
            resolve({
              status: false,
              contact: {
                _id: contact._id,
                first_name: contact.first_name,
                email: contact.email,
              },
              error: err.message || err.msg,
              type: 'internal_error',
            });
          });
      });
      promise_array.push(promise);
    } else {
      const attachment_array = [];
      if (attachments) {
        for (let i = 0; i < attachments.length; i++) {
          attachment_array.push({
            contentType: attachments[i].type,
            filename: attachments[i].filename,
            content: attachments[i].content,
            encoding: 'base64',
          });
        }
      }

      const hostName = garbage.smtp_info.host;
      const user = garbage.smtp_info.user;
      const pass = garbage.smtp_info.pass;
      const port = garbage.smtp_info.port;
      const ssl = garbage.smtp_info.secure;
      const emailAddress = garbage.smtp_info.email;
      var smtpTransporter = nodemailer.createTransport({
        port,
        host: hostName,
        secure: ssl,
        auth: {
          user,
          pass,
        },
        debug: true,
      });

      var mailOptions = {
        from: `${currentUser.user_name} <${emailAddress}>`,
        to: contact.email,
        text: email_content,
        subject: email_subject,
        html: html_content,
        cc,
        bcc,
        attachments: attachment_array,
      };

      promise = new Promise((resolve) => {
        smtpTransporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            revertEmailing(activities, activity._id, email._id, []);
            resolve({
              status: false,
              contact: {
                _id: contact['_id'],
                first_name: contact.first_name,
                email: contact.email,
              },
              error: error.message || JSON.stringify(error),
              type: 'general',
            });
          } else {
            handleSuccessEmailing(
              contact._id,
              activities,
              activity._id,
              email._id
            );

            resolve({
              status: true,
              contact: {
                _id: contact._id,
                email: contact.email,
                first_name: contact.first_name,
              },
              data: activity.id,
            });
          }
        });
      });
      promise_array.push(promise);
    }
  }

  return Promise.all(promise_array);
};

const sendEmailBySMTP = async (data) => {
  const {
    user,
    contacts,
    video_ids,
    pdf_ids,
    image_ids,
    content,
    subject,
    attachments,
    campaign,
    content_type,
  } = data;

  const currentUser = await User.findOne({ _id: user }).catch((err) => {
    console.log('user find err', err.message);
  });

  const garbage = await Garbage.findOne({
    user: currentUser.id,
  }).catch((err) => {
    console.log('garbage find err', err.message);
  });

  const email = new Email({
    user: currentUser.id,
    subject,
    content,
    contacts,
    campaign,
  });

  email.save().catch((err) => {
    console.log('email save err', err.message);
  });

  const promise_array = [];

  for (let i = 0; i < contacts.length; i++) {
    let promise;
    const activities = [];

    const contact = await Contact.findOne({
      _id: contacts[i],
    }).catch((err) => {
      console.log('contact found err', err.message);
    });

    if (!contact) {
      promise = new Promise((resolve) => {
        resolve({
          status: false,
          contact: {
            _id: contacts[i],
          },
          error: 'Contact was removed.',
          type: 'not_found_contact',
        });
      });

      promise_array.push(promise);
      continue;
    }

    if (contact.tags.indexOf('unsubscribed') !== -1) {
      promise = new Promise((resolve) => {
        resolve({
          status: false,
          contact: {
            _id: contacts[i],
            first_name: contact.first_name,
            email: contact.email,
          },
          error: 'contact email unsubscribed',
          type: 'unsubscribed_contact',
        });
      });

      promise_array.push(promise);
      continue;
    }

    let email_subject = subject;
    let email_content = content || '';
    let html_content;
    let material_title;

    email_subject = email_subject
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{user_company}/gi, currentUser.company)
      .replace(/{contact_first_name}/gi, contact.first_name)
      .replace(/{contact_last_name}/gi, contact.last_name)
      .replace(/{contact_email}/gi, contact.email)
      .replace(/{contact_phone}/gi, contact.cell_phone)
      .replace(/{video_title}/gi, '{material_title}')
      .replace(/{pdf_title}/gi, '{material_title}')
      .replace(/{image_title}/gi, '{material_title}');

    email_content = email_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{user_company}/gi, currentUser.company)
      .replace(/{contact_first_name}/gi, contact.first_name)
      .replace(/{contact_last_name}/gi, contact.last_name)
      .replace(/{contact_email}/gi, contact.email)
      .replace(/{contact_phone}/gi, contact.cell_phone)
      .replace(/{video_title}/gi, '{material_title}')
      .replace(/{pdf_title}/gi, '{material_title}')
      .replace(/{image_title}/gi, '{material_title}');

    if (
      (video_ids && video_ids.length && pdf_ids && pdf_ids.length) ||
      (video_ids && video_ids.length && image_ids && image_ids.length) ||
      (pdf_ids && pdf_ids.length && image_ids && image_ids.length)
    ) {
      material_title = mail_contents.MATERIAL_TITLE;
      email_subject = email_subject.replace(
        /{material_title}/gi,
        material_title
      );
    }

    const material_count =
      (video_ids ? video_ids.length : 0) +
      (pdf_ids ? pdf_ids.length : 0) +
      (image_ids ? image_ids.length : 0);

    if (video_ids && video_ids.length) {
      let video_titles = '';
      const videos = await Video.find({ _id: { $in: video_ids } }).catch(
        (err) => {
          console.log('video find error', err.message);
        }
      );

      let activity_content = 'sent video using email';
      activity_content = ActivityHelper.campaignLog(activity_content);

      if (videos.length >= 2) {
        video_titles = mail_contents.VIDEO_TITLE;
      } else {
        video_titles = videos[0].title;
      }

      if (!material_title) {
        email_subject = email_subject.replace(
          /{material_title}/gi,
          video_titles
        );
      }

      for (let j = 0; j < videos.length; j++) {
        const video = videos[j];

        const activity = new Activity({
          content: activity_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'videos',
          videos: video.id,
          subject: video.title,
          campaign,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
        if (email_content.indexOf(`{{${video.id}}}`) === -1) {
          const material_html = `
            <div><strong>${video.title}</strong></div>
            <div>
              <a href="${video_link}" class="material-object" contenteditable="false">
                <span contenteditable="false">
                  <img alt="Preview image went something wrong. Please click here" src="${video.preview}" width="320" height="176">
                </span>
              </a>
            </div>
          `;
          email_content += `<br/><br/>${material_html}`;
        } else {
          email_content = email_content.replace(
            new RegExp(`{{${video.id}}}`, 'g'),
            video_link
          );
        }

        activities.push(activity.id);
      }
    }

    if (pdf_ids && pdf_ids.length > 0) {
      let pdf_titles = '';
      const pdfs = await PDF.find({ _id: { $in: pdf_ids } }).catch((err) => {
        console.log('pdf find error', err.message);
      });

      let activity_content = 'sent pdf using email';
      activity_content = ActivityHelper.campaignLog(activity_content);

      if (pdfs.length >= 2) {
        pdf_titles = mail_contents.PDF_TITLE;
      } else {
        pdf_titles = pdfs[0].title;
      }

      if (!material_title) {
        email_subject = email_subject.replace(/{material_title}/gi, pdf_titles);
      }
      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];
        const activity = new Activity({
          content: activity_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'pdfs',
          pdfs: pdf.id,
          subject: email_subject,
          campaign,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;
        if (email_content.indexOf(`{{${pdf.id}}}`) === -1) {
          const material_html = `
            <div><strong>${pdf.title}</strong></div>
            <div>
              <a href="${pdf_link}" class="material-object" contenteditable="false">
                <span contenteditable="false">
                  <img alt="Preview image went something wrong. Please click here" src="${pdf.preview}" width="320" height="176">
                </span>
              </a>
            </div>
          `;
          email_content += `<br/><br/>${material_html}`;
        } else {
          email_content = email_content.replace(
            new RegExp(`{{${pdf.id}}}`, 'g'),
            pdf_link
          );
        }

        activities.push(activity.id);
      }
    }

    if (image_ids && image_ids.length > 0) {
      let image_titles = '';
      const images = await Image.find({ _id: { $in: image_ids } }).catch(
        (err) => {
          console.log('image find error', err.message);
        }
      );

      let activity_content = 'sent image using email';
      activity_content = ActivityHelper.campaignLog(activity_content);

      if (images.length >= 2) {
        image_titles = mail_contents.IMAGE_TITLE;
      } else {
        image_titles = images[0].title;
      }

      if (!material_title) {
        email_subject = email_subject.replace(
          /{material_title}/gi,
          image_titles
        );
      }
      for (let j = 0; j < images.length; j++) {
        const image = images[j];
        const activity = new Activity({
          content: activity_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'images',
          images: image.id,
          subject: email_subject,
          campaign,
        });

        activity.save().catch((err) => {
          console.log('activity image err', err.message);
        });

        const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;
        if (email_content.indexOf(`{{${image.id}}}`) === -1) {
          const material_html = `
            <div><strong>${image.title}</strong></div>
            <div>
              <a href="${image_link}" class="material-object" contenteditable="false">
                <span contenteditable="false">
                  <img alt="Preview image went something wrong. Please click here" src="${image.preview}" width="320" height="176">
                </span>
              </a>
            </div>
          `;
          email_content += `<br/><br/>${material_html}`;
        } else {
          email_content = email_content.replace(
            new RegExp(`{{${image.id}}}`, 'g'),
            image_link
          );
        }

        activities.push(activity.id);
      }
    }

    let activity_content = 'sent email';
    activity_content = ActivityHelper.campaignLog(activity_content);
    // if (is_guest) {
    //   activity_content = ActivityHelper.assistantLog(activity_content);
    // }
    const activity = new Activity({
      content: activity_content,
      contacts: contacts[i],
      user: currentUser.id,
      type: 'emails',
      subject: email_subject,
      emails: email.id,
      videos: video_ids,
      pdfs: pdf_ids,
      images: image_ids,
      campaign,
    });

    activity.save().catch((err) => {
      console.log('email send err', err.message);
    });

    email_content = addLinkTracking(email_content, activity.id);

    if (content_type !== 2) {
      html_content =
        '<html><head><title>Email</title></head><body><tbody><tr><td>' +
        email_content +
        '<br/><br/>' +
        currentUser.email_signature +
        '</td></tr><tr><td>' +
        generateOpenTrackLink(activity.id) +
        '</td></tr><tr><td>' +
        generateUnsubscribeLink(activity.id) +
        '</td></tr></tbody></body></html>';
    } else {
      html_content =
        '<html><head><title>Email</title></head><body><tbody><tr><td>' +
        email_content +
        '</td></tr><tr><td>' +
        generateOpenTrackLink(activity.id) +
        '</td></tr><tr><td>' +
        generateUnsubscribeLink(activity.id) +
        '</td></tr></tbody></body></html>';
    }

    const attachment_array = [];
    if (attachments) {
      for (let i = 0; i < attachments.length; i++) {
        attachment_array.push({
          contentType: attachments[i].type,
          filename: attachments[i].filename,
          content: attachments[i].content,
          encoding: 'base64',
        });
      }
    }

    const hostName = garbage.smtp_info.host;
    const user = garbage.smtp_info.user;
    const pass = garbage.smtp_info.pass;
    const port = garbage.smtp_info.port;
    const ssl = garbage.smtp_info.secure;
    const emailAddress = garbage.smtp_info.email;
    var smtpTransporter = nodemailer.createTransport({
      port,
      host: hostName,
      secure: ssl,
      auth: {
        user,
        pass,
      },
      debug: true,
    });

    var mailOptions = {
      from: `${currentUser.user_name} <${emailAddress}>`,
      to: contact.email,
      text: email_content,
      subject: email_subject,
      html: html_content,
      attachments: attachment_array,
    };

    promise = new Promise((resolve) => {
      smtpTransporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          revertEmailing(activities, activity._id, email._id, []);
          resolve({
            status: false,
            contact: {
              _id: contact['_id'],
              first_name: contact.first_name,
              email: contact.email,
            },
            error: error.message || JSON.stringify(error),
            type: 'general',
          });
        } else {
          handleSuccessEmailing(
            contact._id,
            activities,
            activity._id,
            email._id
          );

          resolve({
            status: true,
            contact: {
              _id: contact._id,
              email: contact.email,
              first_name: contact.first_name,
            },
            data: activities,
          });
        }
      });
    });
    promise_array.push(promise);
    // if (
    //   garbage &&
    //   garbage.smtp_info &&
    //   garbage.smtp_info.smtp_sender_verified
    // ) {

    // } else {
    //   promise = new Promise((resolve) => {
    //     resolve({
    //       status: false,
    //       contact: {
    //         _id: contacts[i],
    //         first_name: contact.first_name,
    //         email: contact.email,
    //       },
    //       error: 'SMTP is not connected',
    //       type: 'no_smtp_connection',
    //     });
    //   });
    //   promise_array.push(promise);
    // }
  }

  return Promise.all(promise_array);
};

const updateUserCount = (userId, count) => {
  const newPromise = new Promise(async (resolve, reject) => {
    const user = await User.findOne({ _id: userId }).catch((err) => {
      reject({ message: 'not_found_user' });
    });
    if (user['email_info'] && count) {
      if (user['email_info']['count']) {
        user['email_info']['count'] += count;
      } else {
        user['email_info']['count'] = count;
      }
      user.save().catch((err) => {
        console.log('current user email count update is failed.', err);
      });
      resolve({ status: true });
    } else {
      reject({ message: 'not_found_email_info' });
    }
  });
  return newPromise;
};

const sendNotificationEmail = async (data) => {
  const { email, template_data, template_name, cc, required_reply } = data;
  const templatedData = {
    ...template_data,
    facebook_url: urls.FACEBOOK_URL,
    login_url: urls.LOGIN_URL,
    terms_url: urls.TERMS_SERVICE_URL,
    privacy_url: urls.PRIVACY_URL,
    unsubscription_url: urls.UNSUSCRIPTION_URL,
  };

  const source_email = required_reply
    ? mail_contents.REPLY
    : mail_contents.NO_REPLAY;

  const params = {
    Destination: {
      ToAddresses: [email],
      CcAddresses: [cc],
    },
    Source: source_email,
    Template: template_name,
    TemplateData: JSON.stringify(templatedData),
  };

  ses
    .sendTemplatedEmail(params)
    .promise()
    .catch((err) => {
      console.log('Notification email send err', err);
    });
};

module.exports = {
  sendEmail,
  sendEmailBySMTP,
  isBlockedEmail,
  bulkEmail,
  bulkVideo,
  bulkPDF,
  bulkImage,
  resendVideo,
  sendNotificationEmail,
  addLinkTracking,
  generateUnsubscribeLink,
  generateOpenTrackLink,
  revertEmailing,
  handleSuccessEmailing,
  updateUserCount,
};
