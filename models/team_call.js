const mongoose = require('mongoose');

const { Schema } = mongoose;

const TeamCallSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    guests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    invites: Array,
    subject: String,
    description: String,
    duration: Number,
    location: String,
    status: { type: String, default: 'pending' },
    link: String,
    schedule_link: String,
    proposed_at: Array,
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'deal' },
    shared_team_call: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'team_call',
    },
    has_shared: Boolean,
    confirmed_at: Date,
    desired_at: Date,
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const TeamCall = mongoose.model('team_call', TeamCallSchema);

module.exports = TeamCall;
