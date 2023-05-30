const mongoose = require('mongoose');
const CronJob = require('cron').CronJob;
const AWS = require('aws-sdk');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });

const CampaignJob = require('../models/campaign_job');
const Campaign = require('../models/campaign');
const EmailTemplate = require('../models/email_template');

const api = require('../config/api');
const urls = require('../constants/urls');

const EmailHelper = require('../helpers/email');

const { DB_PORT } = require('../config/database');
const _ = require('lodash');
const { downloadFile } = require('../helpers/fileUpload');
const MaterialTheme = require('../models/material_theme');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const campaign_job = new CronJob(
  '* * * * *',
  async () => {
    const due_date = new Date();
    // due_date: { $lte: moment('2021-07-08T00:10:00Z').toDate() },
    const campaign_jobs = await CampaignJob.find({
      status: 'active',
      due_date: { $lte: due_date },
    }).populate({
      path: 'campaign',
      select: {
        email_template: 1,
        newsletter: 1,
        videos: 1,
        pdfs: 1,
        images: 1,
        subject: 1,
        content: 1,
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
      let content_type;

      if (campaign.email_template) {
        const email_template = await EmailTemplate.findOne({
          _id: campaign.email_template,
        });
        emailContent = email_template.content;
        emailSubject = email_template.subject;
        videos = _.union(email_template.video_ids, campaign.videos);
        pdfs = _.union(email_template.pdf_ids, campaign.pdfs);
        images = _.union(email_template.image_ids, campaign.images);
        content_type = 1;
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
        content_type = 2;
      } else if (campaign.subject && campaign.content) {
        emailSubject = campaign.subject;
        emailContent = campaign.content;
        videos = campaign.videos || [];
        pdfs = campaign.pdfs || [];
        images = campaign.images || [];
        content_type = 1;
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
        content_type,
      };
      campaign_job['status'] = 'progressing';
      await campaign_job
        .save()
        .then(() => {
          console.log(`campaign ${campaign_job.id} is progressing`);
        })
        .catch(() => {
          console.log('campaign progress setting is failed.');
        });
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
              $addToSet: {
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
