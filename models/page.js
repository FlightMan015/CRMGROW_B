const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PageSchema = new Schema(
  {
    slug: String,
    title: String,
    html: String,
    style: String,
    meta: {
      type: {
        title: String,
        description: String,
        image: String,
      },
    },
    default: Boolean,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    home: { type: Boolean, default: false },
    status: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Page = mongoose.model('page', PageSchema);

module.exports = Page;
