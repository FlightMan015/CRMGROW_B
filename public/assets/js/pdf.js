$(function () {
  const pdf_url = document.querySelector('#url').value;
  var total_pages;
  const total = 0;
  const displayControls = (e) => {
    const totalPages = $('#viewer').pdf('getTotalPages');
    total_pages = totalPages;
    $('#viewer').addClass('enable');
    $('.pdf-controls').addClass('enable');
    $('.page-status').addClass('enable');
    $('.page-status .total-page').text(totalPages);
    $(window).resize();
    setTimeout(() => {
      resetHeight();
    }, 500);
  };

  const changeControls = (e) => {
    const currentPage = $('#viewer').pdf('getPageNumber');
    const totalPages = $('#viewer').pdf('getTotalPages');
    if (currentPage === totalPages) {
      $('button.next').hide();
    } else {
      $('button.next').show();
    }

    if (currentPage === 1) {
      $('button.prev').hide();
    } else {
      $('button.prev').show();
    }
    $('.page-status .current-page').text(currentPage);
  };

  const resetHeight = () => {
    // console.log("HEIGHT RESET");
    if ($('#viewer').hasClass('enable')) {
      const pdfDOM = document.querySelector('.pdf-outerdiv');
      const realHeight = window.getComputedStyle(pdfDOM).height;
      const transform = window.getComputedStyle(pdfDOM).transform;
      let scale = transform
        .replace('matrix(', '')
        .replace(')', '')
        .split(',')[0];
      scale = parseFloat(scale);
      scale = scale === 0 ? 1 : scale;
      // console.log(transform);
      document.querySelector('#viewer').style.height =
        parseFloat(realHeight) * scale + 30 + 'px';
    }
  };

  $('.pdf-controls .prev').click(function () {
    $('.pdf-loading').show();
    $('#viewer').pdf('previous');
  });

  $('.pdf-controls .next').click(function () {
    $('.pdf-loading').show();
    $('#viewer').pdf('next');
  });

  $('#viewer').pdf({
    source: pdf_url,
    title: '',
    tabs: [],
    tabsColor: 'beige',
    disableSwipe: false,
    disableLinks: false,
    disableKeys: false,
    loadingHeight: 300,
    loadingWidth: 1000,
    loadingHTML: "<div class='loader'></div>",
    loaded: displayControls,
    changed: changeControls,
  });

  $(window).resize(function () {
    document.querySelector('#viewer').style.height = '';
    setTimeout(() => {
      resetHeight();
    }, 500);
  });
});
