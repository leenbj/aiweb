/*
	Author       :	Themesbazer
	Template Name:	Tdriving - Driving & Language School HTML Template
	Version      :	1.0
	
/***************************************************
==================== JS ======================
****************************************************
01. PRELOADER JS
02. ATTACHMENT IMAGE JS
03.	STICKY HEADER JS
04. MOBILE MENU 
05. SCROLL MENU
06. BACK TO TOP
07. Star Home Slider JS
08. Star Gallery JS
09. Star Client JS
10. Counter JS
11. WOW SCROLL
12. MARQUEE JS
13. HOT DEALS JS
14. LIGHTCASE JS
15. NICE SELECT JS
16. MAILCHAMP JS

****************************************************/

(function ($) {
    "use strict";

    /*--------------------------------------------------------------
		01.	PRELOADER JS
		--------------------------------------------------------------*/
		$(window).on('load', function() { 
			$('.loader').fadeOut();
			$('.atf-preloader').delay(350).fadeOut('slow'); 
		}); 
    /*--------------------------------------------------------------
			PRELOADER JS
		--------------------------------------------------------------*/
	/*--------------------------------------------------------------
		02.	ATTACHMENT IMAGE JS
		--------------------------------------------------------------*/
    var bg = $(".atf_attach_bg");
    bg.css("background-image", function () {
        var attach = "url(" + $(this).data("background") + ")";
        return attach;
    });
    /*--------------------------------------------------------------
		03.	STICKY HEADER JS
		--------------------------------------------------------------*/
    $(window).on("scroll", function () {
        var scroll = $(window).scrollTop();
        if (scroll > 80) {
            $(".atf-sticky-header").addClass("atf-sticky-active");
        } else {
            $(".atf-sticky-header").removeClass("atf-sticky-active");
        }
    });
    /*--------------------------------------------------------------
		04.	MOBILE MENU 
		--------------------------------------------------------------*/
    var atfHamburger = $(".atf-mobile-menu-active > ul").clone();
    var atfHamburgerMenu = $(".atf-hamburger-menu nav");
    atfHamburgerMenu.append(atfHamburger);
    if ($(atfHamburgerMenu).find(".sub-menu").length != 0) {
        $(atfHamburgerMenu).find(".sub-menu").parent().append('<button class="atf-menu-close"><i class="fas fa-chevron-right"></i></button>');
    }

    var atfSidebarMenu = $(".atf-hamburger-menu nav > ul > li button.atf-menu-close, .atf-hamburger-menu nav > ul li.menu-item-children > a");
    $(atfSidebarMenu).on("click", function (e) {
        console.log(e);
        e.preventDefault();
        if (!$(this).parent().hasClass("active")) {
            $(this).parent().addClass("active");
            $(this).siblings(".sub-menu").slideDown();
        } else {
            $(this).siblings(".sub-menu").slideUp();
            $(this).parent().removeClass("active");
        }
    });

    // Hamburger Js
    $(".atf-hamburger-toogle").on("click", function () {
        $(".atf-hamburger").addClass("atf-hamburger-open");
        $(".atf-hamburger-overlay").addClass("atf-hamburger-overlay-open");
    });

    $(".atf-hamburger-close-toggle,.atf-hamburger-overlay").on("click", function () {
        $(".atf-hamburger").removeClass("atf-hamburger-open");
        $(".atf-hamburger-overlay").removeClass("atf-hamburger-overlay-open");
    });

    /*--------------------------------------------------------------
		05.	SCROLL MENU
		--------------------------------------------------------------*/
    function scrollPage() {
        $(".atf-onepage-menu li a").click(function () {
            $(".atf-onepage-menu li a.active").removeClass("active");
            $(this).addClass("active");

            $("html, body")
                .stop()
                .animate(
                    {
                        scrollTop: $($(this).attr("href")).offset().top - 100,
                    },
                    300
                );
            return false;
        });
    }
    scrollPage();
    /*--------------------------------------------------------------
		06.	BACK TO TOP
		--------------------------------------------------------------*/
    $(window).on("scroll", function () {
        var scrolled = $(window).scrollTop();
        if (scrolled > 400) $(".back-to-top").addClass("active");
        if (scrolled < 400) $(".back-to-top").removeClass("active");
    });

    $(".back-to-top").on("click", function () {
        $("html, body").animate(
            {
                scrollTop: "0",
            },
            50
        );
    });
	/* --------------------------------------------------------
		07.	Star Home Slider JS
		--------------------------------------------------------- */
			$('.atf-slick-slider-1').slick({
				arrows: true,
				autoplay:false,
				dots: false,
				infinite: true,
				speed: 500,
				loop: true,
				fade: true,
				cssEase: 'linear',
				slidesToShow: 1,
				adaptiveHeight: true,
				slidesToScroll: 1,
				prevArrow: '<a class="slick-prev"><i class="fa-solid fa-arrow-left-long" alt="Arrow Icon"></i></a>',
				nextArrow: '<a class="slick-next"><i class="fa-solid fa-arrow-right-long" alt="Arrow Icon"></i></a>',
			});
			

	/* --------------------------------------------------------
		08.	Star Gallery JS
		--------------------------------------------------------- */
		$('.atf__gallery_slider_active').slick({
			arrows: true,
			dots: false,
			autoplay:true,
			infinite: true,
			speed: 300,
			slidesToShow:4,
			slidesToScroll: 1,
			prevArrow: '<a class="slick-prev"><i class="fas fa-arrow-left" alt="Arrow Icon"></i></a>',
			nextArrow: '<a class="slick-next"><i class="fas fa-arrow-right" alt="Arrow Icon"></i></a>',
			responsive: [
				{
					breakpoint: 1200,
					settings: {
						slidesToShow: 4,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 992,
					settings: {
						slidesToShow: 4,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 768,
					settings: {
						slidesToShow: 2,
						slidesToScroll: 1,
						arrows: false,
						dots: true,
					}
				},
				{
					breakpoint: 580,
					settings: {
						arrows: false,
						dots: true,
						slidesToShow: 1,
						slidesToScroll: 1
					}
				}
			]
		});
		
	/* --------------------------------------------------------
		09.	Star Client JS
		--------------------------------------------------------- */
		$('.atf__client_slider_active').slick({
			arrows: true,
			dots: false,
			autoplay:false,
			infinite: true,
			speed: 300,
			slidesToShow:2,
			slidesToScroll: 1,
			prevArrow: '<a class="slick-prev"><i class="fas fa-arrow-left" alt="Arrow Icon"></i></a>',
			nextArrow: '<a class="slick-next"><i class="fas fa-arrow-right" alt="Arrow Icon"></i></a>',
			responsive: [
				{
					breakpoint: 1200,
					settings: {
						slidesToShow: 2,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 992,
					settings: {
						slidesToShow: 2,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 768,
					settings: {
						slidesToShow: 1,
						slidesToScroll: 1,
						arrows: false,
						dots: true,
					}
				},
				{
					breakpoint: 580,
					settings: {
						arrows: false,
						dots: true,
						slidesToShow: 1,
						slidesToScroll: 1
					}
				}
			]
		});
	/* --------------------------------------------------------
		END CLIENT
	--------------------------------------------------------- */
	/* --------------------------------------------------------
		10.	Counter JS
		--------------------------------------------------------- */
	$('.counter-value').counterUp({
		delay: 10,
		time: 1000
	});
    /* --------------------------------------------------------
		11.	WOW SCROLL
		--------------------------------------------------------- */
    var wow = new WOW({
        //disabled for mobile
        mobile: false,
    });

    wow.init();
	/* --------------------------------------------------------
		12.	MARQUEE JS
		--------------------------------------------------------- */
    $("#marqueeLeft").marquee();
	
	/* --------------------------------------------------------
		13.	HOT DEALS JS
		--------------------------------------------------------- */

    function makeTimer() {
        var endTime = new Date("September 30, 2032 17:00:00 PDT");
        var endTime = Date.parse(endTime) / 1000;
        var now = new Date();
        var now = Date.parse(now) / 1000;
        var timeLeft = endTime - now;
        var days = Math.floor(timeLeft / 86400);
        var hours = Math.floor((timeLeft - days * 86400) / 3600);
        var minutes = Math.floor((timeLeft - days * 86400 - hours * 3600) / 60);
        var seconds = Math.floor(timeLeft - days * 86400 - hours * 3600 - minutes * 60);
        if (hours < "10") {
            hours = "0" + hours;
        }
        if (minutes < "10") {
            minutes = "0" + minutes;
        }
        if (seconds < "10") {
            seconds = "0" + seconds;
        }
        $("#atf-days").html(days + "<span>Days</span>");
        $("#atf-hours").html(hours + "<span>Hours</span>");
        $("#atf-minutes").html(minutes + "<span>Minutes</span>");
        $("#atf-seconds").html(seconds + "<span>Seconds</span>");
    }

    setInterval(function () {
        makeTimer();
    }, 0);
    
	
    /* --------------------------------------------------------
		14.	LIGHTCASE JS
		--------------------------------------------------------- */
    $("a[data-rel^=lightcase]").lightcase({
        transition: "elastic" /* none, fade, fadeInline, elastic, scrollTop, scrollRight, scrollBottom, scrollLeft, scrollHorizontal and scrollVertical */,
        swipe: true,
        maxWidth: 1170,
        maxHeight: 600,
    });
    
	
	/* --------------------------------------------------------
		15.	NICE SELECT JS
		--------------------------------------------------------- */
		$('select').niceSelect();
	/* --------------------------------------------------------
		00.	GSAP JS
		--------------------------------------------------------- */

    document.addEventListener("DOMContentLoaded", function () {
        // Split Content animation
        if ($(".split-content").length > 0) {
            let st = $(".split-content");
            if (st.length == 0) return;
            gsap.registerPlugin(SplitText);
            st.each(function (index, el) {
                el.split = new SplitText(el, {
                    type: "lines,words,chars",
                    linesClass: "atf-split-line",
                });
                gsap.set(el, {
                    perspective: 400,
                });
                if ($(el).hasClass("end")) {
                    gsap.set(el.split.chars, {
                        opacity: 0,
                        x: "50",
                        ease: "Back.easeOut",
                    });
                }
                if ($(el).hasClass("start")) {
                    gsap.set(el.split.chars, {
                        opacity: 0,
                        x: "-50",
                        ease: "circ.out",
                    });
                }
                if ($(el).hasClass("up")) {
                    gsap.set(el.split.chars, {
                        opacity: 0,
                        y: "80",
                        ease: "circ.out",
                    });
                }
                if ($(el).hasClass("down")) {
                    gsap.set(el.split.chars, {
                        opacity: 0,
                        y: "-80",
                        ease: "circ.out",
                    });
                }
                el.anim = gsap.to(el.split.chars, {
                    scrollTrigger: {
                        trigger: el,
                        start: "top 90%",
                    },
                    x: "0",
                    y: "0",
                    rotateX: "0",
                    scale: 1,
                    opacity: 1,
                    duration: 0.6,
                    stagger: 0.04,
                });
            });
        }

        // Image spread js
        let revealContainers = document.querySelectorAll(".spread");
        revealContainers.forEach((container) => {
            let image = container.querySelector("img");
            let tl = gsap.timeline({
                scrollTrigger: {
                    trigger: container,
                    toggleActions: "play none none none",
                },
            });

            tl.set(container, {
                autoAlpha: 1,
            });

            if (container.classList.contains("zoom-out")) {
                // Zoom-out effect
                tl.from(image, 1.5, {
                    scale: 1.4,
                    ease: Power2.out,
                });
            } else if (container.classList.contains("start") || container.classList.contains("end")) {
                let xPercent = container.classList.contains("start") ? -100 : 100;
                tl.from(container, 1.5, {
                    xPercent,
                    ease: Power2.out,
                });
                tl.from(image, 1.5, {
                    xPercent: -xPercent,
                    scale: 1,
                    delay: -1.5,
                    ease: Power2.out,
                });
            }
        });
    });
		
   /* --------------------------------------------------------
		16. MAILCHAMP JS
		--------------------------------------------------------- */
	$("#mc-form").ajaxChimp({
		url: "https://themesfamily.us22.list-manage.com/subscribe/post?u=e056d9c3aeb53b20aff997467&amp;id=e307d7e1b8&amp;f_id=0012cee1f0",
		/* Replace Your AjaxChimp Subscription Link */
	});
	
})(jQuery);
