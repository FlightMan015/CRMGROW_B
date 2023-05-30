let hasCapture = false;
let captured = false;
let isTrackMaterial = false;

if ($("#capture-dialog").val() === 'true') {
  hasCapture = true;
}
if($("#activity").val() != 'undefined' && $("#contact").val() != 'undefined') {
  isTrackMaterial = true;
}

$("#contact").change(function(e) {
  console.log("Contact Changed", $(this).val());
})

$(".widget-action.interesting").click(function() {
  if (hasCapture && captured) {
    likeWithContact()  
    // API Update
  }
  if (hasCapture && !captured) {
    $("#interestModal").modal({backdrop: 'static', keyboard: false})
  }
  if (!hasCapture) {
    if (isTrackMaterial) {
      likeWithContact()
    } else {
      $("#interestModal").modal({backdrop: 'static', keyboard: false})
    }
  }
});

function likeWithContact() {
  let contact = $('#contact').val();
  let material = $('#material').val();
  let materialType = $('#material-type').val();
  let user = $('#user').val();
  let activity_id = $('#activity').val();

  $(".widget-action.interesting").addClass('loading');
  $.ajax({
    type: 'POST',
    url: 'api/material/thumbs-up',
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({activity_id}),
    success: function (data) {
      $(".widget-action.interesting").removeClass('loading');
      const response = data.data;
      // TODO: Interested
      showSuccess("SUCCESS", "You gave thumbs up successfully.");
      hideInterested();
      if (response) {
        if(!socket) {
          // var siteAddr = location.protocol + '//' + location.hostname;
          var siteAddr = "http://localhost:3000";
          socket = io.connect(siteAddr);
        }
      }
    },
    error: function (data) {
      $(".widget-action.interesting").removeClass('loading');
      if (data.status == 400) {
        const response = data.responseJSON;
        if (response && response['error']) {
          showError('ERROR', response['error'])
        } else {
          showError('ERROR', 'Internal Server Error')
        }
      } else {
        showError('ERROR', 'Internal Server Error')
      }
    },
  });
}


$('#interest-form').submit((e) => {
  e.preventDefault();
  var formData = $("#interest-form").serializeArray();
  var data = {};
  var material_id;
  formData.forEach((e) => {
    data[e['name']] = e['value'];
    if(e.name === 'material') {
      material_id = e.value;
    }
  });
  let materialType = $('#material-type').val();
  data['materialType'] = materialType;
  data[materialType] = material_id
  $('#interest-form .btn').addClass('loading');
  $('#interest-form .btn').text('Please wait...');

  $.ajax({
    type: 'POST',
    url: 'api/contact/lead',
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify(data),
    success: function (data) {
      const response = data.data;
      // TODO: Interest Completed
      if (response) {
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
        likeWithContact();
      }
      $('#interest-form .btn').removeClass('loading');
      $('#interest-form .btn').text('I\'M INTERESTED');
      $('#interestModal').modal('hide');
      captured = true;
    },
    error: function (data) {
      $('#interest-form .btn').removeClass('loading');
      $('#interest-form .btn').text('I\'M INTERESTED');
      if (data.status == 400) {
        const response = data.responseJSON;
        if (response && response['error']) {
          showError('ERROR', response['error'])
        } else {
          showError('ERROR', 'Internal Server Error')
        }
      } else {
        showError('ERROR', 'Internal Server Error')
      }
    },
  });
})

var share_popup;
$(".share-action.icon").click(function(e) {
  e.preventDefault();
  let href = this.href;
  if(share_popup) {
    share_popup.close();  
  }
  share_popup = window.open(href, '', "width=600, height=400");

  // REGISTER ACTION
  let contact = $("#contact").val();
  if(!contact) {
    return;
  }
  let data = {
    site: $(this).attr("data-media"),
    contact: contact,
  }
  $.ajax({
    type: 'POST',
    url: 'api/contact/share',
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify(data),
    success: function (data) {
      const response = data.data;
      // TODO: Show ALERT
    },
    error: function (data) {
      
    },
  });
});
$(".action.icon").click(function(e) {
  // REGISTER ACTION
  let contact = $("#contact").val();
  if(!contact) {
    return;
  }
  let data = {
    site: $(this).attr("data-media"),
    contact: contact,
  }
  $.ajax({
    type: 'POST',
    url: 'api/contact/share',
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify(data),
    success: function (data) {
      const response = data.data;
      // TODO: Show ALERT
    },
    error: function (data) {
      
    },
  });
});

$(".copy-link").click(function(e) {
  let link = $(".page-link-content").html();
  let el = document.createElement("input");
  el.value = link;
  el.setAttribute('readonly', '');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  el.setSelectionRange(0, 99999)
  document.execCommand("copy");
  document.body.removeChild(el);
  $(this).html("Copied");
  setTimeout(() => {
    $(this).html("Copy Link");
  }, 3000);
});


const showSuccess = (title, message) => {
  $(".toast.success").toast('hide');
  $(".toast.error").toast('hide');
  $(".toast.success .title").html(title);
  $(".toast.success .content").html(message);
  setTimeout(() => {
    $(".toast.success").toast('show');
  }, 1000);
}
const showError = (title, message) => {
  $(".toast.success").toast('hide');
  $(".toast.error").toast('hide');
  $(".toast.error .title").html(title);
  $(".toast.error .content").html(message);
  setTimeout(() => {
    $(".toast.error").toast('show');
  }, 1000);
}

const hideInterested = () => {
  $(".widget-action.interesting").addClass('d-none');
}
const updateInterested = () => {
  $(".widget-action.interesting .icon img").attr('src', './theme/icons/interest_icon.png');
}

const getConvertStatus = () => {
  let material = $('#material').val();
  $.ajax({
    type: 'POST',
    url: 'api/video/convert-status1',
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({videos: [material]}),
    success: function (data) {
      let response = data;
      if(response[material]) {
        let progress = response[material]['progress'];
        let progressBar = document.querySelector(".convertStatus .progress-bar");
        if(progressBar) {
          progressBar.style.width = progress + '%';
        }
        if(progress < 100) {
          setTimeout(() => {
            getConvertStatus();
          }, 3000);
        } else {
          $('.convertStatus').remove();
        }
      }
    },
    error: function (data) {
      
    },
  });
}
let convertStatus = document.querySelector(".convertStatus");
if(convertStatus) {
  getConvertStatus();
}