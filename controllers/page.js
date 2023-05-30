const mongoose = require('mongoose');
const uuidv1 = require('uuid/v1');
const AWS = require('aws-sdk');
const Page = require('../models/page');
const api = require('../config/api');
const User = require('../models/user');
const Garbage = require('../models/garbage');

AWS.config.update({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});
const s3 = new AWS.S3();

const loadDefault = async (req, res) => {
  const templates = await Page.find({ default: true }).catch((err) => {
    throw err;
  });
  if (templates) {
    return res.send({
      status: true,
      data: templates,
    });
  }
  return res.status(400).send({
    status: false,
    error: 'There are no templates',
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  const { meta, title } = req.body;
  if (meta && meta.base64_image) {
    const base64Data = new Buffer.from(
      meta.base64_image.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );
    const type = meta.base64_image.split(';')[0].split('/')[1];
    const image_name = uuidv1();
    delete meta.base64_image;
    const data = {
      Bucket: 'teamgrow',
      Key: `${image_name}.${type}`,
      Body: base64Data,
      ContentEncoding: 'base64',
      ACL: 'public-read',
      ContentType: `image/${type}`,
    };
    try {
      const { Location, Key } = await s3.upload(data).promise();
      meta.image = Location;
    } catch (error) {
      console.log(error);
    }
  }

  // Get the same title pages in this user
  let slug = title
    .toLowerCase() // Convert the string to lowercase letters
    .trim() // Remove whitespace from both sides of a string
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/&/g, '-y-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
  const samePages = await Page.find({
    title: { $regex: new RegExp(`^${title}$`, 'i') },
    user: currentUser.id,
  });
  console.log(samePages);
  if (samePages && samePages.length) {
    slug = `${slug}--${samePages.length}`;
  }

  const page = new Page({
    ...req.body,
    slug: `/${slug}`,
    user: currentUser.id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  page
    .save()
    .then((_page) => {
      res.send({
        status: true,
        data: _page,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Page creating is failed.',
      });
    });
};

const update = async (req, res) => {
  const { currentUser } = req;
  const { id } = req.params;
  const data = req.body;
  const { meta, title } = data;
  if (meta && meta.base64_image) {
    if (meta.image) {
      const params = { Bucket: 'teamgrow', Key: meta.image };
      try {
        await s3.deleteObject(params).promise();
        delete meta.image;
      } catch (error) {
        console.log(error);
      }
    }

    const base64Data = new Buffer.from(
      meta.base64_image.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );
    const type = meta.base64_image.split(';')[0].split('/')[1];
    const image_name = uuidv1();
    delete meta.base64_image;
    const imageParam = {
      Bucket: 'teamgrow',
      Key: `${image_name}.${type}`,
      Body: base64Data,
      ContentEncoding: 'base64',
      ACL: 'public-read',
      ContentType: `image/${type}`,
    };
    try {
      const { Location, Key } = await s3.upload(imageParam).promise();
      console.log('Location, key', Location, Key);
      meta.image = Location;
    } catch (error) {
      console.log(error);
    }
  }

  let slug = title
    .toLowerCase() // Convert the string to lowercase letters
    .trim() // Remove whitespace from both sides of a string
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/&/g, '-y-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
  const samePages = await Page.find({
    title: { $regex: new RegExp(`^${title}$`, 'i') },
    user: currentUser.id,
    id: { $ne: id },
  });
  console.log(samePages);
  if (samePages && samePages.length) {
    slug = `${slug}--${samePages.length}`;
  }

  Page.updateOne({ _id: id }, { $set: { ...data, sslug: `/${slug}` } })
    .then(() => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(400).send({
        status: false,
        error: err.message || 'Page Updating is failed.',
      });
    });
};

const read = (req, res) => {
  const { id } = req.params;

  Page.findOne({ _id: id })
    .then((data) => {
      res.send({
        satus: true,
        data,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Page reading is failed.',
      });
    });
};

const remove = async (req, res) => {
  await Page.deleteOne({ _id: req.params.id }).catch((err) => {
    res.status(400).send({
      status: false,
    });
  });

  res.send({
    status: false,
  });
};

const bulkRemove = async (req, res) => {
  const { ids } = req.body;
  await Page.delete({ _id: { $in: ids } }).catch((err) => {
    res.status(400).send({
      status: false,
    });
  });

  return res.send({
    status: false,
  });
};

const load = async (req, res) => {
  const { currentUser } = req;
  const { page } = req.params;

  const pages = await Page.find({ user: currentUser.id })
    .skip((page - 1) * 10)
    .limit(10)
    .catch((err) => {
      throw err;
    });
  const total = await Page.countDocuments({
    user: currentUser.id,
  });
  if (pages) {
    setTimeout(() => {
      return res.send({
        status: true,
        data: pages,
        total,
      });
    }, 4000);
  } else {
    return res.status(400).send({
      status: false,
      error: 'There are no Pages',
    });
  }
};

const duplicate = (req, res) => {};

const search = async (req, res) => {
  // const condition = req.body;
  // const { currentUser } = req;
  // Automation.find(
  // {$and: [
  //     {
  //         $or: [
  //             {'user': currentUser.id,},
  //             {'role': 'admin'}
  //           ]
  //         },
  //     {
  //         'title': { '$regex': '.*' + condition.search + '.*', '$options': 'i' }
  //     }
  // ]}).then((data) => {
  //     return res.send({
  //         status: true,
  //         data
  //     })
  // }).catch(err => {
  //         res.status(400).send({
  //             status: false
  //         })
  //     })
};

const display = async (req, res, next) => {
  const sub_domain = req.headers['x-subdomain'];
  if (sub_domain !== 'app') {
    const user = await User.findOne({ nick_name: sub_domain }).catch((err) => {
      console.log('err', err);
    });

    if (user) {
      const slug = req.originalUrl;
      const garbage = await Garbage.findOne({ user: user.id }).catch((err) => {
        console.log('err', err);
      });
      let page;
      if (slug === '/' && garbage.index_page) {
        page = await Page.findOne({ _id: garbage.index_page }).catch((err) => {
          console.log('err', err);
        });
        return res.render('page', {
          page,
          user,
        });
      }
      page = await Page.findOne({ slug, user: user.id }).catch((err) => {
        console.log('err', err);
      });
      if (page && user) {
        return res.render('page', {
          page,
          user,
        });
      }
      next();
    } else {
      next();
    }
  } else {
    next();
  }
};

module.exports = {
  create,
  read,
  update,
  display,
  remove,
  load,
  bulkRemove,
  search,
  duplicate,
  loadDefault,
};
