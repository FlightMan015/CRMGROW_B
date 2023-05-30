const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PaymentSchema = new Schema(
  {
    email: String,
    card_name: String,
    customer_id: String,
    card: String,
    card_id: String,
    plan_id: String,
    token: String,
    subscription: String,
    fingerprint: String,
    card_brand: String,
    bill_amount: String,
    exp_year: String,
    exp_month: String,
    referral: String,
    last4: String,
    type: { type: String, default: 'crmgrow' },
    active: { type: Boolean, default: false },
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Payment = mongoose.model('payment', PaymentSchema);

module.exports = Payment;
