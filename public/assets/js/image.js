// $(function() {
//   $(".regular").slick({
//     dots: true,
//     infinite: true,
//     speed: 500,
//     adaptiveHeight: true,
//     slidesToShow: 3,
//     cssEase: 'linear'
//   });
// });

(function ($) {
  $(document).ready(() => {
    if ($('.gallery img').length > 1) {
      setTimeout(() => {
        $('.gallery').tjGallery({
          row_min_height: 180,
          margin: 10,
          selector: 'a',
        });
      }, 3000);
    } else {
      $('.gallery img').addClass('single');
    }

    var lightbox = new SimpleLightbox('.gallery a', {
      /* options */
    });
  });
})(jQuery);
