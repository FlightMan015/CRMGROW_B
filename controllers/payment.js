const api = require('../config/api');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const Payment = require('../models/payment');
const User = require('../models/user');
const Notification = require('../models/notification');
const { sendNotificationEmail } = require('../helpers/email');
const moment = require('moment-timezone');

const stripeKey = api.STRIPE.SECRET_KEY;

const stripe = require('stripe')(stripeKey);

const get = async (req, res) => {
  const { currentUser } = req;
  if (!currentUser.payment || currentUser.payment === 'undefined') {
    return res.status(400).json({
      status: false,
      error: 'Payment doesn`t exist',
    });
  }
  //   if (!req.params.id || req.params.id == 'undefined') {
  //     return res.status(400).json({
  //         status: false,
  //         error: 'Payment doesn`t exist'
  //     })
  //   }

  const data = await Payment.findOne({ _id: req.params.id }).catch((err) => {
    console.log('err', err);
  });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Payment doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (payment_data) => {
  return new Promise(function (resolve, reject) {
    const { user_name, email, token, level, offer } = payment_data;
    let { is_trial } = payment_data;

    let trial_period_days = system_settings.SUBSCRIPTION_FREE_TRIAL;
    let coupon;
    if (offer === system_settings.OFFER.ONE_MONTH_TRIAL) {
      trial_period_days = 30;
      is_trial = true;
    } else if (offer === system_settings.OFFER.TWENTY_PERCENT_DISCOUNT) {
      coupon = api.STRIPE.DISCOUNT['TWENTY'];
    }

    createCustomer(user_name, email).then((customer) => {
      stripe.customers.createSource(
        customer.id,
        { source: token.id },
        function (err, card) {
          if (err) {
            console.log('card error', err);
          }
          if (!card) {
            reject('Card is null');
            return;
          }
          if (card['cvc_check'] === 'unchecked') {
            reject('CVC is unchecked');
            return;
          }

          const pricingPlan = api.STRIPE.PLAN[level];
          const subscription_data = {
            customer_id: customer.id,
            plan_id: pricingPlan,
            is_trial,
            trial_period_days,
            coupon,
          };

          createSubscription(subscription_data)
            .then(async (subscription) => {
              // Save card information to DB.
              const payment = new Payment({
                email,
                customer_id: customer.id,
                plan_id: pricingPlan,
                token: token.id,
                subscription: subscription.id,
                card_id: card.id,
                card_name: token.card_name,
                card_brand: token.card.brand,
                fingerprint: card.fingerprint,
                exp_month: token.card.exp_month,
                exp_year: token.card.exp_year,
                last4: token.card.last4,
                active: true,
              });

              const _payment = await payment
                .save()
                .then()
                .catch((err) => {
                  console.log('err', err);
                });
              resolve(_payment);
            })
            .catch((err) => {
              reject(err.type);
            });
        }
      );
    });
  });
};

const update = async (req, res) => {
  const { token, offer } = req.body;
  const { currentUser } = req;
  let level;
  if (currentUser.user_version === 1 && currentUser.package_level === 'PRO') {
    level = 'LITE';
  } else {
    level = currentUser.package_level || system_settings.DEFAULT_PACKAGE;
  }

  if (currentUser.is_minimal) {
    level = system_settings.MINIMAL_PACKAGE;
  }

  if (!currentUser.payment) {
    const payment_data = {
      user_name: currentUser.user_name,
      email: currentUser.email,
      token,
      level,
      offer,
    };

    create(payment_data)
      .then((payment) => {
        // Save card information to DB.

        currentUser['payment'] = payment.id;
        currentUser
          .save()
          .then(() => {
            return res.send({
              status: true,
              data: payment,
            });
          })
          .catch((err) => {
            console.log('err', err);
          });
      })
      .catch((err) => {
        console.log('creating subscripition error', err);
        return res.status(400).send({
          status: false,
          error: err.type,
        });
      });
  }

  if (currentUser.payment) {
    const payment = await Payment.findOne({ _id: currentUser.payment }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    if (!payment) {
      console.log('not found payment');
      const payment_data = {
        user_name: currentUser.user_name,
        email: currentUser.email,
        token,
        level,
      };

      create(payment_data)
        .then((payment) => {
          // Save card information to DB.
          User.updateOne(
            {
              _id: currentUser.id,
            },
            {
              payment: payment.id,
            }
          ).catch((err) => {
            console.log('user update cc payment', err.message);
          });

          return res.send({
            status: true,
            data: payment,
          });
        })
        .catch((err) => {
          console.log('creating subscripition error', err);
          return res.status(400).send({
            status: false,
            error: err.type,
          });
        });
    } else {
      stripe.customers.retrieve(
        payment['customer_id'],
        function (err, customer) {
          if (err || customer['deleted']) {
            console.log('customer retrieve error', err);
            const payment_data = {
              user_name: currentUser.user_name,
              email: currentUser.email,
              token,
              level,
            };

            create(payment_data)
              .then((payment) => {
                // Save card information to DB.

                currentUser['payment'] = payment.id;
                currentUser
                  .save()
                  .then(() => {
                    return res.send({
                      status: true,
                      data: payment,
                    });
                  })
                  .catch((err) => {
                    console.log('err', err);
                  });
              })
              .catch((err) => {
                console.log('creating subscripition error', err);
                return res.status(400).send({
                  status: false,
                  error: err,
                });
              });
          } else {
            stripe.tokens.retrieve(token.id, function (err, _token) {
              // asynchronously called
              if (!_token) {
                return res.status(400).send({
                  status: false,
                  error: 'Card is not valid',
                });
              }
              if (payment['fingerprint'] !== _token.card.fingerprint) {
                stripe.customers.createSource(
                  payment['customer_id'],
                  { source: token.id },
                  function (err, card) {
                    if (!card) {
                      return res.status(400).send({
                        status: false,
                        error: 'Card is not valid',
                      });
                    }

                    stripe.customers
                      .update(payment['customer_id'], {
                        default_source: card.id,
                      })
                      .then(async () => {
                        try {
                          stripe.customers.deleteSource(
                            payment['customer_id'],
                            payment['card_id'],
                            function (err, confirmation) {
                              if (err) {
                                console.log('delete source err', err);
                                stripe.subscriptions
                                  .update(payment['subscription'], {
                                    default_payment_method: card.id,
                                  })
                                  .catch((err) => {
                                    console.log(
                                      'subscription update cc err',
                                      err
                                    );
                                  });
                              }
                            }
                          );
                          // Save card information to DB.

                          if (customer.subscriptions) {
                            const subscription =
                              customer.subscriptions['data'][0];
                            if (subscription) {
                              if (
                                subscription.status === 'past_due' ||
                                subscription.status === 'canceled' ||
                                subscription.status === 'unpaid'
                              ) {
                                await stripe.invoices
                                  .pay(subscription.latest_invoice)
                                  .then(() => {
                                    payment['card_id'] = card.id;
                                    payment['card_name'] = token.card_name;
                                    payment['card_brand'] = token.card.brand;
                                    payment['exp_month'] = token.card.exp_month;
                                    payment['exp_year'] = token.card.exp_year;
                                    payment['last4'] = token.card.last4;
                                    payment['fingerprint'] = card.fingerprint;
                                    payment['updated_at'] = new Date();
                                    payment.save().catch((err) => {
                                      console.log('err', err);
                                    });

                                    return res.send({
                                      status: true,
                                      data: currentUser.payment,
                                    });
                                  })
                                  .catch((err) => {
                                    console.log('invoice charge err', err.type);
                                    return res.status(400).json({
                                      status: false,
                                      err: 'Reject payment',
                                    });
                                  });
                              } else {
                                payment['card_id'] = card.id;
                                payment['card_name'] = token.card_name;
                                payment['card_brand'] = token.card.brand;
                                payment['exp_month'] = token.card.exp_month;
                                payment['exp_year'] = token.card.exp_year;
                                payment['last4'] = token.card.last4;
                                payment['fingerprint'] = card.fingerprint;
                                payment['updated_at'] = new Date();
                                payment.save().catch((err) => {
                                  console.log('err', err);
                                });

                                return res.send({
                                  status: true,
                                  data: currentUser.payment,
                                });
                              }
                            } else {
                              const pricingPlan = api.STRIPE.PLAN[level];

                              const subscription_data = {
                                customer_id: customer.id,
                                plan_id: pricingPlan,
                              };

                              createSubscription(subscription_data)
                                .then(async (subscripition) => {
                                  // Save card information to DB.
                                  payment['subscription'] = subscripition.id;
                                  payment['card_id'] = card.id;
                                  payment['card_name'] = token.card_name;
                                  payment['card_brand'] = token.card.brand;
                                  payment['exp_month'] = token.card.exp_month;
                                  payment['exp_year'] = token.card.exp_year;
                                  payment['last4'] = token.card.last4;
                                  payment['fingerprint'] = card.fingerprint;
                                  payment['updated_at'] = new Date();
                                  payment.save().catch((err) => {
                                    console.log('err', err);
                                  });

                                  payment
                                    .save()
                                    .then()
                                    .catch((err) => {
                                      console.log('err', err);
                                    });

                                  payment.save().catch((err) => {
                                    console.log('err', err);
                                  });

                                  return res.send({
                                    status: true,
                                    data: currentUser.payment,
                                  });
                                })
                                .catch((err) => {
                                  return res.status(400).send({
                                    status: false,
                                    error: err.type,
                                  });
                                });
                            }
                          } else {
                            const payment_data = {
                              user_name: currentUser.user_name,
                              email: currentUser.email,
                              token,
                              level,
                            };

                            create(payment_data)
                              .then((payment) => {
                                // Save card information to DB.

                                currentUser['payment'] = payment.id;
                                currentUser
                                  .save()
                                  .then(() => {
                                    return res.send({
                                      status: true,
                                      data: payment,
                                    });
                                  })
                                  .catch((err) => {
                                    console.log('err', err);
                                  });
                              })
                              .catch((err) => {
                                console.log(
                                  'creating subscripition error',
                                  err
                                );
                                return res.status(400).send({
                                  status: false,
                                  error: err,
                                });
                              });
                          }
                        } catch (err) {
                          console.log('delete card err', err);
                        }
                      });
                    /**
                    const pricingPlan = api.STRIPE.PRIOR_PLAN;
                    const bill_amount =
                      system_settings.SUBSCRIPTION_MONTHLY_PLAN.BASIC;

                    updateSubscription(
                      payment['customer_id'],
                      pricingPlan,
                      card.id
                    )
                      .then((subscription) => {
                        console.log('update Subscription', subscription);
                        cancelSubscription(payment['subscription']).catch(
                          (err) => {
                            console.log('cancel subscription err', err);
                          }
                        );
                        try {
                          stripe.customers.deleteSource(
                            payment['customer_id'],
                            payment['card_id'],
                            function (err, confirmation) {
                              if (err) {
                                console.log('delete source err', err);
                              }
                            }
                          );
                          // Save card information to DB.
                          payment['plan_id'] = pricingPlan;
                          payment['bill_amount'] = bill_amount;
                          payment['token'] = token.id;
                          payment['card_id'] = card.id;
                          payment['card_name'] = token.card_name;
                          payment['card_brand'] = token.card.brand;
                          payment['exp_month'] = token.card.exp_month;
                          payment['exp_year'] = token.card.exp_year;
                          payment['last4'] = token.card.last4;
                          payment['subscription'] = subscription.id;
                          payment['fingerprint'] = card.fingerprint;
                          payment['updated_at'] = new Date();
                          payment.save().catch((err) => {
                            console.log('err', err);
                          });
                          return res.send({
                            status: true,
                            data: currentUser.payment,
                          });
                        } catch (err) {
                          console.log('delete card err', err);
                        }
                      })
                      .catch((err) => {
                        console.log('creating subscripition error', err);
                        return res.status(400).send({
                          status: false,
                          eror: err,
                        });
                      });
                     */
                  }
                );
              } else {
                const customer_id = payment['customer_id'];
                const card_id = payment['card_id'];
                stripe.customers.retrieveSource(
                  customer_id,
                  card_id,
                  async (err, card) => {
                    if (err) {
                      stripe.customers.createSource(
                        payment['customer_id'],
                        { source: token.id },
                        function (err, card) {
                          console.log('_card', card);
                          if (err || !card) {
                            return res.status(400).send({
                              status: false,
                              error: 'Card is not valid',
                            });
                          }

                          const pricingPlan = api.STRIPE.PLAN[level];

                          const subscription_data = {
                            customer_id: customer.id,
                            plan_id: pricingPlan,
                          };

                          createSubscription(subscription_data)
                            .then((subscription) => {
                              console.log('update Subscription', subscription);
                              try {
                                // Save card information to DB.
                                payment['plan_id'] = pricingPlan;
                                payment['card_id'] = card.id;
                                payment['card_name'] = token.card_name;
                                payment['card_brand'] = token.card.brand;
                                payment['exp_month'] = token.card.exp_month;
                                payment['exp_year'] = token.card.exp_year;
                                payment['last4'] = token.card.last4;
                                payment['subscription'] = subscription.id;
                                payment['fingerprint'] = card.fingerprint;
                                payment['updated_at'] = new Date();
                                payment.save().catch((err) => {
                                  console.log('err', err);
                                });
                                return res.send({
                                  status: true,
                                  data: currentUser.payment,
                                });
                              } catch (err) {
                                console.log('delete card err', err);
                              }
                            })
                            .catch((err) => {
                              console.log('creating subscripition error', err);
                              return res.status(400).send({
                                status: false,
                                error: err,
                              });
                            });
                        }
                      );
                    } else {
                      if (customer.subscriptions) {
                        const subscription = customer.subscriptions['data'][0];
                        if (subscription) {
                          if (subscription.status !== 'active') {
                            await stripe.invoices
                              .pay(subscription.latest_invoice)
                              .then(() => {
                                const card = {
                                  name: token.card.name,
                                  exp_month: token.card.exp_month,
                                  exp_year: token.card.exp_year,
                                };

                                delete card.id;

                                updateCard(customer_id, card_id, card)
                                  .then((_card) => {
                                    // Save card information to DB.
                                    payment['card_name'] = token.card_name;
                                    payment['card_brand'] = token.card.brand;
                                    payment['exp_month'] = token.card.exp_month;
                                    payment['exp_year'] = token.card.exp_year;
                                    payment['last4'] = token.card.last4;
                                    payment['updated_at'] = new Date();
                                    payment.save().catch((err) => {
                                      console.log('err', err);
                                    });

                                    return res.send({
                                      status: true,
                                      data: currentUser.payment,
                                    });
                                  })
                                  .catch((err) => {
                                    return res.status(400).send({
                                      status: false,
                                      error: err,
                                    });
                                  });
                              })
                              .catch((err) => {
                                console.log('invoice charge err', err.type);
                                return res.status(400).json({
                                  status: false,
                                  err: 'Reject payment',
                                });
                              });
                          } else {
                            const card = {
                              name: token.card.name,
                              exp_month: token.card.exp_month,
                              exp_year: token.card.exp_year,
                            };

                            delete card.id;

                            updateCard(customer_id, card_id, card)
                              .then((_card) => {
                                // Save card information to DB.
                                payment['card_name'] = token.card_name;
                                payment['card_brand'] = token.card.brand;
                                payment['exp_month'] = token.card.exp_month;
                                payment['exp_year'] = token.card.exp_year;
                                payment['last4'] = token.card.last4;
                                payment['updated_at'] = new Date();
                                payment.save().catch((err) => {
                                  console.log('err', err);
                                });

                                return res.send({
                                  status: true,
                                  data: currentUser.payment,
                                });
                              })
                              .catch((err) => {
                                return res.status(400).send({
                                  status: false,
                                  error: err,
                                });
                              });
                          }
                        } else {
                          const pricingPlan = api.STRIPE.PLAN[level];

                          const subscription_data = {
                            customer_id: customer.id,
                            plan_id: pricingPlan,
                          };

                          createSubscription(subscription_data)
                            .then(async (subscripition) => {
                              // Save card information to DB.
                              payment['subscription'] = subscripition.id;
                              payment['card_id'] = card.id;
                              payment['card_name'] = token.card_name;
                              payment['card_brand'] = token.card.brand;
                              payment['exp_month'] = token.card.exp_month;
                              payment['exp_year'] = token.card.exp_year;
                              payment['last4'] = token.card.last4;
                              payment['fingerprint'] = card.fingerprint;
                              payment['updated_at'] = new Date();
                              payment.save().catch((err) => {
                                console.log('err', err);
                              });

                              payment
                                .save()
                                .then()
                                .catch((err) => {
                                  console.log('err', err);
                                });

                              payment.save().catch((err) => {
                                console.log('err', err);
                              });

                              return res.send({
                                status: true,
                                data: currentUser.payment,
                              });
                            })
                            .catch((err) => {
                              return res.status(400).send({
                                status: false,
                                error: err.type,
                              });
                            });
                        }
                      }
                    }
                  }
                );
              }
            });
          }
        }
      );
    }
  }
};

const updateCustomerEmail = async (customer_id, email) => {
  // Create new customer
  return new Promise(function (resolve, reject) {
    stripe.customers.update(
      customer_id,
      { metadata: { email } },
      async (err) => {
        if (err) {
          console.log('err', err);
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
};

const createCustomer = async (user_name, email) => {
  return new Promise((resolve, reject) => {
    stripe.customers.create(
      {
        name: user_name,
        email,
      },
      async (err, customer) => {
        if (err) {
          console.log('err', err);
          reject(err);
          return;
        }
        resolve(customer);
      }
    );
  });
};

const createSubscription = async (subscription_data) => {
  const { customer_id, plan_id, is_trial, trial_period_days, coupon } =
    subscription_data;
  let data;

  if (is_trial) {
    data = {
      customer: customer_id,
      items: [{ price: plan_id }],
      trial_period_days,
      coupon,
    };
  } else {
    data = {
      customer: customer_id,
      items: [{ price: plan_id }],
      coupon,
    };
  }

  return new Promise(function (resolve, reject) {
    stripe.subscriptions.create(data, function (err, subscription) {
      console.log('creating subscription err', err);
      if (err != null) {
        return reject(err);
      }
      resolve(subscription);
    });
  });
};

const updateSubscription = async (data) => {
  const { customerId, planId, subscriptionId } = data;

  return new Promise(function (resolve, reject) {
    stripe.customers.retrieve(customerId, function (err, customer) {
      if (err) {
        console.log('update subscription retrieve customer error', err);
        return reject(err.type);
      }
      stripe.subscriptions.retrieve(
        subscriptionId,
        function (err, subscription) {
          if (err) {
            console.log('subscription retrieve err', err);
            return reject('get subscription err');
          } else {
            const priceId = subscription.items.data[0].id;
            stripe.subscriptions.update(
              subscriptionId,
              {
                cancel_at_period_end: false,
                proration_behavior: 'create_prorations',
                items: [
                  {
                    id: priceId,
                    price: planId,
                  },
                ],
              },
              function (err, subscription) {
                if (err) {
                  console.log('update subscription error', err);
                  return reject(err.type);
                }
                resolve(subscription);
              }
            );
          }
        }
      );
    });
  });
};

const cancelSubscription = async (subscription_id) => {
  return new Promise(function (resolve, reject) {
    stripe.subscriptions.del(subscription_id, function (err, confirmation) {
      if (err != null) {
        return reject(err);
      }
      resolve();
    });
  });
};

/**
 *
 * @param {customer id} id
 */
const deleteCustomer = async (id) => {
  return new Promise(function (resolve, reject) {
    stripe.customers.del(id, function (err, confirmation) {
      if (err) reject(err);
      resolve(confirmation);
    });
  });
};

/**
 *
 * @param {customer id} customerId
 * @param {cart id} cardId
 * @param {data} data
 * @qutation update card
 */
const updateCard = async (customerId, cardId, data) => {
  return new Promise(function (resolve, reject) {
    stripe.customers.updateSource(
      customerId,
      cardId,
      data,
      function (err, card) {
        if (err) {
          console.log('err', err);
          reject(err);
        }
        resolve(card);
      }
    );
  });
};

const cancelCustomer = async (id) => {
  const payment = await Payment.findOne({ _id: id }).catch((err) => {
    console.log('err', err);
  });

  return new Promise((resolve, reject) => {
    cancelSubscription(payment.subscription).catch((err) => {
      console.log('err', err);
    });

    deleteCustomer(payment.customer_id)
      .then(() => {
        resolve();
      })
      .catch((err) => {
        console.log('err', err);
        reject();
      });
  });
};

const paymentFailed = async (req, res) => {
  const invoice = req.body.data;
  const customer_id = invoice['object']['customer'];
  const attempt_count = invoice['object']['attempt_count'];

  const payment = await Payment.findOne({
    customer_id,
  }).catch((err) => {
    console.log('payment find err', err.message);
  });

  if (payment && payment.type === 'crmgrow') {
    const user = await User.findOne({
      payment,
      del: false,
    }).catch((err) => {
      console.log('user find err', err.message);
    });

    if (user) {
      user['subscription']['is_failed'] = true;
      user['subscription']['updated_at'] = new Date();
      user['subscription']['attempt_count'] = attempt_count;
      user['updated_at'] = new Date();
      user['subscription']['amount'] = invoice['object']['amount_due'];

      if (attempt_count === 4) {
        user['subscription']['is_suspended'] = true;
        user['subscription']['suspended_at'] = new Date();

        const time_zone = user.time_zone_info
          ? JSON.parse(user.time_zone_info).tz_name
          : system_settings.TIME_ZONE;
        const data = {
          template_data: {
            user_name: user.user_name,
            created_at: moment().tz(time_zone).format('h:mm MMMM Do, YYYY'),
            amount: user.subscription.amount / 100 || 29,
            last_4_cc: payment.last4 || 'Unknown',
          },
          template_name: 'SuspendNotification',
          required_reply: true,
          email: user.email,
        };

        sendNotificationEmail(data);
      }

      user.save().catch((err) => {
        console.log('err', err.message);
      });

      const notification = new Notification({
        type: 'personal',
        criteria: 'subscription_failed',
        content: `Your payment for your crmgrow account has failed. Please update cc card info at <a href="${urls.BILLING_URL}" style="color:black;">billing page</a>`,
        user: user.id,
      });

      notification.save().catch((err) => {
        console.log('err', err.message);
      });

      return res.send({
        status: true,
      });
    } else {
      return res.send({
        status: false,
        error: 'no_user',
      });
    }
  } else {
    return res.send({
      status: false,
      error: 'no_payment',
    });
  }
};

const paymentSucceed = async (req, res) => {
  const invoice = req.body.data;
  const customer_id = invoice['object']['customer'];
  const payment = await Payment.findOne({ customer_id }).catch((err) => {
    console.log('err', err);
  });

  if (payment && payment.type === 'crmgrow') {
    const user = await User.findOne({ payment: payment.id, del: false }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    user['subscription']['is_failed'] = false;
    user['subscription']['attempt_count'] = 0;
    user['subscription']['is_suspended'] = false;
    user['subscription']['updated_at'] = new Date();

    if (user) {
      const subscription = {
        is_false: false,
        attempt_count: 0,
        is_suspended: false,
        updated_at: new Date(),
        amount: invoice['object']['amount_paid'],
      };

      User.updateOne(
        {
          _id: user.id,
        },
        {
          $set: {
            is_trial: false,
            subscription,
          },
        }
      ).catch((err) => {
        console.log('user update subscription err', err.message);
      });

      Notification.deleteMany({
        type: 'personal',
        criteria: 'subscription_failed',
        user: user.id,
      }).catch((err) => {
        console.log('notification delete error', err.message);
      });

      return res.send({
        status: true,
      });
    } else {
      console.log('Payment not found for user: ', customer_id);
      return res.status(400).json({
        status: false,
        error: `Couldn't find user ${customer_id}`,
      });
    }
  }
};

const createCharge = async (data) => {
  const { card_id, customer_id, amount, description } = data;
  return stripe.charges.create({
    amount,
    currency: 'usd',
    customer: customer_id,
    description,
  });
};

const getTransactions = async (req, res) => {
  const { currentUser } = req;
  let payment;

  if (currentUser.payment) {
    payment = await Payment.findOne({ _id: currentUser.payment }).catch(
      (err) => {
        console.log('err', err.message);
      }
    );
  } else {
    return res.send({
      status: true,
      data: [],
    });
  }

  if (payment) {
    const customer_id = payment.customer_id;
    stripe.charges.list({ customer: customer_id }, async (err, charges) => {
      if (err) {
        console.log('payment history find err', err);
        if (currentUser.role === 'admin') {
          return res.send({
            status: true,
            data: [],
          });
        } else {
          return res.status(400).json({
            status: false,
            error: err,
          });
        }
      }
      const charge_list = charges.data;
      const data = [];
      for (let i = 0; i < charge_list.length; i++) {
        if (charge_list[i].invoice) {
          const invoice = await stripe.invoices.retrieve(
            charge_list[i].invoice
          );
          const charge = {
            id: charge_list[i].id,
            amount: charge_list[i].amount / 100,
            status: charge_list[i].status,
            description: charge_list[i].description,
            customer: charge_list[i].customer,
            date: charge_list[i].created * 1000,
            invoice_pdf: invoice.invoice_pdf,
          };
          data.push(charge);
        } else {
          const charge = {
            id: charge_list[i].id,
            amount: charge_list[i].amount / 100,
            status: charge_list[i].status,
            description: charge_list[i].description,
            customer: charge_list[i].customer,
            date: charge_list[i].created * 1000,
          };
          data.push(charge);
        }
      }
      return res.send({
        status: true,
        data,
      });
    });
  } else {
    return res.send({
      status: true,
      data: [],
    });
  }
};

module.exports = {
  get,
  create,
  update,
  updateSubscription,
  createCharge,
  createSubscription,
  cancelCustomer,
  getTransactions,
  paymentFailed,
  paymentSucceed,
  updateCustomerEmail,
  cancelSubscription,
  deleteCustomer,
};
