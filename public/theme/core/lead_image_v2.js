(function($) {
  let lead_opened = false;
  $(document).ready(function() {
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
            contact = response.contact;
            if (contact && activity) {
              $.ajax({
                type: 'POST',
                url: 'api/material/track-image',
                headers: {
                  'Content-Type': 'application/json',
                },
                data: JSON.stringify({ activity_id: activity }),
              });
            }
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
  Galleria.loadTheme('./theme/plugins/galleria/galleria.classic.min.js');

  // Initialize Galleria
  Galleria.run('#galleria');

  $("#galleria").on("click", ".galleria-stage .galleria-image img", function(e) {
    let currentIndex = $("#galleria .galleria-current").html();
    $("#gallery-container a:nth-child(" + currentIndex + ") img").click();
  });

})(jQuery)