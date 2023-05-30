(function ($) {
  $('.section.nav .nav-item .nav-link').on('click', function (event) {
    if (this.hash !== '') {
      event.preventDefault();
      var hash = this.hash;
      $('html, body').animate(
        {
          scrollTop: $(hash).offset().top,
        },
        900,
        function () {}
      );
    }
  });
  $('.feature-tab').click(function () {
    $('.feature-tab').removeClass('active');
    $(this).addClass('active');
    const target = $(this).attr('data-target');
    $('.feature-screen').removeClass('show');
    $('#' + target).addClass('show');
  });
})(jQuery);
