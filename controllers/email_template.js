const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const EmailTemplate = require('../models/email_template');
const Garbage = require('../models/garbage');
const Team = require('../models/team');
const Folder = require('../models/folder');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const garbageHelper = require('../helpers/garbage');
const _ = require('lodash');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const api = require('../config/api');
const { createCanvas, loadImage } = require('canvas');
const uuidv1 = require('uuid/v1');
const { uploadBase64Image } = require('../helpers/fileUpload');
const {
  THUMBNAILS_PATH,
  TEMP_PATH,
  GIF_PATH,
  VIDEO_PATH,
  PLAY_BUTTON_PATH,
} = require('../config/path');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const get = async (req, res) => {
  const { id } = req.params;

  const data = await EmailTemplate.findOne({ _id: id })
    .populate({
      path: 'video_ids',
      select: { _id: true, preview: true, title: true },
    })
    .populate({
      path: 'pdf_ids',
      select: { _id: true, preview: true, title: true },
    })
    .populate({
      path: 'image_ids',
      select: { _id: true, preview: true, title: true },
    });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Template doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const getTemplates = async (req, res) => {
  const { currentUser } = req;
  const { page } = req.params;
  const team_templates = [];
  const teams = await Team.find({ members: currentUser.id });

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      if (team.email_templates) {
        Array.prototype.push.apply(team_templates, team.email_templates);
      }
    }
  }

  const templates = await EmailTemplate.find({
    $or: [
      { user: currentUser.id },
      { role: 'admin' },
      { _id: { $in: team_templates } },
    ],
  })
    .skip((page - 1) * 10)
    .limit(10);

  const total = await EmailTemplate.countDocuments({
    $or: [{ user: currentUser.id }, { role: 'admin' }],
  });
  return res.json({
    status: true,
    data: templates,
    total,
  });
};

const getAll = async (req, res) => {
  const { currentUser } = req;

  const company = currentUser.company || 'eXp Realty';

  const email_templates = await EmailTemplate.find({
    user: currentUser.id,
  });

  const _template_admin = await EmailTemplate.find({
    role: 'admin',
    company,
  });

  Array.prototype.push.apply(email_templates, _template_admin);

  const teams = await Team.find({
    $or: [{ members: currentUser.id }, { owner: currentUser.id }],
  }).populate('email_templates');

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(email_templates, team.email_templates);
    }
  }

  if (!email_templates) {
    return res.status(400).json({
      status: false,
      error: 'Templates doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data: email_templates,
  });
};

const loadLibrary = async (req, res) => {
  const { currentUser } = req;

  const company = currentUser.company || 'eXp Realty';
  const template_list = [];

  const _template_admin = await EmailTemplate.find({
    role: 'admin',
    company,
  });

  Array.prototype.push.apply(template_list, _template_admin);

  const folder_list = [];
  const _admin_folders = await Folder.find({
    type: 'template',
    role: 'admin',
    company,
  });
  Array.prototype.push.apply(folder_list, _admin_folders);

  const teams = await Team.find({
    $or: [{ members: currentUser.id }, { owner: currentUser.id }],
  })
    .populate('email_templates')
    .populate('folders');

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(template_list, team.email_templates);
      if (team.folders && team.folders.length) {
        team.folders.forEach((folder) => {
          if (folder.type === 'template') {
            folder_list.push(folder);
          }
        });
      }
    }
  }
  let folder_template_ids = [];
  const folders = [];
  folder_list.forEach((folder) => {
    folder_template_ids = [...folder_template_ids, ...folder.templates];
    const folderDoc = { ...folder._doc, isFolder: true };
    folders.push(folderDoc);
  });
  const folder_templates = await EmailTemplate.find({
    _id: { $in: folder_template_ids },
  }).catch((err) => {
    console.log('folder templates', err);
  });

  return res.send({
    status: true,
    data: [...template_list, ...folder_templates, ...folders],
  });
};
const createVideo = async (currentUser, videoP) => {
  let count = 0;
  let max_upload_count = 0;
  if (!currentUser.material_info['is_enabled']) {
    return;
  }
  if (currentUser.material_info['is_limit']) {
    const userVideoCount = await Video.countDocuments({
      user: currentUser.id,
      uploaded: false,
      del: false,
    });
    const userPDFCount = await PDF.countDocuments({
      user: currentUser.id,
      del: false,
    });
    const userImageCount = await Image.countDocuments({
      user: currentUser.id,
      del: false,
    });
    count = userVideoCount + userPDFCount + userImageCount;
    max_upload_count =
      currentUser.material_info.upload_max_count ||
      system_settings.MATERIAL_UPLOAD_LIMIT.PRO;
  }
  if (currentUser.material_info['is_limit'] && max_upload_count <= count) {
    console.log('limited', max_upload_count, count);
    return;
  }
  const video = new Video({
    ...videoP,
    converted: 'completed',
    user: currentUser.id,
    created_at: new Date(),
  });
  const _video = await video.save().catch((err) => {
    console.log('err', err);
  });
  const response = { ..._video._doc };
  return response;
};

const createPDF = async (currentUser, pdfP) => {
  let count = 0;
  let max_upload_count = 0;
  if (!currentUser.material_info['is_enabled']) {
    return;
  }
  if (currentUser.material_info['is_limit']) {
    const userVideoCount = await Video.countDocuments({
      user: currentUser.id,
      uploaded: false,
      del: false,
    });
    const userPDFCount = await PDF.countDocuments({
      user: currentUser.id,
      del: false,
    });
    const userImageCount = await Image.countDocuments({
      user: currentUser.id,
      del: false,
    });
    count = userVideoCount + userPDFCount + userImageCount;
    max_upload_count =
      currentUser.material_info.upload_max_count ||
      system_settings.MATERIAL_UPLOAD_LIMIT.PRO;
  }
  if (currentUser.material_info['is_limit'] && max_upload_count <= count) {
    return;
  }
  const pdf = new PDF({
    ...pdfP,
    user: currentUser.id,
  });
  const _pdf = await pdf.save().catch((err) => {
    console.log('err', err);
  });
  const response = { ..._pdf._doc };
  return response;
};

const createImage = async (currentUser, imageP) => {
  let count = 0;
  let max_upload_count = 0;
  if (!currentUser.material_info['is_enabled']) {
    return;
  }
  if (currentUser.material_info['is_limit']) {
    const userVideoCount = await Video.countDocuments({
      user: currentUser.id,
      uploaded: false,
      del: false,
    });
    const userPDFCount = await PDF.countDocuments({
      user: currentUser.id,
      del: false,
    });
    const userImageCount = await Image.countDocuments({
      user: currentUser.id,
      del: false,
    });
    count = userVideoCount + userPDFCount + userImageCount;
    max_upload_count =
      currentUser.material_info.upload_max_count ||
      system_settings.MATERIAL_UPLOAD_LIMIT.PRO;
  }
  if (currentUser.material_info['is_limit'] && max_upload_count <= count) {
    return;
  }
  const image = new Image({
    ...imageP,
    user: currentUser.id,
  });
  const _image = await image.save().catch((err) => {
    console.log('err', err);
  });
  const response = { ..._image._doc };
  return response;
};

const createTemplate = async (req, res) => {
  const { currentUser } = req;

  const old_video_ids = req.body.video_ids;
  const old_pdf_ids = req.body.pdf_ids;
  const old_image_ids = req.body.image_ids;
  const new_video_ids = [];
  const new_pdf_ids = [];
  const new_image_ids = [];
  let new_content = req.body.content;
  if (old_video_ids) {
    for (let i = 0; i < old_video_ids.length; i++) {
      let video = await Video.findOne({
        original_id: old_video_ids[i],
        user: currentUser.id,
        del: false,
      }).catch((err) => {
        console.log('err', err.message);
      });
      if (!video) {
        let tmpVideo = await Video.findOne({
          _id: old_video_ids[i],
        }).catch((err) => {
          console.log('err', err.message);
        });
        tmpVideo.original_id = tmpVideo._id;
        tmpVideo = _.omit(tmpVideo._doc, [
          '_id',
          'company',
          'is_draft',
          'role',
        ]);
        video = await createVideo(currentUser, tmpVideo);
      }
      if (video) {
        new_video_ids.push(video._id);
        new_content = new_content.replace(old_video_ids[i], video._id);
      }
    }
  }
  if (old_pdf_ids) {
    for (let i = 0; i < old_pdf_ids.length; i++) {
      let pdf = await PDF.findOne({
        original_id: old_pdf_ids[i],
        user: currentUser.id,
        del: false,
      }).catch((err) => {
        console.log('err', err.message);
      });
      if (!pdf) {
        let tmpPdf = await PDF.findOne({
          _id: old_pdf_ids[i],
        }).catch((err) => {
          console.log('err', err.message);
        });
        tmpPdf.original_id = tmpPdf._id;
        tmpPdf = _.omit(tmpPdf._doc, ['_id', 'company', 'is_draft', 'role']);
        pdf = await createPDF(currentUser, tmpPdf);
      }
      if (pdf) {
        new_pdf_ids.push(pdf._id);
        new_content = new_content.replace(old_pdf_ids[i], pdf._id);
      }
    }
  }
  if (old_image_ids) {
    for (let i = 0; i < old_image_ids.length; i++) {
      let image = await Image.findOne({
        original_id: old_image_ids[i],
        user: currentUser.id,
        del: false,
      }).catch((err) => {
        console.log('err', err.message);
      });
      if (!image) {
        let tmpImage = await Image.findOne({
          _id: old_image_ids[i],
        }).catch((err) => {
          console.log('err', err.message);
        });
        tmpImage.original_id = tmpImage._id;
        tmpImage = _.omit(tmpImage._doc, [
          '_id',
          'company',
          'is_draft',
          'role',
        ]);
        image = await createImage(currentUser, tmpImage);
      }
      if (image) {
        new_image_ids.push(image._id);
        new_content = new_content.replace(old_image_ids[i], image._id);
      }
    }
  }

  const template = new EmailTemplate({
    ...req.body,
    user: currentUser.id,
    video_ids: new_video_ids,
    pdf_ids: new_pdf_ids,
    image_ids: new_image_ids,
    content: new_content,
    updated_at: new Date(),
    created_at: new Date(),
  });

  template
    .save()
    .then(async (_t) => {
      if (req.body.folder) {
        await Folder.updateOne(
          { _id: req.body['folder'], user: currentUser._id, type: 'template' },
          { $addToSet: { templates: { $each: [_t._id] } } }
        ).catch((err) => {
          console.log('folder update is failed');
        });
      }

      return res.send({
        status: true,
        data: _t,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        error: err.message || JSON.stringify(err),
      });
    });
};

const create = async (req, res) => {
  const { currentUser } = req;
  // const errors = validationResult(req)
  // if (!errors.isEmpty()) {
  //   return res.status(400).json({
  //     status: false,
  //     error: errors.array()
  //   })
  // }

  const template = new EmailTemplate({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  template
    .save()
    .then(async (_t) => {
      if (req.body.folder) {
        await Folder.updateOne(
          { _id: req.body['folder'], user: currentUser._id, type: 'template' },
          { $addToSet: { templates: { $each: [_t._id] } } }
        ).catch((err) => {
          console.log('folder update is failed');
        });
      }

      return res.send({
        status: true,
        data: _t,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        error: err.message || JSON.stringify(err),
      });
    });
};

const update = async (req, res) => {
  const { currentUser } = req;
  const { id } = req.params;
  EmailTemplate.find({ _id: id, user: currentUser.id })
    .updateOne({ $set: { ...req.body } })
    .then(() => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Update Error',
      });
    });
};

const remove = async (req, res) => {
  const { id } = req.params;
  const { currentUser } = req;
  const email_template = await EmailTemplate.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!email_template) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission.',
    });
  }
  if (email_template.role === 'team') {
    Team.updateOne(
      { email_templates: req.params.id },
      {
        $pull: { email_templates: { $in: [req.params.id] } },
      }
    ).catch((err) => {
      console.log('template update err', err.message);
    });
  }
  const garbage = await Garbage.findOne({ user: currentUser.id });
  if (garbage) {
    if (garbage.canned_message) {
      const canned_message = garbage.canned_message;
      if (
        canned_message.sms &&
        canned_message.sms.toString() === req.params.id
      ) {
        await Garbage.updateOne(
          {
            user: currentUser.id,
          },
          {
            $unset: { 'canned_message.sms': 1 },
          }
        ).catch((err) => {
          console.log('default text template remove err', err.message);
        });
      }
      if (
        canned_message.email &&
        canned_message.email.toString() === req.params.id
      ) {
        await Garbage.updateOne(
          {
            user: currentUser.id,
          },
          {
            $unset: { 'canned_message.email': 1 },
          }
        ).catch((err) => {
          console.log('default email template remove err', err.message);
        });
      }
    }
  }
  EmailTemplate.deleteOne({ _id: id, user: currentUser.id })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Remove Template Error',
      });
    });
};

const bulkRemove = async (req, res) => {
  const { ids } = req.body;
  const { currentUser } = req;
  const garbage = await Garbage.findOne({ user: currentUser.id });
  for (let i = 0; i < ids.length; i++) {
    const email_template = await EmailTemplate.findOne({
      _id: ids[i],
      user: currentUser.id,
    });

    if (email_template.role === 'team') {
      Team.updateOne(
        { email_templates: ids[i] },
        {
          $pull: { email_templates: { $in: [ids[i]] } },
        }
      ).catch((err) => {
        console.log('email template remove err', err.message);
      });
    }

    if (garbage) {
      if (garbage.canned_message) {
        if (
          garbage.canned_message.email &&
          garbage.canned_message.email.toString() === ids[i]
        ) {
          await Garbage.updateOne(
            {
              user: currentUser.id,
            },
            {
              $unset: { 'canned_message.email': 1 },
            }
          ).catch((err) => {
            console.log('default email template remove err', err.message);
          });
        } else if (
          garbage.canned_message.sms &&
          garbage.canned_message.sms.toString() === ids[i]
        ) {
          await Garbage.updateOne(
            {
              user: currentUser.id,
            },
            {
              $unset: { 'canned_message.sms': 1 },
            }
          ).catch((err) => {
            console.log('default text template remove err', err.message);
          });
        }
      }
    }
  }

  EmailTemplate.deleteMany({ _id: { $in: ids }, user: currentUser.id })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Remove Templates Error',
      });
    });
};

const search = async (req, res) => {
  const { currentUser } = req;
  const str = req.query.q;
  const option = { ...req.body };

  const team_templates = [];
  const teams = await Team.find({
    $or: [{ members: currentUser.id }, { owner: currentUser.id }],
  });

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      if (team.email_templates) {
        Array.prototype.push.apply(team_templates, team.email_templates);
      }
    }
  }

  const templates = await EmailTemplate.find({
    $and: [
      option,
      {
        $or: [
          { title: { $regex: `.*${str}.*`, $options: 'i' } },
          { subject: { $regex: `.*${str}.*`, $options: 'i' } },
          { content: { $regex: `.*${str}.*`, $options: 'i' } },
        ],
      },
      {
        $or: [
          { user: currentUser.id },
          { role: 'admin' },
          { _id: { $in: team_templates } },
        ],
      },
    ],
  });

  return res.send({
    status: true,
    data: templates,
  });
};
const ownSearch = async (req, res) => {
  const { currentUser } = req;
  const str = req.query.q;
  const option = { ...req.body };

  const templates = await EmailTemplate.find({
    $and: [
      option,
      {
        $or: [
          { title: { $regex: `.*${str}.*`, $options: 'i' } },
          { subject: { $regex: `.*${str}.*`, $options: 'i' } },
          { content: { $regex: `.*${str}.*`, $options: 'i' } },
        ],
      },
      {
        $or: [{ user: currentUser.id }, { role: 'admin' }],
      },
    ],
  });

  return res.send({
    status: true,
    data: templates,
  });
};

const loadOwn = async (req, res) => {
  const { currentUser } = req;

  const templates = await EmailTemplate.find({
    user: currentUser.id,
  });

  const folderArr = await Folder.find({
    user: currentUser._id,
    type: 'template',
  });
  const folders = (folderArr || []).map((e) => {
    return { ...e._doc, isFolder: true };
  });

  return res.json({
    status: true,
    data: [...templates, ...folders],
  });
};

const getEasyLoad = async (req, res) => {
  const { currentUser } = req;
  const email_templates = await EmailTemplate.find({
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
    data: email_templates,
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
        const { templates } = oldFolderData;
        EmailTemplate.deleteMany({
          user: currentUser._id,
          _id: { $in: templates },
        });
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
  } else if (mode === 'move-other') {
    const oldFolderData = { ...folder._doc };
    Folder.deleteOne({ _id })
      .then(async () => {
        if (target) {
          await Folder.updateOne(
            { _id: target },
            {
              $addToSet: {
                templates: { $each: oldFolderData.templates },
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
  for (let i = 0; i < folders.length; i++) {
    if (mode === 'remove-all') {
      const oldFolderData = { ...folders[i]._doc };
      Folder.deleteOne({ _id: folders[i]._id }).then(async () => {
        const { templates } = oldFolderData;
        EmailTemplate.deleteMany({
          user: currentUser._id,
          _id: { $in: templates },
        });
      });
    } else if (mode === 'move-other') {
      const oldFolderData = { ...folders[i]._doc };
      Folder.deleteOne({ _id: folders[i]._id }).then(async () => {
        if (target) {
          await Folder.updateOne(
            { _id: target },
            {
              $addToSet: {
                templates: { $each: oldFolderData.templates },
              },
            }
          );
        }
      });
    }
    if (mode === 'only-folder') {
      Folder.deleteOne({ _id: folders[i]._id });
    }
  }
  return res.send({
    status: true,
  });
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
      delete newFolder.templates;
      newFolder.user = currentUser._id;
      new Folder(newFolder)
        .save()
        .then(async (_newFolder) => {
          const templateDocs = await EmailTemplate.find({
            _id: { $in: _folder.templates },
            user: { $ne: currentUser._id },
          }).catch((err) => {
            console.log('template load', err);
          });
          const templatePromises = [];
          (templateDocs || []).forEach((_template) => {
            const templatePromise = new Promise((resolve, reject) => {
              const newTemplate = { ..._template._doc };
              delete newTemplate.role;
              delete newTemplate._id;
              newTemplate.user = currentUser._id;
              new EmailTemplate(newTemplate)
                .save()
                .then((_newTemplate) => {
                  resolve(_newTemplate._id);
                })
                .catch(() => {
                  reject();
                });
            });
            templatePromises.push(templatePromise);
          });
          Promise.all(templatePromises).then((templates) => {
            _newFolder.templates = templates;
            _newFolder.save().catch(() => {
              console.log('templates register failed');
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
          templates: { $in: files },
        },
      }
    );
  }
  if (target) {
    await Folder.updateOne(
      { _id: target, user: currentUser._id },
      {
        $addToSet: {
          templates: { $each: files },
        },
      }
    );
  }
  return res.send({
    status: true,
  });
};

module.exports = {
  create,
  createTemplate,
  get,
  getAll,
  getEasyLoad,
  loadLibrary,
  update,
  remove,
  getTemplates,
  bulkRemove,
  search,
  loadOwn,
  ownSearch,
  removeFolder,
  removeFolders,
  moveFile,
  downloadFolder,
};
