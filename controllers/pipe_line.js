const PipeLine = require('../models/pipe_line');
const DealStage = require('../models/deal_stage');
const Deal = require('../models/deal');

const get = async (req, res) => {
  const { currentUser } = req;

  const data = await PipeLine.find({ user: currentUser.id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Pipeline doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  const pipe_info = currentUser.pipe_info;

  if (pipe_info && pipe_info['is_limit']) {
    const pipe_count = await PipeLine.countDocuments({ user: currentUser.id });
    if (pipe_count >= pipe_info.max_count) {
      console.log('no error');
      return res.status(412).send({
        status: false,
        error: 'You reach out max pipeline count',
      });
    }
  }

  const pipe_line = new PipeLine({
    ...req.body,
    user: currentUser.id,
  });

  await PipeLine.updateOne(
    { user: currentUser._id, is_active: true },
    { $set: { is_active: false } }
  );

  pipe_line.save().catch((err) => {
    return res.status(400).send({
      status: false,
      error: err.message,
    });
  });

  return res.send({
    status: true,
    pipeline: pipe_line,
  });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;

  await PipeLine.deleteOne({ user: currentUser._id, _id: id });
  await DealStage.deleteMany({
    pipe_line: id,
    user: currentUser.id,
  });

  return res.send({
    status: true,
  });
};

const update = async (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;
  const data = req.body;
  const { is_active } = req.body;
  if (is_active) {
    await PipeLine.updateOne(
      { user: currentUser._id, is_active: true },
      { $set: { is_active: false } }
    );
  }

  await PipeLine.updateOne({ user: currentUser._id, _id: id }, { $set: data });

  return res.send({
    status: true,
  });
};

const deletePipeline = async (req, res) => {
  const { currentUser } = req;
  const { option, target, current } = req.body;

  if (option === 2) {
    PipeLine.deleteOne({ user: currentUser._id, _id: current }).then(() => {
      return res.send({
        status: true,
      });
    });
  } else if (option === 0) {
    DealStage.find({ user: currentUser._id, pipe_line: current }).then(
      (stages) => {
        let dealIds = [];
        const dealStageIds = [];
        stages.forEach((e) => {
          dealIds = [...dealIds, ...e.deals];
          dealStageIds.push(e._id);
        });
        Deal.deleteMany({
          $or: [
            { _id: { $in: dealIds } },
            { deal_stage: { $in: dealStageIds } },
          ],
        }).catch(() => {
          console.log('Deal deleting failed');
        });
        DealStage.deleteMany({ _id: { $in: dealStageIds } }).catch(() => {
          console.log('Stages deleting failed');
        });
        PipeLine.deleteOne({ _id: current }).catch(() => {
          console.log('pipeline deleting failed');
        });
        return res.send({
          status: true,
        });
        // TODO: delete related activities
      }
    );
  } else if (option === 1) {
    DealStage.find({ user: currentUser._id, pipe_line: current }).then(
      (stages) => {
        let dealIds = [];
        const dealStageIds = [];
        stages.forEach((e) => {
          dealIds = [...dealIds, ...e.deals];
          dealStageIds.push(e._id);
        });
        Deal.find({
          $or: [
            { _id: { $in: dealIds } },
            { deal_stage: { $in: dealStageIds } },
          ],
        }).then((_deals) => {
          const _dealIds = _deals.map((e) => e._id);
          Deal.updateMany(
            {
              _id: { $in: _dealIds },
            },
            {
              $set: { deal_stage: target },
            }
          ).then(() => {
            DealStage.deleteMany({ _id: { $in: dealStageIds } }).catch(() => {
              console.log('deal stage deleting failed');
            });
            DealStage.updateOne(
              { _id: target },
              { $addToSet: { deals: { $each: _dealIds } } }
            )
              .then(() => {
                PipeLine.deleteOne({ _id: current }).catch(() => {
                  console.log('pipeline deleting failed');
                });
                return res.send({
                  status: true,
                });
              })
              .catch(() => {
                console.log('deals moving is failed');
                return res.send({
                  status: true,
                });
              });
          });
        });
      }
    );
  }
};

module.exports = {
  get,
  create,
  remove,
  update,
  deletePipeline,
};
