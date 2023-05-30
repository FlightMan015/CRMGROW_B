$( document ).ready(function() {
    const baseURL = 'https://app.crmgrow.com';
    function validateEmail(email) {
        const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,4}/gim;
        if (email === '' || !re.test(email)) {
            return false;
        }
        return true;
    }

    $("#menu-btn").change(function() {
        if (this.checked) {
            $("body").addClass("overflow-hidden");
            $(".header").addClass("active");
        } else {
            $("body").removeClass("overflow-hidden");
            $(".header").removeClass("active");
        }
    });

    $("#signup-button-1").click(function () {
        var email = $("#free-email-1").val();
        if (validateEmail(email)) {
            if ($("#signup-email-error-1").hasClass("show")) {
                $("#signup-email-error-1").removeClass("show");
            }
            window.location.href = `${baseURL}/signup?email=${email}`;
        } else {
            if (!$("#signup-email-error-1").hasClass("show")) {
                $("#signup-email-error-1").addClass("show");
            }
        }
    });
});
