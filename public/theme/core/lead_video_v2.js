var deviceType;
var registered_flag = false;
var reported = false;
var socket;
var vPlayer = new Plyr('#player');
var trackingTimes = [];
var startOverlapFlag = false;
var endOverlapFlag = false;
var currentTrackerIndex = 0;
var seek_flag = false;
var watched_time = 0;
var duration = document.querySelector('#duration').value;
var limit = duration
var tracker_id = '';

if(duration > 600) {
  limit = duration - 5
} else {
  limit = duration - 3
}

(function ($) {
  $(document).ready(function () {
    let delayTime = parseInt($('#capture-delay').val());
    let showable = $('#capture-dialog').val();
    if (showable == 'true') {
      if (delayTime) {
        setTimeout(() => {
          if(!captured) {
            // Show The Modal & BackDrop
            $('#leadModal').modal({backdrop: 'static', keyboard: false});
            // Protect the Body Form
            $('body').addClass('is_protected');
            // Pause the Video
            vPlayer.pause();
          }
        }, delayTime * 60000);
      } else {
        $('#leadModal').modal({backdrop: 'static', keyboard: false});
        // Protect the Body Form
        $('body').addClass('is_protected');
      }
    }

    // var cleave = new Cleave('input.phone-info', {
    //   numericOnly: true,
    //   blocks: [0, 3, 3, 4],
    //   delimiters: ['(', ') ', '-'],
    // });

    $('#info-form').submit((e) => {
      e.preventDefault();
      var formData = $('#info-form').serializeArray();
      var data = {};
      formData.forEach((e) => {
        if (e.name == 'tags') {
          data[e['name']] = JSON.parse(e['value']);
        } else {
          data[e['name']] = e['value'];
        }
      });
      $('#info-form .btn').addClass('loading');
      $('#info-form .btn').text('Please wait...');
      $.ajax({
        type: 'POST',
        url: 'api/contact/lead',
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify(data),
        success: function (data) {
          const response = data.data;
          if (response) {
            if(document.querySelector(".intro_video")) {
              document.querySelector(".intro_video").muted = true
              document.querySelector(".intro_video").pause();
            }
            $('#contact').val(response.contact);
            $('#activity').val(response.activity);

            if (!socket || !socket.connected) {
              var siteAddr = location.protocol + '//' + location.hostname;
              if (location.port) {
                siteAddr += (':' + location.port)
              }
              // var siteAddr = 'http://localhost:3000'
              socket = io.connect(siteAddr);
              socket.on('inited_video', (data) => {
                console.log('init Video', data);
                tracker_id = data._id;
              });
            }

            vPlayer.play();
            if(updateInterested) {
              updateInterested();
            }
          }
          $('#info-form .btn').removeClass('loading');
          $('#info-form .btn').text('Submit');
          $('body').removeClass('is_protected');
          $('#leadModal').modal('hide');
          captured = true;
        },
        error: function (data) {
          $('#info-form .btn').removeClass('loading');
          $('#info-form .btn').text('Submit');
          if (data.status == 400) {
            const response = data.responseJSON;
            if (response && response['error']) {
              alert(response['error']);
            } else {
              alert('Internal Server Error');
            }
          } else {
            alert('Internal Server Error');
          }
        },
      });
    });

    $(".quick-video-wrapper .volume-control").click(e => {
      let volumnStatus = document.querySelector(".intro_video").muted;
      document.querySelector(".intro_video").muted = !volumnStatus
      if(volumnStatus) {
        $(".quick-video-wrapper .volume-control img").attr("src", "./theme/icons/mute.png")
      }
      else {
        $(".quick-video-wrapper .volume-control img").attr("src", "./theme/icons/unmute.png")
      }
    })
  });
})(jQuery);

function updateStartTime() {
  let currentTime = vPlayer.currentTime;
  for (let i = 0; i < trackingTimes.length; i++) {
    if (
      trackingTimes[i][0] <= currentTime &&
      currentTime <= trackingTimes[i][1]
    ) {
      currentTrackerIndex = i;
      startOverlapFlag = true;
      return;
    }
  }
  trackingTimes.push([currentTime]);
  currentTrackerIndex = trackingTimes.length - 1;
  startOverlapFlag = false;
}

function updateEndTime() {
  let currentTime = vPlayer.currentTime;
  if (startOverlapFlag == false) {
    // TODO : Can update the start index as current tracker for Better algorithm
    for (let i = 0; i < trackingTimes.length; i++) {
      if (i != currentTrackerIndex && trackingTimes[i][1]) {
        if (
          trackingTimes[i][0] <= currentTime &&
          currentTime <= trackingTimes[i][1] &&
          i != currentTrackerIndex
        ) {
          trackingTimes[currentTrackerIndex][1] = trackingTimes[i][1];
          trackingTimes.splice(i, 1);
          if (i < currentTrackerIndex) {
            currentTrackerIndex--;
          }
          return;
        }
      }
    }
    if (
      trackingTimes[currentTrackerIndex] &&
      trackingTimes[currentTrackerIndex][1] != null &&
      trackingTimes[currentTrackerIndex][1] != undefined
    ) {
      trackingTimes[currentTrackerIndex][1] = currentTime;
    } else if (trackingTimes[currentTrackerIndex]) {
      trackingTimes[currentTrackerIndex].push(currentTime);
    }
  } else {
    if (currentTime <= trackingTimes[currentTrackerIndex][1]) {
      return;
    } else {
      for (let i = 0; i < trackingTimes.length; i++) {
        if (i != currentTrackerIndex && trackingTimes[i][1]) {
          if (
            trackingTimes[i][0] <= currentTime &&
            currentTime <= trackingTimes[i][1] &&
            i != currentTrackerIndex
          ) {
            trackingTimes[currentTrackerIndex][1] = trackingTimes[i][1];
            trackingTimes.splice(i, 1);
            if (i < currentTrackerIndex) {
              currentTrackerIndex--;
            }
            return;
          }
        }
      }
      if (
        trackingTimes[currentTrackerIndex][1] != null &&
        trackingTimes[currentTrackerIndex][1] != undefined
      ) {
        trackingTimes[currentTrackerIndex][1] = currentTime;
      } else if (trackingTimes[currentTrackerIndex]) {
        trackingTimes[currentTrackerIndex].push(currentTime);
      }
    }
  }
}

function reportTime(isEnd = false) {
  var total = 0;
  var start = duration;
  var end = 0;
  trackingTimes.forEach((e) => {
    if (e[1]) {
      total += e[1] - e[0];
      if (e[0] < start) {
        start = e[0];
      }
      if (e[1] > end) {
        end = e[1];
      }
    }
  });
  watched_time = total;
  if (total != 0 && socket) {
    if (watched_time < limit) {
      if (!registered_flag) {
        const video = document.querySelector('#material').value;
        const user = document.querySelector('#user').value;
        const contact = document.querySelector('#contact').value;
        const activity = document.querySelector('#activity').value;
        var report = {
          video,
          user,
          contact,
          activity,
          duration: 0,
          material_last: vPlayer.currentTime
        };
        registered_flag = true;
        socket.emit('init_video', report);
      } else {
        socket.emit('update_video', {
          tracker_id: tracker_id,
          duration: total * 1000,
          material_last: vPlayer.currentTime,
          start: start,
          end: end,
          gap: trackingTimes
        });

        if (isEnd && !reported) {
          socket.emit('close', { mode: 'end_reached' });
        }
      }
    } else {
      if (!reported) {
        let currentTime = vPlayer.currentTime;
        if(currentTime > limit - 2 ) {
          currentTime = 0;
        }
        socket.emit('update_video', {
          tracker_id: tracker_id,
          duration: duration * 1000,
          material_last: currentTime,
          start: start,
          end: end
        });
        socket.emit('close', { mode: 'full_watched' });
        reported = true;
      }
    }
  }
}

vPlayer.on('playing', function () {
  if (seek_flag || watched_time == 0) {
    updateStartTime();
    seek_flag = false;
  }
});

vPlayer.on('timeupdate', function () {
  console.log('timeupdate');
  if (vPlayer.seeking || seek_flag) {
    seek_flag = true;
  } else {
    seek_flag = false;
    updateEndTime();
    reportTime();
  }
});

vPlayer.on('seeking', () => {
  seek_flag = true;
});

vPlayer.on('seeked', () => {
  seek_flag = false;
  updateStartTime();
});

vPlayer.on('ended', (e) => {
  reportTime(true);
});

function initRecord() {
  registered_flag = false;
  reported = false;
  socket = undefined;
  trackingTimes = [];
  startOverlapFlag = false;
  endOverlapFlag = false;
  currentTrackerIndex = 0;
  seek_flag = false;
  watched_time = 0;
}

// Document View and Hide activity
function handleVisibilityChange() {
  if (document.hidden) {
    // Close the Socket on mobile
    if(deviceType === 'mobile') {
      if(socket) {
        socket.emit('close', { mode: 'hide' });
      }
    }
  } else  {
    // Restart the Socket on mobile
    if(deviceType === 'mobile') {
      if (!socket || !socket.connected) {
        initRecord();
        var siteAddr = location.protocol + '//' + location.hostname;
        if (location.port) {
          siteAddr += (':' + location.port)
        }
        socket = io.connect(siteAddr);
        socket.on('inited_video', (data) => {
          tracker_id = data._id;
        });
      }
    }
  }
}


if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
  deviceType = 'mobile'
} else { 
  deviceType = 'desktop'
}

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

function initLoader() {
  var statusWrapper = document.querySelector('.video-status-wrapper');
  if (statusWrapper) {
    statusWrapper.classList.add('active');
  }
}

function deinitLoader(token) {
  if (!token) {
    var statusWrapper = document.querySelector('.video-status-wrapper');
    if (statusWrapper) {
      statusWrapper.classList.remove('active');
    }
    initPlayer();
  }
  const myHeaders = new Headers();
  myHeaders.append('Content-Type', 'application/json');
  myHeaders.append('Authorization', _t);

  fetch('api/video/' + material._id + '?with=true', {
    method: 'GET',
    headers: myHeaders
  }).then((data) => {
    return data.json();
  }).then(res => {
    if (res && res.data) {
      material = {...material, ...res['data']};
      var statusWrapper = document.querySelector('.video-status-wrapper');
      if (statusWrapper) {
        statusWrapper.classList.remove('active');
      }
      initPlayer();
    }
  }).catch((err) => {
  });
}

function updateProgressBar(progress) {
  var progressBar = document.querySelector('.video-status-wrapper .video-progress-inner');
  if (progressBar) {
    progressBar.style.width = progress + '%';
  }
}

let convertCheckingStartTime = null;
let uploadCheckingStartTime = null;
let videoCheckingStatus = '';
let checkPercent = 0;
let _t = '';


initPlayer();

const startUploadCheck = () => {
  videoCheckingStatus = 'Uploading';
  uploadCheckingStartTime = Date.now();
  checkUploadStatus();
};
const continueUploadCheck = () => {
  if (!uploadCheckingStartTime) {
    uploadCheckingStartTime = Date.now();
  }
  const currentTime = Date.now();
  let diff = currentTime - uploadCheckingStartTime;
  if (diff < 300 * 1000) {
    setTimeout(() => {
      checkUploadStatus();
    }, 5000);
  } else {
    // Time over alert
    alert('Please check your network speed. If it is slow, please reload and wait for a while again. Or please contact support team.');
  }
};
const startConvertCheck = () => {
  checkPercent = 30;
  videoCheckingStatus = 'Converting';
  convertCheckingStartTime = Date.now();
  checkConvertStatus();
};
const continueConvertCheck = () => {
  if (!convertCheckingStartTime) {
    convertCheckingStartTime = Date.now();
  }
  const currentTime = Date.now();
  let diff = currentTime - convertCheckingStartTime;
  if (diff < 900 * 1000) {
    setTimeout(() => {
      checkConvertStatus();
    }, 5000);
  } else {
    // Time over alert
    alert('Video optimization seems to be failed. Please contact support team.');
  }
};

const checkUploadStatus = () => {
  if (checkPercent < 30) {
    checkPercent++;
    updateProgressBar(checkPercent);
  }
  const myHeaders = new Headers();
  myHeaders.append('Content-Type', 'application/json');
  myHeaders.append('Authorization', _t);
  const _id = material['_id'];
  fetch('api/video/' + _id, {
    method: 'GET',
    headers: myHeaders
  })
    .then((data) => {
      return data.json();
    })
    .then((res) => {
      if (res['status'] && res['data']) {
        if (res['data']['status'] && res['data']['status']['merged']) {
          if (res['data']['status']['merged']['status']) {
            startConvertCheck();
          } else {
            // Failed Merging: Alert Displaying and contact support team
            alert('Video optimization(step 1) seems to be failed. Please contact support team');
          }
        } else {
          continueUploadCheck();
        }
      } else {
        continueUploadCheck();
      }
    })
    .catch((err) => {
      continueUploadCheck();
    });
};

const checkConvertStatus = () => {
  if (checkPercent < 80) {
    checkPercent++;
    updateProgressBar(checkPercent);
  }
  const myHeaders = new Headers();
  myHeaders.append('Content-Type', 'application/json');
  myHeaders.append('Authorization', _t);
  const _id = material['_id'];
  fetch('api/video/' + _id, {
    method: 'GET',
    headers: myHeaders
  })
    .then((data) => {
      return data.json();
    })
    .then((res) => {
      if (res['status'] && res['data']) {
        if (res['data']['status'] && res['data']['status']['converted']) {
          if (res['data']['status']['converted']['status']) {
            // play the converted video
            deinitLoader();
          } else {
            // Failed Converting: Alert Displaying and contact support team
            alert('Video optimization(step 2) seems to be failed. Please contact support team');
          }
        } else {
          continueConvertCheck();
        }
      } else {
        continueConvertCheck();
      }
    })
    .catch(() => {
      continueConvertCheck();
    });
};

const videoChecker = async () => {
  if (material['type'] === 'youtube' || material['type'] === 'vimeo') {
    // Social Video
  } else if (material['converted'] === 'completed') {
    // Converted Succeess
  } else if (material['is_stream'] || material['is_converted']) {
    // Convert success or streaming success (call checking)
  } else if (material['status'] && material['status']['converted'] && material['status']['converted']['status']) {
    // Convert success
  } else {
    initLoader();
  
    // Token Confirmation
    const url = new URL(location.href);
    const token = url.searchParams.get('token');
    const user = url.searchParams.get('user') || (material.user || material.user._id);
    let cookieSecureStr = await Cookie.get('_video_session_' + user);
    let cookieSecure = null;
    if (cookieSecureStr) {
      try {
        cookieSecure = cookieSecureStr.replace('_video_session_key___', '');
      } catch (err) {
        console.log('cookie convert failed', err);
      }
    }
    if (token) {
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.href);
      // cookie setting with 10 min expire time
      Cookie.set('_video_session_' + user, '_video_session_key__' + token, Date.now() + 600000);
    } else {
      if (cookieSecure) {
        token = cookieSecure;
      }
    }
    if (!token) {
      // alert error
      alert('Sorry. Authorization is failed.')
    } else {
      _t = token;
    }
    // checking status (uploading status && convert status && streaming status)
    if (material['status'] && material['status']['merged']) {
      if (material['status']['merged']['status']) {
        startConvertCheck();
      } else {
        // Failed Merging: Alert Displaying and contact support team
        alert('Video optimization(step 1) seems to be failed. Please contact support team');
      }
    } else {
      startUploadCheck();
    }
  }
}

if (material['type'] === 'youtube' || material['type'] === 'vimeo') {
  deinitLoader();
}

videoChecker();