let slickInited = true;
$('.highlights').slick({
  // normal options...
  dots: true,
  slidesToShow: 3,
  infinite: true,

  // the magic
  responsive: [
    {
      breakpoint: 768,
      settings: {
        slidesToShow: 2,
        vertical: false,
      },
    },
  ],
});

$(document).ready(function(e){
  let loc = location.href;
  if(loc.indexOf('test') !== -1) {
    $('.watched-time').addClass("testing");
  };
})

jQuery(window).on('resize', () => { initSlick()});

const initSlick = () => {
  var viewportWidth = jQuery(window).width();

  if (viewportWidth < 481) {
    if(slickInited) {
      $('.highlights').slick('unslick');
      slickInited = false;
    }
  } else {
    if(!slickInited) {
      $('.highlights').slick({
        // normal options...
        dots: true,
        slidesToShow: 3,
        infinite: true,
      
        // the magic
        responsive: [
          {
            breakpoint: 768,
            settings: {
              slidesToShow: 2,
              vertical: false,
            },
          },
        ],
      });
      slickInited = true;
    }
  }
}

initSlick();