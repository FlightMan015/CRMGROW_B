const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const system_settings = require('../config/system_settings');
const { PLAY_BUTTON_PATH } = require('../config/path');

const update = async (req, res) => {
  const canvas = createCanvas(400, 220);
  const url = 'https://i.ytimg.com/vi/FkOOTqA5jA4/maxresdefault.jpg';
  const ctx = canvas.getContext('2d');

  const image = await loadImage(url);
  let height = image.height;
  let width = image.width;
  if (height > width) {
    ctx.rect(
      0,
      0,
      system_settings.THUMBNAIL.WIDTH,
      system_settings.THUMBNAIL.HEIGHT
    );
    ctx.fillStyle = '#000000';
    ctx.fill();
    width = (system_settings.THUMBNAIL.HEIGHT * width) / height;
    height = system_settings.THUMBNAIL.HEIGHT;
    ctx.drawImage(image, (250 - width) / 2, 0, width, height);
  } else {
    height = system_settings.THUMBNAIL.HEIGHT;
    width = system_settings.THUMBNAIL.WIDTH;
    ctx.drawImage(image, 0, 0, width, height);
  }

  const play = await loadImage(PLAY_BUTTON_PATH);
  ctx.drawImage(play, 10, 150);
  const buf = canvas.toBuffer();
  fs.writeFileSync('test.png', buf);
};

update();
