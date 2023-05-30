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
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const migrate = async () => {
  const users = await User.find({
    del: false,
  });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    // const admin_automations = await Automation.find({
    //   role: 'admin',
    // });

    const admin_automations = await Automation.find({
      user: user.id,
    });

    for (let j = 0; j < admin_automations.length; j++) {
      const automation = admin_automations[j];

      const { automations } = automation;
      automations.forEach((timeline) => {
        const { action } = timeline;
        if (timeline.action.type === 'send_email_video') {
          action.type = 'email';
          if (action.video) {
            action.videos = [action.video._id];

            if (action.content.indexOf(`{{${action.video._id}}}`) === -1) {
              const material_html = `
                <div><strong>${action.video.title}</strong></div>
                <div>
                  <a href="{{${action.video._id}}}" class="material-object" contenteditable="false">
                    <span contenteditable="false">
                      <img alt="Preview image went something wrong. Please click here" src="${action.video.preview}" width="320" height="176">
                    </span>
                  </a>
                </div>
              `;
              action.content += `<br/><br/>${material_html}`;
            }
          }
          delete action.video;
          delete action.pdf;
          delete action.image;
        }
        if (timeline.action.type === 'send_email_pdf') {
          action.type = 'email';
          if (action.pdf) {
            action.pdfs = [action.pdf._id];

            if (action.content.indexOf(`{{${action.pdf._id}}}`) === -1) {
              const material_html = `
                <div><strong>${action.pdf.title}</strong></div>
                <div>
                  <a href="${action.pdf._id}" class="material-object" contenteditable="false">
                    <span contenteditable="false">
                      <img alt="Preview image went something wrong. Please click here" src="${action.pdf.preview}" width="320" height="176">
                    </span>
                  </a>
                </div>
              `;
              action.content += `<br/><br/>${material_html}`;
            }
          }
          delete action.video;
          delete action.pdf;
          delete action.image;
        }
        if (timeline.action.type === 'send_email_image') {
          action.type = 'email';
          if (action.image) {
            action.images = [action.image._id];

            if (action.content.indexOf(`{{${action.image._id}}}`) === -1) {
              const material_html = `
                <div><strong>${action.image.title}</strong></div>
                <div>
                  <a href="${action.image._id}" class="material-object" contenteditable="false">
                    <span contenteditable="false">
                      <img alt="Preview image went something wrong. Please click here" src="${action.image.preview}" width="320" height="176">
                    </span>
                  </a>
                </div>
              `;
              action.content += `<br/><br/>${material_html}`;
            }
          }
          delete action.video;
          delete action.pdf;
          delete action.image;
        }
        if (timeline.action.type === 'send_text_video') {
          action.type = 'text';
          if (action.video) {
            action.videos = [action.video._id];

            if (action.content.indexOf(`{{${action.video._id}}}`) === -1) {
              const material_text = `{{${action.video._id}}}`;
              action.content += `\n\n${material_text}`;
            }
          }
          delete action.video;
          delete action.pdf;
          delete action.image;
        }
        if (timeline.action.type === 'send_text_pdf') {
          action.type = 'text';
          if (action.pdf) {
            action.pdfs = [action.pdf._id];

            if (action.content.indexOf(`{{${action.pdf._id}}}`) === -1) {
              const material_text = `{{${action.pdf._id}}}`;
              action.content += `\n\n${material_text}`;
            }
          }
          delete action.video;
          delete action.pdf;
          delete action.image;
        }
        if (timeline.action.type === 'send_text_image') {
          action.type = 'text';
          if (action.image) {
            action.images = [action.image._id];

            if (action.content.indexOf(`{{${action.image._id}}}`) === -1) {
              const material_text = `{{${action.image._id}}}`;
              action.content += `\n\n${material_text}`;
            }
          }
          delete action.video;
          delete action.pdf;
          delete action.image;
        }
        if (timeline.condition) {
          if (timeline.condition.case === 'watched_video') {
            timeline.condition.case = 'watched_material';
            if (timeline.watched_video) {
              timeline.watched_materials = [timeline.watched_video];
            }
          }
          if (timeline.condition.case === 'watched_pdf') {
            timeline.condition.case = 'watched_material';
            if (timeline.watched_pdf) {
              timeline.watched_materials = [timeline.watched_pdf];
            }
          }
          if (timeline.condition.case === 'watched_image') {
            timeline.condition.case = 'watched_material';
            if (timeline.watched_image) {
              timeline.watched_materials = [timeline.watched_image];
            }
          }
          delete timeline.watched_video;
          delete timeline.watched_pdf;
          delete timeline.watched_image;
        }
      });

      Automation.updateOne(
        {
          _id: automation.id,
        },
        {
          $set: {
            automations,
          },
        }
      )
        .then(() => {
          console.log('automation updated');
        })
        .catch((err) => {
          console.log('automation update err', err.message);
        });
    }
  }
};

const migrateTest = async () => {
  const automation = await Automation.findOne({
    _id: mongoose.Types.ObjectId('60eb5016b502210014e2a6a5'),
  });

  const { automations } = automation;
  automations.forEach((timeline) => {
    const { action } = timeline;
    if (timeline.action.type === 'send_email_video') {
      action.type = 'email';
      if (action.video) {
        action.videos = [action.video._id];

        if (action.content.indexOf(`{{${action.video._id}}}`) === -1) {
          const material_html = `
            <div><strong>${action.video.title}</strong></div>
            <div>
              <a href="{{${action.video._id}}}" class="material-object" contenteditable="false">
                <span contenteditable="false">
                  <img alt="Preview image went something wrong. Please click here" src="${action.video.preview}" width="320" height="176">
                </span>
              </a>
            </div>
          `;
          action.content += `<br/><br/>${material_html}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.action.type === 'send_email_pdf') {
      action.type = 'email';
      if (action.pdf) {
        action.pdfs = [action.pdf._id];

        if (action.content.indexOf(`{{${action.pdf._id}}}`) === -1) {
          const material_html = `
            <div><strong>${action.pdf.title}</strong></div>
            <div>
              <a href="${action.pdf._id}" class="material-object" contenteditable="false">
                <span contenteditable="false">
                  <img alt="Preview image went something wrong. Please click here" src="${action.pdf.preview}" width="320" height="176">
                </span>
              </a>
            </div>
          `;
          action.content += `<br/><br/>${material_html}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.action.type === 'send_email_image') {
      action.type = 'email';
      if (action.image) {
        action.images = [action.image._id];

        if (action.content.indexOf(`{{${action.image._id}}}`) === -1) {
          const material_html = `
            <div><strong>${action.image.title}</strong></div>
            <div>
              <a href="${action.image._id}" class="material-object" contenteditable="false">
                <span contenteditable="false">
                  <img alt="Preview image went something wrong. Please click here" src="${action.image.preview}" width="320" height="176">
                </span>
              </a>
            </div>
          `;
          action.content += `<br/><br/>${material_html}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.action.type === 'send_text_video') {
      action.type = 'text';
      if (action.video) {
        action.videos = [action.video._id];

        if (action.content.indexOf(`{{${action.video._id}}}`) === -1) {
          const material_text = `{{${action.video._id}}}`;
          action.content += `\n\n${material_text}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.action.type === 'send_text_pdf') {
      action.type = 'text';
      if (action.pdf) {
        action.pdfs = [action.pdf._id];

        if (action.content.indexOf(`{{${action.pdf._id}}}`) === -1) {
          const material_text = `{{${action.pdf._id}}}`;
          action.content += `\n\n${material_text}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.action.type === 'send_text_image') {
      action.type = 'text';
      if (action.image) {
        action.images = [action.image._id];

        if (action.content.indexOf(`{{${action.image._id}}}`) === -1) {
          const material_text = `{{${action.image._id}}}`;
          action.content += `\n\n${material_text}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.condition) {
      if (timeline.condition.case === 'watched_video') {
        timeline.condition.case = 'watched_material';
        if (timeline.watched_video) {
          timeline.watched_materials = [timeline.watched_video];
        }
      }
      if (timeline.condition.case === 'watched_pdf') {
        timeline.condition.case = 'watched_material';
        if (timeline.watched_pdf) {
          timeline.watched_materials = [timeline.watched_pdf];
        }
      }
      if (timeline.condition.case === 'watched_image') {
        timeline.condition.case = 'watched_material';
        if (timeline.watched_image) {
          timeline.watched_materials = [timeline.watched_image];
        }
      }
      delete timeline.watched_video;
      delete timeline.watched_pdf;
      delete timeline.watched_image;
    }
  });

  console.log('automations --- ', automations);
  Automation.updateOne(
    {
      _id: automation.id,
    },
    {
      $set: {
        automations,
      },
    }
  ).catch((err) => {
    console.log('automation update err', err.message);
  });
};

const migrateTimeline = async () => {
  const users = await User.find({
    del: false,
  });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const user_timelines = await TimeLine.find({
      user: user.id,
      status: { $in: ['active', 'pending', 'checking'] },
    });

    for (let j = 0; j < user_timelines.length; j++) {
      const timeline = user_timelines[j];
      const { action } = timeline;
      if (timeline.action.type === 'send_email_video') {
        action.type = 'email';
        if (action.video) {
          action.videos = [action.video._id];

          if (action.content.indexOf(`{{${action.video._id}}}`) === -1) {
            const material_html = `
              <div><strong>${action.video.title}</strong></div>
              <div>
                <a href="{{${action.video._id}}}" class="material-object" contenteditable="false">
                  <span contenteditable="false">
                    <img alt="Preview image went something wrong. Please click here" src="${action.video.preview}" width="320" height="176">
                  </span>
                </a>
              </div>
            `;
            action.content += `<br/><br/>${material_html}`;
          }
        }
        delete action.video;
        delete action.pdf;
        delete action.image;
      }
      if (timeline.action.type === 'send_email_pdf') {
        action.type = 'email';
        if (action.pdf) {
          action.pdfs = [action.pdf._id];

          if (action.content.indexOf(`{{${action.pdf._id}}}`) === -1) {
            const material_html = `
              <div><strong>${action.pdf.title}</strong></div>
              <div>
                <a href="${action.pdf._id}" class="material-object" contenteditable="false">
                  <span contenteditable="false">
                    <img alt="Preview image went something wrong. Please click here" src="${action.pdf.preview}" width="320" height="176">
                  </span>
                </a>
              </div>
            `;
            action.content += `<br/><br/>${material_html}`;
          }
        }
        delete action.video;
        delete action.pdf;
        delete action.image;
      }
      if (timeline.action.type === 'send_email_image') {
        action.type = 'email';
        if (action.image) {
          action.images = [action.image._id];

          if (action.content.indexOf(`{{${action.image._id}}}`) === -1) {
            const material_html = `
              <div><strong>${action.image.title}</strong></div>
              <div>
                <a href="${action.image._id}" class="material-object" contenteditable="false">
                  <span contenteditable="false">
                    <img alt="Preview image went something wrong. Please click here" src="${action.image.preview}" width="320" height="176">
                  </span>
                </a>
              </div>
            `;
            action.content += `<br/><br/>${material_html}`;
          }
        }
        delete action.video;
        delete action.pdf;
        delete action.image;
      }
      if (timeline.action.type === 'send_text_video') {
        action.type = 'text';
        if (action.video) {
          action.videos = [action.video._id];

          if (action.content.indexOf(`{{${action.video._id}}}`) === -1) {
            const material_text = `{{${action.video._id}}}`;
            action.content += `\n\n${material_text}`;
          }
        }
        delete action.video;
        delete action.pdf;
        delete action.image;
      }
      if (timeline.action.type === 'send_text_pdf') {
        action.type = 'text';
        if (action.pdf) {
          action.pdfs = [action.pdf._id];

          if (action.content.indexOf(`{{${action.pdf._id}}}`) === -1) {
            const material_text = `{{${action.pdf._id}}}`;
            action.content += `\n\n${material_text}`;
          }
        }
        delete action.video;
        delete action.pdf;
        delete action.image;
      }
      if (timeline.action.type === 'send_text_image') {
        action.type = 'text';
        if (action.image) {
          action.images = [action.image._id];

          if (action.content.indexOf(`{{${action.image._id}}}`) === -1) {
            const material_text = `{{${action.image._id}}}`;
            action.content += `\n\n${material_text}`;
          }
        }
        delete action.video;
        delete action.pdf;
        delete action.image;
      }
      if (timeline.condition) {
        if (timeline.condition.case === 'watched_video') {
          timeline.condition.case = 'watched_material';
          if (timeline.watched_video) {
            timeline.watched_materials = [timeline.watched_video];
          }
        }
        if (timeline.condition.case === 'watched_pdf') {
          timeline.condition.case = 'watched_material';
          if (timeline.watched_pdf) {
            timeline.watched_materials = [timeline.watched_pdf];
          }
        }
        if (timeline.condition.case === 'watched_image') {
          timeline.condition.case = 'watched_material';
          if (timeline.watched_image) {
            timeline.watched_materials = [timeline.watched_image];
          }
        }
        delete timeline.watched_video;
        delete timeline.watched_pdf;
        delete timeline.watched_image;
      }
      TimeLine.updateOne(
        {
          _id: timeline.id,
        },
        {
          $set: {
            ...timeline,
          },
        }
      )
        .then(() => {
          console.log('updated');
        })
        .catch((err) => {
          console.log('timeline update errr', err.message);
        });
    }
  }
};

const migrateTimelineTest = async () => {
  const timelines = await TimeLine.find({
    contact: mongoose.Types.ObjectId('60e273d089dc480cd80f87d5'),
  });

  for (let i = 0; i < timelines.length; i++) {
    const timeline = timelines[i];
    const { action } = timeline;
    if (timeline.action.type === 'send_email_video') {
      action.type = 'email';
      if (action.video) {
        action.videos = [action.video._id];

        if (action.content.indexOf(`{{${action.video._id}}}`) === -1) {
          const material_html = `
              <div><strong>${action.video.title}</strong></div>
              <div>
                <a href="{{${action.video._id}}}" class="material-object" contenteditable="false">
                  <span contenteditable="false">
                    <img alt="Preview image went something wrong. Please click here" src="${action.video.preview}" width="320" height="176">
                  </span>
                </a>
              </div>
            `;
          action.content += `<br/><br/>${material_html}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.action.type === 'send_email_pdf') {
      action.type = 'email';
      if (action.pdf) {
        action.pdfs = [action.pdf._id];

        if (action.content.indexOf(`{{${action.pdf._id}}}`) === -1) {
          const material_html = `
              <div><strong>${action.pdf.title}</strong></div>
              <div>
                <a href="${action.pdf._id}" class="material-object" contenteditable="false">
                  <span contenteditable="false">
                    <img alt="Preview image went something wrong. Please click here" src="${action.pdf.preview}" width="320" height="176">
                  </span>
                </a>
              </div>
            `;
          action.content += `<br/><br/>${material_html}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.action.type === 'send_email_image') {
      action.type = 'email';
      if (action.image) {
        action.images = [action.image._id];

        if (action.content.indexOf(`{{${action.image._id}}}`) === -1) {
          const material_html = `
              <div><strong>${action.image.title}</strong></div>
              <div>
                <a href="${action.image._id}" class="material-object" contenteditable="false">
                  <span contenteditable="false">
                    <img alt="Preview image went something wrong. Please click here" src="${action.image.preview}" width="320" height="176">
                  </span>
                </a>
              </div>
            `;
          action.content += `<br/><br/>${material_html}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.action.type === 'send_text_video') {
      action.type = 'text';
      if (action.video) {
        action.videos = [action.video._id];

        if (action.content.indexOf(`{{${action.video._id}}}`) === -1) {
          const material_text = `{{${action.video._id}}}`;
          action.content += `\n\n${material_text}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.action.type === 'send_text_pdf') {
      action.type = 'text';
      if (action.pdf) {
        action.pdfs = [action.pdf._id];

        if (action.content.indexOf(`{{${action.pdf._id}}}`) === -1) {
          const material_text = `{{${action.pdf._id}}}`;
          action.content += `\n\n${material_text}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.action.type === 'send_text_image') {
      action.type = 'text';
      if (action.image) {
        action.images = [action.image._id];

        if (action.content.indexOf(`{{${action.image._id}}}`) === -1) {
          const material_text = `{{${action.image._id}}}`;
          action.content += `\n\n${material_text}`;
        }
      }
      delete action.video;
      delete action.pdf;
      delete action.image;
    }
    if (timeline.condition) {
      if (timeline.condition.case === 'watched_video') {
        timeline.condition.case = 'watched_material';
        if (timeline.watched_video) {
          timeline.watched_materials = [timeline.watched_video];
        }
      }
      if (timeline.condition.case === 'watched_pdf') {
        timeline.condition.case = 'watched_material';
        if (timeline.watched_pdf) {
          timeline.watched_materials = [timeline.watched_pdf];
        }
      }
      if (timeline.condition.case === 'watched_image') {
        timeline.condition.case = 'watched_material';
        if (timeline.watched_image) {
          timeline.watched_materials = [timeline.watched_image];
        }
      }
      delete timeline.watched_video;
      delete timeline.watched_pdf;
      delete timeline.watched_image;
    }

    TimeLine.updateOne(
      {
        _id: timeline.id,
      },
      {
        $set: {
          ...timeline,
        },
      }
    ).catch((err) => {
      console.log('timeline update err', err.message);
    });
  }
};

const migrateTimelineRemove = async () => {
  const users = await User.find({
    del: true,
  });

  for (let i = 0; i < users.length; i++) {
    TimeLine.deleteMany({
      user: users[i].id,
    })
      .then(() => {
        console.log('timeline delete');
      })
      .catch((err) => {
        console.log('time line err', err.message);
      });
  }
};

// migrate();
// removeAuatomations();
// migrateTest();
migrateTimeline();
// migrateTimelineTest();
// migrateTimelineRemove();
