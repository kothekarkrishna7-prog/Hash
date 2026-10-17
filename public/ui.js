/**
 * API Sentinel — Visual UI Enhancements (ui.js)
 * ─────────────────────────────────────────────
 * Purely visual / presentational behaviours.
 * Loaded AFTER app.js. Never touches data flow or core logic.
 *
 * Features:
 *  1. Theme toggle (dark/light) with localStorage + system preference
 *  2. HTTP method colour-coding on the select
 *  3. Tab switching (Headers / Body panels)
 *  4. Copy buttons with ✓ feedback (body + headers + cURL)
 *  5. Empty-state visibility toggle (hide when result appears)
 *  6. Progress ring inside the summary banner
 *  7. Check-chip type-badge colouring
 *  8. Skeleton shimmer while request is in-flight
 *  9. Empty checks hint when no checks are present
 */

(function () {
  'use strict';

  /* ────────────────────────────────────────────
     1. THEME TOGGLE
     ──────────────────────────────────────────── */
  const html = document.documentElement;
  const themeBtn = document.getElementById('theme-toggle');

  const SUN_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`;

  const MOON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`;

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    if (themeBtn) {
      if (theme === 'dark') {
        themeBtn.innerHTML = SUN_SVG;
        themeBtn.title = 'Switch to Light Mode';
        themeBtn.setAttribute('aria-label', 'Switch to Light Mode');
      } else {
        themeBtn.innerHTML = MOON_SVG;
        themeBtn.title = 'Switch to Dark Mode';
        themeBtn.setAttribute('aria-label', 'Switch to Dark Mode');
      }
    }
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('sentinel_theme'); } catch { /* ignore */ }
    const preferred = (saved) || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    applyTheme(preferred);
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('sentinel_theme', next); } catch { /* ignore */ }
    });
  }

  initTheme();

  /* ────────────────────────────────────────────
     2. METHOD COLOUR-CODING
     ──────────────────────────────────────────── */
  const methodSel = document.getElementById('method');
  const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  function updateMethodClass() {
    if (!methodSel) return;
    const m = methodSel.value || 'GET';
    METHODS.forEach(v => methodSel.classList.remove(v));
    methodSel.classList.add(m);
  }

  if (methodSel) {
    methodSel.addEventListener('change', updateMethodClass);
    updateMethodClass();
  }

  /* ────────────────────────────────────────────
     3. TAB SWITCHING
     ──────────────────────────────────────────── */
  const tabHeadersBtn = document.getElementById('tab-headers');
  const tabBodyBtn    = document.getElementById('tab-body');
  const headersPanel  = document.getElementById('headers-panel');
  const bodyPanel     = document.getElementById('body-panel');

  function activateTab(active, inactive, show, hide) {
    active.classList.add('active');
    active.setAttribute('aria-selected', 'true');
    inactive.classList.remove('active');
    inactive.setAttribute('aria-selected', 'false');
    show.classList.remove('hidden-tab');
    hide.classList.add('hidden-tab');
  }

  if (tabHeadersBtn && tabBodyBtn && headersPanel && bodyPanel) {
    tabHeadersBtn.addEventListener('click', () => activateTab(tabHeadersBtn, tabBodyBtn, headersPanel, bodyPanel));
    tabBodyBtn.addEventListener('click',    () => activateTab(tabBodyBtn, tabHeadersBtn, bodyPanel, headersPanel));
  }

  /* ────────────────────────────────────────────
     4. COPY BUTTONS WITH ✓ FEEDBACK
     ──────────────────────────────────────────── */
  function makeCopyButton(btn, getTextFn) {
    if (!btn) return;
    const origHTML = btn.innerHTML;
    btn.addEventListener('click', () => {
      const text = getTextFn();
      if (!text || !text.trim() || text.startsWith('(')) return;
      navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = origHTML;
          btn.classList.remove('copied');
        }, 2000);
      }).catch(() => { /* silent */ });
    });
  }

  const copyBodyBtn    = document.getElementById('btn-copy-body');
  const copyHeadersBtn = document.getElementById('btn-copy-headers');
  const respBodyPre    = document.getElementById('resp-body');
  const respHeadersPre = document.getElementById('resp-headers');

  makeCopyButton(copyBodyBtn,    () => respBodyPre    ? respBodyPre.textContent    : '');
  makeCopyButton(copyHeadersBtn, () => respHeadersPre ? respHeadersPre.textContent : '');

  /* ────────────────────────────────────────────
     5. EMPTY-STATE ↔ RESULT VISIBILITY
     ──────────────────────────────────────────── */
  const resultCard   = document.getElementById('result');
  const emptyCard    = document.getElementById('empty-state-card');

  // Use a MutationObserver so we catch when app.js removes the `hidden` attribute
  if (resultCard && emptyCard) {
    const obs = new MutationObserver(() => {
      const isVisible = !resultCard.hasAttribute('hidden');
      emptyCard.style.display = isVisible ? 'none' : '';
      if (isVisible) {
        resultCard.classList.remove('response-card');
        void resultCard.offsetWidth; // reflow
        resultCard.classList.add('response-card');
        updateProgressRing();
      }
    });
    obs.observe(resultCard, { attributes: true, attributeFilter: ['hidden'] });
  }

  /* ────────────────────────────────────────────
     6. PROGRESS RING in summary banner
     ──────────────────────────────────────────── */
  const summaryEl = document.getElementById('summary');

  /**
   * Parse the summary text (set by app.js) and draw an SVG ring.
   * app.js patterns:
   *  "✓ All N checks passed (100%)"
   *  "✗ F of T checks failed (P% pass rate)"
   *  "No checks configured…"
   */
  function updateProgressRing() {
    if (!summaryEl) return;
    // Remove old ring if any
    const old = summaryEl.querySelector('.summary-ring');
    if (old) old.remove();

    const text = summaryEl.textContent || '';
    let pct = 100;
    let color = '#10b981';

    const failMatch = text.match(/(\d+)%\s+pass rate/);
    const passMatch = text.match(/100%/);

    if (failMatch) {
      pct = parseInt(failMatch[1], 10);
      color = '#ef4444';
    } else if (passMatch) {
      pct = 100;
      color = '#10b981';
    } else {
      return; // no checks or plain message — skip ring
    }

    const r = 9;
    const circ = 2 * Math.PI * r;
    const dash = circ * (pct / 100);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '26');
    svg.setAttribute('height', '26');
    svg.setAttribute('viewBox', '0 0 26 26');
    svg.classList.add('summary-ring');
    svg.setAttribute('aria-hidden', 'true');

    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', '13'); track.setAttribute('cy', '13'); track.setAttribute('r', String(r));
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'rgba(255,255,255,0.12)');
    track.setAttribute('stroke-width', '3');

    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fill.setAttribute('cx', '13'); fill.setAttribute('cy', '13'); fill.setAttribute('r', String(r));
    fill.setAttribute('fill', 'none');
    fill.setAttribute('stroke', color);
    fill.setAttribute('stroke-width', '3');
    fill.setAttribute('stroke-linecap', 'round');
    fill.setAttribute('stroke-dasharray', `${circ}`);
    fill.setAttribute('stroke-dashoffset', `${circ - dash}`);
    fill.setAttribute('transform', 'rotate(-90 13 13)');

    svg.appendChild(track);
    svg.appendChild(fill);
    summaryEl.prepend(svg);
  }

  // Also observe summary text changes (app.js sets innerHTML)
  if (summaryEl) {
    const sumObs = new MutationObserver(updateProgressRing);
    sumObs.observe(summaryEl, { childList: true, subtree: true, characterData: true });
  }

  /* ────────────────────────────────────────────
     7. CHECK CHIP: COLOURED TYPE BADGES
     ──────────────────────────────────────────── */
  const BADGE_CLASS = {
    status:      'badge-status',
    field:       'badge-field',
    'json-valid':'badge-json',
    time:        'badge-time',
    header:      'badge-header'
  };

  const checkListEl = document.getElementById('check-list');

  function styleCheckChips() {
    if (!checkListEl) return;
    checkListEl.querySelectorAll('.check-chip').forEach(chip => {
      if (chip.querySelector('.check-type-badge')) return; // already done

      const desc = chip.querySelector('.check-desc');
      if (!desc) return;

      const strong = desc.querySelector('strong');
      if (!strong) return;
      const rawType = strong.textContent.trim().toLowerCase();
      const cls = BADGE_CLASS[rawType] || 'badge-status';

      const badge = document.createElement('span');
      badge.className = `check-type-badge ${cls}`;
      badge.textContent = strong.textContent.trim();

      strong.style.display = 'none';
      desc.prepend(badge);
    });
    updateChecksEmptyHint();
  }

  /* ────────────────────────────────────────────
     8. SKELETON SHIMMER  (show during in-flight)
     ──────────────────────────────────────────── */
  const sendBtn = document.getElementById('send');

  // Build a skeleton element and insert after the result card
  function createSkeleton() {
    const el = document.createElement('div');
    el.id = 'skeleton-shimmer';
    el.className = 'skeleton-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="skel-line h-24 w-full"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        <div class="skel-line h-24"></div>
        <div class="skel-line h-24"></div>
        <div class="skel-line h-24"></div>
      </div>
      <div class="skel-line w-3-4"></div>
      <div class="skel-line w-full"></div>
      <div class="skel-line w-1-2"></div>
    `;
    return el;
  }

  let skeletonEl = null;

  function showSkeleton() {
    if (skeletonEl) return;
    if (!resultCard) return;
    skeletonEl = createSkeleton();
    resultCard.parentElement.insertBefore(skeletonEl, resultCard);
    skeletonEl.classList.add('active');
  }
  function hideSkeleton() {
    if (skeletonEl) { skeletonEl.remove(); skeletonEl = null; }
  }

  if (sendBtn) {
    // Intercept disabled state changes as proxy for loading
    const origDisabledDesc = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
    let wasDisabled = false;
    const loadingObs = new MutationObserver(() => {
      const isDisabled = sendBtn.disabled;
      if (isDisabled && !wasDisabled) { showSkeleton(); wasDisabled = true; }
      if (!isDisabled && wasDisabled) { hideSkeleton(); wasDisabled = false; }
    });
    loadingObs.observe(sendBtn, { attributes: true, attributeFilter: ['disabled'] });
  }

  /* ────────────────────────────────────────────
     9. EMPTY CHECKS HINT
     ──────────────────────────────────────────── */
  function updateChecksEmptyHint() {
    if (!checkListEl) return;
    const existing = document.getElementById('checks-empty-hint');
    const hasChips = checkListEl.querySelectorAll('.check-chip').length > 0;
    if (!hasChips) {
      if (!existing) {
        const hint = document.createElement('div');
        hint.id = 'checks-empty-hint';
        hint.className = 'checks-empty-hint';
        hint.setAttribute('aria-label', 'No checks added yet');
        hint.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          No checks yet — add one above or click <strong>Basic Checks</strong>.
        `;
        checkListEl.appendChild(hint);
      }
    } else {
      if (existing) existing.remove();
    }
  }

  // Observe check-list mutations (app.js populates it)
  if (checkListEl) {
    const chipObs = new MutationObserver(() => {
      styleCheckChips();
      updateChecksEmptyHint();
    });
    chipObs.observe(checkListEl, { childList: true, subtree: false });
    // Initial call in case chips already rendered
    styleCheckChips();
    updateChecksEmptyHint();
  }

})();
