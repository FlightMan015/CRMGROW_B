var registered_flag = false;
var reported = false;
var socket;
// var vPlayer = videojs('material-video');
var vPlayer = new Plyr('#player');
// var timer;
var trackingTimes = [];
var startOverlapFlag = false;
var endOverlapFlag = false;
var currentTrackerIndex = 0;
var seek_flag = false;
var watched_time = 0;
var duration = document.querySelector('#video-duration').value;
let limit = duration
if(duration > 600) {
  limit = duration - 60
}
else {
  limit = duration - 10
}
function updateStartTime() {
  const contact = document.querySelector('#contact').value;
  const activity = document.querySelector('#activity').value;
  if (contact && activity) {
    if (!socket) {
      var siteAddr = location.protocol + '//' + location.hostname;
      socket = io.connect(siteAddr);
    }
  }
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
  // Seeking Check
  // if( trackingTimes[currentTrackerIndex] && trackingTimes[currentTrackerIndex][1] != null && trackingTimes[currentTrackerIndex][1] != undefined && ( trackingTimes[currentTrackerIndex][1] < currentTime - 0.6 || currentTime < trackingTimes[currentTrackerIndex][1]) ) {
  //     return;
  // }

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

function reportTime() {
  var total = 0;
  trackingTimes.forEach((e) => {
    if (e[1]) {
      total += e[1] - e[0];
    }
  });
  watched_time = total;
  if (total != 0 && socket) {
    if (watched_time < limit) {
      if (!registered_flag) {
        const video = document.querySelector('#video').value;
        const user = document.querySelector('#user').value;
        const contact = document.querySelector('#contact').value;
        const activity = document.querySelector('#activity').value;
        var report = {
          video,
          user,
          contact,
          activity,
          duration: 0,
        };
        registered_flag = true;
        socket.emit('init_video', report);
      } else {
        socket.emit('update_video', total * 1000);
      }
    } else {
      if (!reported) {
        socket.emit('update_video', duration * 1000);
        socket.emit('close');
        reported = true;
      }
    }
  }
  let watched_sec = Math.floor(watched_time % 60);
  let watched_min = Math.floor(watched_time / 60);
  let watched_min_s = watched_min < 10 ? '0' + watched_min : watched_min;
  let watched_sec_s = watched_sec < 10 ? '0' + watched_sec : watched_sec;
  if (document.querySelector('.watched-time')) {
    document.querySelector(
      '.watched-time'
    ).innerText = `${watched_min_s}:${watched_sec_s}`;
  }
}

vPlayer.on('playing', function () {
  if (seek_flag || watched_time == 0) {
    updateStartTime();
    seek_flag = false;
  }
});

vPlayer.on('timeupdate', function () {
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

setInterval(() => {
  if (socket && socket.connected) {
    if (document.querySelector('.watched-time')) {
      document.querySelector('.watched-time').classList.add('connected');
    }
  } else {
    if (document.querySelector('.watched-time')) {
      document.querySelector('.watched-time').classList.remove('connected');
    }
  }
}, 1000);
