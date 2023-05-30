const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const AppointmentSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    description: String,
    location: String,
    due_start: Date,
    due_end: Date,
    type: Number,
    del: { type: Boolean, default: false },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    guests: Array,
    event_id: String,
    recurrence_id: String,
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'deal' },
    shared_appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'appointment',
    },
    event_type: { type: mongoose.Schema.Types.ObjectId, ref: 'event_type' },
    calendar_id: String,
    has_shared: Boolean,
    created_at: Date,
    updated_at: Date,
    scheduler_timezone: String,
    scheduler_comment: String,
    remind_at: Date,
    status: { type: Number, default: 0 },
    timezone: String,
    service_type: String,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

AppointmentSchema.index({ event_id: 1, user_id: 1 });
AppointmentSchema.index({ contacts: 1 });
AppointmentSchema.index({ deal: 1 });
const Appointment = mongoose.model('appointment', AppointmentSchema);

module.exports = Appointment;
