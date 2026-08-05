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
    [".hy-map", "left"],
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
     National-park map

     A port of d3-geo's geoAlbersUsa: a conic equal-area projection for the
     lower 48, with Alaska and Hawaii as separately-parameterised insets, each
     valid only inside its own box. Same constants as tools/gen_us_map.py, which
     generated the state outlines — the two must agree or pins drift off the
     coastline.
     ---------------------------------------------------------------------- */

  var DEG = Math.PI / 180;
  var TAU = Math.PI * 2;

  function conicEqualArea(parallel0, parallel1) {
    var y0 = parallel0 * DEG;
    var sy0 = Math.sin(y0);
    var n = (sy0 + Math.sin(parallel1 * DEG)) / 2;
    var c = 1 + sy0 * (2 * n - sy0);
    var r0 = Math.sqrt(c) / n;

    return function (lambda, phi) {
      var r = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
      var a = lambda * n;
      return [r * Math.sin(a), r0 - r * Math.cos(a)];
    };
  }

  function albers(parallels, rotateLon, center, scale, translate) {
    var raw = conicEqualArea(parallels[0], parallels[1]);
    var deltaLambda = rotateLon * DEG;
    /* d3 takes `center` in post-rotation coordinates, so it is not rotated. */
    var c = raw(center[0] * DEG, center[1] * DEG);
    var dx = translate[0] - scale * c[0];
    var dy = translate[1] + scale * c[1];

    return function (lon, lat) {
      var lambda = lon * DEG + deltaLambda;
      if (lambda > Math.PI) lambda -= TAU;
      else if (lambda < -Math.PI) lambda += TAU;
      var p = raw(lambda, lat * DEG);
      return [dx + scale * p[0], dy - scale * p[1]];
    };
  }

  function albersUsa(scale, translate) {
    var k = scale;
    var x = translate[0];
    var y = translate[1];

    var parts = [
      { project: albers([29.5, 45.5], 96, [-0.6, 38.7], k, [x, y]),
        clip: [x - 0.455 * k, y - 0.238 * k, x + 0.455 * k, y + 0.238 * k] },
      { project: albers([55, 65], 154, [-2, 58.5], k * 0.35, [x - 0.307 * k, y + 0.201 * k]),
        clip: [x - 0.425 * k, y + 0.120 * k, x - 0.214 * k, y + 0.234 * k] },
      { project: albers([8, 18], 157, [-3, 19.9], k, [x - 0.205 * k, y + 0.212 * k]),
        clip: [x - 0.214 * k, y + 0.166 * k, x - 0.115 * k, y + 0.234 * k] }
    ];

    /* Try each sub-projection in turn and keep the first whose box contains the
       result — that is what decides Alaska belongs in the inset. */
    return function (lon, lat) {
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].project(lon, lat);
        var box = parts[i].clip;
        if (p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3]) {
          return p;
        }
      }
      return null;
    };
  }

  /* Pin drawn with its tip at the local origin, so the artwork's bottom edge is
     the point being marked. */
  var PIN_SVG =
    '<svg viewBox="-9 -18.5 18 18.5" aria-hidden="true" focusable="false">' +
      '<circle class="hy-map__pin-halo" cx="0" cy="-9.2" r="7.4"></circle>' +
      '<path class="hy-map__pin-body" d="M0,0C-1.6,-3.2 -5,-5.6 -5,-9.2A5,5 0 1,1 5,-9.2C5,-5.6 1.6,-3.2 0,0Z"></path>' +
      '<circle class="hy-map__pin-dot" cx="0" cy="-9.2" r="2.1"></circle>' +
    '</svg>';

  function buildParkMap() {
    var figure = document.querySelector("[data-hy-map]");
    if (!figure) return;

    var svg = figure.querySelector(".hy-map__svg");
    var layer = figure.querySelector(".hy-map__pins");
    var tip = figure.querySelector(".hy-map__tip");
    var tipName = figure.querySelector(".hy-map__tip-name");
    var tipDates = figure.querySelector(".hy-map__tip-dates");
    if (!svg || !layer || !tip) return;

    var parks;
    try {
      parks = JSON.parse(figure.getAttribute("data-parks") || "[]");
    } catch (e) {
      return;   /* leave the plain map rather than a half-built one */
    }

    var viewBox = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    if (viewBox.length !== 4 || !viewBox[2]) return;

    var project = albersUsa(1070, [480, 250]);
    var anchors = [];
    var locked = null;
    var GAP = 10;    /* px between the pin and the tooltip */
    var EDGE = 6;    /* px the tooltip keeps clear of the panel edge */

    parks.forEach(function (park, index) {
      if (typeof park.lat !== "number" || typeof park.lon !== "number") return;
      var point = project(park.lon, park.lat);
      if (!point) return;

      var label = park.name + (park.dates ? ", visited " + park.dates : "");

      var pin = document.createElement("button");
      pin.type = "button";
      pin.className = "hy-map__pin";
      pin.setAttribute("aria-label", label);
      pin.title = park.name + (park.dates ? " — " + park.dates : "");
      pin.style.setProperty("--i", String(index));
      /* Percentages of the viewBox, so the pin tracks the map as it resizes. */
      pin.style.left = ((point[0] - viewBox[0]) / viewBox[2] * 100).toFixed(3) + "%";
      pin.style.top = ((point[1] - viewBox[1]) / viewBox[3] * 100).toFixed(3) + "%";
      pin.innerHTML = PIN_SVG;

      layer.appendChild(pin);
      anchors.push({ pin: pin, park: park });

      pin.addEventListener("mouseenter", function () {
        if (locked && locked !== pin) return;
        showTip(pin, park);
      });
      pin.addEventListener("mouseleave", function () {
        /* Any locked tooltip owns the display — including one belonging to a
           different pin, so moving the mouse across its neighbours must not
           close it. */
        if (locked) return;
        hideTip();
      });
      pin.addEventListener("focus", function () {
        if (locked && locked !== pin) locked = null;
        showTip(pin, park);
      });
      pin.addEventListener("blur", function () {
        if (locked !== pin) hideTip();
      });

      /* A real <button> already fires click on Enter and Space, so there is no
         key handling to write. Click pins the tooltip open, which is what makes
         this work on touch, where there is no hover. */
      pin.addEventListener("click", function (event) {
        event.stopPropagation();
        if (locked === pin) {
          locked = null;
          hideTip();
        } else {
          locked = pin;
          showTip(pin, park);
        }
      });
    });

    if (!anchors.length) return;

    function showTip(pin, park) {
      /* The active pin is raised with z-index in CSS — no DOM reordering, which
         would blur a keyboard-focused pin and hide the tooltip it just opened. */
      anchors.forEach(function (a) { a.pin.classList.remove("is-active"); });
      pin.classList.add("is-active");

      tipName.textContent = park.name;
      tipDates.textContent = park.dates || "";
      tip.hidden = false;

      var figureBox = figure.getBoundingClientRect();
      var pinBox = pin.getBoundingClientRect();

      /* offsetWidth/Height are layout values, so they ignore the translate
         already on the card from the previous pin — no stale measurement. */
      var width = tip.offsetWidth;
      var height = tip.offsetHeight;

      var pinCentre = pinBox.left + pinBox.width / 2 - figureBox.left;
      var pinTop = pinBox.top - figureBox.top;
      var pinBottom = pinBox.bottom - figureBox.top;

      /* Flip under the pin when there isn't room above — otherwise the card
         escapes the panel and covers the heading, since nothing clips it. */
      var below = pinTop - height - GAP < EDGE;
      var y = below ? pinBottom + GAP : pinTop - GAP - height;

      var left = pinCentre - width / 2;
      var maxLeft = figureBox.width - width - EDGE;
      left = maxLeft < EDGE ? EDGE : Math.min(Math.max(left, EDGE), maxLeft);

      /* The card may have been nudged sideways to stay in the panel, so point
         the arrow at the pin rather than at the card's middle. */
      var arrow = Math.min(Math.max(pinCentre - left, 12), Math.max(width - 12, 12));

      tip.classList.toggle("is-below", below);
      tip.style.setProperty("--tip-arrow", arrow.toFixed(1) + "px");
      tip.style.transform = "translate(" + left.toFixed(1) + "px," + y.toFixed(1) + "px)";
    }

    function hideTip() {
      tip.hidden = true;
      anchors.forEach(function (a) { a.pin.classList.remove("is-active"); });
    }

    /* Pins are positioned in percentages, so resizing needs no relayout — only
       the tooltip's pixel offsets go stale. */
    window.addEventListener("resize", function () {
      if (tip.hidden) return;
      locked = null;
      hideTip();
    });

    document.addEventListener("click", function () {
      locked = null;
      hideTip();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        locked = null;
        hideTip();
      }
    });

    /* Drop the pins in when the map first comes into view. */
    if (!reduceMotion && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          anchors.forEach(function (a) { a.pin.classList.add("hy-map__pin--drop"); });
          io.disconnect();
        });
      }, { threshold: 0.15 });
      io.observe(svg);
    }
  }

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */

  function init() {
    guardGreedyNav();
    buildThemeToggle();
    revealOnScroll();
    buildParkMap();
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
