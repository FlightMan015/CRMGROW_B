const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CampaignJobSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'campaign' },
    status: String,
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    failed: { type: Array, default: [] },
    due_date: Date,
    action: Object,
    ref: String,
    parent_ref: String,
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

CampaignJobSchema.index({ status: 1, due_date: 1 });

const CampaignJob = mongoose.model('campaign_job', CampaignJobSchema);

module.exports = CampaignJob;
