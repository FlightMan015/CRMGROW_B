const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const child_process = require('child_process');

const getTime = async () => {
  const args = ['-i', '2.webm', '-f', 'null', '-'];

  const ffmpegConvert = child_process.spawn(ffmpegPath, args);
  ffmpegConvert.stderr.on('data', (data) => {
    const content = new Buffer(data).toString();
    console.log('data', content);

    const matches = content.match(/time=(.*?) bitrate/g);

    if (matches && matches.length > 0) {
      let rawTime = matches.pop();
      // needed if there is more than one match
      if (Array.isArray(rawTime)) {
        rawTime = rawTime.pop().replace('time=', '').replace(' bitrate', '');
      } else {
        rawTime = rawTime.replace('time=', '').replace(' bitrate', '');
      }
      // convert rawTime from 00:00:00.00 to seconds.
      const ar = rawTime.split(':').reverse();
      let time = parseFloat(ar[0]);
      if (ar[1]) time += parseInt(ar[1]) * 60;
      if (ar[2]) time += parseInt(ar[2]) * 60 * 60;
      console.log('time*******************', time);
    }
  });
};

getTime();
