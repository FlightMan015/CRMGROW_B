const _ = require('lodash');

const MailList = require('../models/mail_list');
const Contact = require('../models/contact');

const getAll = async (req, res) => {
  const { currentUser } = req;
  const data = await MailList.find({ user: currentUser.id }).catch((err) => {
    console.log('mail list find err', err.message);
  });

  return res.send({
    status: true,
    data,
  });
};

const get = async (req, res) => {
  const data = await MailList.findOne({ _id: req.params.id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Mail list doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const mail_list = new MailList({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  mail_list
    .save()
    .then(() => {
      return res.send({
        status: true,
        data: mail_list,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(500).json({
        status: false,
        error: err.message || 'Internal server error',
      });
    });
};

const addContacts = async (req, res) => {
  const { mail_list, contacts } = req.body;

  const list = await MailList.findOne({
    _id: mail_list,
  })
    .populate('contacts')
    .catch((err) => {
      console.log('contact found err', err.message);
    });

  const contacts_list = list.contacts;
  const new_list = _.unionBy(contacts_list, contacts, 'email');

  MailList.updateOne(
    {
      _id: mail_list,
    },
    {
      $set: { contacts: new_list },
    }
  )
    .then(() => {
      return res.send({
        status: true,
        data: new_list,
      });
    })
    .catch((err) => {
      console.log('mail list update err', err.message);
      return res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

const removeContacts = async (req, res) => {
  const { mail_list, contacts } = req.body;
  MailList.updateOne(
    {
      _id: mail_list,
    },
    {
      $pull: { contacts: { $in: contacts } },
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('mail list update err', err.message);
      return res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  MailList.deleteOne({
    _id: req.params.id,
  })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('mail list delete err', err.message);
      return res.send(500).json({
        status: false,
        error: err,
      });
    });
};

const update = async (req, res) => {
  const id = req.params.id;
  MailList.updateOne({ _id: id }, { $set: { title: req.body.title } })
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

const bulkRemove = (req, res) => {
  const { ids } = req.body;
  const { currentUser } = req;
  MailList.deleteMany({ _id: { $in: ids }, user: currentUser.id })
    .then(() => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Remove MailList Error',
      });
    });
};

const getContacts = async (req, res) => {
  const { currentUser } = req;
  const { mail_list } = req.body;
  const count = req.body.count || 50;
  const skip = req.body.skip || 0;

  const list = await MailList.findOne({
    _id: mail_list,
  }).catch((err) => {
    console.log('get mail list contact', err.message);
    return res.status(500).send({
      status: false,
      error: err.message || 'Get mail list contact Error',
    });
  });

  const total = list.contacts ? list.contacts.length : 0;

  const contacts = await Contact.find({ _id: { $in: list.contacts } })
    .skip(skip)
    .limit(count)
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Get mail list contact Error',
      });
    });

  return res.send({
    status: true,
    data: {
      count: total,
      contacts,
    },
  });
};

const getAllContacts = async (req, res) => {
  const { currentUser } = req;
  const { mail_list } = req.body;

  const list = await MailList.findOne({ _id: mail_list })
    .populate({
      path: 'contacts',
      select: { _id: 1 },
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Select all mail list contacts Error',
      });
    });

  return res.send({
    status: true,
    data: list.contacts,
  });
};

const moveTopContacts = async (req, res) => {};

module.exports = {
  get,
  getAll,
  create,
  remove,
  update,
  addContacts,
  removeContacts,
  moveTopContacts,
  bulkRemove,
  getContacts,
  getAllContacts,
};
