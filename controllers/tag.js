const mongoose = require('mongoose');
const Tag = require('../models/tag');
const Contact = require('../models/contact');
const TimeLine = require('../models/time_line');
const Garbage = require('../models/garbage');
const Automation = require('../models/automation');

const get = async (req, res) => {
  const { currentUser } = req;
  const data = await Tag.findOne({ user: currentUser.id });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Tag doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create1 = async (req, res) => {
  const { currentUser } = req;
  const { tag, selection } = req.body;
  const reqIds = [];
  selection.forEach((id) => {
    reqIds.push(mongoose.Types.ObjectId(id));
  });
  await Contact.updateMany(
    {
      user: mongoose.Types.ObjectId(currentUser.id),
      _id: { $in: reqIds },
    },
    { $addToSet: { tags: tag } },
    {
      multi: true,
    }
  );
  return res.send({
    status: true,
    data: tag,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  const { tag } = req.body;

  try {
    const data = await Contact.aggregate([
      {
        $match: { user: mongoose.Types.ObjectId(currentUser.id) },
      },
      {
        $unwind: {
          path: '$tags',
        },
      },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);
    console.log('###', data);
    if (data.length) {
      const index = data.findIndex((e) => e._id === tag);
      if (index !== -1) {
        return res.status(400).json({
          status: false,
          error: 'This tag already exist',
        });
      }
    }
    let tags = await Tag.findOne({
      user: currentUser.id,
    });

    if (!tags) {
      tags = new Tag({
        user: currentUser.id,
        tags: [],
      });
    } else {
      if (tags.tags.includes(tag)) {
        return res.status(400).json({
          status: false,
          error: 'This tag already exist',
        });
      }
    }
    tags.tags.push(tag);
    await tags.save();

    return res.send({
      status: true,
    });
  } catch (err) {
    return res.status(500).send({
      status: false,
      error: err.message || 'Tag creating failed.',
    });
  }
};

const search = async (req, res) => {
  const { currentUser } = req;
  const { search } = req.body;
  const limit = search ? 10 : 10000;
  // data = await Tag.find({content: {'$regex': search+'.*', '$options': 'i'}, user: currentUser.id}).sort({content: 1})
  const data = await Tag.aggregate([
    {
      $match: {
        content: { $regex: `${search}.*`, $options: 'i' },
        user: mongoose.Types.ObjectId(currentUser.id),
      },
    },
    { $group: { _id: '$content', id: { $first: '$_id' } } },
    { $sort: { _id: 1 } },
    { $project: { content: '$_id', _id: '$id' } },
    { $limit: limit },
  ]).catch((err) => {
    console.log('err', err);
  });

  return res.send({
    status: true,
    data,
  });
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const _tags = await Tag.findOne({
    user: currentUser.id,
  });
  const data = await Contact.aggregate([
    {
      $match: { user: mongoose.Types.ObjectId(currentUser.id) },
    },
    {
      $unwind: {
        path: '$tags',
      },
    },
    {
      $group: {
        _id: '$tags',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
  if (_tags && _tags.tags.length) {
    _tags.tags.forEach((tag) => {
      const index = data.findIndex((e) => e._id === tag);
      if (index === -1) {
        const _tag = {
          _id: tag,
          count: 0,
        };
        data.push(_tag);
      }
    });
  }
  res.send({
    status: true,
    data,
  });
};

const getTagsDetail = async (req, res) => {
  const { currentUser } = req;
  const { tag, page, pageSize, searchStr } = req.body;
  const search = searchStr.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  const garbage = await Garbage.findOne({
    user: mongoose.Types.ObjectId(currentUser.id),
  });

  let _automation;
  if (garbage.tag_automation && garbage.tag_automation[tag]) {
    _automation = await Automation.findOne({
      _id: garbage.tag_automation[tag],
    });
  }

  const data = await Contact.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(currentUser.id),
        tags: { $in: [tag] },
        $or: [
          {
            first_name: {
              $regex: search,
              $options: 'i',
            },
          },
          {
            last_name: {
              $regex: search,
              $options: 'i',
            },
          },
        ],
      },
    },
    {
      $sort: { first_name: 1 },
    },
    {
      $skip: (page - 1) * pageSize,
    },
    {
      $limit: pageSize,
    },
    {
      $project: { first_name: 1, last_name: 1, _id: 1 },
    },
  ]);

  const total = await Contact.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(currentUser.id),
        tags: { $in: [tag] },
        $or: [
          {
            first_name: {
              $regex: search,
              $options: 'i',
            },
          },
          {
            last_name: {
              $regex: search,
              $options: 'i',
            },
          },
        ],
      },
    },
  ]);

  /**
  for (let i = 0; i < data.length; i++) {
    const contact = data[i];
    const searched_timeline = await TimeLine.findOne({
      contact,
      automation: _automation,
    }).catch((err) => {
      console.log('time line find err', err.message);
    });

    if (searched_timeline) {
      data[i]['tag_automation'] = 'running';
    } else {
      data[i]['tag_automation'] = '';
    }
  }
   */

  res.send({
    status: true,
    data,
    total: total.length,
  });
};

const getTagsDetail1 = async (req, res) => {
  const { currentUser } = req;
  const contacts = await Contact.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(currentUser.id),
      },
    },
    {
      $sort: { first_name: 1 },
    },
    {
      $project: { first_name: 1, last_name: 1, _id: 1 },
    },
  ]);
  const total = await Contact.countDocuments({
    $or: [{ user: currentUser.id }],
  });

  res.send({
    status: true,
    data: {
      contacts,
      totalCount: total,
    },
  });
};

const updateTag = async (req, res) => {
  const { currentUser } = req;

  const { oldTag, newTag } = req.body;
  await Contact.update(
    { user: mongoose.Types.ObjectId(currentUser.id) },
    { $set: { 'tags.$[element]': newTag } },
    {
      multi: true,
      arrayFilters: [{ element: oldTag }],
    }
  );
  await Tag.updateOne(
    {
      user: currentUser.id,
    },
    { $set: { 'tags.$[element]': newTag } },
    {
      arrayFilters: [{ element: oldTag }],
    }
  );

  res.send({
    status: true,
  });
};

const deleteTag = async (req, res) => {
  const { currentUser } = req;

  const { tag, contact } = req.body;
  const query = { user: mongoose.Types.ObjectId(currentUser.id) };
  if (contact) {
    query['_id'] = contact;
  }
  await Contact.updateMany(query, { $pull: { tags: tag } }, { multi: true });
  await Tag.updateOne(
    {
      user: currentUser.id,
    },
    { $pull: { tags: tag } }
  );
  res.send({
    status: true,
  });
};

module.exports = {
  get,
  create,
  search,
  getAll,
  getTagsDetail,
  getTagsDetail1,
  updateTag,
  deleteTag,
};
