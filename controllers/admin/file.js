const path = require('path');
const mime = require('mime-types');
const fs = require('fs');

const File = require('../../models/file');
const { FILES_PATH } = require('../../config/path');

const create = async (req, res) => {
  if (req.file) {
    if (req.currentUser) {
      const file = new File({
        user: req.currentUser.id,
        name: req.file.filename,
        type: 'image',
      });
      file.save();
    }
    res.send({
      status: true,
      data: {
        file_name: req.file.filename,
        url: `${process.env.TEAMGROW_DOMAIN}/api/file/${req.file.filename}`,
      },
    });
  }
};

const get = (req, res) => {
  const filePath = FILES_PATH + req.params.name;
  if (fs.existsSync(filePath)) {
    const contentType = mime.contentType(path.extname(filePath));
    res.set('Content-Type', contentType);
    res.sendFile(filePath);
  } else {
    res.status(404).send({
      status: false,
      error: 'File does not exist',
    });
  }
};

const remove = async (req, res) => {
  const { currentUser } = req;
  try {
    const file = File.findOne({ user: currentUser.id, name: req.params.id });

    if (file) {
      fs.unlinkSync(FILES_PATH + req.params.id);
      res.send({
        status: true,
        data: {
          file_name: req.params.id,
        },
      });
    } else {
      res.status(404).send({
        status: false,
        error: 'file_not_found',
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    res.status(500).send({
      status: false,
      error: 'internal_server_error',
    });
  }
};

module.exports = {
  create,
  get,
  remove,
};
