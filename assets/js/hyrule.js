/* ==========================================================================
   Hyrule skin — behaviour layer.
   Runs after main.min.js. Everything here degrades gracefully: with JS off
   the page is still complete and readable.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------------------
     Day / night toggle
     ---------------------------------------------------------------------- */

  function buildThemeToggle() {
    var btn = document.createElement("button");
    btn.className = "hy-theme-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "Switch between day and night");
    btn.innerHTML =
      '<svg class="hy-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
        '<circle cx="12" cy="12" r="4.2"></circle>' +
        '<path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"></path>' +
      '</svg>' +
      '<svg class="hy-icon-moon" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z"></path>' +
      '</svg>';

    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-hy-theme") === "night" ? "day" : "night";
      root.setAttribute("data-hy-theme", next);
      try { localStorage.setItem("hy-theme", next); } catch (e) { /* private mode */ }
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", next === "night" ? "#16202b" : "#fdf7ea");
    });

    document.body.appendChild(btn);
  }

  /* ----------------------------------------------------------------------
     Reset the theme's "greedy nav"

     main.min.js measures the nav once, at parse time, and tucks links into
     the overflow menu when it thinks they don't fit. On loads where that
     measurement happens before layout settles it hides every link — and it
     restores at most one per resize event, popping one entry off its
     `breaks` stack each time. Worse, the runaway recursion described in
     guardGreedyNav() pushes a `breaks` entry per iteration, so `breaks` can
     hold thousands of bogus widths and the nav can never dig itself out.

     So don't nudge it: put the links back, clear `breaks`, and let
     updateNav() re-measure once from a clean state. It then collapses only
     what genuinely doesn't fit.
     ---------------------------------------------------------------------- */

  function settleNav() {
    var nav = document.querySelector(".greedy-nav");
    var visible = document.querySelector(".greedy-nav .visible-links");
    var hidden = document.querySelector(".greedy-nav .hidden-links");
    if (!nav || !visible || !hidden) return;

    /* Measuring against a zero-width viewport is what corrupts the nav in the
       first place — bail and wait for a resize rather than add to the mess. */
    if (!window.innerWidth || !nav.offsetWidth) return;

    /* hidden-links keeps the original order, so appending in order restores it. */
    while (hidden.firstElementChild) {
      visible.appendChild(hidden.firstElementChild);
    }

    if (Array.isArray(window.breaks)) window.breaks.length = 0;

    var btn = nav.querySelector("button");
    if (btn) btn.classList.add("hidden");
    hidden.classList.add("hidden");

    if (typeof window.updateNav === "function") window.updateNav();
  }

  /* main.min.js ends updateNav() with `$vlinks.width() > e && updateNav()`.
     When it measures the nav at zero width — which happens on some loads before
     layout settles — that condition can never become false: every removable
     link is already gone, so the tail call recurses until the stack blows and
     the handler dies mid-run. It's a pre-existing theme bug (reproducible with
     this skin's CSS and fonts stripped out), but the nav is styled here now, so
     guard it. updateNav is a global function declaration, and its own recursive
     call resolves through the global binding — reassigning it redirects that
     call too. */
  function guardGreedyNav() {
    if (typeof window.updateNav !== "function" || window.updateNav.hyGuarded) return;

    var original = window.updateNav;
    var depth = 0;

    function guarded() {
      if (depth > 24) return;   /* far above the ~1-per-link legitimate depth */
      depth++;
      try {
        return original.apply(this, arguments);
      } finally {
        depth--;
      }
    }

    guarded.hyGuarded = true;
    window.updateNav = guarded;
  }

  /* ----------------------------------------------------------------------
     Scroll reveal
     ---------------------------------------------------------------------- */

  function revealOnScroll() {
    var targets = document.querySelectorAll(".hy-reveal");
    if (!targets.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add("is-in"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------------------
     Sparkle burst
     ---------------------------------------------------------------------- */

  var SPARK_COLORS = ["#67e0dc", "#ee6e97", "#d99a2b", "#63a24a", "#8d6fce"];

  function sparkle(x, y, count) {
    if (reduceMotion) return;
    for (var i = 0; i < count; i++) {
      var s = document.createElement("span");
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      var dist = 26 + Math.random() * 46;
      s.className = "hy-spark";
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.background = SPARK_COLORS[i % SPARK_COLORS.length];
      s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      s.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      document.body.appendChild(s);
      window.setTimeout(function (node) {
        return function () { node.remove(); };
      }(s), 800);
    }
  }

  /* ----------------------------------------------------------------------
     Hidden forest sprites

     An original little leaf-hooded character, hidden somewhere on each page.
     Click it for a sparkle; the tally is kept in localStorage.
     ---------------------------------------------------------------------- */

  var SPRITE_SVG =
    '<svg viewBox="0 0 40 40" aria-hidden="true">' +
      '<ellipse cx="20" cy="25" rx="12" ry="11.5" fill="#8bbd6a"/>' +
      '<ellipse cx="20" cy="24" rx="8.4" ry="8" fill="#f4e7c8"/>' +
      '<circle cx="16.9" cy="23" r="1.7" fill="#3f3a2c"/>' +
      '<circle cx="23.1" cy="23" r="1.7" fill="#3f3a2c"/>' +
      '<path d="M18 27.4q2 1.8 4 0" stroke="#3f3a2c" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M20 14.6c4.4 0 7.6-2.6 8.4-6.6-4.6-1-8.4 1.4-8.4 6.6z" fill="#63a24a"/>' +
      '<path d="M20 14.6c-4.4 0-7.6-2.6-8.4-6.6 4.6-1 8.4 1.4 8.4 6.6z" fill="#7cb85f"/>' +
      '<path d="M20 14.6V9.4" stroke="#4a7d38" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>';

  /* Spots are expressed as [selector, corner] so a sprite tucks itself into a
     real element on the page rather than floating at a random offset. */
  var SPOTS = [
    [".hy-section:nth-of-type(1)", "right"],
    [".hy-park-grid", "left"],
    [".pub-list", "right"],
    [".page__content h2", "right"],
    [".page__footer footer", "left"]
  ];

  function placeSprite() {
    var host = null;
    var side = "right";

    for (var i = 0; i < SPOTS.length; i++) {
      var el = document.querySelector(SPOTS[i][0]);
      if (el) { host = el; side = SPOTS[i][1]; break; }
    }
    if (!host) return;

    if (getComputedStyle(host).position === "static") host.style.position = "relative";

    var btn = document.createElement("button");
    btn.className = "hy-sprite";
    btn.type = "button";
    btn.setAttribute("aria-label", "A hidden forest sprite");
    btn.innerHTML = SPRITE_SVG;
    btn.style.top = "-14px";
    btn.style[side] = "-6px";

    btn.addEventListener("click", function (event) {
      if (btn.classList.contains("is-found")) return;
      btn.classList.add("is-found");
      sparkle(event.clientX, event.clientY, 12);
      toast(bumpCount());
    });

    host.appendChild(btn);
  }

  function bumpCount() {
    var n = 1;
    try {
      n = (parseInt(localStorage.getItem("hy-sprites"), 10) || 0) + 1;
      localStorage.setItem("hy-sprites", String(n));
    } catch (e) { /* private mode */ }
    return n;
  }

  var toastTimer;
  function toast(count) {
    var el = document.querySelector(".hy-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "hy-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = "呀哈哈！Found " + count + (count === 1 ? " sprite" : " sprites") + " 🍃";
    /* restart the transition */
    void el.offsetWidth;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-on"); }, 2600);
  }

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */

  function init() {
    guardGreedyNav();
    buildThemeToggle();
    revealOnScroll();
    placeSprite();
    settleNav();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(settleNav);
    }

    /* Re-measure from a clean state on resize too, so the nav recovers from
       any bad measurement instead of restoring one link per resize event.
       settleNav is idempotent, so the extra calls below cost nothing when the
       nav is already correct. */
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(settleNav, 150);
    });

    /* A tab restored in the background can have a zero-size viewport at load,
       which is exactly when settleNav bails. Catch it once it has one. */
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) settleNav();
    });
    [150, 600, 1500].forEach(function (delay) { setTimeout(settleNav, delay); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
