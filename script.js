document.addEventListener('DOMContentLoaded', () => {
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (navMenu.classList.contains('active')) {
          navMenu.classList.remove('active');
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

  const DEFAULTS = {
    daysAhead: 30,
    apiUrl: 'https://api-proxy-revivre.philippe-lubranolavadera.workers.dev/',
    id: '129622',
    pageId: '580895',
    containerId: 'agenda-events',
    fallbackId: 'agenda-fallback',
    summaryId: null,
    requestTimeoutMs: 10000
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

      const key = String(opts.containerId || 'agenda-events');
      if (__inited.has(key)) {
        const last = __lastItems.get(key);
        if (last && opts.summaryId) renderSummary(last, opts);
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
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + Number(opts.daysAhead || 30));

    const fmt = (d) => d.toISOString().slice(0, 10);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(opts.requestTimeoutMs || 10000));

    const form = new FormData();
    form.append('id', String(opts.id));
    form.append('pageId', String(opts.pageId));
    form.append('start', fmt(start));
    form.append('end', fmt(end));

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
      renderEvents(data, opts);
      renderSummary(data, opts);
    } catch (err) {
      console.warn('Agenda fetch failed:', err);
    }
  }

  function renderEvents(items, opts) {
    if (!Array.isArray(items) || items.length === 0) return;
    const container = document.getElementById(opts.containerId);
    if (!container) return;

    const filtered = items
      .map((it) => {
        const ds = it.date || it.start || it.eventDate || '';
        const t = new Date(ds);
        return Object.assign({}, it, { __ts: isNaN(t) ? null : t.getTime() });
      })
      .filter((it) => it.__ts !== null);

    if (filtered.length === 0) return;
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
    if (!Array.isArray(items) || items.length === 0) return;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const asTime = (it) => {
      const ds = it.date || it.start || it.eventDate || '';
      const d = new Date(ds);
      return isNaN(d) ? null : d;
    };

    const normalized = items
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
      restoreScrollLock();
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

  let __scrollLockPrev = null;
  function applyScrollLock() {
    if (__scrollLockPrev) return;
    const y = window.scrollY || window.pageYOffset || 0;
    __scrollLockPrev = {
      scrollY: y,
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyRight: document.body.style.right,
      bodyWidth: document.body.style.width
    };

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function restoreScrollLock() {
    if (!__scrollLockPrev) return;
    const y = __scrollLockPrev.scrollY || 0;

    document.documentElement.style.overflow = __scrollLockPrev.htmlOverflow;
    document.body.style.overflow = __scrollLockPrev.bodyOverflow;
    document.body.style.position = __scrollLockPrev.bodyPosition;
    document.body.style.top = __scrollLockPrev.bodyTop;
    document.body.style.left = __scrollLockPrev.bodyLeft;
    document.body.style.right = __scrollLockPrev.bodyRight;
    document.body.style.width = __scrollLockPrev.bodyWidth;
    __scrollLockPrev = null;

    window.scrollTo(0, y);
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

    applyScrollLock();
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
