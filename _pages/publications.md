---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---

{% include base_path %}

<p class="page__lead">
  &ast; denotes equal contribution. A full list is also on
  <a href="{{ site.author.googlescholar }}">Google Scholar</a>.
</p>

<ul class="pub-list">
{% for paper in site.data.publications %}
  <li>
    <article class="pub-card" style="--pub-accent: var(--hy-{{ paper.accent | default: 'teal' }});">
      <h2 class="pub-card__title">
        {% if paper.url %}<a href="{{ paper.url }}">{{ paper.title }}</a>{% else %}{{ paper.title }}{% endif %}
      </h2>

      <p class="pub-card__authors">{{ paper.authors | markdownify | remove: '<p>' | remove: '</p>' }}</p>

      <div class="pub-card__meta">
        {% if paper.badge %}<span class="pub-badge">{{ paper.badge }}</span>{% endif %}
        {% if paper.pending %}<span class="pub-badge pub-badge--pending">Under review</span>{% endif %}
        {% if paper.venue %}<span class="pub-venue">{{ paper.venue }}</span>{% endif %}
      </div>

      {% if paper.links and paper.links.size > 0 %}
        <div class="pub-card__links">
          {% for link in paper.links %}
            <a class="pub-card__link" href="{{ link.url }}">
              {% if link.icon %}<i class="{{ link.icon }}" aria-hidden="true"></i>{% endif %}{{ link.label }}
            </a>
          {% endfor %}
        </div>
      {% endif %}
    </article>
  </li>
{% endfor %}
</ul>
