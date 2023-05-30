const mongoose = require('mongoose');
const moment = require('moment-timezone');
const CronJob = require('cron').CronJob;
const fs = require('fs');
const uuidv1 = require('uuid/v1');
const AWS = require('aws-sdk');
const phone = require('phone');
const webpush = require('web-push');
const sharp = require('sharp');
const child_process = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });

const User = require('../models/user');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const FollowUp = require('../models/follow_up');
const Reminder = require('../models/reminder');
const Appointment = require('../models/appointment');
const Video = require('../models/video');
const Note = require('../models/note');
const Notification = require('../models/notification');
const TimeLine = require('../models/time_line');
const Garbage = require('../models/garbage');
const CampaignJob = require('../models/campaign_job');
const Campaign = require('../models/campaign');
const EmailTemplate = require('../models/email_template');
const Text = require('../models/text');
const Task = require('../models/task');
const TimeLineCtrl = require('../controllers/time_line');

const api = require('../config/api');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const notifications = require('../constants/notification');
const mail_contents = require('../constants/mail_contents');
const { VIDEO_PATH, TEMP_PATH } = require('../config/path');
const { sendNotificationEmail } = require('../helpers/email');
const { RestClient } = require('@signalwire/node');

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});

const EmailHelper = require('../helpers/email');
const TextHelper = require('../helpers/text');
const FileHelper = require('../helpers/file');
const ActivityHelper = require('../helpers/activity');

const { DB_PORT } = require('../config/database');
const _ = require('lodash');
const { downloadFile } = require('../helpers/fileUpload');
const MaterialTheme = require('../models/material_theme');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const campaign_job = new CronJob(
  '* * * * *',
  async () => {
    const due_date = new Date();
    // due_date: { $lte: moment('2021-07-08T00:10:00Z').toDate() },
    const campaign_jobs = await CampaignJob.find({
      status: 'active',
      // due_date: { $lte: due_date },
      campaign: mongoose.Types.ObjectId('60e81a8734d7781848ca2d3e'),
    }).populate({
      path: 'campaign',
      select: {
        email_template: 1,
        newsletter: 1,
        videos: 1,
        pdfs: 1,
        images: 1,
      },
    });

    if (!campaign_jobs || !campaign_jobs.length) {
      return;
    }

    for (let i = 0; i < campaign_jobs.length; i++) {
      const campaign_job = campaign_jobs[i];
      const campaign = campaign_job.campaign;
      let emailContent = '';
      let emailSubject = '';
      let videos = [];
      let pdfs = [];
      let images = [];
      if (campaign.email_template) {
        const email_template = await EmailTemplate.findOne({
          _id: campaign.email_template,
        });
        emailContent = email_template.content;
        emailSubject = email_template.subject;
        videos = _.union(email_template.video_ids, campaign.videos);
        pdfs = _.union(email_template.pdf_ids, campaign.pdfs);
        images = _.union(email_template.image_ids, campaign.images);
      } else if (campaign.newsletter) {
        const newsletter = await MaterialTheme.findOne({
          _id: campaign.newsletter,
        });
        try {
          const key = newsletter.html_content.slice(
            urls.STORAGE_BASE.length + 1
          );
          const data = await downloadFile(key);
          emailContent = Buffer.from(data.Body).toString('utf8');
        } catch (err) {
          console.log('newsletter getting error');
        }
        emailSubject = newsletter.subject || '';
        videos = _.union(newsletter.videos || [], campaign.videos || []);
        pdfs = _.union(newsletter.pdfs || [], campaign.pdfs || []);
        images = _.union(newsletter.images || [], campaign.images || []);
      }
      const { user, contacts } = campaign_job;
      const data = {
        user,
        contacts,
        content: emailContent,
        subject: emailSubject,
        video_ids: videos,
        pdf_ids: pdfs,
        image_ids: images,
        campaign: campaign._id,
      };
      EmailHelper.sendEmailBySMTP(data)
        .then((res) => {
          const errors = [];
          if (res && res.length) {
            res.forEach((e) => {
              if (!e.status) {
                errors.push({
                  contact: e.contact._id,
                  error: e.error,
                  type: e.type,
                });
              }
            });
          }
          campaign_job['status'] = 'done';
          campaign_job['failed'] = errors;
          campaign_job.save().catch((err) => {
            console.log('campaign run update', err);
          });

          Campaign.updateOne(
            { _id: campaign_job.campaign },
            {
              $push: {
                sent: { $each: contacts },
                failed: { $each: errors },
              },
            }
          ).catch((err) => {
            console.log('Campaign Update is failed');
          });
        })
        .catch((err) => {
          console.log('err', err.message);
        });
    }
  },
  function () {
    console.log('Campaign Runner Job finished.');
  },
  false,
  'US/Central'
);

campaign_job.start();
