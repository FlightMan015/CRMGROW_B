const mongoose = require('mongoose');
const Automation = require('../models/automation');
const TimeLine = require('../models/time_line');
const Contact = require('../models/contact');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const Team = require('../models/team');
const Deal = require('../models/deal');
const Folder = require('../models/folder');
const DealStage = require('../models/deal_stage');
const PipeLine = require('../models/pipe_line');
const Garbage = require('../models/garbage');
const Event = require('../models/event_type');
const garbageHelper = require('../helpers/garbage');
const { createVideo, createImage, createPdf } = require('../helpers/material');
const system_settings = require('../config/system_settings');
const {
  createSubAutomation,
  getSubTitles,
  updateAutomation,
} = require('../helpers/automation');

const get = async (req, res) => {
  const { id } = req.body;
  const { currentUser } = req;
  const count = req.body.count || 50;
  const skip = req.body.skip || 0;

  Automation.findOne({ _id: id })
    .then(async (automation) => {
      const myJSON = JSON.stringify(automation);
      const data = JSON.parse(myJSON);
      if (data.type === 'deal') {
        const deals = [];
        const total = await TimeLine.aggregate()
          .match({
            user: mongoose.Types.ObjectId(currentUser._id),
            automation: mongoose.Types.ObjectId(id),
          })
          .group({ _id: '$deal' })
          .sort({ created_at: 1 });
        if (total && total.length > 0) {
          const page_deals = await TimeLine.aggregate()
            .match({
              user: mongoose.Types.ObjectId(currentUser._id),
              automation: mongoose.Types.ObjectId(id),
            })
            .group({ _id: '$deal' })
            .sort({ created_at: 1 })
            .skip(skip)
            .limit(count);
          for (let i = 0; i < page_deals.length; i++) {
            const _deal = await Deal.findById(page_deals[i]._id).populate(
              'deal_stage'
            );
            if (!_deal) {
              continue;
            }
            const _contacts = await Contact.find({
              _id: { $in: _deal.contacts },
            }).select({
              _id: 1,
              first_name: 1,
              last_name: 1,
              email: 1,
              cell_phone: 1,
            });
            deals.push({
              deal: _deal,
              contacts: _contacts,
            });
          }
          data.deals = { deals, count: total.length };
        }
      } else {
        // get shared contacts first
        const shared_contacts = await Contact.find({
          shared_members: currentUser.id,
        });

        const total = await TimeLine.aggregate([
          {
            $match: {
              $or: [
                {
                  user: mongoose.Types.ObjectId(currentUser._id),
                  automation: mongoose.Types.ObjectId(id),
                },
                {
                  contact: { $in: shared_contacts },
                  automation: mongoose.Types.ObjectId(id),
                },
              ],
            },
          },
          {
            $group: {
              _id: { contact: '$contact' },
            },
          },
          {
            $group: {
              _id: '$_id.contact',
            },
          },
          {
            $project: { _id: 1 },
          },
          {
            $count: 'count',
          },
        ]);

        const contacts = await TimeLine.aggregate([
          {
            $match: {
              $or: [
                {
                  user: mongoose.Types.ObjectId(currentUser._id),
                  automation: mongoose.Types.ObjectId(id),
                },
                {
                  contact: { $in: shared_contacts },
                  automation: mongoose.Types.ObjectId(id),
                },
              ],
            },
          },
          {
            $group: {
              _id: { contact: '$contact' },
            },
          },
          {
            $group: {
              _id: '$_id.contact',
            },
          },
          {
            $project: { _id: 1 },
          },
          { $skip: skip },
          { $limit: count },
        ]);

        data.contacts = { contacts, count: total[0] ? total[0].count : 0 };
      }

      res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Automation reading is failed.',
      });
    });
};

const searchContact = async (req, res) => {
  const { currentUser } = req;
  const searchStr = req.body.search;
  const search = searchStr.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  const phoneSearch = searchStr.replace(/[.*+\-?^${}()|[\]\\\s]/g, '');
  let searched_contacts = [];
  const data = [];

  // get shared contacts first

  if (search.split(' ').length > 1) {
    searched_contacts = await Contact.find({
      $or: [
        {
          first_name: { $regex: search.split(' ')[0], $options: 'i' },
          last_name: { $regex: search.split(' ')[1], $options: 'i' },
          user: currentUser.id,
        },
        {
          first_name: { $regex: search.split(' ')[0], $options: 'i' },
          last_name: { $regex: search.split(' ')[1], $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          first_name: { $regex: search, $options: 'i' },
          user: currentUser.id,
        },
        {
          first_name: { $regex: search, $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          last_name: { $regex: search, $options: 'i' },
          user: currentUser.id,
        },
        {
          last_name: { $regex: search, $options: 'i' },
          shared_members: currentUser.id,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          user: currentUser.id,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          shared_members: currentUser.id,
        },
      ],
    })
      .populate('last_activity')
      .sort({ first_name: 1 });
  } else {
    searched_contacts = await Contact.find({
      $or: [
        {
          first_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
          user: currentUser.id,
        },
        {
          email: { $regex: '.*' + search.split(' ')[0] + '.*', $options: 'i' },
          user: currentUser.id,
        },
        {
          last_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
          user: currentUser.id,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          user: currentUser.id,
        },
      ],
    })
      .populate('last_activity')
      .sort({ first_name: 1 });
  }

  if (searched_contacts.length > 0) {
    for (let i = 0; i < searched_contacts.length; i++) {
      const contact = searched_contacts[i];
      const searched_timeline = await TimeLine.findOne({
        contact,
        automation: req.body.automation,
      }).catch((err) => {
        console.log('time line find err', err.message);
      });

      if (searched_timeline) {
        data.push(contact);
      }
    }
  }

  return res.send({
    status: true,
    data,
  });
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const automations = await Automation.find({
    user: currentUser.id,
    del: false,
  });

  const _automation_admin = await Automation.find({
    role: 'admin',
    company,
    del: false,
  });

  Array.prototype.push.apply(automations, _automation_admin);

  const teams = await Team.find({
    $or: [{ members: currentUser.id }, { owner: currentUser.id }],
  }).populate('automations');

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(automations, team.automations);
    }
  }

  if (!automations) {
    return res.status(400).json({
      status: false,
      error: 'Automation doesn`t exist',
    });
  }

  const shared_contacts = await Contact.find({
    shared_members: currentUser.id,
  });

  const automation_array = [];

  for (let i = 0; i < automations.length; i++) {
    const automation = automations[i];
    const contacts = await TimeLine.aggregate([
      {
        $match: {
          $or: [
            {
              user: mongoose.Types.ObjectId(currentUser._id),
              automation: mongoose.Types.ObjectId(automation._id),
            },
            {
              contact: { $in: shared_contacts },
              automation: mongoose.Types.ObjectId(automation._id),
            },
          ],
        },
      },
      {
        $group: {
          _id: { contact: '$contact' },
        },
      },
      {
        $group: {
          _id: '$_id.contact',
        },
      },
      {
        $project: { _id: 1 },
      },
      {
        $count: 'count',
      },
    ]);

    let automation_detail;

    if (automation._doc) {
      automation_detail = {
        ...automation._doc,
        contacts: contacts[0] ? contacts[0].count : 0,
      };
    } else {
      automation_detail = {
        ...automation,
        contacts: contacts[0] ? contacts[0].count : 0,
      };
    }

    automation_array.push(automation_detail);
  }

  return res.send({
    status: true,
    data: automation_array,
  });
};

const load = async (req, res) => {
  const { currentUser } = req;
  const automations = await Automation.find({
    user: currentUser.id,
    del: false,
  });

  if (!automations) {
    return res.status(400).json({
      status: false,
      error: 'Automation doesn`t exist',
    });
  }

  const shared_contacts = await Contact.find({
    shared_members: currentUser.id,
  });

  const automation_array = [];

  for (let i = 0; i < automations.length; i++) {
    const automation = automations[i];
    const contacts = await TimeLine.aggregate([
      {
        $match: {
          $or: [
            {
              user: mongoose.Types.ObjectId(currentUser._id),
              automation: mongoose.Types.ObjectId(automation._id),
            },
            {
              contact: { $in: shared_contacts },
              automation: mongoose.Types.ObjectId(automation._id),
            },
          ],
        },
      },
      {
        $group: {
          _id: { contact: '$contact' },
        },
      },
      {
        $group: {
          _id: '$_id.contact',
        },
      },
      {
        $project: { _id: 1 },
      },
      {
        $count: 'count',
      },
    ]);

    let automation_detail;

    if (automation._doc) {
      automation_detail = {
        ...automation._doc,
        contacts: contacts[0] ? contacts[0].count : 0,
      };
    } else {
      automation_detail = {
        ...automation,
        contacts: contacts[0] ? contacts[0].count : 0,
      };
    }

    automation_array.push(automation_detail);
  }

  const folderArr = await Folder.find({
    user: currentUser._id,
    type: 'automation',
  });

  const folders = (folderArr || []).map((e) => {
    return { ...e._doc, isFolder: true };
  });

  Array.prototype.push.apply(automation_array, folders);

  return res.send({
    status: true,
    data: automation_array,
  });
};

const loadLibrary = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const automation_list = [];

  const _automation_admin = await Automation.find({
    role: 'admin',
    company,
    del: false,
  });

  Array.prototype.push.apply(automation_list, _automation_admin);

  const folder_list = [];
  const _admin_folders = await Folder.find({
    type: 'automation',
    role: 'admin',
    company,
  });
  Array.prototype.push.apply(folder_list, _admin_folders);

  const teams = await Team.find({
    $or: [{ members: currentUser.id }, { owner: currentUser.id }],
  })
    .populate('automations')
    .populate('folders');

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(automation_list, team.automations);
      if (team.folders && team.folders.length) {
        team.folders.forEach((folder) => {
          if (folder.type === 'automation') {
            folder_list.push(folder);
          }
        });
      }
    }
  }

  let folder_automation_ids = [];
  const folders = [];
  folder_list.forEach((folder) => {
    folder_automation_ids = [...folder_automation_ids, ...folder.automations];
    const folderDoc = { ...folder._doc, isFolder: true };
    folders.push(folderDoc);
  });
  const folder_automations = await Automation.find({
    _id: { $in: folder_automation_ids },
  }).catch((err) => {
    console.log('folder automations', err);
  });

  return res.send({
    status: true,
    data: [...automation_list, ...folder_automations, ...folders],
  });
};

const getStatus = async (req, res) => {
  const { id } = req.params;
  const { contacts } = req.body;
  const assignedContacts = await Contact.find({ _id: { $in: contacts } })
    .populate('last_activity', 'label')
    .catch((err) => {
      console.log('Error', err);
      return res.status(400).json({
        status: false,
        error: err.message,
      });
    });

  return res.send({
    status: true,
    data: assignedContacts,
  });
  /**
  TimeLine.find({ automation: id })
    .populate()
    .then((data) => {
      res.send({
        status: true,
        data: {
          timelines: data,
          contacts: assignedContacts,
        },
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Automation reading is failed.',
      });
    });
  */
};

const getAssignedContacts = async (req, res) => {
  const { id } = req.params;
  const { currentUser } = req;
  const contacts = await TimeLine.aggregate([
    {
      $match: {
        $and: [
          {
            user: mongoose.Types.ObjectId(currentUser._id),
            automation: mongoose.Types.ObjectId(id),
          },
        ],
      },
    },
    {
      $group: {
        _id: { contact: '$contact' },
      },
    },
    {
      $group: {
        _id: '$_id.contact',
      },
    },
    {
      $project: { _id: 1 },
    },
  ]);
  const ids = [];
  contacts.forEach((e) => {
    ids.push(e._id);
  });
  const assignedContacts = await Contact.find(
    { _id: { $in: ids } },
    '_id first_name last_name email cell_phone'
  ).catch((err) => {
    console.log('Error', err);
  });
  res.send({
    status: true,
    data: assignedContacts,
  });
};

const getPage = async (req, res) => {
  const { currentUser } = req;
  const { page } = req.params;

  const garbage = await garbageHelper.get(currentUser);
  // let editedAutomations = [];
  // if(garbage) {
  //     editedAutomations = garbage['edited_automation']
  // }

  const team_automations = [];
  const teams = await Team.find({ members: currentUser.id });

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      if (team.automations) {
        Array.prototype.push.apply(team_automations, team.automations);
      }
    }
  }

  const automations = await Automation.find({
    $or: [
      { user: currentUser.id },
      { role: 'admin' },
      { _id: { $in: team_automations } },
    ],
  })
    .skip((page - 1) * 10)
    .limit(10);
  const automation_array = [];
  for (let i = 0; i < automations.length; i++) {
    const automation = automations[i];
    const contacts = await TimeLine.aggregate([
      {
        $match: {
          $and: [
            {
              user: mongoose.Types.ObjectId(currentUser._id),
              automation: mongoose.Types.ObjectId(automation._id),
            },
          ],
        },
      },
      {
        $group: {
          _id: { contact: '$contact' },
        },
      },
      {
        $group: {
          _id: '$_id.contact',
        },
      },
      {
        $project: { _id: 1 },
      },
    ]);
    const myJSON = JSON.stringify(automation);
    const data = JSON.parse(myJSON);
    const automation_detail = await Object.assign(data, { contacts });

    automation_array.push(automation_detail);
  }

  const total = await Automation.countDocuments({
    $or: [{ user: currentUser.id }, { role: 'admin' }],
  });

  return res.json({
    status: true,
    data: automation_array,
    total,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  if (!currentUser.automation_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable automations',
    });
  }
  const automation = new Automation({
    ...req.body,
    user: currentUser.id,
  });
  automation
    .save()
    .then(async (_automation) => {
      if (req.body.folder) {
        await Folder.updateOne(
          {
            _id: req.body['folder'],
            user: currentUser._id,
            type: 'automation',
          },
          { $addToSet: { automations: { $each: [_automation._id] } } }
        ).catch((err) => {
          console.log('folder update is failed');
        });
      }
      res.send({
        status: true,
        data: _automation,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Automation creating is failed.',
      });
    });
};

const download = async (req, res) => {
  const { currentUser } = req;
  const { ids, videoIds, imageIds, pdfIds, data, match_info } = req.body;
  if (!currentUser.automation_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable automations',
    });
  }
  if (!ids.length) {
    const automation = new Automation({
      ...data,
      user: currentUser.id,
    });
    await automation.save();
    res.send({
      status: true,
    });
  } else {
    let automationsList = [];
    let videoList = [];
    let pdfList = [];
    let imageList = [];
    automationsList = await createSubAutomation(ids, currentUser, match_info);
    if (videoIds.length) {
      videoList = await createVideo(videoIds, currentUser);
    }
    if (imageIds.length) {
      imageList = await createImage(imageIds, currentUser);
    }
    if (pdfIds.length) {
      pdfList = await createPdf(pdfIds, currentUser);
    }
    await updateAutomation(
      ids,
      automationsList,
      videoList,
      imageList,
      pdfList,
      match_info,
      currentUser
    );
    res.send({
      status: true,
    });
  }
};
const getTitles = async (req, res) => {
  const { currentUser } = req;
  const { id } = req.body;
  if (!currentUser.automation_info['is_enabled']) {
    return res.status(412).send({
      status: false,
      error: 'Disable automations',
    });
  }
  const subTitles = [];
  const videoIds = [];
  const videoTitles = [];
  const pdfIds = [];
  const pdfTitless = [];
  const imageIds = [];
  const imageTitles = [];
  const dealStageTitles = [];
  const subIds = [];
  const allIds = [];
  allIds.push(id);
  subIds.push(id);
  const result = await getSubTitles(
    allIds,
    subIds,
    subTitles,
    videoIds,
    videoTitles,
    pdfIds,
    pdfTitless,
    imageIds,
    imageTitles,
    dealStageTitles
  );
  return res.send({
    status: true,
    data: result,
  });
};

const update = async (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;
  const data = req.body;
  let automation = await Automation.findOne({ _id: id });
  automation = JSON.parse(JSON.stringify(automation));

  if (automation) {
    if (automation.user !== currentUser.id) {
      if (automation.role === 'admin') {
        return res.status(400).send({
          status: false,
          error: `couldn't update admin automation`,
        });
      }
      return res.status(400).send({
        status: false,
        error: `This is not your automation so couldn't update.`,
      });
    }
  } else {
    return res.status(400).send({
      status: false,
      error: `Automation doesn't exist`,
    });
  }
  Automation.updateOne({ _id: id }, { $set: data })
    .then(() => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(400).send({
        status: false,
        error: err.message || 'Automation Updating is failed.',
      });
    });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  const automation = await Automation.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!automation) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission.',
    });
  }

  const error_message = [];
  const stages = await DealStage.find({
    user: currentUser.id,
    automation: req.params.id,
  }).catch((err) => {
    console.log('err', err.message);
  });

  if (stages.length > 0) {
    error_message.push({
      reason: 'stages',
      stages,
    });
  }

  const garbageCaptureField = await Garbage.find(
    {
      user: currentUser.id,
    },
    { capture_field: 1, _id: 0 }
  ).catch((err) => {
    console.log('err', err.message);
  });

  const garbages = [];
  const captureValues = Object.values(garbageCaptureField[0].capture_field);
  for (let i = 0; i < captureValues.length; i++) {
    if (captureValues[i].automation) {
      if (req.params.id === captureValues[i].automation) {
        garbages.push(captureValues[i].name);
      }
    }
  }

  if (garbages.length > 0) {
    error_message.push({
      reason: 'garbages',
      garbages,
    });
  }

  const event_types = await Event.find({
    automation: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('err', err.message);
  });

  if (event_types.length > 0) {
    error_message.push({
      reason: 'event_types',
      event_types,
    });
  }

  const automations = await Automation.find({
    user: currentUser.id,
    automations: {
      $elemMatch: {
        'action.type': 'automation',
        'action.automation_id': req.params.id,
      },
    },
  }).catch((err) => {
    console.log('err', err.message);
  });

  if (automations.length > 0) {
    error_message.push({
      reason: 'automations',
      automations,
    });
  }

  const timeline = await TimeLine.findOne({
    user: currentUser.id,
    automation: automation._id,
  });

  if (timeline) {
    error_message.push({
      reason: 'running',
    });
  }
  if (error_message.length > 0) {
    return res.send({
      status: true,
      error_message,
    });
  }

  if (automation.role === 'team') {
    Team.updateOne(
      { automations: req.params.id },
      {
        $pull: { automations: { $in: [req.params.id] } },
      }
    );
  }

  Automation.deleteOne({ _id: req.params.id })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Automation Removing is failed.',
      });
    });
};

const bulkRemove = async (req, res) => {
  const { currentUser } = req;
  const { data } = req.body;

  const errors = [];
  const promise_array = [];
  const running_automations = [];
  if (data) {
    for (let i = 0; i < data.length; i++) {
      const promise = new Promise(async (resolve) => {
        const automation = await Automation.findOne({
          _id: data[i],
          user: currentUser.id,
        });

        if (automation) {
          const error_message = [];
          const stages = await DealStage.find({
            user: currentUser.id,
            automation: automation._id,
          }).catch((err) => {
            console.log('err', err.message);
          });

          if (stages.length > 0) {
            error_message.push({
              reason: 'stages',
              stages,
            });
          }

          const garbageCaptureField = await Garbage.find(
            {
              user: currentUser.id,
            },
            { capture_field: 1, _id: 0 }
          ).catch((err) => {
            console.log('err', err.message);
          });

          const garbages = [];
          const captureValues = Object.values(
            garbageCaptureField[0].capture_field
          );
          for (let i = 0; i < captureValues.length; i++) {
            if (captureValues[i].automation) {
              if (automation.id === captureValues[i].automation) {
                garbages.push(captureValues[i].name);
              }
            }
          }

          if (garbages.length > 0) {
            error_message.push({
              reason: 'garbages',
              garbages,
            });
          }

          const event_types = await Event.find({
            automation: automation._id,
            user: currentUser.id,
          }).catch((err) => {
            console.log('err', err.message);
          });

          if (event_types.length > 0) {
            error_message.push({
              reason: 'event_types',
              event_types,
            });
          }

          const automations = await Automation.find({
            user: currentUser.id,
            automations: {
              $elemMatch: {
                'action.type': 'automation',
                'action.automation_id': automation.id,
              },
            },
          }).catch((err) => {
            console.log('err', err.message);
          });

          if (automations.length > 0) {
            error_message.push({
              reason: 'automations',
              automations,
            });
          }

          const timeline = await TimeLine.findOne({
            user: currentUser.id,
            automation: automation._id,
          });

          if (timeline) {
            error_message.push({
              reason: 'running',
            });
          }

          if (error_message.length > 0) {
            if (error_message.length > 0) {
              errors.push({
                automation_id: automation._id,
                automation_title: automation.title,
                error_message,
              });
            }

            resolve();
          } else {
            if (automation.role === 'team') {
              Team.updateOne(
                { automations: data[i] },
                {
                  $pull: { automations: { $in: [data[i]] } },
                }
              );
            }

            await Automation.deleteOne({ _id: automation._id }).catch((err) => {
              console.log('err', err.message);
            });
            resolve();
          }
        }
      });
      promise_array.push(promise);
    }
  }

  Promise.all(promise_array)
    .then(() => {
      return res.json({
        status: true,
        failed: errors,
      });
    })
    .catch((err) => {
      console.log('automation bulk remove err', err.message);
      res.status(500).json({
        status: false,
        error: err.message,
      });
    });

  // const error_message = [];
  // const remove_promise = new Promise(async (resolve) => {
  //   const stages = await DealStage.find({
  //     user: currentUser.id,
  //     automation: { $in: data },
  //   }).catch((err) => {
  //     console.log('err', err.message);
  //   });

  //   if (stages.length > 0) {
  //     error_message.push({
  //       reason: 'stages',
  //       stages,
  //     });
  //   }

  //   const garbageCaptureField = await Garbage.find(
  //     {
  //       user: currentUser.id,
  //     },
  //     { capture_field: 1, _id: 0 }
  //   ).catch((err) => {
  //     console.log('err', err.message);
  //   });

  //   const garbages = [];
  //   const captureValues = Object.values(garbageCaptureField[0].capture_field);
  //   for (let i = 0; i < captureValues.length; i++) {
  //     if (captureValues[i].automation) {
  //       if (data.findIndex((e) => e === captureValues[i].automation) !== -1) {
  //         garbages.push(captureValues[i].name);
  //       }
  //     }
  //   }

  //   if (garbages.length > 0) {
  //     error_message.push({
  //       reason: 'garbages',
  //       garbages,
  //     });
  //   }

  //   const event_types = await Event.find({
  //     automation: { $in: data },
  //     user: currentUser.id,
  //   }).catch((err) => {
  //     console.log('err', err.message);
  //   });

  //   if (event_types.length > 0) {
  //     error_message.push({
  //       reason: 'event_types',
  //       event_types,
  //     });
  //   }

  //   const subautomations = await Automation.find({
  //     user: currentUser.id,
  //     _id: { $in: data },
  //     automations: {
  //       $elemMatch: {
  //         'action.type': 'automation',
  //       },
  //     },
  //   }).catch((err) => {
  //     console.log('err', err.message);
  //   });

  //   if (subautomations.length > 0) {
  //     error_message.push({
  //       reason: 'subautomations',
  //       subautomations,
  //     });
  //   }

  //   if (error_message.length > 0) {
  //     resolve();
  //   } else {
  //     for (let i = 0; i < data.length; i++) {
  //       const automation = await Automation.findOne({
  //         _id: data[i],
  //         user: currentUser.id,
  //       });
  //       if (automation.role === 'team') {
  //         Team.updateOne(
  //           { automations: data[i] },
  //           {
  //             $pull: { automations: { $in: [data[i]] } },
  //           }
  //         );
  //       }
  //     }

  //     await Automation.deleteMany({ _id: { $in: data } }).catch((err) => {
  //       console.log('err', err.message);
  //     });
  //     resolve();
  //   }
  // });

  // remove_promise
  //   .then(() => {
  //     return res.send({
  //       status: true,
  //       error_message,
  //     });
  //   })
  //   .catch((err) => {
  //     return res.status(500).send({
  //       status: false,
  //       error: err.message || 'Automation Removing is failed.',
  //     });
  //   });
};

const search = async (req, res) => {
  const condition = req.body;
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';

  const team_automations = [];
  const teams = await Team.find({
    $or: [{ members: currentUser.id }, { owner: currentUser.id }],
  });

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      if (team.automations) {
        Array.prototype.push.apply(team_automations, team.automations);
      }
    }
  }

  Automation.find({
    $and: [
      {
        $or: [
          { user: currentUser.id },
          { role: 'admin', company },
          { _id: { $in: team_automations } },
        ],
      },
      {
        title: { $regex: `.*${condition.search}.*`, $options: 'i' },
      },
    ],
  })
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
      });
    });
};

const updateDefault = async (req, res) => {
  const { automation, id } = req.body;
  let thumbnail;
  const { currentUser } = req;

  const defaultAutomation = await Video.findOne({
    _id: id,
    role: 'admin',
  }).catch((err) => {
    console.log('err', err);
  });
  if (!defaultAutomation) {
    return res.status(400).json({
      status: false,
      error: 'This Default automation not exists',
    });
  }
  // Update Garbage
  const garbage = await garbageHelper.get(currentUser);
  if (!garbage) {
    return res.status(400).send({
      status: false,
      error: `Couldn't get the Garbage`,
    });
  }
  if (garbage.edited_automation) {
    garbage.edited_automation.push(id);
  } else {
    garbage.edited_automation = [id];
  }

  await garbage.save().catch((err) => {
    return res.status.json({
      status: false,
      error: 'Update Garbage Error.',
    });
  });

  for (const key in automation) {
    defaultAutomation[key] = automation[key];
  }
  if (thumbnail) {
    defaultAutomation.thumbnail = thumbnail;
  }

  defaultAutomation.updated_at = new Date();
  const defaultAutomationJSON = JSON.parse(JSON.stringify(defaultAutomation));
  delete defaultAutomationJSON._id;
  delete defaultAutomationJSON.role;
  const newAutomation = new Automation({
    ...defaultAutomationJSON,
    user: currentUser._id,
    default_edited: true,
  });
  const _automation = await newAutomation
    .save()
    .then()
    .catch((err) => {
      console.log('err', err);
    });

  return res.send({
    status: true,
    data: _automation,
  });
};

const loadOwn = async (req, res) => {
  const { currentUser } = req;
  const automations = await Automation.find({
    $and: [{ user: currentUser.id }, { role: { $ne: 'admin' } }],
  });
  const shared_contacts = await Contact.find({
    shared_members: currentUser.id,
  });

  let count;

  for (let i = 0; i < automations.length; i++) {
    if (automations[i].type === 'contact') {
      count = await TimeLine.aggregate([
        {
          $match: {
            $or: [
              {
                user: mongoose.Types.ObjectId(currentUser._id),
                automation: mongoose.Types.ObjectId(automations[i]._id),
              },
              {
                contact: { $in: shared_contacts },
                automation: mongoose.Types.ObjectId(automations[i]._id),
              },
            ],
          },
        },
        {
          $group: {
            _id: { contact: '$contact' },
          },
        },
        {
          $group: {
            _id: '$_id.contact',
          },
        },
        {
          $project: { _id: 1 },
        },
        { $count: 'count' },
      ]);
    } else {
      count = await TimeLine.aggregate()
        .match({
          user: mongoose.Types.ObjectId(currentUser._id),
          automation: mongoose.Types.ObjectId(automations[i]._id),
        })
        .group({ _id: '$deal' })
        .count('count');
    }

    automations[i] = { ...automations[i]._doc, ...count[0] };
  }

  const folderArr = await Folder.find({
    user: currentUser._id,
    type: 'automation',
  });
  const folders = (folderArr || []).map((e) => {
    return { ...e._doc, isFolder: true };
  });

  return res.json({
    status: true,
    data: [...automations, ...folders],
  });
};

const getEasyLoad = async (req, res) => {
  const { currentUser } = req;
  const automations = await Automation.find({
    $or: [
      {
        user: mongoose.Types.ObjectId(currentUser.id),
      },
      {
        role: 'admin',
      },
      {
        shared_members: currentUser.id,
      },
    ],
  });

  return res.send({
    status: true,
    data: automations,
  });
};

const getContactDetail = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.body;

  const _timelines = await TimeLine.find({
    user: currentUser.id,
    contact,
  });

  return res.send({
    status: true,
    data: _timelines,
  });
};

const searchDeal = async (req, res) => {
  const { currentUser } = req;
  const searchStr = req.body.search;
  const search = searchStr.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  const data = [];

  // get shared deals first

  const searched_deals = await Deal.find({
    title: { $regex: search, $options: 'i' },
    user: currentUser.id,
  });

  if (searched_deals.length > 0) {
    for (let i = 0; i < searched_deals.length; i++) {
      const deal = searched_deals[i];
      const searched_timeline = await TimeLine.findOne({
        deal: deal._id,
        automation: req.body.automation,
      }).catch((err) => {
        console.log('time line find err', err.message);
      });

      if (searched_timeline) {
        const contacts = await Contact.find({
          _id: { $in: deal.contacts },
        }).select({
          _id: 1,
          first_name: 1,
          last_name: 1,
          email: 1,
          cell_phone: 1,
        });
        data.push({
          deal,
          contacts,
        });
      }
    }
  }

  return res.send({
    status: true,
    data,
  });
};

const removeFolder = async (req, res) => {
  const { currentUser } = req;
  const { _id, mode, target } = req.body;

  const folder = await Folder.findOne({ _id, user: currentUser._id }).catch(
    (err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    }
  );

  if (!folder) {
    return res.status(400).send({
      status: false,
      error: 'Not found folder',
    });
  }

  if (mode === 'remove-all') {
    const oldFolderData = { ...folder._doc };
    Folder.deleteOne({ _id })
      .then(async () => {
        const { automations } = oldFolderData;
        bulkRemove({ currentUser, body: { data: automations } }, res);
        // Automation.deleteMany({
        //   user: currentUser._id,
        //   _id: { $in: automations },
        // });
        // return res.send({
        //   status: true,
        // });
      })
      .catch((err) => {
        return res.status(500).send({
          status: false,
          error: err.message,
        });
      });
  } else if (mode === 'move-other') {
    const oldFolderData = { ...folder._doc };
    Folder.deleteOne({ _id })
      .then(async () => {
        if (target) {
          await Folder.updateOne(
            { _id: target },
            {
              $addToSet: {
                automations: { $each: oldFolderData.automations },
              },
            }
          );
        }
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        return res.status(500).send({
          status: false,
          error: err.message,
        });
      });
  }

  if (mode === 'only-folder') {
    // Skip
    Folder.deleteOne({ _id })
      .then(() => {
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        return res.status(500).send({
          status: false,
          error: err.message,
        });
      });
  }
};

const removeFolders = async (req, res) => {
  const { currentUser } = req;
  const { _ids, mode, target } = req.body;
  const folders = await Folder.find({
    _id: { $in: _ids },
    user: currentUser._id,
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message,
    });
  });

  let allSelectedFolderData = [];
  for (let i = 0; i < folders.length; i++) {
    if (mode === 'remove-all') {
      const oldFolderData = { ...folders[i]._doc };
      const { automations } = oldFolderData;
      allSelectedFolderData = [...allSelectedFolderData, ...automations];
      Folder.deleteOne({ _id: folders[i]._id }).then(async () => {
        // await Automation.deleteMany({
        //   user: currentUser._id,
        //   _id: { $in: automations },
        // });
      });
    } else if (mode === 'move-other') {
      const oldFolderData = { ...folders[i]._doc };
      Folder.deleteOne({ _id: folders[i]._id }).then(async () => {
        if (target) {
          await Folder.updateOne(
            { _id: target },
            {
              $addToSet: {
                automations: { $each: oldFolderData.automations },
              },
            }
          );
        }
      });
    }

    if (mode === 'only-folder') {
      // Skip
      Folder.deleteOne({ _id: folders[i]._id });
    }
  }
  if (mode !== 'remove-all') {
    return res.send({
      status: true,
    });
  } else {
    bulkRemove({ currentUser, body: { data: allSelectedFolderData } }, res);
  }
};

const downloadFolder = async (req, res) => {
  const { currentUser } = req;
  const { folders } = req.body;

  const folderDocs = await Folder.find({
    _id: { $in: folders },
    user: { $ne: currentUser._id },
  }).catch((err) => {
    console.log('folder load', err);
  });

  const promises = [];
  (folderDocs || []).forEach((_folder) => {
    const createPromise = new Promise((resolve, reject) => {
      const newFolder = { ..._folder._doc };
      delete newFolder.role;
      delete newFolder._id;
      delete newFolder.automations;
      newFolder.user = currentUser._id;
      new Folder(newFolder)
        .save()
        .then(async (_newFolder) => {
          const automationDocs = await Automation.find({
            _id: { $in: _folder.automations },
            user: { $ne: currentUser._id },
          }).catch((err) => {
            console.log('automation load', err);
          });
          const automationPromises = [];
          (automationDocs || []).forEach((_automation) => {
            const automationPromise = new Promise((resolve, reject) => {
              const newAutomation = { ..._automation._doc };
              delete newAutomation.role;
              delete newAutomation._id;
              newAutomation.user = currentUser._id;
              new Automation(newAutomation)
                .save()
                .then((_newAutomation) => {
                  resolve(_newAutomation._id);
                })
                .catch(() => {
                  reject();
                });
            });
            automationPromises.push(automationPromise);
          });
          Promise.all(automationPromises).then((automations) => {
            _newFolder.automations = automations;
            _newFolder.save().catch(() => {
              console.log('automations register failed');
            });
            resolve();
          });
        })
        .catch(() => {
          reject();
        });
    });
    promises.push(createPromise);
  });

  Promise.all(promises).then(() => {
    return res.send({
      status: true,
    });
  });
};

const moveFile = async (req, res) => {
  const { currentUser } = req;
  const { files, target, source } = req.body;
  if (source) {
    await Folder.updateOne(
      { _id: source, user: currentUser._id },
      {
        $pull: {
          automations: { $in: files },
        },
      }
    );
  }
  if (target) {
    await Folder.updateOne(
      { _id: target, user: currentUser._id },
      {
        $addToSet: {
          automations: { $each: files },
        },
      }
    );
  }
  return res.send({
    status: true,
  });
};

module.exports = {
  get,
  getAll,
  load,
  loadLibrary,
  getStatus,
  getAssignedContacts,
  getPage,
  getEasyLoad,
  create,
  update,
  remove,
  download,
  getTitles,
  updateDefault,
  search,
  searchContact,
  loadOwn,
  getContactDetail,
  searchDeal,
  removeFolder,
  removeFolders,
  moveFile,
  downloadFolder,
  bulkRemove,
};
