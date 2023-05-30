#!/usr/bin/env node

/**
 * Module dependencies.
 */

const debug = require('debug')('myapp:server');
const http = require('http');
const socketIO = require('socket.io');

const mongoose = require('mongoose');
const app = require('../app');
const { setupTracking } = require('../controllers/tracker');
const { setupRecording } = require('../controllers/video');
const { setupExtension } = require('../controllers/extension');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

const { DB_PORT } = require('../config/database');
const { REDIS_ENDPOINT } = require('../config/redis');
const { setupNotification } = require('../helpers/notification');

/**
 * Connect Monogo Database.
 */

mongoose.set('useCreateIndex', true);

mongoose
  .connect(DB_PORT, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connecting to database successful');
  })
  .catch((err) => console.error('Could not connect to mongo DB', err));

/**
 * Create HTTP server.
 */

var server = http.createServer(app);
const io = socketIO(server);
const redis = require('socket.io-redis');

io.adapter(redis({ host: REDIS_ENDPOINT, port: 6379 }));

module.exports.ioObject = io;
/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

setupTracking(io);
setupRecording(io);
setupExtension(io.of('/extension'));
setupNotification(io.of('/application'));

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  console.log('App listening on', bind);
  debug('Listening on ' + bind);
}
