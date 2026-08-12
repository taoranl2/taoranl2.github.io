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

  /* Same boundaries as the pre-paint script in _includes/head/custom.html.
     If you change them, change them in both places. */
  function clockSky() {
    var hour = new Date().getHours();
    if (hour < 5) return "night";
    if (hour < 8) return "dawn";
    if (hour < 17) return "day";
    if (hour < 20) return "dusk";
    return "night";
  }

  function skyState() {
    return root.getAttribute("data-hy-sky") || "day";
  }

  /* ----------------------------------------------------------------------
     Day / night toggle
     ---------------------------------------------------------------------- */

  /* The dock is the one fixed control in the corner: a stamina-style ring that
     tracks reading progress, wrapped around the day/night button so the two
     don't compete for the same corner. */
  function buildDock() {
    var dock = document.createElement("div");
    dock.className = "hy-dock";

    var RADIUS = 25;
    var CIRC = 2 * Math.PI * RADIUS;
    dock.innerHTML =
      '<svg class="hy-stamina" viewBox="0 0 60 60" aria-hidden="true" focusable="false">' +
        '<circle class="hy-stamina__track" cx="30" cy="30" r="' + RADIUS + '"></circle>' +
        '<circle class="hy-stamina__fill" cx="30" cy="30" r="' + RADIUS + '" ' +
          'stroke-dasharray="' + CIRC.toFixed(2) + '" stroke-dashoffset="' + CIRC.toFixed(2) + '"></circle>' +
      '</svg>';

    var fill = dock.querySelector(".hy-stamina__fill");
    var ticking = false;

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      /* A page shorter than the viewport has nothing to track — show it full
         rather than stuck at zero, which would read as "you've read none of it". */
      var progress = scrollable > 8 ? Math.min(Math.max(window.scrollY / scrollable, 0), 1) : 1;
      fill.style.strokeDashoffset = (CIRC * (1 - progress)).toFixed(2);
      dock.classList.toggle("is-full", progress > 0.995);
    }

    function request() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    update();

    document.body.appendChild(dock);
    return dock;
  }

  function buildThemeToggle(dock) {
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
      /* The sky has to follow, or the toggle leaves a night sky over light
         chrome. Going back to light restores whichever daytime sky the
         visitor's own clock says it is. */
      root.setAttribute("data-hy-sky", next === "night" ? "night" : clockSky());
      try { localStorage.setItem("hy-theme", next); } catch (e) { /* private mode */ }
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", next === "night" ? "#201826" : "#fff7fb");
    });

    dock.appendChild(btn);
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

     An original little leaf-hooded character. Six of them are hidden at fixed
     spots across the site; each has a stable id, and the ids you have found are
     kept as a set in localStorage. Storing the set rather than a running count
     is what makes the tally honest — revisiting a page you have already cleared
     can't inflate it.
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

  /* id, where it hides, and which corner it peeks from. Every id must appear on
     exactly one page, or the same sprite could be found twice in one visit. */
  var SPRITE_SPOTS = [
    { id: "hero",     sel: ".hy-hero__inner",        side: "left",  top: "34%" },
    { id: "log",      sel: ".hy-section:last-of-type", side: "right" },
    { id: "about",    sel: ".hy-edu",                side: "left"  },
    { id: "pubs",     sel: ".pub-list",              side: "right" },
    { id: "map",      sel: ".hy-map",                side: "left"  },
    { id: "footer",   sel: ".page__footer footer",   side: "left"  }
  ];

  var SPRITE_TOTAL = SPRITE_SPOTS.length;
  var SPRITE_KEY = "hy-sprites-found";

  function loadFound() {
    try {
      var raw = localStorage.getItem(SPRITE_KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      /* Ignore ids that no longer exist, so removing a spot can't leave the
         counter permanently above the total. */
      return Array.isArray(list) ? list.filter(function (id) {
        return SPRITE_SPOTS.some(function (spot) { return spot.id === id; });
      }) : [];
    } catch (e) { return []; }
  }

  function saveFound(list) {
    try { localStorage.setItem(SPRITE_KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }

  function placeSprites() {
    var found = loadFound();
    var counter = buildSpriteCounter(found.length);

    SPRITE_SPOTS.forEach(function (spot) {
      if (found.indexOf(spot.id) !== -1) return;   /* already caught on a past visit */
      var host = document.querySelector(spot.sel);
      if (!host) return;

      if (getComputedStyle(host).position === "static") host.style.position = "relative";

      var btn = document.createElement("button");
      btn.className = "hy-sprite";
      btn.type = "button";
      btn.setAttribute("aria-label", "A hidden forest sprite — click to catch it");
      btn.innerHTML = SPRITE_SVG;
      btn.style.top = spot.top || "-14px";
      btn.style[spot.side] = "-6px";

      btn.addEventListener("click", function (event) {
        if (btn.classList.contains("is-found")) return;
        btn.classList.add("is-found");

        found = loadFound();
        if (found.indexOf(spot.id) === -1) found.push(spot.id);
        saveFound(found);

        sparkle(event.clientX, event.clientY, 12);
        counter.set(found.length);

        if (found.length >= SPRITE_TOTAL) {
          celebrate();
        } else {
          toast("呀哈哈！ " + found.length + " / " + SPRITE_TOTAL + " 🍃");
        }
      });

      host.appendChild(btn);
    });
  }

  /* A small tally by the dock, shown only once the hunt has started. The chip
     is itself the reset control, so the hunt can be restarted at any point
     rather than only from the completion card. */
  function buildSpriteCounter(initial) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = "hy-tally";
    document.body.appendChild(el);

    var live = document.createElement("div");
    live.className = "screen-reader-text";
    live.setAttribute("role", "status");
    document.body.appendChild(live);

    function set(n) {
      el.innerHTML = '<span class="hy-tally__leaf" aria-hidden="true">' + SPRITE_SVG + '</span>' +
        '<span class="hy-tally__count">' + n + " / " + SPRITE_TOTAL + "</span>" +
        '<span class="hy-tally__reset" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
            'stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M20 11A8 8 0 1 0 18 16.5"></path><polyline points="20 5 20 11 14 11"></polyline>' +
          "</svg></span>";
      el.classList.toggle("is-on", n > 0);
      el.classList.toggle("is-complete", n >= SPRITE_TOTAL);
      el.setAttribute("aria-label",
        "Sprites found: " + n + " of " + SPRITE_TOTAL + ". Activate to hide them all again and start over.");
      el.title = "Hide them all again and start over";
      live.textContent = n + " of " + SPRITE_TOTAL + " sprites found";
    }

    el.addEventListener("click", function () {
      saveFound([]);
      location.reload();
    });

    set(initial);
    return { set: set };
  }

  /* Reward for finding every sprite. */
  function celebrate() {
    var card = document.createElement("div");
    card.className = "hy-cheer";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", "You found every sprite");
    card.innerHTML =
      '<div class="hy-cheer__panel hy-runed">' +
        '<div class="hy-cheer__sprite">' + SPRITE_SVG + '</div>' +
        "<h2>呀哈哈！ All " + SPRITE_TOTAL + " found</h2>" +
        "<p>You combed through every corner of this little world. " +
          "Thanks for wandering so thoroughly.</p>" +
        '<div class="hy-cheer__actions">' +
          '<button class="hy-cheer__close" type="button">Close</button>' +
          '<button class="hy-cheer__reset" type="button">Hide them again</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(card);

    var closeBtn = card.querySelector(".hy-cheer__close");
    closeBtn.focus({ preventScroll: true });

    /* A burst from the middle of the card, then a few stragglers. */
    var box = card.querySelector(".hy-cheer__panel").getBoundingClientRect();
    sparkle(box.left + box.width / 2, box.top + box.height / 2, 18);
    if (!reduceMotion) {
      [180, 380, 620].forEach(function (delay, i) {
        setTimeout(function () {
          sparkle(box.left + (i + 1) * box.width / 4, box.top + box.height / 3, 10);
        }, delay);
      });
    }

    function close() { card.remove(); }
    closeBtn.addEventListener("click", close);
    card.addEventListener("click", function (e) { if (e.target === card) close(); });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    });
    card.querySelector(".hy-cheer__reset").addEventListener("click", function () {
      saveFound([]);
      close();
      location.reload();
    });
  }

  var toastTimer;
  function toast(message) {
    var el = document.querySelector(".hy-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "hy-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
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

  /* ----------------------------------------------------------------------
     Lightbox for the park photos

     Home-grown rather than the theme's magnific-popup: that one is bound at
     document-ready over the links that exist then, and it is styled for the
     stock theme. Thumbnails are <button>s, not <a href="…jpg">, so the theme's
     auto-binding leaves them alone.
     ---------------------------------------------------------------------- */

  var lightbox = null;

  function buildLightbox() {
    if (lightbox) return lightbox;

    var root = document.createElement("div");
    root.className = "hy-lightbox";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Photo viewer");
    root.innerHTML =
      '<button class="hy-lightbox__close" type="button" aria-label="Close photo viewer">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
          '<path d="M6 6l12 12M18 6L6 18"></path></svg></button>' +
      '<button class="hy-lightbox__prev" type="button" aria-label="Previous photo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="15 5 8 12 15 19"></polyline></svg></button>' +
      '<button class="hy-lightbox__next" type="button" aria-label="Next photo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="9 5 16 12 9 19"></polyline></svg></button>' +
      '<figure class="hy-lightbox__figure">' +
        '<img class="hy-lightbox__img" alt="">' +
        '<figcaption class="hy-lightbox__caption"><b></b>' +
          '<span class="hy-lightbox__count"></span></figcaption>' +
      '</figure>';

    document.body.appendChild(root);

    var img = root.querySelector(".hy-lightbox__img");
    var title = root.querySelector(".hy-lightbox__caption b");
    var count = root.querySelector(".hy-lightbox__count");
    var photos = [];
    var index = 0;
    var heading = "";
    var returnFocus = null;

    function render() {
      var photo = photos[index] || {};
      img.src = photo.src || "";
      /* The description stays on the image for screen readers; it is
         deliberately not shown as a visible caption. */
      img.alt = photo.alt || "";
      title.textContent = heading;
      count.textContent = photos.length > 1 ? (index + 1) + " / " + photos.length : "";
      root.classList.toggle("is-single", photos.length < 2);
    }

    function step(delta) {
      if (photos.length < 2) return;
      index = (index + delta + photos.length) % photos.length;
      render();
    }

    function close() {
      root.hidden = true;
      document.documentElement.style.overflow = "";
      img.src = "";
      if (returnFocus && document.contains(returnFocus)) {
        returnFocus.focus({ preventScroll: true });
      }
      returnFocus = null;
    }

    root.querySelector(".hy-lightbox__close").addEventListener("click", close);
    root.querySelector(".hy-lightbox__prev").addEventListener("click", function () { step(-1); });
    root.querySelector(".hy-lightbox__next").addEventListener("click", function () { step(1); });

    /* Clicking the backdrop closes; clicking the photo or a control does not. */
    root.addEventListener("click", function (event) {
      if (event.target === root) close();
    });

    root.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.stopPropagation(); close(); }
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "Tab") {
        /* Keep focus inside the dialog. */
        var focusable = root.querySelectorAll("button");
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    });

    lightbox = {
      open: function (list, startAt, label, opener) {
        photos = list;
        index = startAt || 0;
        heading = label || "";
        returnFocus = opener || null;
        render();
        root.hidden = false;
        /* Stop the page scrolling behind the overlay. */
        document.documentElement.style.overflow = "hidden";
        root.querySelector(".hy-lightbox__close").focus({ preventScroll: true });
      },
      isOpen: function () { return !root.hidden; }
    };
    return lightbox;
  }

  function buildParkMap() {
    var figure = document.querySelector("[data-hy-map]");
    if (!figure) return;

    var svg = figure.querySelector(".hy-map__svg");
    var layer = figure.querySelector(".hy-map__pins");
    var tip = figure.querySelector(".hy-map__tip");
    var tipName = figure.querySelector(".hy-map__tip-name");
    var tipDates = figure.querySelector(".hy-map__tip-dates");
    var shots = figure.querySelector(".hy-map__shots");
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
        cancelHide();
        if (locked && locked !== pin) return;
        showTip(pin, park);
      });
      pin.addEventListener("mouseleave", function () {
        /* Any locked tooltip owns the display — including one belonging to a
           different pin, so moving the mouse across its neighbours must not
           close it. */
        if (locked) return;
        scheduleHide();
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
      renderShots(park, pin);
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

    /* Thumbnails are built fresh per park and given explicit dimensions in CSS,
       so the card's size is final before any image has loaded — the position
       computed in showTip stays correct. */
    function renderShots(park, pin) {
      shots.innerHTML = "";
      var list = park.photos || [];
      tip.classList.toggle("has-photos", list.length > 0);
      if (!list.length) return;

      list.forEach(function (photo, i) {
        if (!photo || !photo.src) return;
        var button = document.createElement("button");
        button.type = "button";
        button.className = "hy-map__shot";
        button.setAttribute("aria-label",
          "Open photo " + (i + 1) + " of " + list.length + " from " + park.name +
          (photo.alt ? ": " + photo.alt : ""));

        var img = document.createElement("img");
        img.src = photo.thumb || photo.src;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        button.appendChild(img);

        button.addEventListener("click", function (event) {
          event.stopPropagation();
          /* Pin the card open: the lightbox returns focus to this button when
             it closes, and focus can't land on a hidden element. */
          cancelHide();
          locked = pin;
          buildLightbox().open(list, i, park.name, button);
        });

        shots.appendChild(button);
      });
    }

    function hideTip() {
      tip.hidden = true;
      tip.classList.remove("has-photos");
      anchors.forEach(function (a) { a.pin.classList.remove("is-active"); });
    }

    /* With photos in the card the pointer has to be able to cross the gap from
       the pin to a thumbnail, so hiding is deferred and cancelled if the
       pointer lands on the card. */
    var hideTimer = null;

    function cancelHide() {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    }

    function scheduleHide() {
      cancelHide();
      hideTimer = setTimeout(function () {
        hideTimer = null;
        if (!locked) hideTip();
      }, 160);
    }

    tip.addEventListener("mouseenter", cancelHide);
    tip.addEventListener("mouseleave", function () { if (!locked) scheduleHide(); });

    /* Pins are positioned in percentages, so resizing needs no relayout — only
       the tooltip's pixel offsets go stale. */
    window.addEventListener("resize", function () {
      if (tip.hidden) return;
      locked = null;
      hideTip();
    });

    /* While the lightbox is up it owns clicks and Escape; tearing the card down
       underneath it would strand the focus it has to return to. */
    document.addEventListener("click", function () {
      if (lightbox && lightbox.isOpen()) return;
      locked = null;
      hideTip();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (lightbox && lightbox.isOpen()) return;
      locked = null;
      hideTip();
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
     Visitor-map widget

     Third-party, and it has been observed returning HTTP 500 with an HTML
     error page in place of its script. The section is hidden in CSS and only
     revealed once the widget has actually put something on the page, so an
     outage costs a heading over empty space rather than looking broken.
     ---------------------------------------------------------------------- */

  function revealVisitorMap() {
    var section = document.querySelector("[data-hy-visitors]");
    var slot = section && section.querySelector("[data-hy-visitors-slot]");
    if (!section || !slot) return;

    /* Watch the slot, which holds nothing but the widget's own script tag.
       Looking at the whole section would be fooled by anything else that adds
       markup inside it — the hidden sprite drops an <svg> into a heading. */
    function rendered() {
      var nodes = slot.getElementsByTagName("*");
      for (var i = 0; i < nodes.length; i++) {
        var tag = nodes[i].tagName;
        if (tag !== "SCRIPT" && tag !== "STYLE") return true;
      }
      return false;
    }

    function check() {
      if (!rendered()) return false;
      section.classList.add("is-live");
      return true;
    }

    if (check()) return;
    if (!("MutationObserver" in window)) return;

    var observer = new MutationObserver(function () {
      if (check()) observer.disconnect();
    });
    observer.observe(slot, { childList: true, subtree: true });

    /* Give it a while, then stop watching rather than observe forever. */
    setTimeout(function () { observer.disconnect(); }, 10000);
  }

  /* ----------------------------------------------------------------------
     Falling petals by day, rising stardust by night
     ---------------------------------------------------------------------- */

  function buildWeather() {
    var hero = document.querySelector(".hy-hero");
    if (!hero || reduceMotion) return;

    var layer = document.createElement("div");
    layer.className = "hy-weather";
    layer.setAttribute("aria-hidden", "true");

    /* Fewer on a phone: the same count on a 375px screen reads as a blizzard,
       and it is the narrow screens that can least afford the compositing. */
    var count = window.innerWidth < 700 ? 9 : window.innerWidth < 1100 ? 14 : 20;

    for (var i = 0; i < count; i++) {
      var bit = document.createElement("span");
      bit.className = "hy-weather__bit";
      bit.style.left = (Math.random() * 100).toFixed(2) + "%";
      bit.style.animationDuration = (9 + Math.random() * 11).toFixed(2) + "s";
      bit.style.animationDelay = (-Math.random() * 16).toFixed(2) + "s";
      bit.style.setProperty("--drift", (Math.random() * 90 - 45).toFixed(0) + "px");
      bit.style.setProperty("--spin", (Math.random() * 540 - 270).toFixed(0) + "deg");
      bit.style.setProperty("--scale", (0.6 + Math.random() * 0.7).toFixed(2));
      layer.appendChild(bit);
    }

    hero.appendChild(layer);
  }

  /* ----------------------------------------------------------------------
     Night sky: twinkling stars and the occasional meteor
     ---------------------------------------------------------------------- */

  function isNight() {
    return skyState() === "night";
  }

  function buildNightSky() {
    var sky = document.querySelector(".hy-sky");
    if (!sky || reduceMotion) return;

    /* Stars are laid out once and simply hidden by day, so toggling the theme
       never has to rebuild them. */
    var count = window.innerWidth < 700 ? 34 : window.innerWidth < 1100 ? 60 : 90;
    var frag = document.createDocumentFragment();

    for (var i = 0; i < count; i++) {
      var star = document.createElement("span");
      star.className = "hy-star";
      star.style.left = (Math.random() * 100).toFixed(2) + "%";
      /* Kept to the upper sky so stars never sit on the hills. */
      star.style.top = (Math.random() * 62).toFixed(2) + "%";
      star.style.setProperty("--size", (1 + Math.random() * 2.2).toFixed(2) + "px");
      star.style.animationDuration = (2.4 + Math.random() * 4).toFixed(2) + "s";
      star.style.animationDelay = (-Math.random() * 6).toFixed(2) + "s";
      star.style.setProperty("--peak", (0.45 + Math.random() * 0.55).toFixed(2));
      frag.appendChild(star);
    }
    sky.appendChild(frag);

    buildFireflies(sky);
    buildConstellations(sky);
    scheduleMeteor(sky);
  }

  /* Fireflies drift between the hills at dusk. Each gets its own wander path
     and blink period so they never move as a group. */
  function buildFireflies(sky) {
    var count = window.innerWidth < 700 ? 6 : 11;
    var frag = document.createDocumentFragment();

    for (var i = 0; i < count; i++) {
      var fly = document.createElement("span");
      fly.className = "hy-fly";
      fly.style.left = (6 + Math.random() * 88).toFixed(2) + "%";
      /* Anchored to the bottom of the sky layer, which sits just above the
         ridges — measuring from the top put them up among the hero text. */
      fly.style.bottom = (Math.random() * 24).toFixed(2) + "%";
      for (var leg = 1; leg <= 3; leg++) {
        fly.style.setProperty("--x" + leg, (Math.random() * 120 - 60).toFixed(0) + "px");
        fly.style.setProperty("--y" + leg, (Math.random() * 70 - 35).toFixed(0) + "px");
      }
      fly.style.animationDuration =
        (16 + Math.random() * 14).toFixed(1) + "s, " + (2.4 + Math.random() * 3).toFixed(1) + "s";
      fly.style.animationDelay =
        (-Math.random() * 20).toFixed(1) + "s, " + (-Math.random() * 5).toFixed(1) + "s";
      frag.appendChild(fly);
    }
    sky.appendChild(frag);
  }

  /* Constellations: as the pointer moves through the star field, the nearest
     stars are joined up, and the lines fade out behind it. */
  function buildConstellations(sky) {
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "hy-constel");
    svg.setAttribute("aria-hidden", "true");
    sky.appendChild(svg);

    var LINES = 5;
    var lines = [];
    for (var i = 0; i < LINES; i++) {
      var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      svg.appendChild(line);
      lines.push(line);
    }

    var stars = [];
    var pending = false;
    var px = 0, py = 0;

    /* Star positions are read once per pointer burst, not per star per move. */
    function measure() {
      var box = sky.getBoundingClientRect();
      stars = Array.prototype.map.call(sky.querySelectorAll(".hy-star"), function (s) {
        var r = s.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      });
    }

    function draw() {
      pending = false;
      if (!stars.length) measure();

      var pool = stars.filter(function (s) {
        var dx = s.x - px, dy = s.y - py;
        return dx * dx + dy * dy < 190 * 190;
      });

      /* Walk nearest-neighbour from the star closest to the pointer. Chaining
         them in order of distance from the pointer instead makes the path
         zig-zag back and forth, which reads as scribble rather than a figure. */
      var path = [];
      if (pool.length > 1) {
        var best = 0;
        pool.forEach(function (s, i) {
          var d = (s.x - px) * (s.x - px) + (s.y - py) * (s.y - py);
          var bd = (pool[best].x - px) * (pool[best].x - px) + (pool[best].y - py) * (pool[best].y - py);
          if (d < bd) best = i;
        });
        var current = pool.splice(best, 1)[0];
        path.push(current);

        while (path.length <= LINES && pool.length) {
          var nearestAt = 0;
          var nearestD = Infinity;
          for (var i = 0; i < pool.length; i++) {
            var ddx = pool[i].x - current.x, ddy = pool[i].y - current.y;
            var dd = ddx * ddx + ddy * ddy;
            if (dd < nearestD) { nearestD = dd; nearestAt = i; }
          }
          current = pool.splice(nearestAt, 1)[0];
          path.push(current);
        }
      }

      lines.forEach(function (line, i) {
        var a = path[i], b = path[i + 1];
        if (!a || !b) { line.classList.remove("is-on"); return; }
        line.setAttribute("x1", a.x.toFixed(1));
        line.setAttribute("y1", a.y.toFixed(1));
        line.setAttribute("x2", b.x.toFixed(1));
        line.setAttribute("y2", b.y.toFixed(1));
        line.classList.add("is-on");
      });
    }

    var hero = sky.parentNode;
    hero.addEventListener("pointermove", function (event) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (skyState() !== "night") return;
      var box = sky.getBoundingClientRect();
      px = event.clientX - box.left;
      py = event.clientY - box.top;
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(draw);
    }, { passive: true });

    hero.addEventListener("pointerleave", function () {
      lines.forEach(function (l) { l.classList.remove("is-on"); });
    });

    /* Positions are percentage-based, so a resize invalidates the cache. */
    window.addEventListener("resize", function () { stars = []; });
  }

  var meteorTimer = null;

  function scheduleMeteor(sky) {
    clearTimeout(meteorTimer);
    /* Random gaps, so meteors feel like luck rather than a metronome. */
    meteorTimer = setTimeout(function () {
      /* Only when it would actually be seen: night, tab visible, hero on screen. */
      if (isNight() && !document.hidden && sky.getBoundingClientRect().bottom > 0) {
        launchMeteor(sky);
      }
      scheduleMeteor(sky);
    }, 3500 + Math.random() * 9000);
  }

  function launchMeteor(sky) {
    var meteor = document.createElement("span");
    meteor.className = "hy-meteor";
    /* Start high and anywhere along the width, then fall down-left. */
    meteor.style.left = (18 + Math.random() * 78).toFixed(1) + "%";
    meteor.style.top = (Math.random() * 34).toFixed(1) + "%";
    meteor.style.setProperty("--len", (110 + Math.random() * 130).toFixed(0) + "px");
    meteor.style.setProperty("--fall", (150 + Math.random() * 170).toFixed(0) + "px");
    meteor.style.animationDuration = (0.75 + Math.random() * 0.55).toFixed(2) + "s";
    sky.appendChild(meteor);
    setTimeout(function () { meteor.remove(); }, 1800);
  }

  /* ----------------------------------------------------------------------
     Hero parallax — layers drift slightly against the pointer
     ---------------------------------------------------------------------- */

  function heroParallax() {
    var hero = document.querySelector(".hy-hero");
    if (!hero || reduceMotion) return;
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    /* depth: how far each layer shifts, in px, at the edge of the hero. */
    var layers = [
      { el: hero.querySelector(".hy-hero__clouds"), depth: 16 },
      { el: hero.querySelector(".hy-hero__aurora"), depth: 11 },
      { el: hero.querySelector(".hy-sky"),          depth: 7 },
      { el: hero.querySelector(".hy-hero__orb"),    depth: 22 },
      { el: hero.querySelector(".hy-hero__scene"),  depth: -9 }
    ].filter(function (l) { return l.el; });
    if (!layers.length) return;

    var pending = false;
    var nx = 0, ny = 0;

    function apply() {
      pending = false;
      layers.forEach(function (l) {
        l.el.style.setProperty("--px", (nx * l.depth).toFixed(1) + "px");
        l.el.style.setProperty("--py", (ny * l.depth * 0.5).toFixed(1) + "px");
      });
    }

    hero.addEventListener("pointermove", function (event) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      var box = hero.getBoundingClientRect();
      if (!box.width || !box.height) return;
      nx = (event.clientX - box.left) / box.width * 2 - 1;   /* -1 .. 1 */
      ny = (event.clientY - box.top) / box.height * 2 - 1;
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(apply);
    }, { passive: true });

    hero.addEventListener("pointerleave", function () {
      nx = 0; ny = 0;
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(apply);
    });
  }

  /* ----------------------------------------------------------------------
     Portrait: wiggles on hover, gets shy when clicked
     ---------------------------------------------------------------------- */

  var HEART_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12 21s-8-5.1-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 15.9 12 21 12 21z"/>' +
    '</svg>';

  function floatHearts(host, n) {
    if (reduceMotion) return;
    for (var i = 0; i < n; i++) {
      var heart = document.createElement("span");
      heart.className = "hy-heart-pop";
      heart.innerHTML = HEART_SVG;
      heart.style.left = (18 + Math.random() * 64) + "%";
      heart.style.animationDelay = (i * 90) + "ms";
      heart.style.setProperty("--dx", (Math.random() * 44 - 22).toFixed(0) + "px");
      host.appendChild(heart);
      window.setTimeout(function (node) {
        return function () { node.remove(); };
      }(heart), 1500 + i * 90);
    }
  }

  function enliven() {
    var avatar = document.querySelector(".hy-avatar");
    if (!avatar) return;

    var busy = false;
    avatar.addEventListener("mouseenter", function () {
      if (busy) return;
      floatHearts(avatar, 3);
    });

    avatar.addEventListener("click", function () {
      if (busy) return;
      busy = true;
      avatar.classList.add("is-shy");
      floatHearts(avatar, 5);
      window.setTimeout(function () {
        avatar.classList.remove("is-shy");
        busy = false;
      }, 900);
    });
  }

  /* ----------------------------------------------------------------------
     Cursor sparkle trail
     ---------------------------------------------------------------------- */

  var STAR_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 1.6l2.6 6.7 6.9.4-5.3 4.4 1.8 6.7-6-3.8-6 3.8 1.8-6.7L2.5 8.7l6.9-.4z"/>' +
    '</svg>';

  function cursorTrail() {
    /* Pointless on touch — there is no cursor to trail — and unkind to anyone
       who asked for less motion. */
    if (reduceMotion) return;
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    var last = { x: 0, y: 0 };
    var pending = null;
    var live = 0;
    var MAX_LIVE = 18;

    function spawn(x, y) {
      if (live >= MAX_LIVE) return;
      live++;
      var star = document.createElement("span");
      star.className = "hy-trail";
      star.innerHTML = STAR_SVG;
      star.style.left = x + "px";
      star.style.top = y + "px";
      star.style.setProperty("--dx", (Math.random() * 26 - 13).toFixed(0) + "px");
      star.style.setProperty("--dy", (10 + Math.random() * 20).toFixed(0) + "px");
      star.style.setProperty("--rot", (Math.random() * 180 - 90).toFixed(0) + "deg");
      star.style.setProperty("--size", (7 + Math.random() * 7).toFixed(1) + "px");
      document.body.appendChild(star);
      window.setTimeout(function () { star.remove(); live--; }, 900);
    }

    window.addEventListener("pointermove", function (event) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      last.x = event.clientX;
      last.y = event.clientY;
      if (pending) return;
      /* One star per frame at most, and only once the pointer has actually
         travelled — otherwise a resting hand keeps emitting. */
      pending = window.requestAnimationFrame(function () {
        pending = null;
        var dx = last.x - spawn.px, dy = last.y - spawn.py;
        if (spawn.px === undefined || dx * dx + dy * dy > 90) {
          spawn(last.x, last.y);
          spawn.px = last.x;
          spawn.py = last.y;
        }
      });
    }, { passive: true });
  }

  /* ----------------------------------------------------------------------
     Konami code
     ---------------------------------------------------------------------- */

  function konami() {
    var SEQ = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
               "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    var at = 0;

    document.addEventListener("keydown", function (event) {
      var key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      at = (key === SEQ[at]) ? at + 1 : (key === SEQ[0] ? 1 : 0);
      if (at < SEQ.length) return;
      at = 0;
      confetti();
      toast("✧ You know the old magic words ✧");
    });
  }

  var CONFETTI_COLORS = ["#e05a92", "#8f6bd0", "#3bb3ae", "#c98016", "#4f9a6f", "#ffa8cd"];

  function confetti() {
    if (reduceMotion) {
      return;
    }
    for (var i = 0; i < 70; i++) {
      var bit = document.createElement("span");
      bit.className = "hy-confetti";
      bit.style.left = (Math.random() * 100).toFixed(2) + "vw";
      bit.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      bit.style.animationDuration = (2.2 + Math.random() * 1.8).toFixed(2) + "s";
      bit.style.animationDelay = (Math.random() * 0.6).toFixed(2) + "s";
      bit.style.setProperty("--drift", (Math.random() * 220 - 110).toFixed(0) + "px");
      bit.style.setProperty("--spin", (Math.random() * 900 - 450).toFixed(0) + "deg");
      if (i % 3 === 0) bit.style.borderRadius = "50%";
      document.body.appendChild(bit);
      window.setTimeout(function (node) {
        return function () { node.remove(); };
      }(bit), 4600);
    }
  }

  /* ----------------------------------------------------------------------
     Footer flower — one petal per sprite found
     ---------------------------------------------------------------------- */

  function buildFlower() {
    var footer = document.querySelector(".page__footer footer");
    if (!footer) return;

    var found = loadFound().length;
    var wrap = document.createElement("div");
    wrap.className = "hy-flower";
    wrap.title = found + " of " + SPRITE_TOTAL + " sprites found";

    var petals = "";
    for (var i = 0; i < SPRITE_TOTAL; i++) {
      var angle = (360 / SPRITE_TOTAL) * i;
      petals +=
        '<ellipse class="hy-flower__petal' + (i < found ? " is-open" : "") + '" ' +
          'cx="0" cy="-15" rx="7" ry="12" ' +
          'transform="rotate(' + angle + ')" style="--i:' + i + '"></ellipse>';
    }

    wrap.innerHTML =
      '<svg viewBox="-34 -34 68 68" aria-hidden="true">' +
        '<g transform="translate(0 2)">' + petals +
          '<circle class="hy-flower__heart" cx="0" cy="0" r="7"></circle>' +
        "</g>" +
      "</svg>" +
      '<span class="hy-flower__label">' + found + " / " + SPRITE_TOTAL + "</span>";

    footer.insertBefore(wrap, footer.firstChild);
  }

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */

  function init() {
    guardGreedyNav();
    buildThemeToggle(buildDock());
    revealOnScroll();
    revealVisitorMap();
    buildParkMap();
    placeSprites();
    buildFlower();
    buildWeather();
    buildNightSky();
    heroParallax();
    enliven();
    cursorTrail();
    konami();
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
