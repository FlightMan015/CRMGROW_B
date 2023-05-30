const fs = require('fs');

const readFile = (fileName, options) => {
  return new Promise(function (resolve, reject) {
    var cb = function cb(err, data) {
      if (err) {
        return reject(err);
      }
      resolve(data);
      return false;
    };

    fs.readFile.call(fs, fileName, options, cb);
  });
};

module.exports = {
  readFile,
};
