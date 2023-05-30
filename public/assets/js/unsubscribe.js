
(function ($) {
    $(document).ready(function () {
      document.querySelector(".button").addEventListener('click', function(){
        let params = (new URL(document.location)).searchParams;
        let activity = params.get('activity');
 
        $.ajax({
            type: 'GET',
            url: `api/email/unsubscribe/${activity}`,
            headers: {
              'Content-Type': 'application/json',
            },
            success: function (data) {
              $('#unsubscribe-content').removeClass('content-hide');
              $('#subscribe-content').addClass('content-hide');
            },
          });
      }, true);
    })
})(jQuery);