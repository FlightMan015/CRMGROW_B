const express = require('express');
const user = require('./user');
const follow_up = require('./follow_up');
const contact = require('./contact');
const activity = require('./activity');
const note = require('./note');
const phone_log = require('./phone_log');
const appointment = require('./appointment');
const tag = require('./tag');
const file = require('./file');
const email = require('./email');
const video = require('./video');
const video_tracker = require('./video_tracker');
const pdf = require('./pdf');
const pdf_tracker = require('./pdf_tracker');
const text = require('./text');
const payment = require('./payment');
const template = require('./email_template');
const image = require('./image');
const notification = require('./notification');
const garbage = require('./garbage');
const automation = require('./automation');
const timeline = require('./time_line');
const page = require('./page');
const guest = require('./guest');
const label = require('./label');
const assets = require('./assets');
const affiliate = require('./affiliate');
const team = require('./team');
const team_call = require('./team_call');
const material = require('./material');
const developer = require('./developer');
const integration = require('./integration');
const theme = require('./material_theme');
const mail_list = require('./mail_list');
const campaign = require('./campaign');
const deal = require('./deal');
const deal_stage = require('./deal_stage');
const filter = require('./filter');
const draft = require('./draft');
const call = require('./call');
const pipe_line = require('./pipe_line');
const extension = require('./extension');
const scheduler = require('./scheduler');
const task = require('./task');
const admin = require('./admin/index');

const router = express.Router();

router.get('/health', (req, res) => {
  res.send('OK Cool!');
});

// User Dashboard api
router.use('/user', user);
router.use('/follow', follow_up);
router.use('/contact', contact);
router.use('/activity', activity);
router.use('/note', note);
router.use('/phone', phone_log);
router.use('/appointment', appointment);
router.use('/tag', tag);
router.use('/file', file);
router.use('/video', video);
router.use('/image', image);
router.use('/vtrack', video_tracker);
router.use('/pdf', pdf);
router.use('/ptrack', pdf_tracker);
router.use('/sms', text);
router.use('/payment', payment);
router.use('/template', template);
router.use('/email', email);
router.use('/notification', notification);
router.use('/garbage', garbage);
router.use('/automation', automation);
router.use('/timeline', timeline);
router.use('/page', page);
router.use('/guest', guest);
router.use('/label', label);
router.use('/assets', assets);
router.use('/affiliate', affiliate);
router.use('/team', team);
router.use('/team-call', team_call);
router.use('/material', material);
router.use('/developer', developer);
router.use('/integration', integration);
router.use('/campaign', campaign);
router.use('/mail-list', mail_list);
router.use('/theme', theme);
router.use('/deal', deal);
router.use('/deal-stage', deal_stage);
router.use('/filter', filter);
router.use('/draft', draft);
router.use('/call', call);
router.use('/pipe', pipe_line);
router.use('/extension', extension);
router.use('/scheduler', scheduler);
router.use('/admin', admin);
router.use('/task', task);

module.exports = router;