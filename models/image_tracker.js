const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TrackerSchema = new Schema(
  {
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    image: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    activity: [{ type: mongoose.Schema.Types.ObjectId, ref: 'activity' }],
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'campaign' },
    type: { type: String, default: 'review' },
    duration: Number,
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

TrackerSchema.index({ activity: 1 });
const ImageTracker = mongoose.model('image_tracker', TrackerSchema);

module.exports = ImageTracker;
