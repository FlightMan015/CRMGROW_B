let pdfObj;
let lead_opened = false;
let totalPages = 0;
var track_id;
var pages = [0];

$(document).ready(function () {
  pdfObj = $("#pdf-container").flipBook({
    pdfUrl: $("#pdfpath").val(),
    lightBox:true,
    lightboxBackground:'rgba(220,225,229,1)',
    onfullscreenenter:function(){
        console.log("onfullscreenenter()")
    },
    onfullscreenexit:function(){
        console.log("onfullscreenexit()")
    },
    onChangePage: function(){
      console.log('update page');
    }
  });
  $(pdfObj).on("pagechange", (e) => {
    totalPages = pdfObj.options.pages.length;
    e.target.cPage.forEach((e) => {
      if (pages.indexOf(e) == -1) {
        pages.push(e);
      }
    });
    if (pages.length == 1) {
      $.ajax({
        type: 'POST',
        url: 'api/material/track-pdf',
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({ activity_id: activity, total_pages: totalPages }),
        success: function(data) {
          const response = data.data;
          if (response) {
            track_id = response;
          }
        }
      });
    } else {
      $.ajax({
        type: 'PUT',
        url: 'api/material/track-pdf-update/' + track_id,
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({ read_pages: pages.length }),
      });
    }
  });


  let delayTime = parseInt($('#capture-delay').val());
  let showable = $('#capture-dialog').val();
  if (showable == 'true') {
    if (delayTime) {
      setTimeout(() => {
        if(!captured) {
          $('#leadModal').modal({backdrop: 'static', keyboard: false});
            // Protect the Body Form
          $('body').addClass('is_protected');
          lead_opened = true;
        }
      }, delayTime * 60000)
    } else {
      $('#leadModal').modal({backdrop: 'static', keyboard: false});
      // Protect the Body Form
      $('body').addClass('is_protected');
      lead_opened = true;
    }
  }

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
          activity = response.activity;
          if(updateInterested) {
            updateInterested();
          }
        }
        $('#info-form .btn').removeClass('loading');
        $('#info-form .btn').text('Submit');
        $('body').removeClass('is_protected');
        $('#leadModal').modal('hide');
        lead_opened = false;
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
        lead_opened = false;
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
})

