const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TaskSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    status: String,
    due_date: Date,
    period: Number,
    action: Object,
    ref: String,
    parent_ref: String,
    type: { type: String },
    process: { type: String },
    activity: { type: mongoose.Schema.Types.ObjectId, ref: 'activity' },
    condition: {
      case: String,
      answer: Boolean,
    },
    watched_video: { type: mongoose.Schema.Types.ObjectId, ref: 'video' },
    watched_pdf: { type: mongoose.Schema.Types.ObjectId, ref: 'pdf' },
    watched_image: { type: mongoose.Schema.Types.ObjectId, ref: 'image' },
    opened_email: { type: mongoose.Schema.Types.ObjectId, ref: 'activity' },
    deals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'deals' }],
    exec_result: Object,
    set_recurrence: Boolean,
    recurrence_mode: String,
    source: { type: String, default: 'normal' }, // normal | schedule
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

TaskSchema.index({ status: 1, due_date: 1 });
TaskSchema.index({ user: 1 });

const Task = mongoose.model('task', TaskSchema);

module.exports = Task;
