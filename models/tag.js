const mongoose = require('mongoose');

const { Schema } = mongoose;
const findOrCreate = require('mongoose-findorcreate');

const TagSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    tags: Array,
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

TagSchema.plugin(findOrCreate);
const Tag = mongoose.model('tag', TagSchema);

module.exports = Tag;
