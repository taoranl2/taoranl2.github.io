---
layout: archive
title: "Miscellaneous"
permalink: /miscellaneous/
author_profile: true
---

{% include base_path %}

<p class="page__lead">
  I enjoy cooking Chinese food with my friends. Additionally, I have a passion for hiking and
  photography, especially in natural environments. I have had the opportunity to visit several
  national parks, where I capture the beauty of the landscapes through my lens.
</p>

National Parks
======

{% include us-map.html %}

<p>
  <span class="hy-park__count">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px" aria-hidden="true">
      <path d="M3 19l6.2-10.4L13 15l2.4-3.6L21 19z"></path>
    </svg>
    {{ site.data.parks | size }} parks so far
  </span>
</p>

<ul class="hy-park-grid">
{% for park in site.data.parks %}
  <li>
    <div class="hy-park__card">
      <span class="hy-park__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 19l6.2-10.4L13 15l2.4-3.6L21 19z"></path>
          <path d="M7.6 12.2l1.6-1.2 1.4 1"></path>
        </svg>
      </span>
      <span>
        <span class="hy-park__name">{{ park.name }}</span>
        <span class="hy-park__dates">{{ park.dates }}</span>
      </span>
    </div>
  </li>
{% endfor %}
</ul>
