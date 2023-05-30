const DealStage = require('../models/deal_stage');
const Deal = require('../models/deal');
const TimeLine = require('../models/time_line');
const Pipeline = require('../models/pipe_line');
const { DEFAULT_STAGES } = require('../config/system_settings');
const {
  runTimeline,
  activeNext,
  assignTimeline,
} = require('../helpers/automation');

const init = async (req, res) => {
  const { currentUser } = req;
  const promise_array = [];
  for (let i = 0; i < DEFAULT_STAGES.length; i++) {
    const promise = new Promise((resolve) => {
      const deal_stage = new DealStage({
        user: currentUser.id,
        title: DEFAULT_STAGES[i],
        priority: i,
      });
      deal_stage
        .save()
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          console.log('deal stage err', err.message);
        });
    });
    promise_array.push(promise);
  }
  Promise.all(promise_array)
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(500).json({
        status: false,
        error: err || 'Deal intialize error',
      });
    });
};

const getAll = async (req, res) => {
  const { currentUser } = req;

  const data = await DealStage.find({ user: currentUser.id })
    .populate({
      path: 'deals',
      populate: { path: 'contacts', select: 'first_name last_name email' },
    })
    .sort({ priority: 1 });

  if (!data || !data.length) {
    const promise_array = [];
    for (let i = 0; i < DEFAULT_STAGES.length; i++) {
      const promise = new Promise((resolve) => {
        const deal_stage = new DealStage({
          user: currentUser.id,
          title: DEFAULT_STAGES[i],
          priority: i,
        });
        deal_stage
          .save()
          .then((deal) => {
            resolve(deal);
          })
          .catch((err) => {
            console.log('deal stage err', err.message);
          });
      });
      promise_array.push(promise);
    }
    Promise.all(promise_array)
      .then((deals) => {
        return res.send({
          status: true,
          data: deals,
        });
      })
      .catch((err) => {
        return res.status(500).json({
          status: false,
          error: err || 'Deal intialize error',
        });
      });
  } else {
    return res.send({
      status: true,
      data,
    });
  }
};

const getStages = async (req, res) => {
  const { currentUser } = req;

  const data = await DealStage.find({ user: currentUser.id }).sort({
    priority: 1,
  });

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const deal_stage = new DealStage({
    ...req.body,
    user: currentUser.id,
  });
  deal_stage
    .save()
    .then((_deal_stage) => {
      return res.send({
        status: true,
        data: _deal_stage,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  const { remove_stage, move_stage } = req.body;
  const deal_stage = await DealStage.findOne({
    _id: remove_stage,
    user: currentUser.id,
  }).catch((err) => {
    console.log('deal stage err', err.message);
  });

  if (!deal_stage) {
    return res.status(400).json({
      status: false,
      error: 'Permission invalid',
    });
  }

  if (move_stage) {
    Deal.updateMany(
      {
        _id: { $in: deal_stage.deals },
      },
      {
        $set: {
          deal_stage: move_stage,
        },
      }
    ).catch((err) => {
      console.log('move deals into other stage', err.message);
    });
  }

  const deals = await Deal.find({ _id: { $in: deal_stage.deals } });
  const dealIds = [];
  deals.forEach((e) => {
    dealIds.push(e._id);
  });

  if (move_stage) {
    await DealStage.updateOne(
      { _id: move_stage },
      { $addToSet: { deals: { $each: dealIds } } }
    );
  }

  DealStage.deleteOne({
    _id: remove_stage,
  })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('deal stage remove err', err.message);
    });
};

const edit = async (req, res) => {
  const { currentUser } = req;

  DealStage.updateOne(
    {
      _id: req.params.id,
      user: currentUser.id,
    },
    {
      $set: { ...req.body },
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('deal stage update err', err.message);
      return res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};
const changeOrder = async (req, res) => {
  const orderInfo = req.body;
  for (const prop in orderInfo) {
    console.log(prop, orderInfo[prop]);
    await DealStage.updateOne(
      { _id: prop },
      { $set: { priority: orderInfo[prop] } }
    );
  }
  return res.send({
    status: true,
  });
};

const getEasyLoad = async (req, res) => {
  const { currentUser } = req;
  const pipeline = req.body;
  const query = { user: currentUser.id };
  const pipelines = await Pipeline.find({ user: currentUser._id }).catch(() => {
    console.log('user pipelines loading failed');
  });
  const pipelineIds = pipelines.map((e) => e._id + '');
  if (pipeline && pipeline._id) {
    if (pipelineIds.indexOf(pipeline._id) !== -1) {
      query.pipe_line = pipeline._id;
    } else if (pipelineIds[0]) {
      query.pipe_line = pipelineIds[0];
    }
  }
  let deal_stage = await DealStage.find(query).sort({
    priority: 1,
  });
  if (!deal_stage.length) {
    deal_stage = await DealStage.find({ user: currentUser.id }).sort({
      priority: 1,
    });
  }

  return res.send({
    status: true,
    data: deal_stage,
  });
};

const getStageWithContact = async (req, res) => {
  const { currentUser } = req;

  const stageContacts = await DealStage.aggregate([
    {
      $match: { user: currentUser._id },
    },
    {
      $lookup: {
        from: 'deals',
        localField: 'deals',
        foreignField: '_id',
        as: 'deal_details',
      },
    },
    {
      $group: {
        _id: '$_id',
        contacts: {
          $addToSet: '$deal_details.contacts',
        },
        title: {
          $first: '$title',
        },
        priority: {
          $first: '$priority',
        },
      },
    },
    { $unwind: '$contacts' },
    {
      $addFields: {
        contactIds: {
          $reduce: {
            input: '$contacts',
            initialValue: [],
            in: { $setUnion: ['$$value', '$$this'] },
          },
        },
      },
    },
    {
      $sort: { priority: 1 },
    },
  ]);

  return res.send({
    status: true,
    data: stageContacts || [],
  });
};

const load = async (req, res) => {
  const { currentUser } = req;
  const { _id } = req.body;

  let query = { user: currentUser.id };
  if (_id) {
    query = { ...query, pipe_line: _id };
  } else {
    const activePipeline = await Pipeline.findOne({
      user: currentUser._id,
      is_active: true,
    });
    if (activePipeline) query = { ...query, pipe_line: activePipeline._id };
  }

  const data = await DealStage.find({
    ...query,
  })
    .populate({
      path: 'deals',
      populate: { path: 'contacts', select: 'first_name last_name email' },
    })
    .populate({ path: 'automation', select: 'title' })
    .sort({ priority: 1 });

  for (let i = 0; i < data.length; i++) {
    const deals = data[i].deals;
    for (let j = 0; j < deals.length; j++) {
      const deal = deals[j];
      const dealId = deal._id;

      const _timeline = await TimeLine.findOne({
        user: currentUser.id,
        deal: dealId,
      }).catch((err) => {
        console.log('err', err);
      });

      if (_timeline) {
        data[i].deals[j] = {
          ...data[i].deals[j]._doc,
          running_automation: true,
        };
      }
    }
  }

  return res.send({
    status: true,
    data,
  });
};

module.exports = {
  init,
  getAll,
  getEasyLoad,
  load,
  create,
  remove,
  edit,
  changeOrder,
  getStages,
  getStageWithContact,
};
