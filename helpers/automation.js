const moment = require('moment-timezone');
const mongoose = require('mongoose');
const phone = require('phone');
const User = require('../models/user');
const TimeLine = require('../models/time_line');
const Contact = require('../models/contact');
const Note = require('../models/note');
const Activity = require('../models/activity');
const Automation = require('../models/automation');
const FollowUp = require('../models/follow_up');
const Garbage = require('../models/garbage');
const Deal = require('../models/deal');
const DealStage = require('../models/deal_stage');
const Notification = require('../models/notification');
const Email = require('../models/email');
const Text = require('../models/text');
const Task = require('../models/task');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const PipeLine = require('../models/pipe_line');
const { sendEmail, updateUserCount: updateEmailCount } = require('./email');
const { sendText, updateUserTextCount, sendRingless } = require('./text');
const { automationLog } = require('./activity');
const notifications = require('../constants/notification');
const urls = require('../constants/urls');
const {
  AUTOMATION_BRANCH_LIMIT,
  AUTOMATION_ASSIGN_LIMIT,
} = require('../config/system_settings');
const uuidv1 = require('uuid/v1');
const _ = require('lodash');
const { createCronNotification } = require('./notificationImpl');

const createSubAutomation = async (ids, user) => {
  const automationsList = [];
  for (let i = 0; i < ids.length; i++) {
    const automationId = ids[i];
    const data = await Automation.aggregate([
      {
        $match: { _id: mongoose.Types.ObjectId(automationId) },
      },
      { $project: { _id: 0, role: 0, created_at: 0, updated_at: 0 } },
    ]).catch((err) => {
      console.log('err', err);
    });
    const query = {
      ...data[0],
      user: user.id,
    };
    const check_number = await Automation.find(query).count();
    if (check_number === 0) {
      const automation = new Automation({
        ...data[0],
        user: user.id,
      });
      const tempAutomation = await automation.save();
      const item = { origin: ids[i], new: tempAutomation._id };
      automationsList.push(item);
    } else {
      const automation = await Automation.findOne(query);
      const item = { origin: ids[i], new: automation._id };
      automationsList.push(item);
    }
  }
  return automationsList;
};
const updateAutomation = async (
  ids,
  automationsList,
  videoList,
  imageList,
  pdfList,
  match_info,
  currentUser
) => {
  for (let i = 0; i < ids.length; i++) {
    const automation = await Automation.findOne({
      _id: mongoose.Types.ObjectId(ids[i]),
    });
    for (let j = 0; j < automation.automations.length; j++) {
      const item = automation.automations[j].action;
      if (item.automation_id) {
        for (let k = 0; k < automationsList.length; k++) {
          if (item.automation_id === automationsList[k].origin) {
            item.automation_id = automationsList[k].new;
          }
        }
      }
      if (item.videos) {
        item.videos.forEach((element, index) => {
          for (let k = 0; k < videoList.length; k++) {
            if (element === videoList[k].origin) {
              item.content = item.content.replace(
                '{{' + item.videos[index] + '}}',
                '{{' + videoList[k].new.toString() + '}}'
              );
              item.videos[index] = videoList[k].new;
            }
          }
        });
      }
      if (item.pdfs) {
        item.pdfs.forEach((element, index) => {
          for (let k = 0; k < pdfList.length; k++) {
            if (element === pdfList[k].origin) {
              item.content = item.content.replace(
                '{{' + item.pdfs[index] + '}}',
                '{{' + pdfList[k].new.toString() + '}}'
              );
              item.pdfs[index] = pdfList[k].new;
            }
          }
        });
      }
      if (item.images) {
        item.images.forEach((element, index) => {
          for (let k = 0; k < imageList.length; k++) {
            if (element === imageList[k].origin) {
              item.content = item.content.replace(
                '{{' + item.images[index] + '}}',
                '{{' + imageList[k].new.toString() + '}}'
              );
              item.images[index] = imageList[k].new;
            }
          }
        });
      }
      if (item.deal_stage) {
        if (
          match_info[item.deal_stage] &&
          match_info[item.deal_stage].dealStage
        ) {
          item.deal_stage = match_info[item.deal_stage].dealStage;
        } else {
          if (match_info[item.deal_stage].pipeline) {
            const pipe_line = await PipeLine.findOne({
              _id: mongoose.Types.ObjectId(
                match_info[item.deal_stage].pipeline
              ),
            });

            let pipeline_id;
            if (pipe_line) {
              if (pipe_line.user.toString() === currentUser.id.toString()) {
                pipeline_id = pipe_line._id;
              } else {
                const pipe_info = currentUser.pipe_info;
                if (pipe_info && pipe_info['is_limit']) {
                  const pipe_count = await PipeLine.countDocuments({
                    user: currentUser.id,
                  });
                  if (pipe_count >= pipe_info.max_count) {
                    console.log('You reach out max pipeline count');
                    return false;
                  }
                }
                const new_pipeline = new PipeLine({
                  title: pipe_line.title,
                  user: currentUser.id,
                });
                const _pipe_line = await new_pipeline.save();
                pipeline_id = _pipe_line._id;
              }
              const dealStage = await DealStage.findOne({
                _id: mongoose.Types.ObjectId(item.deal_stage),
              });

              // get max priority for new stage.
              let max_priority = 1;
              const pipeline_stages = await DealStage.find({
                user: currentUser.id,
                pipe_line: pipeline_id,
              });
              if (pipeline_stages.length > 0) {
                const priorities = pipeline_stages.map(
                  (item) => item._doc.priority
                );
                max_priority = Math.max(...priorities) + 1;
              }

              if (dealStage) {
                const new_stage = new DealStage({
                  title: dealStage.title,
                  deals: [],
                  user: currentUser.id,
                  priority: max_priority,
                  pipe_line: pipeline_id,
                });
                const _deal_stage = await new_stage.save();
                item.deal_stage = _deal_stage._id;
              }
            }
          }
        }
      }
    }
    await Automation.updateOne(
      { _id: mongoose.Types.ObjectId(ids[i]) },
      { $set: { automations: automation.automations } }
    ).catch((err) => {
      console.log('err', err);
    });
  }
};
const getSubTitles = async (
  allIds,
  ids,
  subTitles,
  videoIds,
  videoTitles,
  pdfIds,
  pdfTitles,
  imageIds,
  imageTitles,
  dealStageTitles
) => {
  const tempIds = [];
  for (let i = 0; i < ids.length; i++) {
    const tempAutomation = await Automation.findOne({
      _id: mongoose.Types.ObjectId(ids[0]),
    });
    if (tempAutomation) {
      subTitles.push(tempAutomation.title);
      for (let j = 0; j < tempAutomation.automations.length; j++) {
        const item = tempAutomation.automations[j].action;
        if (item.automation_id) {
          tempIds.push(item.automation_id);
          allIds.push(item.automation_id);
        }
        if (item.videos) {
          for (let k = 0; k < item.videos.length; k++) {
            const tempVideo = await Video.findOne({
              _id: mongoose.Types.ObjectId(item.videos[k]),
            });
            videoTitles.push(tempVideo);
            videoIds.push(item.videos[k]);
          }
        }
        if (item.pdfs) {
          for (let k = 0; k < item.pdfs.length; k++) {
            const tempPdf = await PDF.findOne({
              _id: mongoose.Types.ObjectId(item.pdfs[k]),
            });
            pdfTitles.push(tempPdf);
            pdfIds.push(item.pdfs[k]);
          }
        }
        if (item.images) {
          for (let k = 0; k < item.images.length; k++) {
            const tempImage = await Image.findOne({
              _id: mongoose.Types.ObjectId(item.images[k]),
            });
            imageTitles.push(tempImage);
            imageIds.push(item.images[k]);
          }
        }
        if (item.deal_stage) {
          const dealStage = await DealStage.findOne({
            _id: mongoose.Types.ObjectId(item.deal_stage),
          });
          dealStageTitles.push(dealStage);
        }
      }
    }
  }
  if (tempIds.length > 0) {
    return getSubTitles(
      allIds,
      tempIds,
      subTitles,
      videoIds,
      videoTitles,
      pdfIds,
      pdfTitles,
      imageIds,
      imageTitles,
      dealStageTitles
    );
  } else {
    const result = {
      ids: allIds,
      titles: subTitles,
      videoIds,
      videos: videoTitles,
      imageIds,
      images: imageTitles,
      pdfIds,
      pdfs: pdfTitles,
      dealStages: dealStageTitles,
    };
    return result;
  }
};
const getMaterials = async (
  automation_ids,
  ids,
  videos,
  images,
  pdfs,
  currentUser
) => {
  const tempIds = [];
  for (let i = 0; i < automation_ids.length; i++) {
    const tempAutomation = await Automation.findOne({
      _id: mongoose.Types.ObjectId(automation_ids[i]),
      user: currentUser.id,
    });
    if (tempAutomation) {
      for (let j = 0; j < tempAutomation.automations.length; j++) {
        const item = tempAutomation.automations[j].action;
        if (item.automation_id) {
          tempIds.push(item.automation_id);
          ids.push(item.automation_id);
        }
        if (item.videos) {
          for (let k = 0; k < item.videos.length; k++) {
            videos.push(item.videos[k]);
          }
        }
        if (item.pdfs) {
          for (let k = 0; k < item.pdfs.length; k++) {
            pdfs.push(item.pdfs[k]);
          }
        }
        if (item.images) {
          for (let k = 0; k < item.images.length; k++) {
            images.push(item.images[k]);
          }
        }
      }
    } else {
      const data = { ids, videos, images, pdfs };
      return data;
    }
  }
  if (tempIds.length > 0) {
    return getMaterials(tempIds, ids, videos, images, pdfs, currentUser);
  } else {
    const data = { ids, videos, images, pdfs };
    return data;
  }
};

const runTimeline = async (timeline) => {
  const { action, type } = timeline;
  let data;

  TimeLine.updateOne(
    {
      _id: timeline.id,
    },
    {
      $set: { status: 'progress' },
    }
  ).catch((err) => {
    console.log('timeline update progress', err.message);
  });

  if (type === 'deal') {
    const deal = await Deal.findOne({
      _id: timeline.deal,
    });

    if (!deal) {
      return;
    }

    let contacts = deal.contacts;

    if (contacts.length === 0) {
      return;
    }

    if (timeline.group === 'primary') {
      if (deal.primary_contact) {
        contacts = [deal.primary_contact];
      } else {
        contacts = deal.contacts[0];
      }
    } else if (timeline.group === 'other' && deal.primary_contact) {
      contacts.splice(contacts.indexOf(deal.primary_contact), 1);
    }

    switch (action.type) {
      case 'follow_up': {
        let due_date;

        if (action.due_date) {
          due_date = action.due_date;
        } else {
          const now = moment();
          now.set({ second: 0, millisecond: 0 });
          due_date = now.add(action.due_duration, 'hours');
          due_date.set({ second: 0, millisecond: 0 });
        }

        const garbage = await Garbage.findOne({
          user: timeline.user,
        }).catch((err) => {
          console.log('garbage find err', err.message);
        });

        const reminder_before = garbage.reminder_before || 30;

        const startdate = moment(due_date);
        const remind_at = startdate.subtract(reminder_before, 'mins');

        const followup = new FollowUp({
          user: timeline.user,
          deal: timeline.deal,
          type: action.task_type,
          content: action.content,
          timezone: action.timezone,
          due_date,
        });

        followup.save().catch((err) => {
          console.log('new follow up save err', err.message);
        });

        TimeLine.updateMany(
          {
            deal: timeline.deal,
            'action.type': 'update_follow_up',
            'action.ref_id': timeline.ref,
          },
          {
            $set: { 'action.follow_up': followup.id },
          }
        ).catch((err) => {
          console.log('follow error', err.message);
        });

        let activity_content = 'added task';
        activity_content = automationLog(activity_content);

        const activity = new Activity({
          content: activity_content,
          type: 'follow_ups',
          follow_ups: followup.id,
          deals: timeline.deal,
          user: timeline.user,
        });

        activity
          .save()
          .then((_activity) => {
            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $set: { status: 'completed' },
              }
            ).catch((err) => {
              console.log('timeline update err', err.message);
            });
          })
          .catch((err) => {
            console.log('activity save err', err.message);
          });

        for (let i = 0; i < contacts.length; i++) {
          const contact = contacts[i];

          const new_followup = new FollowUp({
            has_shared: true,
            shared_follow_up: followup.id,
            contact,
            content: action.content,
            due_date,
            type: action.task_type,
            remind_at,
            timezone: action.timezone,
            user: timeline.user,
          });

          new_followup.save().catch((err) => {
            console.log('new follow up save err', err.message);
          });

          const new_activity = new Activity({
            content: activity_content,
            contacts: contact,
            user: timeline.user,
            type: 'follow_ups',
            follow_ups: new_followup.id,
          });

          new_activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });

          Contact.updateOne(
            {
              _id: contact,
            },
            {
              $set: {
                last_activity: new_activity.id,
              },
            }
          ).catch((err) => {
            console.log('contact update err', err.message);
          });
        }
        break;
      }
      case 'update_follow_up': {
        switch (action.command) {
          case 'update_follow_up': {
            let follow_due_date;
            let content;
            let update_data;
            if (action.due_date) {
              follow_due_date = action.due_date;
            }
            if (action.due_duration) {
              const now = moment();
              now.set({ second: 0, millisecond: 0 });
              follow_due_date = now.add(action.due_duration, 'hours');
              follow_due_date.set({ second: 0, millisecond: 0 });
            }
            if (follow_due_date) {
              update_data = {
                follow_due_date,
              };
            }
            if (action.content) {
              content = action.content;
              update_data = { ...update_data, content };
            }

            if (follow_due_date) {
              const garbage = await Garbage.findOne({
                user: timeline.user,
              }).catch((err) => {
                console.log('garbage find err', err.message);
              });

              let reminder_before = 30;

              if (garbage) {
                reminder_before = garbage.reminder_before;
              }

              const startdate = moment(follow_due_date);
              const remind_at = startdate.subtract(reminder_before, 'mins');

              update_data = {
                ...update_data,
                remind_at,
                status: 0,
              };
            }

            FollowUp.updateOne(
              {
                _id: action.follow_up,
              },
              { $set: { ...update_data } }
            )
              .then(async () => {
                let activity_content = 'updated task';
                activity_content = automationLog(activity_content);

                const activity = new Activity({
                  content: activity_content,
                  deals: timeline.deal,
                  user: timeline.user,
                  type: 'follow_ups',
                  follow_ups: action.follow_up,
                });

                activity.save().catch((err) => {
                  console.log('follow error', err.message);
                });

                let followups = [];
                if (action.follow_up) {
                  followups = await FollowUp.find({
                    shared_follow_up: action.follow_up,
                    user: timeline.user,
                  });
                }

                const contacts = [];
                const followUpIds = [];
                const contactFollowMatch = {};

                followups.forEach((e) => {
                  if (e && e['contact']) {
                    contacts.push(e['contact']);
                    contactFollowMatch[e['contact']] = e._id;
                  }
                  followUpIds.push(e._id);
                });

                FollowUp.updateMany(
                  { _id: { $in: followUpIds } },
                  {
                    $set: {
                      ...update_data,
                    },
                  }
                ).catch((err) => {
                  console.log('followup update err', err.message);
                });

                for (let i = 0; i < contacts.length; i++) {
                  const contact = contacts[i];

                  const new_activity = new Activity({
                    content: activity_content,
                    contacts: contact,
                    user: timeline.user,
                    type: 'follow_ups',
                    follow_ups: contactFollowMatch[contact],
                  });

                  new_activity
                    .save()
                    .then((_activity) => {
                      Contact.updateOne(
                        { _id: contact },
                        {
                          $set: { last_activity: _activity.id },
                        }
                      ).catch((err) => {
                        console.log(
                          'contact update automation followup err',
                          err.message
                        );
                      });
                    })
                    .catch((err) => {
                      console.log(
                        'new activity automation followup err',
                        err.message
                      );
                    });
                }
              })
              .catch((err) => {
                console.log('update task cron err', err.message);
              });
            break;
          }
          case 'complete_follow_up': {
            FollowUp.updateOne(
              {
                _id: action.follow_up,
              },
              {
                $set: { status: 1 },
              }
            )
              .then(async () => {
                let detail_content = 'completed task';
                detail_content = automationLog(detail_content);

                const activity = new Activity({
                  content: detail_content,
                  deals: timeline.deal,
                  user: timeline.user,
                  type: 'follow_ups',
                  follow_ups: action.follow_up,
                });

                activity.save().catch((err) => {
                  console.log('follow error', err.message);
                });

                let followups = [];
                if (action.follow_up) {
                  followups = await FollowUp.find({
                    shared_follow_up: action.follow_up,
                    user: timeline.user,
                  }).catch((err) => {
                    console.log('followups find err', err.message);
                  });
                }

                const contacts = [];
                const followUpIds = [];
                const contactFollowMatch = {};

                followups.forEach((e) => {
                  if (e && e['contact'] && e['contact']) {
                    contacts.push(e['contact']);
                    contactFollowMatch[e['contact']] = e._id;
                  }
                  followUpIds.push(e._id);
                });

                FollowUp.updateMany(
                  { _id: { $in: followUpIds } },
                  {
                    $set: { status: 1 },
                  }
                ).catch((err) => {
                  console.log('contact deal update task', err.message);
                });

                for (let i = 0; i < contacts.length; i++) {
                  const contact = contacts[i];

                  const activity = new Activity({
                    content: detail_content,
                    contacts: contact,
                    user: timeline.user,
                    type: 'follow_ups',
                    follow_ups: contactFollowMatch[contact],
                  });

                  activity
                    .save()
                    .then((_activity) => {
                      Contact.updateOne(
                        { _id: contact },
                        {
                          $set: { last_activity: _activity.id },
                        }
                      ).catch((err) => {
                        console.log('err', err);
                      });
                    })
                    .catch((err) => {
                      console.log(
                        'follow complete activity save error',
                        err.message
                      );
                    });
                }
              })
              .catch((err) => {
                console.log('update task cron err', err.message);
              });
            break;
          }
        }

        TimeLine.updateOne(
          {
            _id: timeline.id,
          },
          {
            $set: { status: 'completed' },
          }
        ).catch((err) => {
          console.log('timeline update err', err.message);
        });
        break;
      }
      case 'note': {
        const note = new Note({
          content: action.content,
          deal: timeline.deal,
          user: timeline.user,
        });

        note.save().catch((err) => {
          console.log('deal note create err', err.message);
        });

        const content = 'added note';
        const activity = new Activity({
          user: timeline.user,
          content,
          notes: note.id,
          type: 'notes',
          deals: timeline.deal,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        for (let i = 0; i < contacts.length; i++) {
          const contact_note = new Note({
            contact: contacts[i],
            has_shared: true,
            shared_note: note.id,
            content: action.content,
            user: timeline.user,
          });

          contact_note.save().catch((err) => {
            console.log('note save err', err.message);
          });

          const note_activity = new Activity({
            content,
            contacts: contacts[i],
            type: 'notes',
            notes: contact_note.id,
            user: timeline.user,
          });

          note_activity
            .save()
            .then((_activity) => {
              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: _activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
              });

              TimeLine.updateOne(
                {
                  _id: timeline.id,
                },
                {
                  $set: { status: 'completed' },
                }
              ).catch((err) => {
                console.log('timeline update err', err.message);
              });
            })
            .catch((err) => {
              console.log('note add error', err.message);
            });
        }
        break;
      }
      case 'email': {
        const error = [];

        const email = new Email({
          user: timeline.user,
          subject: action.subject,
          content: action.content,
          cc: action.cc,
          bcc: action.bcc,
          video_ids: action.videos,
          pdf_ids: action.pdfs || [],
          image_ids: action.images || [],
          deal: timeline.deal,
          assigned_contacts: contacts,
        });

        const data = {
          user: timeline.user,
          subject: action.subject,
          content: action.content,
          cc: action.cc,
          bcc: action.bcc,
          video_ids: action.videos,
          pdf_ids: action.pdfs,
          image_ids: action.images,
          attachments: action.attachments,
          contacts,
          shared_email: email.id,
          has_shared: true,
        };

        email.save().catch((err) => {
          console.log('new email save err', err.message);
        });

        sendEmail(data)
          .then(async (_res) => {
            const succeedContacts = [];
            _res.forEach((response) => {
              if (!response.status) {
                error.push({
                  contact: response.contact,
                  error: response.error,
                  type: response.type,
                });
              } else {
                succeedContacts.push(response.contact._id);
              }
            });

            if (succeedContacts.length) {
              Email.updateOne(
                {
                  _id: email.id,
                },
                {
                  $set: {
                    assigned_contacts: succeedContacts,
                  },
                }
              ).catch((err) => {
                console.log('deal email assigned contact', err.message);
              });

              const activity_content = 'sent email';

              const activity = new Activity({
                user: timeline.user,
                content: activity_content,
                deals: deal,
                type: 'emails',
                emails: email.id,
                videos: action.videos,
                pdfs: action.pdfs,
                images: action.images,
              });

              activity.save().catch((err) => {
                console.log('activity save err', err.message);
              });

              let notRunnedContactIds = [];
              if (_res.length !== contacts.length) {
                const runnedContactIds = [];
                _res.forEach((e) => {
                  runnedContactIds.push(e.contact && e.contact._id);
                });
                notRunnedContactIds = _.differenceBy(
                  contacts,
                  runnedContactIds,
                  (e) => e + ''
                );
              }

              // Failed Contacts && Total Contacts Count
              updateEmailCount(timeline.user, _res.length - error.length).catch(
                (err) => {
                  console.log('Update user email count failed.', err);
                }
              );

              if (error.length > 0) {
                const connect_errors = error.filter((e) => {
                  if (
                    e.type === 'connection_failed' ||
                    e.type === 'google_token_invalid' ||
                    e.type === 'outlook_token_invalid'
                  ) {
                    return true;
                  }
                });

                if (connect_errors.length) {
                  TimeLine.updateOne(
                    {
                      _id: timeline.id,
                    },
                    {
                      $set: {
                        status: 'error',
                        error_message: 'token_invalid',
                      },
                    }
                  ).catch((err) => {
                    console.log('timeline update err', err.message);
                  });
                } else {
                  TimeLine.updateOne(
                    {
                      _id: timeline.id,
                    },
                    {
                      $set: {
                        status: 'warning',
                        error_array: {
                          error,
                          contacts: notRunnedContactIds,
                        },
                      },
                    }
                  ).catch((err) => {
                    console.log('timeline update err', err.message);
                  });
                }
              } else {
                TimeLine.updateOne(
                  {
                    _id: timeline.id,
                  },
                  {
                    $set: {
                      status: 'completed',
                    },
                  }
                ).catch((err) => {
                  console.log('timeline update err', err.message);
                });

                const activity_data = {
                  activity: _res[0].data,
                  deal: deal._id,
                  parent_ref: timeline.ref,
                };

                setEmailTrackTimeline(activity_data);
              }
            } else {
              Email.deleteOne({
                _id: email.id,
              }).catch((err) => {
                console.log('deal email assigned contact', err.message);
              });

              TimeLine.updateOne(
                {
                  _id: timeline.id,
                },
                {
                  $set: {
                    status: 'error',
                    error_message: 'token_invalid',
                  },
                }
              ).catch((err) => {
                console.log('timeline update err', err.message);
              });
            }
          })
          .catch((err) => {
            console.log('email send error', err);
          });
        break;
      }
      case 'text': {
        const text = new Text({
          user: timeline.user,
          type: 0,
          content: action.content,
          assigned_contacts: contacts,
          deal: timeline.deal,
        });

        text.save().catch((err) => {
          console.log('new text save err', err.message);
        });

        const data = {
          user: timeline.user,
          video_ids: action.videos,
          pdf_ids: action.pdfs,
          image_ids: action.images,
          content: action.content,
          contacts,
          shared_text: text.id,
          has_shared: true,
        };

        sendText(data)
          .then((_res) => {
            const errors = [];
            let sentCount = 0;
            const succeedContacts = [];
            const notRunnedContactIds = [];
            _res.forEach((e) => {
              if (!e.status && !e.type) {
                errors.push(e);
                notRunnedContactIds.push(e.contact._id);
              }

              if (e.isSent || e.status) {
                sentCount++;
                succeedContacts.push(e.contact._id);
              }
            });

            if (sentCount) {
              updateUserTextCount(timeline.user, sentCount).catch((err) => {
                console.log('update user text info is failed.', err);
              });

              Text.updateOne(
                {
                  _id: text.id,
                },
                {
                  $set: {
                    assigned_contacts: succeedContacts,
                  },
                }
              ).catch((err) => {
                console.log('text update err', err.message);
              });

              const activity_content = 'sent text';

              const activity = new Activity({
                user: timeline.user,
                content: activity_content,
                deals: deal,
                type: 'texts',
                texts: text.id,
                videos: action.videos,
                pdfs: action.pdfs,
                images: action.images,
              });

              activity.save().catch((err) => {
                console.log('deal text activity save err', err.message);
              });

              if (errors.length > 0) {
                TimeLine.updateOne(
                  {
                    _id: timeline.id,
                  },
                  {
                    $set: {
                      status: 'warning',
                      error_array: {
                        error: errors,
                        contacts: notRunnedContactIds,
                      },
                    },
                  }
                ).catch((err) => {
                  console.log('timeline update err', err.message);
                });
              } else {
                TimeLine.updateOne(
                  {
                    _id: timeline.id,
                  },
                  {
                    $set: {
                      status: 'completed',
                    },
                  }
                ).catch((err) => {
                  console.log('timeline update err', err.message);
                });
              }
            } else {
              TimeLine.updateOne(
                {
                  _id: timeline.id,
                },
                {
                  $set: {
                    status: 'error',
                    error_array: {
                      error: errors,
                    },
                  },
                }
              ).catch((err) => {
                console.log('timeline update err', err.message);
              });
            }
          })
          .catch((err) => {
            console.log('email send error', err);
          });
        break;
      }
      case 'move_deal': {
        const source_deal = await Deal.findOne({ _id: timeline.deal }).catch(
          (err) => {
            console.log('deal found error', err.message);
          }
        );

        if (source_deal) {
          // get next stage
          let updated_stage = null;
          if (action.deal_stage) {
            updated_stage = action.deal_stage;
          } else {
            const source_deal_stage = await DealStage.findOne({
              _id: source_deal.deal_stage,
            });

            if (source_deal_stage) {
              // move to next deal
              let priority = source_deal_stage.priority;
              priority++;

              const next_deal_stage = await DealStage.findOne({
                user: mongoose.Types.ObjectId(source_deal.user),
                pipe_line: mongoose.Types.ObjectId(source_deal_stage.pipe_line),
                priority,
              });

              if (next_deal_stage) {
                updated_stage = next_deal_stage._id;
              } else {
                updated_stage = source_deal_stage._id;
              }
            }
          }

          if (updated_stage) {
            DealStage.updateOne(
              { _id: source_deal.deal_stage },
              {
                $pull: {
                  deals: { $in: [mongoose.Types.ObjectId(source_deal._id)] },
                },
              },
              { new: true }
            ).catch((err) => {
              console.log('source deal stage update error', err.message);
              throw err.message || 'Source deal stage update error';
            });

            Deal.updateOne(
              { _id: timeline.deal },
              {
                $set: {
                  deal_stage: mongoose.Types.ObjectId(updated_stage),
                  put_at: new Date(),
                },
              }
            ).catch((err) => {
              console.log('deal update error', err.message);
              throw err.message || 'deal update error';
            });

            DealStage.updateOne(
              { _id: updated_stage },
              {
                $addToSet: {
                  deals: {
                    $each: [timeline.deal],
                  },
                },
              }
            ).catch((err) => {
              console.log('destination deal stage update error', err.message);
              throw err.message || 'Destination deal stage update error';
            });

            let detail_content = 'moved deal';
            detail_content = automationLog(detail_content);

            const activity = new Activity({
              user: timeline.user,
              content: detail_content,
              type: 'deals',
              deals: timeline.deal,
              deal_stages: updated_stage,
            });

            activity
              .save()
              .then((_activity) => {
                TimeLine.updateOne(
                  {
                    _id: timeline.id,
                  },
                  {
                    $set: {
                      status: 'completed',
                    },
                  }
                ).catch((err) => {
                  console.log('timeline update err', err.message);
                });
              })
              .catch((err) => {
                console.log('activity save err', err.message);
              });

            for (let i = 0; i < contacts.length; i++) {
              const activity = new Activity({
                content: detail_content,
                contacts: contacts[i],
                user: timeline.user,
                type: 'deals',
                deals: timeline.deal,
                deal_stages: updated_stage,
              });

              activity.save().then((_activity) => {
                Contact.updateOne(
                  { _id: timeline.contact },
                  {
                    $set: { last_activity: _activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
              });
            }
          }
        }
        break;
      }
      case 'update_contact': {
        if (action.content[0]) {
          Contact.updateMany(
            {
              _id: { $in: contacts },
            },
            {
              $set: { label: mongoose.Types.ObjectId(action.content[0]) },
              $addToSet: { tags: { $each: action.content[1] } },
            }
          ).catch((err) => {
            console.log('label set err', err.message);
          });
        } else {
          Contact.updateMany(
            {
              _id: { $in: contacts },
            },
            {
              $addToSet: { tags: { $each: action.content[1] } },
            }
          ).catch((err) => {
            console.log('label set err', err.message);
          });
        }
        Contact.updateMany(
          {
            _id: { $in: contacts },
          },
          {
            $pull: { tags: { $in: action.content[2] } },
          }
        ).catch((err) => {
          console.log('label set err', err.message);
        });
        TimeLine.updateOne(
          {
            _id: timeline.id,
          },
          {
            $set: { status: 'completed' },
          }
        ).catch((err) => {
          console.log('timeline update err', err.message);
        });
        break;
      }
      case 'automation': {
        const { automation_id } = action;
        let due_date;
        if (action.due_date) {
          due_date = action.due_date;
        } else {
          const now = moment();
          now.set({ second: 0, millisecond: 0 });
          due_date = now.add(action.due_duration, 'hours');
          due_date.set({ second: 0, millisecond: 0 });
        }

        TimeLine.updateMany(
          {
            deal: timeline.deal,
            automation: timeline.automation,
          },
          {
            $set: {
              visible: false,
            },
          }
        ).catch((err) => {
          console.log('timeline update err', err.message);
        });

        const _timeline = new TimeLine({
          automation: timeline.automation,
          deal: timeline.deal,
          type: 'deal',
          action: {
            type: 'automation',
            automation_id: timeline.automation,
          },
          user: timeline.user,
          parent_ref: timeline.ref,
          ref: timeline.automation,
          status: 'completed',
          period: timeline.period,
          due_date,
        });

        _timeline.save().catch((err) => {
          console.log('timeline save err', err.message);
        });

        const data = {
          assign_array: [timeline.deal],
          automation_id,
          user_id: timeline.user,
          required_unique: false,
          inherited_by: true,
          parent_ref: timeline.automation.toString(),
        };

        assignTimeline(data)
          .then(() => {
            // Indicating new opening automation
            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $set: {
                  status: 'completed',
                  // parent_ref: timeline.automation,
                },
              }
            ).catch((err) => {
              console.log('timeline update err', err.message);
            });
          })
          .catch((err) => {
            console.log('assign automation time', err.message);
          });
        break;
      }
      /** 
      case 'appointment': {
        const currentUser = await User.findOne({ _id: timeline.user });
        let event_id;
        let recurrence_id;
 
        if (currentUser.calendar_connected) {
          const _appointment = action;
          const { connected_email, calendar_id } = action;
 
          const calendar_list = currentUser.calendar_list;
          let calendar;
          calendar_list.some((_calendar) => {
            if (_calendar.connected_email === connected_email) {
              calendar = _calendar;
            }
          });
 
          if (!calendar) {
            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $set: { status: 'error', error_message: err.message },
              }
            ).catch((err) => {
              console.log('timeline update err', err.message);
            });
          }
 
          const ctz = currentUser.time_zone_info
            ? JSON.parse(currentUser.time_zone_info).tz_name
            : system_settings.TIME_ZONE;
 
          if (calendar.connected_calendar_type === 'outlook') {
            const { new_event_id, new_recurrence_id } =
              await addOutlookCalendarById(ctz, _appointment, calendar);
            event_id = new_event_id;
            recurrence_id = new_recurrence_id;
          } else {
            const oauth2Client = new google.auth.OAuth2(
              api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
              api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
              urls.GMAIL_AUTHORIZE_URL
            );
            const token = JSON.parse(calendar.google_refresh_token);
            oauth2Client.setCredentials({ refresh_token: token.refresh_token });
            const { new_event_id, new_recurrence_id } =
              await addGoogleCalendarById(oauth2Client, ctz, _appointment);
            event_id = new_event_id;
            recurrence_id = new_recurrence_id;
          }
 
          if (req.body.contacts) {
            const contacts = req.body.contacts;
 
            const appointment = new Appointment({
              ...req.body,
              contacts,
              user: currentUser.id,
              type: 0,
              event_id,
              recurrence_id,
            });
 
            appointment.save().catch((err) => {
              console.log('appointment save err', err.message);
            });
 
            for (let i = 0; i < contacts.length; i++) {
              const activity = new Activity({
                content: 'added appointment',
                contacts: contacts[i],
                appointments: appointment.id,
                user: currentUser.id,
                type: 'appointments',
              });
 
              activity.save().then((_activity) => {
                Contact.updateOne(
                  {
                    _id: contacts[i],
                  },
                  {
                    $set: { last_activity: _activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
              });
            }
          }
          return res.send({
            status: true,
            event_id,
          });
        } else {
          return res.status(407).json({
            status: false,
            error: 'You must connect gmail/outlook',
          });
        }
      }
      */
    }
  } else {
    switch (action.type) {
      case 'follow_up': {
        let follow_due_date;
        if (action.due_date) {
          follow_due_date = action.due_date;
        } else {
          const now = moment();
          now.set({ second: 0, millisecond: 0 });
          follow_due_date = now.add(action.due_duration, 'hours');
          follow_due_date.set({ second: 0, millisecond: 0 });
        }

        const garbage = await Garbage.findOne({
          user: timeline.user,
        }).catch((err) => {
          console.log('garbage find err', err.message);
        });
        let reminder_before = 30;
        if (garbage) {
          reminder_before = garbage.reminder_before;
        }
        const startdate = moment(follow_due_date);
        const remind_at = startdate.subtract(reminder_before, 'mins');

        const followUp = new FollowUp({
          content: action.content,
          contact: timeline.contact,
          user: timeline.user,
          type: action.task_type,
          due_date: follow_due_date,
          timezone: action.timezone,
          remind_at,
        });

        followUp
          .save()
          .then(async (_followup) => {
            let detail_content = 'added task';
            detail_content = automationLog(detail_content);

            const activity = new Activity({
              content: detail_content,
              contacts: _followup.contact,
              user: timeline.user,
              type: 'follow_ups',
              follow_ups: _followup.id,
            });

            activity
              .save()
              .then((_activity) => {
                TimeLine.updateOne(
                  {
                    _id: timeline.id,
                  },
                  {
                    $set: { status: 'completed' },
                  }
                ).catch((err) => {
                  console.log('timeline update err', err.message);
                });

                Contact.updateOne(
                  { _id: _followup.contact },
                  {
                    $set: { last_activity: _activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
              })
              .catch((err) => {
                console.log('follow error', err);
              });

            TimeLine.updateMany(
              {
                contact: timeline.contact,
                'action.type': 'update_follow_up',
                'action.ref_id': timeline.ref,
              },
              {
                $set: { 'action.follow_up': _followup.id },
              }
            ).catch((err) => {
              console.log('follow error', err.message);
            });
          })
          .catch((err) => {
            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $set: { status: 'error', error_message: err.message },
              }
            ).catch((err) => {
              console.log('timeline update err', err.message);
            });

            console.log('follow automation error', err.message);
          });
        break;
      }
      case 'note': {
        const note = new Note({
          content: action.content,
          contact: timeline.contact,
          user: timeline.user,
        });

        let detail_content = 'added note';
        detail_content = automationLog(detail_content);

        note
          .save()
          .then((_note) => {
            const activity = new Activity({
              content: detail_content,
              contacts: _note.contact,
              user: timeline.user,
              type: 'notes',
              notes: _note.id,
            });

            activity.save().then((_activity) => {
              Contact.updateOne(
                { _id: _note.contact },
                {
                  $set: { last_activity: _activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
              });

              TimeLine.updateOne(
                {
                  _id: timeline.id,
                },
                {
                  $set: { status: 'completed' },
                }
              ).catch((err) => {
                console.log('timeline update err', err.message);
              });
            });
          })
          .catch((err) => {
            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $set: { status: 'error', error_message: err.message },
              }
            ).catch((err) => {
              console.log('timeline update err', err.message);
            });
          });
        break;
      }
      case 'email':
        data = {
          user: timeline.user,
          subject: action.subject,
          content: action.content,
          contacts: [timeline.contact],
          video_ids: action.videos,
          pdf_ids: action.pdfs,
          image_ids: action.images,
          attachments: action.attachments,
        };

        sendEmail(data)
          .then((res) => {
            if (res[0] && res[0].status === true) {
              TimeLine.updateOne(
                {
                  _id: timeline.id,
                },
                {
                  $set: { status: 'completed' },
                }
              ).catch((err) => {
                console.log('timeline update err', err.message);
              });
              const activity_data = {
                activity: res[0].data,
                contact: timeline.contact,
                parent_ref: timeline.ref,
              };
              setEmailTrackTimeline(activity_data);
            } else {
              TimeLine.updateOne(
                {
                  _id: timeline.id,
                },
                {
                  $set: { status: 'error', error_message: res[0].error },
                }
              ).catch((err) => {
                console.log('timeline update err', err.message);
              });
            }
          })
          .catch((err) => {
            console.log('send email err', err);
          });
        break;
      case 'text':
        data = {
          user: timeline.user,
          content: action.content,
          contacts: [timeline.contact],
          video_ids: action.videos,
          pdf_ids: action.pdfs,
          image_ids: action.images,
        };

        sendText(data)
          .then((res) => {
            if (res[0] && res[0].status === true) {
              TimeLine.updateOne(
                {
                  _id: timeline.id,
                },
                {
                  $set: { status: 'completed' },
                }
              ).catch((err) => {
                console.log('timeline update err', err.message);
              });
            } else {
              TimeLine.updateOne(
                {
                  _id: timeline.id,
                },
                {
                  $set: { status: 'error', error_message: res[0].error },
                }
              ).catch((err) => {
                console.log('timeline update err', err.message);
              });
            }
          })
          .catch((err) => {
            console.log('text send err', err.message);
          });
        break;
      case 'deal': {
        const _contact = await Contact.findOne({ _id: timeline.contact });
        const deal_title = action.deal_name
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name);

        const deal = new Deal({
          deal_stage: action.deal_stage,
          title: deal_title,
          contacts: [timeline.contact],
          primary_contact: timeline.contact,
          user: timeline.user,
          put_at: new Date(),
        });

        let detail_content = 'added deal';
        detail_content = automationLog(detail_content);

        deal
          .save()
          .then((_deal) => {
            DealStage.updateOne(
              {
                _id: action.deal_stage,
              },
              {
                $push: { deals: _deal._id },
              }
            ).catch((err) => {
              console.log('error', err.message);
            });

            const activity = new Activity({
              content: detail_content,
              contacts: timeline.contact,
              user: timeline.user,
              type: 'deals',
              deals: _deal.id,
              deal_stages: action.deal_stage,
            });

            activity.save().then((_activity) => {
              Contact.updateOne(
                { _id: timeline.contact },
                {
                  $set: { last_activity: _activity.id },
                }
              ).catch((err) => {
                console.log('contact update err', err.message);
              });

              TimeLine.updateMany(
                {
                  contact: timeline.contact,
                  type: 'deal',
                },
                {
                  $set: {
                    deal: deal.id,
                  },
                }
              ).catch((err) => {
                console.log('timeline update err', err.message);
              });

              TimeLine.updateOne(
                {
                  _id: timeline.id,
                },
                {
                  $set: { status: 'completed' },
                }
              ).catch((err) => {
                console.log('timeline update err', err.message);
              });
            });
          })
          .catch((err) => {
            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $set: { status: 'error', error_message: err.message },
              }
            ).catch((err) => {
              console.log('timeline update err', err.message);
            });
          });
        break;
      }
      case 'update_contact': {
        const data = await Contact.findOne({
          _id: mongoose.Types.ObjectId(timeline.contact),
        });
        const tempTags = data.tags;
        const pushTags = action.content[1];
        const pullTags = action.content[2];
        if (pushTags.length) {
          pushTags.forEach((tag) => {
            if (tempTags.indexOf(tag) === -1) {
              tempTags.push(tag);
            }
          });
        }
        if (pullTags.length) {
          pullTags.forEach((tag) => {
            const index = tempTags.indexOf(tag);
            if (index > -1) {
              tempTags.splice(index, 1);
            }
          });
        }
        let query;
        if (action.content[0]) {
          query = {
            label: mongoose.Types.ObjectId(action.content[0]),
            tags: tempTags,
          };
          Contact.updateOne(
            {
              _id: timeline.contact,
            },
            {
              $set: {
                ...query,
              },
            }
          ).catch((err) => {
            console.log('label set err', err.message);
          });
        } else {
          query = {
            tags: tempTags,
          };
          Contact.updateOne(
            {
              _id: timeline.contact,
            },
            {
              $set: {
                ...query,
              },
            }
          ).catch((err) => {
            console.log('label set err', err.message);
          });
        }
        TimeLine.updateOne(
          {
            _id: timeline.id,
          },
          {
            $set: { status: 'completed' },
          }
        ).catch((err) => {
          console.log('timeline update err', err.message);
        });
        break;
      }
      case 'update_follow_up': {
        switch (action.command) {
          case 'update_follow_up': {
            let follow_due_date;
            let content;
            let update_data;

            if (action.due_date) {
              follow_due_date = action.due_date;
            }

            if (action.due_duration) {
              const now = moment();
              now.set({ second: 0, millisecond: 0 });
              follow_due_date = now.add(action.due_duration, 'hours');
              follow_due_date.set({ second: 0, millisecond: 0 });
            }

            if (follow_due_date) {
              update_data = {
                follow_due_date,
              };
            }

            if (action.content) {
              content = action.content;
              update_data = { ...update_data, content };
            }

            if (follow_due_date) {
              const garbage = await Garbage.findOne({
                user: timeline.user,
              }).catch((err) => {
                console.log('err', err.message);
              });
              let reminder_before = 30;
              if (garbage) {
                reminder_before = garbage.reminder_before;
              }
              const startdate = moment(follow_due_date);
              const remind_at = startdate.subtract(reminder_before, 'mins');

              update_data = {
                ...update_data,
                remind_at,
                status: 0,
              };
            }

            FollowUp.updateOne(
              {
                _id: action.follow_up,
              },
              { $set: { ...update_data } }
            )
              .then(() => {
                let detail_content = 'updated task';
                detail_content = automationLog(detail_content);
                const activity = new Activity({
                  content: detail_content,
                  contacts: timeline.contact,
                  user: timeline.user,
                  type: 'follow_ups',
                  follow_ups: action.follow_up,
                });

                activity
                  .save()
                  .then((_activity) => {
                    Contact.updateOne(
                      { _id: timeline.contact },
                      { $set: { last_activity: _activity.id } }
                    ).catch((err) => {
                      console.log('contact update err', err.message);
                    });
                  })
                  .catch((err) => {
                    console.log('follow error', err.message);
                  });
              })
              .catch((err) => {
                console.log('update task cron err', err.message);
              });
            break;
          }
          case 'complete_follow_up': {
            FollowUp.updateOne(
              {
                _id: action.follow_up,
              },
              {
                $set: { status: 1 },
              }
            )
              .then(() => {
                let detail_content = 'completed task';
                detail_content = automationLog(detail_content);
                const activity = new Activity({
                  content: detail_content,
                  contacts: timeline.contact,
                  user: timeline.user,
                  type: 'follow_ups',
                  follow_ups: action.follow_up,
                });

                activity
                  .save()
                  .then((_activity) => {
                    Contact.updateOne(
                      { _id: timeline.contact },
                      { $set: { last_activity: _activity.id } }
                    ).catch((err) => {
                      console.log('contact update err', err.message);
                    });
                  })
                  .catch((err) => {
                    console.log('follow error', err.message);
                  });
              })
              .catch((err) => {
                console.log('update task cron err', err.message);
              });
            break;
          }
        }

        TimeLine.updateOne(
          {
            _id: timeline.id,
          },
          {
            $set: { status: 'completed' },
          }
        ).catch((err) => {
          console.log('timeline update err', err.message);
        });
        break;
      }
      case 'automation': {
        const { automation_id } = action;
        let due_date;
        if (action.due_date) {
          due_date = action.due_date;
        } else {
          const now = moment();
          now.set({ second: 0, millisecond: 0 });
          due_date = now.add(action.due_duration, 'hours');
          due_date.set({ second: 0, millisecond: 0 });
        }
        TimeLine.updateMany(
          {
            contact: timeline.contact,
            automation: timeline.automation,
          },
          {
            $set: {
              visible: false,
            },
          }
        ).catch((err) => {
          console.log('timeline update err', err.message);
        });

        const _timeline = new TimeLine({
          automation: timeline.automation,
          contact: timeline.contact,
          action: {
            type: 'automation',
            automation_id: timeline.automation,
          },
          parent_ref: timeline.ref,
          ref: timeline.automation,
          status: 'completed',
          period: timeline.period,
          due_date,
        });

        _timeline.save().catch((err) => {
          console.log('timeline save err', err.message);
        });

        const data = {
          assign_array: [timeline.contact],
          automation_id,
          user_id: timeline.user,
          required_unique: false,
          inherited_by: true,
          parent_ref: timeline.automation.toString(),
        };

        assignTimeline(data)
          .then(() => {
            // Indicating new opening automation
            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $set: {
                  status: 'completed',
                  // parent_ref: timeline.automation,
                },
              }
            ).catch((err) => {
              console.log('timeline update err', err.message);
            });
          })
          .catch((err) => {
            console.log('assign automation time', err.message);
          });
        break;
      }
      case 'audio': {
        const contact = await Contact.findOne({
          _id: mongoose.Types.ObjectId(timeline.contact),
        });
        const user = await User.findOne({
          _id: mongoose.Types.ObjectId(timeline.user),
        });
        let error = '';
        if (!user.cell_phone) {
          error = 'no_user_number';
        }
        const e164UserPhone = phone(user.cell_phone)[0];
        if (!error && !e164UserPhone) {
          error = error || 'wrong_user_number_format';
        }
        if (!error && !contact) {
          error = error || 'not_found_contact';
        }
        if (!error && !contact.cell_phone) {
          error = error || 'no_phone';
        }
        const e164Phone = phone(contact.cell_phone)[0];
        if (!error && !e164Phone) {
          error = error || 'wrong_number_format';
        }
        if (error) {
          TimeLine.updateOne(
            {
              _id: timeline.id,
            },
            {
              $set: { status: 'error' },
            }
          ).catch((err) => {
            console.log('timeline update err', err.message);
          });
          return;
        }
        const data = {
          voicemailId: timeline.action.voicemail,
          contacts: [e164Phone],
          forwardingNumber: e164UserPhone,
        };

        sendRingless(user._id, data)
          .then(() => {
            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $set: { status: 'completed' },
              }
            ).catch((err) => {
              console.log('timeline update err', err.message);
            });
            const detail_content = 'sent ringless vm';
            const activity = new Activity({
              content: detail_content,
              contacts: contact._id,
              user: timeline.user,
              type: 'ringless',
              detail: { voicemail: timeline.action.voicemail },
            });

            activity.save().then((_activity) => {
              Contact.updateOne(
                { _id: contact._id },
                {
                  $set: { last_activity: _activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
              });
            });
          })
          .catch((err) => {
            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $set: { status: 'error' },
              }
            ).catch((err) => {
              console.log('timeline update err', err.message);
            });
          });
        break;
      }
    }
  }
};

const setEmailTrackTimeline = async (data) => {
  const { activity, contact, parent_ref, deal } = data;
  if (deal) {
    TimeLine.updateMany(
      {
        deal,
        parent_ref,
        'condition.case': 'opened_email',
      },
      {
        $set: { opened_email: activity },
      }
    ).catch((err) => {
      console.log('set email open track timeline err', err.message);
    });
  } else {
    TimeLine.updateMany(
      {
        contact,
        parent_ref,
        'condition.case': 'opened_email',
      },
      {
        $set: { opened_email: activity },
      }
    ).catch((err) => {
      console.log('set email open track timeline err', err.message);
    });
  }
};

const disableNext = async (data) => {
  const { contact, deal, ref } = data;
  if (deal) {
    let timeline = await TimeLine.findOne({
      ref,
      deal,
    });

    if (timeline) {
      TimeLine.updateOne(
        {
          _id: timeline.id,
        },
        {
          $set: {
            status: 'disabled',
          },
        }
      ).catch((err) => {
        console.log('time line update err in disable next', err.message);
      });
      let timelines;
      do {
        timelines = await TimeLine.find({
          parent_ref: timeline.ref,
          deal: timeline.deal,
          status: 'pending',
        }).limit(AUTOMATION_BRANCH_LIMIT);
        if (timelines.length === 0) {
          timeline = await TimeLine.findOne({
            ref: timeline.parent_ref,
            deal: timeline.deal,
            status: 'disabled',
          });
        } else {
          timeline = timelines[0];
          TimeLine.updateOne(
            {
              _id: timeline.id,
            },
            {
              $set: {
                status: 'disabled',
              },
            }
          ).catch((err) => {
            console.log('time line update err in disable next', err.message);
          });
        }
      } while (timelines.length > 0 || timeline);
    }
  } else {
    let timeline = await TimeLine.findOne({
      ref,
      contact,
    });

    if (timeline) {
      TimeLine.updateOne(
        {
          _id: timeline.id,
        },
        {
          $set: {
            status: 'disabled',
          },
        }
      ).catch((err) => {
        console.log('time line update err in disable next', err.message);
      });
      let timelines;
      do {
        timelines = await TimeLine.find({
          parent_ref: timeline.ref,
          contact: timeline.contact,
          status: 'pending',
        }).limit(2);

        if (timelines.length === 0) {
          timeline = await TimeLine.findOne({
            ref: timeline.parent_ref,
            contact: timeline.contact,
            status: 'disabled',
          });
        } else {
          timeline = timelines[0];
          TimeLine.updateOne(
            {
              _id: timeline.id,
            },
            {
              $set: {
                status: 'disabled',
              },
            }
          ).catch((err) => {
            console.log('time line update err in disable next', err.message);
          });
        }
      } while (timelines.length > 0 || timeline);
    }
  }
};

const activeTimeline = async (id) => {
  const timeline = await TimeLine.findOne({ _id: id }).catch((err) => {
    console.log('active timeline err', err.message);
  });

  if (timeline) {
    const now = moment();
    const { period } = timeline;
    now.set({ second: 0, millisecond: 0 });
    const due_date = now.add(period, 'hours');
    due_date.set({ second: 0, millisecond: 0 });

    console.log(
      'condition timeline =====>',
      due_date,
      timeline.ref,
      timeline.condition
    );
    TimeLine.updateOne(
      {
        _id: timeline.id,
      },
      {
        $set: {
          status: 'active',
          due_date,
        },
      }
    ).catch((err) => {
      console.log('timeline update err', err.message);
    });
  }
};

const disableTimeline = async (id) => {
  const timeline = await TimeLine.findOne({ _id: id }).catch((err) => {
    console.log('disable timeline err', err.message);
  });

  if (timeline) {
    const now = moment();
    const { period } = timeline;
    const due_date = now.add(period, 'hours');

    TimeLine.updateOne(
      {
        _id: timeline.id,
      },
      {
        $set: {
          status: 'disabled',
          due_date,
        },
      }
    ).catch((err) => {
      console.log('timeline update err', err.message);
    });
  }
};

const activeNext = async (data) => {
  const { contact, deal, ref } = data;

  if (deal) {
    /**
     * Deal timeline
     */

    const timelines = await TimeLine.find({
      deal,
      status: 'pending',
      parent_ref: ref,
    }).limit(AUTOMATION_BRANCH_LIMIT);

    if (timelines && timelines.length > 0) {
      for (let i = 0; i < timelines.length; i++) {
        const timeline = timelines[i];
        if (timeline.condition) {
          const tDeal = await Deal.findOne({ _id: deal });
          if (tDeal) {
            const { period } = timeline;
            const now = moment();
            now.set({ second: 0, millisecond: 0 });
            const due_date = now.add(period, 'hours');
            due_date.set({ second: 0, millisecond: 0 });
            const query = {};

            if (timeline.condition && timeline.condition.answer === true) {
              query.status = 'checking';
            } else {
              query.status = 'active';
            }

            query.due_date = due_date;
            console.log(
              'due_date condition =====>',
              timeline.ref,
              timeline.condition,
              due_date
            );

            TimeLine.updateOne(
              {
                _id: timeline.id,
              },
              {
                $set: {
                  ...query,
                },
              }
            ).catch((err) => {
              console.log('timeline update err', err.message);
            });
          }
        } else {
          const { period } = timeline;
          const now = moment();
          const due_date = now.add(period, 'hours');
          console.log(
            'due_date =====>',
            timeline.ref,
            timeline.condition,
            due_date
          );

          TimeLine.updateOne(
            {
              _id: timeline.id,
            },
            {
              $set: {
                status: 'active',
                due_date,
              },
            }
          ).catch((err) => {
            console.log('timeline update err', err.message);
          });
        }
      }
    } else {
      const pending_timeline = await TimeLine.findOne({
        deal,
        status: 'active',
      });

      if (!pending_timeline) {
        const data = { deal };
        remove(data);
      }
    }
  } else {
    const timelines = await TimeLine.find({
      contact,
      status: 'pending',
      parent_ref: ref,
    }).limit(2);

    /**
     * Contact timeline
     */
    if (timelines && timelines.length > 0) {
      for (let i = 0; i < timelines.length; i++) {
        const timeline = timelines[i];
        if (timeline.condition && timeline.condition.answer === true) {
          TimeLine.updateOne(
            {
              _id: timeline.id,
            },
            {
              $set: {
                status: 'checking',
              },
            }
          ).catch((err) => {
            console.log('timeline update err', err.message);
          });
        } else {
          const { period } = timeline;
          const now = moment();
          const due_date = now.add(period, 'hours');

          TimeLine.updateOne(
            {
              _id: timeline.id,
            },
            {
              $set: {
                status: 'active',
                due_date,
              },
            }
          ).catch((err) => {
            console.log('timeline update err', err.message);
          });
        }
      }
    } else {
      const data = { contact };
      remove(data);
    }
  }
};

const tagTriggerAutomation = async (data) => {
  const { user_id, tags, contacts } = data;
  const garbage = await Garbage.findOne({
    user: user_id,
  });

  if (garbage.tag_automation) {
    tags.some(async (tag) => {
      if (garbage.tag_automation[tag]) {
        let inputContacts;

        const STANDARD_CHUNK = 8;
        const CHUNK_COUNT = 12;
        const MIN_CHUNK = 5;
        const TIME_GAPS = [2, 3, 4, 5];
        const automation_id = garbage.tag_automation[tag];

        const _automation = await Automation.findOne({
          _id: automation_id,
        });

        const currentUser = await User.findOne({ _id: user_id });

        if (!currentUser.primary_connected && !currentUser['twilio_number']) {
          /**
           * Jian working needed
           * error primary connect
           * Notification Creator
           */
          // createNotification(
          //   'automation',
          //   {
          //     user: currentUser._id,
          //     criteria: 'tag_trigger_automation',
          //     error: 'primary_not_connected',
          //   },
          //   currentUser
          // );
        }

        if (_automation) {
          let count = 0;
          let max_assign_count;

          const automation_info = currentUser.automation_info;

          if (!automation_info['is_enabled']) {
            return;
          }

          if (automation_info['is_limit']) {
            max_assign_count =
              automation_info.max_count || AUTOMATION_ASSIGN_LIMIT.PRO;

            const timeline = await TimeLine.aggregate([
              {
                $match: {
                  user: mongoose.Types.ObjectId(currentUser._id),
                },
              },
              {
                $group: {
                  _id: { contact: '$contact' },
                  count: { $sum: 1 },
                },
              },
              {
                $project: { _id: 1 },
              },
              {
                $count: 'total',
              },
            ]);

            if (timeline[0] && timeline[0]['total']) {
              count = timeline[0]['total'];
            }
          }

          if (automation_info['is_limit'] && max_assign_count <= count) {
            /**
              * Jian working needed
               error: 'Exceed max active automations',
               Notification Creator 
            */
            // createNotification(
            //   'automation',
            //   {
            //     user: currentUser._id,
            //     criteria: 'tag_trigger_automation',
            //     error: 'exceed_max_active',
            //   },
            //   currentUser
            // );
          }

          const taskProcessId = new Date().getTime() + uuidv1();

          let assigns = [...inputContacts];
          let assignsToTemp = [];

          // TODO: Scheduled Time Task
          if (inputContacts.length > STANDARD_CHUNK) {
            const currentTasks = await Task.find({
              user: currentUser._id,
              type: 'assign_automation',
              status: 'active',
            })
              .sort({ due_date: -1 })
              .limit(1)
              .catch((err) => {
                console.log('Getting Last Email Tasks', err.message);
              });
            let last_due;
            if (currentTasks && currentTasks.length) {
              // Split From Here
              last_due = currentTasks[0].due_date;
              assignsToTemp = [...assigns];
              assigns = [];
            } else {
              // Handle First Chunk and Create With Anothers
              last_due = new Date();
              assignsToTemp = assigns.slice(STANDARD_CHUNK);
              assigns = assigns.slice(0, STANDARD_CHUNK);
            }

            let delay = 2;
            let taskIndex = 0;
            while (taskIndex < assignsToTemp.length) {
              const due_date = moment(last_due).add(delay, 'minutes');
              const chunk =
                Math.floor(Math.random() * (CHUNK_COUNT - MIN_CHUNK)) +
                MIN_CHUNK;

              const task = new Task({
                user: currentUser.id,
                contacts: assignsToTemp.slice(taskIndex, taskIndex + chunk),
                status: 'active',
                process: taskProcessId,
                type: 'assign_automation',
                action: {
                  automation: automation_id,
                  contacts: undefined,
                },
                due_date,
              });

              task.save().catch((err) => {
                console.log('campaign job save err', err.message);
              });

              taskIndex += chunk;
              const timeIndex = Math.floor(Math.random() * TIME_GAPS.length);
              delay += TIME_GAPS[timeIndex];
            }

            if (!assigns.length) {
              // Create Notification for the bulk assign automation
              const notification = new Notification({
                user: currentUser._id,
                type: 'personal',
                criteria: 'assign_automation',
                status: 'pending',
                process: taskProcessId,
                contact: [...inputContacts],
                detail: {
                  automation: automation_id,
                },
                deliver_status: {
                  succeed: [],
                  failed: [],
                  not_executed: [],
                },
              });

              notification.save().catch((err) => {
                console.log(
                  'Bulk assign automation notification creation is failed.',
                  err
                );
              });
              return;
            }
          }

          if (assigns.length) {
            const data = {
              assign_array: contacts,
              user_id: currentUser.id,
            };

            assignTimeline(data)
              .then(async (result) => {
                const error = [];
                result.forEach((_res) => {
                  if (!_res.status) {
                    error.push({
                      contact: _res.contact,
                      error: _res.error,
                      type: _res.type,
                    });
                  }
                });

                let notRunnedAssignIds = [];
                if (result.length !== assigns.length) {
                  if (inputContacts) {
                    const runnedContactIds = [];
                    result.forEach((e) => {
                      runnedContactIds.push(e.contact && e.contact._id);
                    });
                    notRunnedAssignIds = _.differenceBy(
                      assigns,
                      runnedContactIds,
                      (e) => e + ''
                    );
                  } else {
                    const runnedDealIds = [];
                    result.forEach((e) => {
                      runnedDealIds.push(e.deal && e.deal._id);
                    });
                    notRunnedAssignIds = _.differenceBy(
                      assigns,
                      runnedDealIds,
                      (e) => e + ''
                    );
                  }
                }

                if (assignsToTemp) {
                  // Create Notification and With Success and Failed & first Task create
                  const failed = error.map((e) => e.contact && e.contact._id);
                  const not_executed = [...notRunnedAssignIds];
                  const succeed = _.differenceBy(
                    contacts,
                    [...failed, ...notRunnedAssignIds],
                    (e) => e + ''
                  );

                  const notification = new Notification({
                    user: currentUser._id,
                    type: 'personal',
                    criteria: 'assign_automation',
                    status: 'pending',
                    process: taskProcessId,
                    contact: [...inputContacts],
                    detail: {
                      automation: automation_id,
                    },
                    deliver_status: {
                      succeed,
                      failed,
                      not_executed,
                      error,
                    },
                  });

                  notification.save().catch((err) => {
                    console.log(
                      'Bulk assign automation notification creation is failed.',
                      err
                    );
                  });

                  const task = new Task({
                    user: currentUser._id,
                    contacts,
                    status: 'completed',
                    process: taskProcessId,
                    type: 'send_email',
                    action: {
                      automation: automation_id,
                    },
                    due_date: new Date(),
                    exec_result: {
                      notExecuted: not_executed,
                      succeed,
                      failed: error,
                    },
                  });

                  task.save().catch((err) => {
                    console.log('Some assign is processed immediately', err);
                  });
                }
              })
              .catch((err) => {
                console.log('bulk automation assigning is failed', err);
              });
          }
        } else {
          /**
            * Jian working needed
               error: 'not found automations'
               Notification Cretor
            */
          // createNotification(
          //   'automation',
          //   {
          //     user: currentUser._id,
          //     criteria: 'assign_automation',
          //     status: 'pending',
          //     // process: taskProcessId,
          //     // deliver_status: {
          //     //   failed: error,
          //     //   assigns,
          //     //   notExecuted: notRunnedContactIds,
          //     // },
          //     // detail: { ...req.body },
          //   },
          //   currentUser
          // );
        }
        return true;
      }
    });
  }
};

const assignTimeline = async (data) => {
  const {
    assign_array,
    automation_id,
    user_id,
    required_unique,
    inherited_by,
    parent_ref,
    custom_period,
    scheduled_time,
  } = data;
  const promise_array = [];
  let promise;

  const _automation = await Automation.findOne({ _id: automation_id }).catch(
    (err) => {
      console.log('automation assign err', err.message);
    }
  );

  if (_automation) {
    const { automations } = _automation;
    let count = 0;
    let max_assign_count;

    const currentUser = await User.findOne({
      _id: user_id,
    });

    if (currentUser) {
      const automation_info = currentUser.automation_info;

      if (automation_info['is_limit']) {
        max_assign_count =
          automation_info.max_count || AUTOMATION_ASSIGN_LIMIT.PRO;

        const timeline = await TimeLine.aggregate([
          {
            $match: {
              user: mongoose.Types.ObjectId(currentUser._id),
            },
          },
          {
            $group: {
              _id: { contact: '$contact' },
              count: { $sum: 1 },
            },
          },
          {
            $project: { _id: 1 },
          },
          {
            $count: 'total',
          },
        ]);

        if (timeline[0] && timeline[0]['total']) {
          count = timeline[0]['total'];
        }
      }

      if (_automation.type === 'contact') {
        for (let i = 0; i < assign_array.length; i++) {
          const contact = await Contact.findOne({ _id: assign_array[i] });

          if (contact) {
            if (required_unique) {
              await TimeLine.deleteMany({
                contact: assign_array[i],
                automation: { $ne: null },
              }).catch((err) => {
                console.log('timeline remove err', err.message);
              });
            }

            if (automation_info['is_limit'] && max_assign_count <= count) {
              promise = new Promise((resolve) => {
                resolve({
                  status: false,
                  contact: {
                    _id: contact._id,
                    first_name: contact.first_name,
                    last_name: contact.last_name,
                  },
                  error: 'Exceed max active automations',
                });
              });
              promise_array.push(promise);
              continue;
            }

            count += 1;
            promise = new Promise((resolve) => {
              resolve({
                status: true,
                contact: {
                  _id: contact._id,
                  first_name: contact.first_name,
                  last_name: contact.last_name,
                },
              });
            });
            promise_array.push(promise);

            for (let j = 0; j < automations.length; j++) {
              const automation = automations[j];
              let time_line;
              let due_date;
              if (automation.status === 'active') {
                const { period } = automation;
                const now = scheduled_time
                  ? moment(new Date(scheduled_time))
                  : moment();

                if (custom_period) {
                  due_date = now.add(custom_period, 'minutes');
                } else {
                  due_date = now;
                }

                due_date = due_date.add(period, 'hours');

                let new_parent = automation.parent;
                let new_ref = automation.id;
                if (inherited_by) {
                  new_ref = `${new_ref}_${automation_id}`;
                  if (automation.parent === 'a_10000') {
                    new_parent = parent_ref;
                  } else {
                    new_parent = `${new_parent}_${automation_id}`;
                  }
                }
                const _time_line = new TimeLine({
                  ...automation,
                  ref: new_ref,
                  parent_ref: new_parent,
                  user: currentUser.id,
                  contact: assign_array[i],
                  automation: automation_id,
                  due_date,
                });

                _time_line
                  .save()
                  .then(async (timeline) => {
                    if (
                      !custom_period &&
                      timeline.period === 0 &&
                      !scheduled_time
                    ) {
                      try {
                        runTimeline(timeline);
                        const data = {
                          contact: assign_array[i],
                          ref: timeline.ref,
                        };
                        activeNext(data);
                      } catch (err) {
                        console.log('run timeline err', err);
                      }
                    }
                  })
                  .catch((err) => {
                    console.log('timeline assign err', err.message);
                  });
              } else {
                let new_parent = automation.parent;
                let new_ref = automation.id;
                if (inherited_by) {
                  new_ref = `${new_ref}_${automation_id}`;
                  if (automation.parent === 'a_10000') {
                    new_parent = parent_ref;
                  } else {
                    new_parent = `${new_parent}_${automation_id}`;
                  }
                }
                time_line = new TimeLine({
                  ...automation,
                  ref: new_ref,
                  parent_ref: new_parent,
                  user: currentUser.id,
                  contact: assign_array[i],
                  automation: automation_id,
                });

                time_line.save().catch((err) => {
                  console.log('timeline assign err', err.message);
                });
              }
            }
          }
        }
      } else {
        for (let i = 0; i < assign_array.length; i++) {
          const deal = await Deal.findOne({ _id: assign_array[i] });

          if (required_unique) {
            await TimeLine.deleteMany({
              deal: assign_array[i],
              automation: { $ne: null },
            }).catch((err) => {
              console.log('timeline remove err', err.message);
            });
          }

          // const old_timeline = await TimeLine.findOne({
          //   deal: assign_array[i],
          //   automation: { $ne: null },
          // });
          //
          // if (old_timeline) {
          //   promise = new Promise((resolve) => {
          //     resolve({
          //       status: false,
          //       deal: {
          //         _id: deal._id,
          //         title: deal.title,
          //       },
          //       error: 'A deal has been already assigned automation',
          //     });
          //   });
          //   promise_array.push(promise);
          //   continue;
          // }

          if (automation_info['is_limit'] && max_assign_count <= count) {
            promise = new Promise((resolve) => {
              resolve({
                status: false,
                deal: {
                  _id: deal._id,
                  title: deal.title,
                },
                error: 'Exceed max active automations',
              });
            });
            promise_array.push(promise);
            continue;
          }

          count += 1;

          for (let j = 0; j < automations.length; j++) {
            const automation = automations[j];
            let time_line;
            if (automation.status === 'active') {
              const { period } = automation;
              const now = scheduled_time
                ? moment(new Date(scheduled_time))
                : moment();
              now.set({ second: 0, millisecond: 0 });
              const due_date = now.add(period, 'hours');

              let new_parent = automation.parent;
              let new_ref = automation.id;
              if (inherited_by) {
                new_ref = `${new_ref}_${automation_id}`;
                if (automation.parent === 'a_10000') {
                  new_parent = parent_ref;
                } else {
                  new_parent = `${new_parent}_${automation_id}`;
                }
              }
              const _time_line = new TimeLine({
                ...automation,
                type: 'deal',
                ref: new_ref,
                parent_ref: new_parent,
                user: currentUser.id,
                automation: automation_id,
                deal: assign_array[i],
                due_date,
              });

              _time_line
                .save()
                .then(async (timeline) => {
                  if (timeline.period === 0 && !scheduled_time) {
                    try {
                      runTimeline(timeline);
                      const data = {
                        ref: timeline.ref,
                        deal: deal._id,
                      };
                      activeNext(data);
                    } catch (err) {
                      console.log('timeline run err', err);
                    }
                  }
                })
                .catch((err) => {
                  console.log('timeline save err', err.message);
                });
            } else {
              let new_parent = automation.parent;
              let new_ref = automation.id;

              if (inherited_by) {
                new_ref = `${new_ref}_${automation_id}`;
                if (automation.parent === 'a_10000') {
                  new_parent = parent_ref;
                } else {
                  new_parent = `${new_parent}_${automation_id}`;
                }
              }

              time_line = new TimeLine({
                ...automation,
                ref: new_ref,
                type: 'deal',
                parent_ref: new_parent,
                user: currentUser.id,
                deal: assign_array[i],
                automation: automation_id,
              });

              time_line.save().catch((err) => {
                console.log('timeline save err', err.message);
              });
            }
          }
        }
      }
    }
  }

  return Promise.all(promise_array);
};

/**
 * @param {*} data
 */
const remove = async (data) => {
  const { deal, contact } = data;

  if (deal) {
    const timelines = await TimeLine.find({
      deal,
    }).catch((err) => {
      console.log('timeline finding error', err.message);
    });
    TimeLine.deleteMany({
      deal: mongoose.Types.ObjectId(deal),
    }).catch((err) => {
      console.log('timeline delete error', err.message);
    });
    const detail = [];
    timelines.forEach((e) => {
      const action = {
        ...e,
        user: undefined,
        deal: undefined,
        automation: undefined,
        created_at: undefined,
        updated_at: undefined,
        __v: undefined,
        _id: undefined,
      };
      detail.push(action);
    });
    const userId = timelines[0]['_id'];

    const automationId = timelines[0]['automation'];
    const automation = await Automation.findOne({
      _id: automationId,
    })
      .select({ title: true })
      .catch((err) => {
        console.log('automation is completed', err);
      });

    createCronNotification(
      'automation',
      {
        user: userId,
        criteria: 'automation_completed',
        content: notifications.automation_completed.content,
        description: `Click <a href="${urls.DEAL_PAGE_URL}${deal}">here</a> to check it out`,
        detail: {
          _id: automationId,
          title: automation.title,
          actions: detail,
        },
        deal,
      },
      { _id: userId }
    );
  } else {
    const timelines = await TimeLine.find({
      contact,
    }).catch((err) => {
      console.log('timeline finding error', err.message);
    });
    TimeLine.deleteMany({
      contact,
    }).catch((err) => {
      console.log('timeline delete error', err.message);
    });

    const detail = [];
    timelines.forEach((e) => {
      const action = {
        ...e,
        user: undefined,
        contact: undefined,
        automation: undefined,
        created_at: undefined,
        updated_at: undefined,
        __v: undefined,
        _id: undefined,
      };
      detail.push(action);
    });
    const userId = timelines[0].user;
    const automationId = timelines[0]['automation'];
    const automation = await Automation.findOne({
      _id: automationId,
    })
      .select({ title: true })
      .catch((err) => {
        console.log('automation is completed', err);
      });

    if (automation) {
      createCronNotification(
        'automation',
        {
          user: userId,
          criteria: 'automation_completed',
          contact,
          content: notifications.automation_completed.content,
          description: `Click <a href="${urls.CONTACT_PAGE_URL}${contact}">here</a> to check it out`,
          detail: {
            _id: automationId,
            title: automation.title,
            actions: detail,
          },
        },
        { _id: userId }
      );
    }
  }
};

module.exports = {
  runTimeline,
  disableNext,
  activeTimeline,
  disableTimeline,
  activeNext,
  tagTriggerAutomation,
  remove,
  assignTimeline,
  createSubAutomation,
  updateAutomation,
  getSubTitles,
  getMaterials,
};
