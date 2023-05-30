const mongoose = require('mongoose');
const User = require('../models/user');
const TimeLine = require('../models/time_line');
const Automation = require('../models/automation');
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => {
    TimeLine.aggregate([
      {
        $group: {
          _id: { automation: '$automation', user: '$user' },
        },
      },
    ]).then((results) => {
        results.forEach(async (item) => {
            try {
                const automation = item._id.automation;
                const user = item._id.user;
                if (automation && user) {
                    const automationDoc = await Automation.findOne({_id: automation, user: user}).catch(err => {
                        console.log('err not found');
                    })
                    if (automationDoc) {
                        // console.log('--------- users ----------', automationDoc._id);
                    } else {
                        const originalAutomation = await Automation.findOne({_id: automation}).catch(err => {
                            console.log('original find error');
                        });
                        if (originalAutomation) {
                            const newAutomationData = {...originalAutomation._doc};
                            delete newAutomationData._id;
                            delete newAutomationData.role;
                            newAutomationData.user = user;
                            const newAutomation = new Automation(newAutomationData);
                            newAutomation.save()
                                .then(_nA => {
                                    console.log('new automation is created', _nA._id, user);
                                    TimeLine.updateMany({automation, user}, {$set: { automation: _nA._id}})
                                        .then(_res => {
                                            console.log('timelines are updated');
                                        })
                                })
                        } else {
                            console.log('not found original', automation, user);
                        }
                    }
                } else {
                    console.log('automation data', item);
                }
            } catch (err) {
                console.log('failed data', item);
            }
        })
    })
  })
  .catch((err) => console.error('Could not connect to mongo DB', err));
