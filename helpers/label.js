const Garbage = require('../models/garbage');
const Label = require('../models/label');

const getAll = async (user) => {
  const garbage = await Garbage.findOne({ user });

  let editedLabels = [];
  if (garbage && garbage['edited_label']) {
    editedLabels = garbage['edited_label'];
  }

  const _label_list = await Label.find({ user }).select({
    name: 1,
  });

  const _label_admin = await Label.find({
    role: 'admin',
    _id: { $nin: editedLabels },
  }).select({ name: 1 });

  Array.prototype.push.apply(_label_list, _label_admin);
  return _label_list;
};

const convertLabel = async (user, label_str) => {
  let label;
  label = await Label.findOne({
    $or: [
      {
        user,
        name: new RegExp(label_str, 'i'),
      },
      {
        role: 'admin',
        name: new RegExp(label_str, 'i'),
      },
    ],
  }).catch((err) => {
    console.log('label find err', err.message);
  });

  if (label) {
    return label.id;
  } else {
    label = new Label({
      user,
      name: label_str,
    });
    const new_label = await label.save().catch((err) => {
      console.log('new label save err', err.message);
    });
    return new_label.id;
  }
};

module.exports = {
  getAll,
  convertLabel,
};
