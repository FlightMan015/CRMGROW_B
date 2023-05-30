var vPlayer = new Plyr('#player');

let material = window['config'];
function initPlayer() {
  if (material['is_stream'] && material['stream_url']) {
    var fragmentExtension = '.ts';
    const cookieStr = material['stream_url'].split('?')[1];
    var url = 'https://d1lpx38wzlailf.cloudfront.net/streamd/' + material.key + '/' + material.key + '.m3u8?' + cookieStr;
    if (Hls.isSupported()) {
      var originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function() {
          if (arguments[1].endsWith(fragmentExtension)){
              arguments[1] = arguments[1] + '?' + cookieStr;
          }
          originalOpen.apply(this, arguments);
      }
      var video = document.querySelector('#player');
      var hls = new Hls();
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, function () {
        hls.loadSource(url);
        hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
          console.log("manifest loaded, found " + data.levels.length + " quality level");
        });
      });
    } else {
      var baseUrl = 'https://d1lpx38wzlailf.cloudfront.net/streamd/' + config.key + '/';
      var credStr = '?' + cookieStr;
      fetch(url)
        .then((data) => {
          return data.text();
        }).then(data => {
            const fileReg = /([a-zA-Z0-9-]+).ts/gi;
            const files = data.match(fileReg);
            var convertedFile = data;
            files.forEach((e) => {
              convertedFile = convertedFile.replace(e, baseUrl + e + credStr);
            });
            const base64File = 'data:application/vnd.apple.mpegurl;base64,' + btoa(convertedFile);
            var video = document.querySelector('#player');
            if (video) {
              video.src = base64File;
            }
        })
        .catch(err => {
          alert(`Current Video doesn't exist`);
        });
    }
  }
}

initPlayer();