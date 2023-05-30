const File = require('../models/file');
const { uploadBase64Image, removeFile } = require('../helpers/fileUpload');
const urls = require('../constants/urls');

const load = async (req, res) => {
  const { currentUser } = req;
  const page = req.params.page;
  const skip = (page - 1) * 20;
  const total = await File.find({ user: currentUser._id }).count();
  File.find({ user: currentUser._id })
    .sort({ updated_at: -1 })
    .skip(skip)
    .limit(20)
    .then((_files) => {
      return res.send({
        total,
        status: true,
        data: _files,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    });
};

const update = async (req, res) => {
  const { _id } = req.body;
  File.updateOne({ _id }, { $set: { ...req.body, _id: undefined } })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    });
};

const create = async (req, res) => {
  const { name, url } = req.body;
  const { currentUser } = req;
  try {
    const newURL = await uploadBase64Image(url, 'assets');
    const file = new File({
      name,
      url: newURL,
      user: currentUser.id,
    });
    file
      .save()
      .then((_file) => {
        return res.send({
          status: true,
          data: _file,
        });
      })
      .catch((err) => {
        return res.status(500).send({
          status: false,
          error: err,
        });
      });
  } catch (err) {
    return res.status(500).send({
      status: false,
      error: err,
    });
  }
};

const replace = async (req, res) => {
  const { _id, url } = req.body;
  const file = await File.findOne({ _id }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err,
    });
  });
  if (file) {
    try {
      const key = file.url.slice(urls.STORAGE_BASE.length + 1);
      await removeFile(key);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('File Remove Error: File ID=', _id, err);
    }
    try {
      const newURL = await uploadBase64Image(url, 'assets');
      File.updateOne({ _id }, { $set: { url: newURL } })
        .then(() => {
          return res.send({
            status: true,
            data: {
              ...file,
              url: newURL,
            },
          });
        })
        .catch((err) => {
          return res.status(500).send({
            status: false,
            error: err,
          });
        });
    } catch (err) {
      return res.status(500).send({
        status: false,
        error: err,
      });
    }
  } else {
    return res.status(400).send({
      status: false,
      error: 'There is no file',
    });
  }
};

const remove = async (req, res) => {
  const { ids } = req.body;
  const files = await File.find({ _id: { $in: ids } }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err,
    });
  });
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      // console.log('File Remove', file.url);
      const key = file.url.slice(urls.STORAGE_BASE.length + 1);
      await removeFile(key);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Remove Assets From Amazon: ', err);
    }
  }
  await File.deleteMany({ _id: { $in: ids } }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err,
    });
  });
  res.send({
    status: true,
  });
};

const bulkCreate = async (req, res) => {
  const files = req.files;
  const { currentUser } = req;
  const savedFiles = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileObj = {
      name: file.originalname || 'Untitled',
      size: file.size,
      url: file.location,
      user: currentUser.id,
    };
    const newFile = new File(fileObj);
    const savedFile = await newFile.save();
    savedFiles.push(savedFile);
  }
  res.send({
    status: true,
    data: savedFiles,
  });
};

module.exports = {
  load,
  update,
  create,
  replace,
  remove,
  bulkCreate,
};
