document.addEventListener('DOMContentLoaded', () => {
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  // Nouveau menu mobile (header commun)
  const siteHeader = document.querySelector('.site-header');
  const siteNavToggle = document.querySelector('.site-nav-toggle');
  const siteNav = document.querySelector('.site-nav');

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      if (navMenu) navMenu.classList.toggle('active');
    });
  }

  if (siteHeader && siteNavToggle && siteNav) {
    const setExpanded = (expanded) => {
      siteNavToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };

    setExpanded(false);

    siteNavToggle.addEventListener('click', () => {
      const willOpen = !siteHeader.classList.contains('is-open');
      siteHeader.classList.toggle('is-open');
      setExpanded(willOpen);
    });

    // Ferme au clic sur un lien
    siteNav.addEventListener('click', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      if (siteHeader.classList.contains('is-open')) {
        siteHeader.classList.remove('is-open');
        setExpanded(false);
      }
    });

    // Ferme au clic hors du header
    document.addEventListener('click', (e) => {
      if (!siteHeader.classList.contains('is-open')) return;
      if (siteHeader.contains(e.target)) return;
      siteHeader.classList.remove('is-open');
      setExpanded(false);
    });

    // Ferme avec Escape
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!siteHeader.classList.contains('is-open')) return;
      siteHeader.classList.remove('is-open');
      setExpanded(false);
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Ferme l'ancien menu mobile (si présent)
        if (navMenu && navMenu.classList.contains('active')) {
          navMenu.classList.remove('active');
        }

        // Ferme le nouveau menu mobile (si ouvert)
        const header = document.querySelector('.site-header');
        const toggle = document.querySelector('.site-nav-toggle');
        if (header && header.classList.contains('is-open')) {
          header.classList.remove('is-open');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
      }
    });
  });

  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Merci pour votre intérêt ! (Démo)');
      form.reset();
    });
  });

  window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (!header) return;
    if (window.scrollY > 50) {
      header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    } else {
      header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    }
  });
});

// Agenda (réutilisable sur plusieurs pages)
(function () {
  const __inited = new Set();
  const __lastItems = new Map();
  const __filterState = new Map();

  const DEFAULTS = {
    daysAhead: 30,
    apiUrl: 'https://api-proxy-revivre.philippe-lubranolavadera.workers.dev/',
    id: '129622',
    pageId: '580895',
    containerId: 'agenda-events',
    fallbackId: 'agenda-fallback',
    summaryId: null,
    requestTimeoutMs: 10000,
    cacheTtlMs: 15 * 60 * 1000,
    cacheKeyPrefix: 'revivre:agenda'
  };

  function initAgenda(options) {
    const opts = Object.assign({}, DEFAULTS, options || {});

    const run = () => {
      const container = document.getElementById(opts.containerId);
      if (!container) return;

      const datasetSummary = container.getAttribute('data-agenda-summary');
      if (!opts.summaryId && datasetSummary) {
        opts.summaryId = datasetSummary;
      }

      ensureCityFilterUI(opts);

      const key = String(opts.containerId || 'agenda-events');
      if (__inited.has(key)) {
        const last = __lastItems.get(key);
        if (last !== undefined && opts.summaryId) renderSummary(last, opts);
        return;
      }

      __inited.add(key);
      fetchAgenda(opts);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }

  async function fetchAgenda(opts) {
    const range = getAgendaRange(opts);

    const cached = loadCachedAgenda(opts, range);
    if (cached !== null) {
      __lastItems.set(String(opts.containerId || 'agenda-events'), cached);
      renderEvents(cached, opts);
      renderSummary(cached, opts);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(opts.requestTimeoutMs || 10000));

    const form = new FormData();
    form.append('id', String(opts.id));
    form.append('pageId', String(opts.pageId));
    form.append('start', range.startStr);
    form.append('end', range.endStr);

    try {
      const res = await fetch(String(opts.apiUrl), {
        method: 'POST',
        referrerPolicy: 'origin-when-cross-origin',
        signal: controller.signal,
        body: form
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      __lastItems.set(String(opts.containerId || 'agenda-events'), data);
      saveCachedAgenda(opts, range, data);
      renderEvents(data, opts);
      renderSummary(data, opts);
    } catch (err) {
      console.warn('Agenda fetch failed:', err);
      renderEmptyState(opts);
    }
  }

  function getAgendaRange(opts) {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + Number(opts.daysAhead || 30));

    const fmt = (d) => d.toISOString().slice(0, 10);
    return {
      start,
      end,
      startStr: fmt(start),
      endStr: fmt(end)
    };
  }

  function buildCacheKey(opts, range) {
    const prefix = String(opts.cacheKeyPrefix || 'revivre:agenda');
    const id = String(opts.id || '');
    const pageId = String(opts.pageId || '');
    return `${prefix}:id=${id}:page=${pageId}:start=${range.startStr}:end=${range.endStr}`;
  }

  function loadCachedAgenda(opts, range) {
    const ttl = Number(opts.cacheTtlMs);
    if (!isFinite(ttl) || ttl <= 0) return null;
    if (!('sessionStorage' in window)) return null;

    try {
      const key = buildCacheKey(opts, range);
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const fetchedAt = Number(parsed && parsed.fetchedAt);
      const items = parsed && parsed.items;

      if (!isFinite(fetchedAt) || !Array.isArray(items)) return null;
      if ((Date.now() - fetchedAt) > ttl) return null;

      return items;
    } catch {
      return null;
    }
  }

  function saveCachedAgenda(opts, range, items) {
    const ttl = Number(opts.cacheTtlMs);
    if (!isFinite(ttl) || ttl <= 0) return;
    if (!('sessionStorage' in window)) return;
    if (!Array.isArray(items)) return;

    try {
      const key = buildCacheKey(opts, range);
      const payload = {
        fetchedAt: Date.now(),
        items
      };
      window.sessionStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore quota / privacy mode
    }
  }

  function renderEvents(items, opts) {
    const effective = applyAgendaFilter(items, opts);

    if (!Array.isArray(effective) || effective.length === 0) {
      renderEmptyState(opts);
      return;
    }
    const container = document.getElementById(opts.containerId);
    if (!container) return;

    const filtered = effective
      .map((it) => {
        const ds = it.date || it.start || it.eventDate || '';
        const t = new Date(ds);
        return Object.assign({}, it, { __ts: isNaN(t) ? null : t.getTime() });
      })
      .filter((it) => it.__ts !== null);

    if (filtered.length === 0) {
      renderEmptyState(opts);
      return;
    }
    filtered.sort((a, b) => a.__ts - b.__ts);

    container.innerHTML = '';
    const fallback = document.getElementById(opts.fallbackId);
    if (fallback) fallback.style.display = 'none';

    const cards = filtered.map(buildEventCard);
    if (cards.length > 1) {
      container.appendChild(buildAgendaCarousel(cards));
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid grid-1';
      grid.appendChild(cards[0]);
      container.appendChild(grid);
    }
  }

  function renderSummary(items, opts) {
    if (!opts.summaryId) return;
    const root = document.getElementById(opts.summaryId);
    if (!root) return;

    const effective = applyAgendaFilter(items, opts);
    if (!Array.isArray(effective) || effective.length === 0) return;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const asTime = (it) => {
      const ds = it.date || it.start || it.eventDate || '';
      const d = new Date(ds);
      return isNaN(d) ? null : d;
    };

    const normalized = effective
      .map((it) => ({ it, d: asTime(it) }))
      .filter((x) => x.d);

    const today = normalized.filter((x) => x.d >= startOfToday && x.d < startOfTomorrow);
    const thisMonth = normalized.filter((x) => x.d >= startOfTomorrow && x.d.getMonth() === now.getMonth() && x.d.getFullYear() === now.getFullYear());

    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = normalized.filter((x) => x.d >= nextMonthDate && (x.d.getMonth() === nextMonthDate.getMonth()) && (x.d.getFullYear() === nextMonthDate.getFullYear()));

    root.innerHTML = '';
    root.className = 'grid grid-3';

    root.appendChild(buildSummaryCard("Aujourd'hui", today.map((x) => x.it)));
    root.appendChild(buildSummaryCard('À venir dans le mois', thisMonth.map((x) => x.it)));
    root.appendChild(buildSummaryCard('À venir le mois prochain', nextMonth.map((x) => x.it)));
  }

  function clearSummary(opts) {
    if (!opts.summaryId) return;
    const root = document.getElementById(opts.summaryId);
    if (!root) return;
    root.innerHTML = '';
  }

  function renderEmptyState(opts) {
    const container = document.getElementById(opts.containerId);
    if (container) container.innerHTML = '';

    clearSummary(opts);

    const fallback = document.getElementById(opts.fallbackId);
    if (!fallback) return;

    fallback.style.display = '';
    setFallbackCardContent(fallback, {
      dateLabel: 'Prochainement…',
      title: 'Aucun groupe ou atelier de disponible pour le moment',
      description: 'Les prochains évènements seront annoncés par e-mail très prochainement.'
    });
  }

  function setFallbackCardContent(fallbackRoot, content) {
    const card = fallbackRoot.querySelector('.event-card') || fallbackRoot;

    const dayEl = card.querySelector('.event-date .day');
    const monthEl = card.querySelector('.event-date .month');
    if (dayEl) dayEl.textContent = '';
    if (monthEl) monthEl.textContent = String(content.dateLabel || '');

    const titleEl = card.querySelector('.event-content h3') || card.querySelector('h3');
    if (titleEl) titleEl.textContent = String(content.title || '');

    const infoEls = card.querySelectorAll('.event-content .event-info');
    infoEls.forEach((el) => {
      el.textContent = '';
      el.style.display = 'none';
    });

    const contentRoot = card.querySelector('.event-content') || card;
    let descEl = contentRoot.querySelector('.event-empty-desc');
    if (!descEl) {
      descEl = document.createElement('p');
      descEl.className = 'event-empty-desc';
      contentRoot.appendChild(descEl);
    }
    descEl.textContent = String(content.description || '');
  }

  function ensureCityFilterUI(opts) {
    const container = document.getElementById(opts.containerId);
    if (!container) return;

    const existing = document.getElementById(getCityFilterId(opts));
    if (existing) return;

    const wrap = document.createElement('div');
    wrap.id = getCityFilterId(opts);
    wrap.className = 'agenda-city-filter';

    const label = document.createElement('label');
    label.setAttribute('for', getCitySelectId(opts));
    label.textContent = 'Ville (présentiel)';
    wrap.appendChild(label);

    const select = document.createElement('select');
    select.id = getCitySelectId(opts);
    select.name = 'agenda-city';
    select.setAttribute('aria-label', 'Filtrer les groupes en présentiel par ville');

    const options = [
      { value: '', label: 'Tous les événements' },
      { value: 'toulouse', label: 'Toulouse' },
      { value: 'marseille', label: 'Marseille' },
      { value: 'paris', label: 'Paris' }
    ];
    options.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      select.appendChild(opt);
    });

    const stateKey = String(opts.containerId || 'agenda-events');
    const saved = __filterState.get(stateKey);
    if (saved && typeof saved.city === 'string') {
      select.value = saved.city;
    }

    select.addEventListener('change', () => {
      __filterState.set(stateKey, { city: select.value });
      const items = __lastItems.get(stateKey);
      if (items !== undefined) {
        renderEvents(items, opts);
        renderSummary(items, opts);
      }
    });

    wrap.appendChild(select);
    container.parentNode.insertBefore(wrap, container);
  }

  function getCityFilterId(opts) {
    return `agenda-city-filter-${String(opts.containerId || 'agenda-events')}`;
  }

  function getCitySelectId(opts) {
    return `agenda-city-select-${String(opts.containerId || 'agenda-events')}`;
  }

  function applyAgendaFilter(items, opts) {
    if (!Array.isArray(items)) return items;

    const stateKey = String(opts.containerId || 'agenda-events');
    const city = getSelectedCity(stateKey, opts);
    if (!city) return items;

    const cityLower = String(city).toLowerCase();
    return items.filter((it) => isPresentiel(it) && descriptionHasCity(it, cityLower));
  }

  function getSelectedCity(stateKey, opts) {
    const stored = __filterState.get(stateKey);
    if (stored && typeof stored.city === 'string') return stored.city;

    const select = document.getElementById(getCitySelectId(opts));
    if (select && typeof select.value === 'string') return select.value;
    return '';
  }

  function isPresentiel(it) {
    const title = String((it && (it.title || it.name)) || '').toLowerCase();
    return title.includes('présentiel') || title.includes('presentiel');
  }

  function descriptionHasCity(it, cityLower) {
    const desc = String((it && it.description) || '').toLowerCase();
    return desc.includes(cityLower);
  }

  function buildSummaryCard(title, list) {
    const card = document.createElement('div');
    card.className = 'card card-left';

    const h = document.createElement('h3');
    h.textContent = title;
    card.appendChild(h);

    if (!Array.isArray(list) || list.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'Aucun événement.';
      card.appendChild(p);
      return card;
    }

    const ul = document.createElement('ul');
    list
      .slice(0, 10)
      .forEach((it) => {
        const li = document.createElement('li');
        li.textContent = it.title || it.name || 'Événement';
        ul.appendChild(li);
      });
    card.appendChild(ul);
    return card;
  }

  function buildEventCard(it) {
    const card = document.createElement('div');
    card.className = 'event-card';

    const dateCol = document.createElement('div');
    dateCol.className = 'event-date';

    const day = document.createElement('div');
    day.className = 'day';
    const d = parseDateForDisplay(it.date || it.start || it.eventDate);
    day.textContent = d.day;

    const month = document.createElement('div');
    month.className = 'month';
    month.textContent = d.month;

    if (it.start && it.end) {
      const startDate = new Date(it.start);
      const endDate = new Date(it.end);
      if (!isNaN(startDate) && !isNaN(endDate) && startDate.getHours() !== 0) {
        const options = { hour: '2-digit', minute: '2-digit' };
        const timeStr = startDate.toLocaleTimeString('fr-FR', options) + ' - ' + endDate.toLocaleTimeString('fr-FR', options);
        const timeElem = document.createElement('div');
        timeElem.textContent = timeStr;
        month.appendChild(document.createElement('br'));
        month.appendChild(timeElem);
      }
    }

    dateCol.appendChild(day);
    dateCol.appendChild(month);

    const content = document.createElement('div');
    content.className = 'event-content';

    const title = document.createElement('h3');
    title.textContent = it.title || it.name || 'Événement';

    const info1 = document.createElement('p');
    info1.className = 'event-info';
    info1.textContent = it.location || it.venue || '';

    const info2 = document.createElement('p');
    info2.className = 'event-info';
    info2.textContent = it.time || it.startTime || '';

    const desc = document.createElement('p');
    const fullDesc = normalizeText(it.description || '');
    const MAX_DESC_CHARS = 220;
    const isLong = fullDesc.length > MAX_DESC_CHARS;
    desc.className = 'event-desc';
    desc.textContent = isLong ? (fullDesc.slice(0, MAX_DESC_CHARS).trimEnd() + '…') : fullDesc;

    const signupUrl = normalizeUrl(it && it.buttonUrl);
    if (signupUrl) {
      const signup = document.createElement('a');
      signup.className = 'event-signup';
      signup.href = signupUrl;
      signup.target = '_blank';
      signup.rel = 'noopener noreferrer';
      signup.textContent = "S'inscrire";
      signup.setAttribute('aria-label', "S'inscrire à l'événement");
      card.appendChild(signup);
    }

    content.appendChild(title);
    if (info1.textContent) content.appendChild(info1);
    if (info2.textContent) content.appendChild(info2);
    if (desc.textContent) {
      content.appendChild(desc);

      if (isLong) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'event-more';
        more.textContent = 'Afficher plus…';
        more.addEventListener('click', () => openAgendaModal({
          title: title.textContent,
          date: formatEventDate(it),
          location: info1.textContent,
          time: deriveEventTime(it) || info2.textContent,
          description: fullDesc
        }));
        content.appendChild(more);
      }
    }

    card.appendChild(dateCol);
    card.appendChild(content);
    return card;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      return new URL(raw, window.location.href).toString();
    } catch {
      return '';
    }
  }

  function formatEventDate(it) {
    const ds = it.date || it.start || it.eventDate || '';
    const d = new Date(ds);
    if (isNaN(d)) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('fr-FR', { month: 'long' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  function deriveEventTime(it) {
    if (!(it && it.start && it.end)) return '';
    const startDate = new Date(it.start);
    const endDate = new Date(it.end);
    if (isNaN(startDate) || isNaN(endDate)) return '';
    if (startDate.getHours() === 0 && startDate.getMinutes() === 0) return '';
    const options = { hour: '2-digit', minute: '2-digit' };
    return startDate.toLocaleTimeString('fr-FR', options) + ' - ' + endDate.toLocaleTimeString('fr-FR', options);
  }

  function ensureAgendaModal() {
    let root = document.getElementById('agenda-modal');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'agenda-modal';
    root.className = 'agenda-modal';
    root.setAttribute('aria-hidden', 'true');

    const dialog = document.createElement('div');
    dialog.className = 'agenda-modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'agenda-modal-title');

    const header = document.createElement('div');
    header.className = 'agenda-modal-header';

    const title = document.createElement('h3');
    title.className = 'agenda-modal-title';
    title.id = 'agenda-modal-title';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'agenda-modal-close';
    close.setAttribute('aria-label', 'Fermer');
    close.textContent = '×';

    const body = document.createElement('div');
    body.className = 'agenda-modal-body';
    body.id = 'agenda-modal-body';

    header.appendChild(title);
    header.appendChild(close);
    dialog.appendChild(header);
    dialog.appendChild(body);
    root.appendChild(dialog);

    function closeModal() {
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
    }

    close.addEventListener('click', closeModal);
    root.addEventListener('click', (e) => {
      if (e.target === root) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (root.classList.contains('is-open') && e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    });

    document.body.appendChild(root);
    return root;
  }

  function openAgendaModal(data) {
    const root = ensureAgendaModal();
    const titleEl = root.querySelector('#agenda-modal-title');
    const bodyEl = root.querySelector('#agenda-modal-body');
    const closeBtn = root.querySelector('.agenda-modal-close');
    if (!titleEl || !bodyEl || !closeBtn) return;

    titleEl.textContent = data.title || 'Événement';
    bodyEl.innerHTML = '';

    const metaParts = [data.date, data.time, data.location].filter(Boolean);
    if (metaParts.length) {
      const meta = document.createElement('p');
      meta.className = 'agenda-modal-meta';
      meta.textContent = metaParts.join(' • ');
      bodyEl.appendChild(meta);
    }

    if (data.description) {
      const p = document.createElement('p');
      p.textContent = data.description;
      bodyEl.appendChild(p);
    }

    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function buildAgendaCarousel(cards) {
    let index = 0;

    const root = document.createElement('div');
    root.className = 'agenda-carousel';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Prochains événements');

    const viewport = document.createElement('div');
    viewport.className = 'agenda-carousel-viewport';

    const track = document.createElement('div');
    track.className = 'agenda-carousel-track';

    const dots = document.createElement('div');
    dots.className = 'agenda-carousel-dots';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'agenda-carousel-btn prev';
    prevBtn.setAttribute('aria-label', 'Événement précédent');
    prevBtn.textContent = '‹';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'agenda-carousel-btn next';
    nextBtn.setAttribute('aria-label', 'Événement suivant');
    nextBtn.textContent = '›';

    const dotButtons = cards.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'agenda-carousel-dot';
      b.setAttribute('aria-label', `Aller à l'événement ${i + 1}`);
      b.addEventListener('click', () => goTo(i));
      dots.appendChild(b);
      return b;
    });

    cards.forEach((card) => {
      const slide = document.createElement('div');
      slide.className = 'agenda-carousel-slide';
      slide.appendChild(card);
      track.appendChild(slide);
    });

    viewport.appendChild(track);
    root.appendChild(prevBtn);
    root.appendChild(nextBtn);
    root.appendChild(viewport);
    root.appendChild(dots);

    function clamp(nextIndex) {
      const len = cards.length;
      return (nextIndex % len + len) % len;
    }

    function update() {
      const w = viewport.clientWidth || 1;
      track.style.transform = `translateX(${-index * w}px)`;
      dotButtons.forEach((b, i) => b.setAttribute('aria-current', i === index ? 'true' : 'false'));
    }

    function goTo(nextIndex) {
      index = clamp(nextIndex);
      update();
    }

    prevBtn.addEventListener('click', () => goTo(index - 1));
    nextBtn.addEventListener('click', () => goTo(index + 1));

    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(index - 1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(index + 1);
      }
    });

    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isSwiping = false;
    }, { passive: true, capture: true });

    viewport.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        isSwiping = true;
        e.preventDefault();
      }
    }, { passive: false, capture: true });

    viewport.addEventListener('touchend', (e) => {
      if (!isSwiping) return;
      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t) return;
      const dx = t.clientX - startX;
      if (dx > 50) goTo(index - 1);
      if (dx < -50) goTo(index + 1);
    }, { passive: true, capture: true });

    new ResizeObserver(() => update()).observe(viewport);
    update();
    return root;
  }

  function parseDateForDisplay(dateStr) {
    if (!dateStr) return { day: '', month: '' };
    const d = new Date(dateStr);
    if (isNaN(d)) return { day: '', month: '' };
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('fr-FR', { month: 'long' });
    return { day, month };
  }

  window.RevivreAgenda = {
    initAgenda
  };

  // Auto-init si la page contient l'emplacement d'agenda.
  initAgenda();
})();
