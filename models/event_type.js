const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const EventSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    description: String,
    location: Object,
    due_start: Date,
    due_end: Date,
    type: Number,
    del: { type: Boolean, default: false },
    guests: Array,
    event_id: String,
    recurrence_id: String,
    link: String,
    duration: Number,
    gap: Object,
    date_range: Object,
    weekly_hours: Object,
    calendar_id: String,
    automation: { type: mongoose.Schema.Types.ObjectId, ref: 'automation' },
    auto_trigger_duration: Number,
    auto_trigger_time: String,
    auto_trigger_type: String,
    tags: Array,
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

EventSchema.index({ user: 1 });
EventSchema.index({ link: 1 });
const Event = mongoose.model('event_type', EventSchema);

module.exports = Event;
