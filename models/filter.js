const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const FilterSchema = new Schema(
  {
    title: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    content: Object,
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Filter = mongoose.model('filter', FilterSchema);

module.exports = Filter;
