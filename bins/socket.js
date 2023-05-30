const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const socket = require('../bin/www');

socket.ioObject
  .of('/extension')
  .to('test123')
  .emit('video_tracked', 'How are You ?');
