/* ═══════════════════════════════════════════════════════════════════
   BULLPRINT 3D — ADMIN (/secret-admin)
   Loads content.json, lets owner edit in place, commits to GitHub
   via Netlify function. Auth: URL secrecy + ADMIN_SECRET password.
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────
  let pristine = null;   // original content.json as loaded
  let working = null;    // working copy with edits
  let secret = sessionStorage.getItem('bp_admin_secret') || '';
  let dirty = false;
  let cardModalCtx = null; // { categoryId, cardIndex } | { categoryId, cardIndex: -1 } for new
  let catModalCtx = null;  // { categoryId } | null for new
  let machineModalCtx = null;  // { idx } | { idx: -1 } for new
  let materialModalCtx = null; // { idx }

  // DOM
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const gate = $('#gate');
  const gateForm = $('#gateForm');
  const gatePwInput = $('#gatePassword');
  const gateBtn = $('#gateBtn');
  const gateError = $('#gateError');

  const adminBar = $('#adminBar');
  const changesInd = $('#changesIndicator');
  const btnDiscard = $('#btnDiscard');
  const btnValidate = $('#btnValidate');
  const btnLogout = $('#btnLogout');

  const cardModal = $('#cardModal');
  const cardModalEls = {
    name: $('#cardName'),
    category: $('#cardCategory'),
    sub: $('#cardSub'),
    badge: $('#cardBadge'),
    badgeStyle: $('#cardBadgeStyle'),
    image: $('#cardImage'),
    save: $('#cardSave'),
    cancel: $('#cardCancel'),
    delete: $('#cardDelete'),
  };

  const catModal = $('#categoryModal');
  const catModalEls = {
    name: $('#catName'),
    id: $('#catId'),
    num: $('#catNum'),
    save: $('#catSave'),
    cancel: $('#catCancel'),
    delete: $('#catDelete'),
  };

  const statusModal = $('#statusModal');
  const statusModalEls = {
    rows: $('#statusRows'),
    add: $('#statusAdd'),
    save: $('#statusSave'),
    cancel: $('#statusCancel'),
  };

  const footerColsModal = $('#footerColumnsModal');
  const footerColsEls = {
    editor: $('#footerColumnsEditor'),
    save: $('#footerColsSave'),
    cancel: $('#footerColsCancel'),
  };

  const machineModal = $('#machineModal');
  const machineModalEls = {
    name: $('#machineName'),
    tagline: $('#machineTagline'),
    idx: $('#machineIdx'),
    status: $('#machineStatus'),
    statusLabel: $('#machineStatusLabel'),
    chips: $('#machineChips'),
    bestLead: $('#machineBestLead'),
    bestRest: $('#machineBestRest'),
    image: $('#machineImage'),
    save: $('#machineSave'),
    cancel: $('#machineCancel'),
    delete: $('#machineDelete'),
  };

  const materialModal = $('#materialModal');
  const materialModalEls = {
    code: $('#materialCode'),
    property: $('#materialProperty'),
    desc: $('#materialDesc'),
    finish: $('#materialFinish'),
    icon: $('#materialIcon'),
    image: $('#materialImage'),
    save: $('#materialSave'),
    cancel: $('#materialCancel'),
  };

  const photosModal = $('#photosModal');
  const photosModalEls = {
    rows: $('#photosRows'),
    add: $('#photosAdd'),
    save: $('#photosSave'),
    cancel: $('#photosCancel'),
  };

  const handlesModal = $('#handlesModal');
  const handlesModalEls = {
    rows: $('#handlesRows'),
    add: $('#handlesAdd'),
    save: $('#handlesSave'),
    cancel: $('#handlesCancel'),
  };

  const commitModal = $('#commitModal');
  const commitSummary = $('#commitSummary');
  const commitMsg = $('#commitMsg');
  const commitConfirm = $('#commitConfirm');
  const commitCancel = $('#commitCancel');

  const busy = $('#busy');
  const busyText = $('#busyText');
  const toastEl = $('#toast');

  // ─────────────────────────────────────────────────────────────
  // UTILS
  // ─────────────────────────────────────────────────────────────
  const deepClone = (o) => JSON.parse(JSON.stringify(o));

  const getByPath = (obj, path) => {
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  };

  const setByPath = (obj, path, val) => {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  };

  const showToast = (msg, kind = 'ok', ms = 3000) => {
    toastEl.textContent = '';
    if (typeof msg === 'string') {
      toastEl.textContent = msg;
    } else {
      toastEl.appendChild(msg);
    }
    toastEl.className = 'toast shown' + (kind === 'error' ? ' error' : '');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.classList.remove('shown');
    }, ms);
  };

  const setBusy = (on, text) => {
    if (text) busyText.textContent = text;
    busy.classList.toggle('shown', !!on);
  };

  const openModal = (m) => m.classList.add('shown');
  const closeModal = (m) => m.classList.remove('shown');

  // ─────────────────────────────────────────────────────────────
  // GATE
  // ─────────────────────────────────────────────────────────────
  const showGate = () => {
    gate.style.display = 'flex';
    adminBar.style.display = 'none';
    setTimeout(() => gatePwInput.focus(), 50);
  };

  const hideGate = () => {
    gate.style.display = 'none';
    adminBar.style.display = 'flex';
    // Admin doesn't run the intro — but the hero h1 word animations
    // are gated on body.intro-done. Force it on.
    document.body.classList.add('intro-done');
    document.documentElement.classList.remove('locked');
    // Also: topbar and status-bar have opacity:0 until .shown is added by
    // the public script.js (which we don't load in admin). Force them visible.
    document.querySelector('.topbar')?.classList.add('shown');
    document.querySelector('.status-bar')?.classList.add('shown');
  };

  const tryUnlock = async (pw) => {
    gateBtn.disabled = true;
    gateError.textContent = '';
    try {
      // Hit health endpoint with secret to validate.
      // commit-content GET returns 200 unauth (with hasSecret flag), so we
      // do a tiny POST with intentionally invalid body to check auth without
      // committing anything. 401 = wrong pw, 400 = pw correct but bad body.
      const res = await fetch('/.netlify/functions/commit-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': pw,
        },
        body: JSON.stringify({ __probe: true }),
      });
      if (res.status === 401) {
        gateError.textContent = 'Mot de passe incorrect';
        gateBtn.disabled = false;
        return false;
      }
      if (res.status === 404) {
        gateError.textContent = 'Service non disponible (la fonction n\'est pas déployée)';
        gateBtn.disabled = false;
        return false;
      }
      // 400 (validation error after auth passed) or 200 = good
      secret = pw;
      sessionStorage.setItem('bp_admin_secret', secret);
      gateBtn.disabled = false;
      return true;
    } catch (e) {
      gateError.textContent = 'Erreur réseau — vérifier la connexion';
      gateBtn.disabled = false;
      return false;
    }
  };

  const handleGateSubmit = async (e) => {
    e.preventDefault();
    const pw = gatePwInput.value.trim();
    if (!pw) return;
    const ok = await tryUnlock(pw);
    if (ok) {
      hideGate();
      await loadContent();
    } else {
      gatePwInput.select();
    }
  };

  const handleLogout = () => {
    if (dirty && !confirm('Tu as des modifications non sauvegardées. Quitter quand même ?')) return;
    sessionStorage.removeItem('bp_admin_secret');
    secret = '';
    gatePwInput.value = '';
    showGate();
  };

  // ─────────────────────────────────────────────────────────────
  // LOAD CONTENT + RENDER
  // ─────────────────────────────────────────────────────────────
  const loadContent = async () => {
    setBusy(true, 'Chargement...');
    try {
      // bust cache so we always get the latest committed content
      const res = await fetch('../content.json?v=' + Date.now());
      if (!res.ok) throw new Error('content.json HTTP ' + res.status);
      pristine = await res.json();
      working = deepClone(pristine);

      // Hand off to render.js's global hook
      window.__BULLPRINT_CONTENT__ = working;
      if (!window.__BULLPRINT_RENDER__) {
        throw new Error('render.js non chargé');
      }
      window.__BULLPRINT_RENDER__(working);

      setBusy(false);
      // wait a tick for DOM to populate, then wire admin overlays
      await new Promise((r) => setTimeout(r, 50));
      // force-reveal everything in admin — no scroll animations
      $$('.reveal, .card').forEach(el => el.classList.add('visible'));
      attachAdminOverlays();
      updateDirty();
    } catch (e) {
      setBusy(false);
      showToast('Erreur de chargement: ' + e.message, 'error', 6000);
      console.error(e);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // EDITABLE OVERLAYS
  // ─────────────────────────────────────────────────────────────
  const attachAdminOverlays = () => {
    // 0. Decorate freshly-rendered atelier lede paragraphs so the generic
    // inline-editor binder (step 1) picks them up. These <p> are rebuilt on
    // every rerender, which naturally resets their adminBound guards.
    $$('[data-bind="atelier.lede"] > p').forEach((p, i) => {
      p.setAttribute('data-edit', '');
      p.setAttribute('data-path', 'atelier.lede.' + i);
    });
    // Same treatment for the 4 "Sur Mesure" step cards (title + desc).
    $$('[data-bind="custom.steps"] .step').forEach((step, i) => {
      const h = step.querySelector('h4');
      const p = step.querySelector('p');
      if (h) { h.setAttribute('data-edit', ''); h.setAttribute('data-path', `custom.steps.${i}.title`); }
      if (p) { p.setAttribute('data-edit', ''); p.setAttribute('data-path', `custom.steps.${i}.desc`); }
    });

    // 1. Plain text editable fields (data-edit, NOT data-edit-title)
    $$('[data-edit][data-path]').forEach((el) => {
      if (el.dataset.adminBound) return;
      el.dataset.adminBound = '1';

      const path = el.dataset.path;
      el.addEventListener('click', (e) => {
        if (el.contentEditable === 'true') return;
        // ignore if click was on a child link
        if (e.target !== el && e.target.tagName === 'A') return;
        e.preventDefault();
        e.stopPropagation();
        startEdit(el, path);
      });
    });

    // 2. Title-array editable fields (data-edit-title) — open a dedicated modal
    $$('[data-edit-title][data-path]').forEach((el) => {
      if (el.dataset.adminBound) return;
      el.dataset.adminBound = '1';
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openTitleEditor(el.dataset.path);
      });
    });

    // 3. Card admin actions
    $$('.cat-row').forEach((row, catIdx) => {
      if (row.dataset.adminBound) return;
      row.dataset.adminBound = '1';

      // Inject category admin buttons next to header
      const catHead = row.querySelector('.cat-head > div:first-child');
      const cat = working.gallery.categories[catIdx];
      if (catHead && cat) {
        const wrap = document.createElement('span');
        wrap.className = 'cat-admin-actions';
        wrap.innerHTML = `
          <button class="cat-admin-btn edit-cat" data-cat-id="${cat.id}">✎ Renommer</button>
          <button class="cat-admin-btn delete delete-cat" data-cat-id="${cat.id}">× Supprimer</button>
          <button class="cat-admin-btn add-card" data-cat-id="${cat.id}">+ Carte</button>
        `;
        catHead.appendChild(wrap);

        wrap.querySelector('.edit-cat').addEventListener('click', (e) => {
          e.stopPropagation();
          openCategoryEditor(cat.id);
        });
        wrap.querySelector('.delete-cat').addEventListener('click', (e) => {
          e.stopPropagation();
          if (!confirm(`Supprimer la catégorie "${cat.name}" et ses ${cat.cards.length} cartes ?`)) return;
          working.gallery.categories = working.gallery.categories.filter((c) => c.id !== cat.id);
          rerender();
        });
        wrap.querySelector('.add-card').addEventListener('click', (e) => {
          e.stopPropagation();
          openCardEditor(cat.id, -1);
        });
      }

      // Card click → edit; inject overlay
      row.querySelectorAll('.card').forEach((card, cardIdx) => {
        // Block default link navigation
        card.removeAttribute('href');
        // Inject edit/delete actions
        const overlay = document.createElement('div');
        overlay.className = 'card-admin-actions';
        overlay.innerHTML = `
          <button class="card-admin-btn edit-card" title="Modifier">✎</button>
          <button class="card-admin-btn delete delete-card" title="Supprimer">×</button>
        `;
        card.appendChild(overlay);

        overlay.querySelector('.edit-card').addEventListener('click', (e) => {
          e.stopPropagation();
          openCardEditor(cat.id, cardIdx);
        });
        overlay.querySelector('.delete-card').addEventListener('click', (e) => {
          e.stopPropagation();
          if (!confirm('Supprimer cette carte ?')) return;
          const c = working.gallery.categories.find((x) => x.id === cat.id);
          c.cards.splice(cardIdx, 1);
          rerender();
        });

        card.addEventListener('click', (e) => {
          if (e.target.closest('.card-admin-actions')) return;
          e.preventDefault();
          openCardEditor(cat.id, cardIdx);
        });
      });
    });

    // 4. "Add category" row at the end of the gallery
    const catStack = $('.cat-stack');
    if (catStack && !catStack.querySelector('.add-category-row')) {
      const addCatBtn = document.createElement('div');
      addCatBtn.className = 'add-category-row';
      addCatBtn.innerHTML = '<div class="label">+ Ajouter une catégorie</div>';
      addCatBtn.addEventListener('click', () => openCategoryEditor(null));
      catStack.appendChild(addCatBtn);
    }

    // 5. Status bar (bande défilante) → modal editor.
    // The marquee is paused via admin CSS so the bar stays clickable.
    // The .status-bar element itself survives rerender (only the track's
    // innerHTML is rewritten), so one delegated binding is enough.
    const statusBarEl = $('.status-bar');
    if (statusBarEl && !statusBarEl.dataset.adminBound) {
      statusBarEl.dataset.adminBound = '1';
      statusBarEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openStatusEditor();
      });
    }

    // 6. Footer columns → modal editor.
    // The container is display:contents (no box, no hover of its own) but
    // clicks on the column divs bubble up to it. Its innerHTML is wiped on
    // every rerender, hence the adminBound guard on the container itself.
    const footColsEl = $('[data-bind="footer.columns"]');
    if (footColsEl && !footColsEl.dataset.adminBound) {
      footColsEl.dataset.adminBound = '1';
      footColsEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFooterColumnsEditor();
      });
    }

    // 7. Order handles (@insta · email · pays livrés) → modal editor.
    // Same story as the footer columns: the container survives rerender,
    // only its innerHTML is wiped, so one guarded delegated binding.
    const handlesEl = $('[data-bind="order.handles"]');
    if (handlesEl && !handlesEl.dataset.adminBound) {
      handlesEl.dataset.adminBound = '1';
      handlesEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openHandlesEditor();
      });
    }

    // 8. Atelier machines → modal editor (delegated: the bench container
    // survives rerender, its cards don't).
    const bench = $('[data-bind="atelier.machines"]');
    if (bench) {
      if (!bench.dataset.adminBound) {
        bench.dataset.adminBound = '1';
        bench.addEventListener('click', (e) => {
          const card = e.target.closest('.machine');
          if (!card) return;
          e.preventDefault();
          const idx = Array.from(bench.querySelectorAll('.machine')).indexOf(card);
          if (idx !== -1) openMachineEditor(idx);
        });
      }
      // "+ Machine" cell — wiped with the container's innerHTML on every
      // rerender, so re-inject each pass (same pattern as add-category-row)
      if (!bench.querySelector('.add-machine-row')) {
        const addRow = document.createElement('div');
        addRow.className = 'add-machine-row';
        addRow.innerHTML = '<div class="label">+ Machine</div>';
        addRow.addEventListener('click', () => openMachineEditor(-1));
        bench.appendChild(addRow);
      }
    }

    // 9. Atelier materials → modal editor (edit only — the 4 filaments are
    // the offer; add/remove is not a phone-admin job)
    const mats = $('[data-bind="atelier.materials"]');
    if (mats && !mats.dataset.adminBound) {
      mats.dataset.adminBound = '1';
      mats.addEventListener('click', (e) => {
        const card = e.target.closest('.mat');
        if (!card) return;
        e.preventDefault();
        const idx = Array.from(mats.querySelectorAll('.mat')).indexOf(card);
        if (idx !== -1) openMaterialEditor(idx);
      });
    }

    // 10. Atelier photo strip → modal editor (list of image paths).
    // No uploader on purpose: image files still travel via Git into
    // assets/atelier/ — the admin only edits the paths.
    const strip = $('[data-bind="atelier.photos"]');
    if (strip && !strip.dataset.adminBound) {
      strip.dataset.adminBound = '1';
      strip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPhotosEditor();
      });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PLAIN TEXT EDIT (data-edit)
  // ─────────────────────────────────────────────────────────────
  const startEdit = (el, path) => {
    // Get the actual current value from working (not from DOM, which may have
    // <strong> rendered from markdown)
    const currentVal = getByPath(working, path) ?? '';
    el.contentEditable = 'true';
    el.spellcheck = true;
    // strip rendered <strong> back to **markdown** for editing
    el.textContent = String(currentVal);
    el.focus();

    // place caret at end
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.addRange(range);

    const finish = (commit) => {
      el.contentEditable = 'false';
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('blur', onBlur);
      if (commit) {
        const newVal = el.textContent.trim();
        setByPath(working, path, newVal);
        rerender();
      } else {
        rerender(); // rerender to restore display formatting
      }
    };

    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    };
    const onBlur = () => finish(true);

    el.addEventListener('keydown', onKey);
    el.addEventListener('blur', onBlur);
  };

  // ─────────────────────────────────────────────────────────────
  // TITLE EDITOR (data-edit-title — multi-word with style hints)
  // ─────────────────────────────────────────────────────────────
  const openTitleEditor = (path) => {
    const titleLines = getByPath(working, path);
    if (!Array.isArray(titleLines)) return;

    // Build a simple inline editor: each word becomes an input with a style dropdown.
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay shown';
    overlay.style.zIndex = '99997';

    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `
      <h3>Modifier le <span class="green">titre</span></h3>
      <p style="font-size:11px;color:#9c9c92;margin-bottom:16px;line-height:1.5">
        Le titre est composé de lignes, chaque ligne contient un ou plusieurs mots.
        Chaque mot peut être stylé : <b>solide</b> (blanc), <b>vert</b> (accent), <b>contour</b> (outline).
      </p>
      <div id="titleLinesEditor"></div>
      <button class="modal-btn" id="titleAddLine" style="margin-top:10px">+ Ligne</button>
      <div class="modal-actions">
        <button class="modal-btn" id="titleCancel">Annuler</button>
        <button class="modal-btn primary" id="titleSave">Enregistrer</button>
      </div>
    `;
    overlay.appendChild(m);
    document.body.appendChild(overlay);

    const editor = m.querySelector('#titleLinesEditor');

    const renderLines = (lines) => {
      editor.innerHTML = '';
      lines.forEach((line, lineIdx) => {
        const lineDiv = document.createElement('div');
        lineDiv.style.cssText = 'margin-bottom:14px;padding:10px;background:#0a0d0a;border:1px solid rgba(234,232,223,.1);border-radius:3px';
        lineDiv.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:9px;letter-spacing:.14em;color:#7fb33a;font-weight:700">LIGNE ${lineIdx + 1}</span>
            <div>
              <button class="modal-btn" data-action="add-word" data-line="${lineIdx}" style="padding:4px 8px;font-size:9px">+ Mot</button>
              <button class="modal-btn danger" data-action="del-line" data-line="${lineIdx}" style="padding:4px 8px;font-size:9px">× Ligne</button>
            </div>
          </div>
          <div class="words" data-line="${lineIdx}"></div>
        `;
        const wordsDiv = lineDiv.querySelector('.words');
        line.forEach((w, wordIdx) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center';
          row.innerHTML = `
            <input type="text" value="${(w.text || '').replace(/"/g, '&quot;')}" data-line="${lineIdx}" data-word="${wordIdx}" data-field="text" style="flex:1;background:#070907;border:1px solid rgba(234,232,223,.22);color:#eae8df;padding:8px 10px;font-family:'JetBrains Mono',monospace;font-size:12px;border-radius:2px">
            <select data-line="${lineIdx}" data-word="${wordIdx}" data-field="style" style="background:#070907;border:1px solid rgba(234,232,223,.22);color:#eae8df;padding:8px;font-family:'JetBrains Mono',monospace;font-size:11px;border-radius:2px">
              <option value="solid"${w.style === 'solid' ? ' selected' : ''}>solide</option>
              <option value="green"${w.style === 'green' ? ' selected' : ''}>vert</option>
              <option value="outline"${w.style === 'outline' ? ' selected' : ''}>contour</option>
            </select>
            <button class="modal-btn danger" data-action="del-word" data-line="${lineIdx}" data-word="${wordIdx}" style="padding:6px 8px;font-size:10px">×</button>
          `;
          wordsDiv.appendChild(row);
        });
        editor.appendChild(lineDiv);
      });
    };

    // Local working copy of lines
    let lines = deepClone(titleLines);
    renderLines(lines);

    editor.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const lineIdx = parseInt(btn.dataset.line, 10);
      if (action === 'add-word') {
        lines[lineIdx].push({ text: 'MOT', style: 'solid' });
        renderLines(lines);
      } else if (action === 'del-line') {
        if (lines.length > 1) {
          lines.splice(lineIdx, 1);
          renderLines(lines);
        } else {
          alert('Il faut au moins une ligne.');
        }
      } else if (action === 'del-word') {
        const wordIdx = parseInt(btn.dataset.word, 10);
        if (lines[lineIdx].length > 1) {
          lines[lineIdx].splice(wordIdx, 1);
          renderLines(lines);
        } else {
          alert('Il faut au moins un mot par ligne.');
        }
      }
    });
    editor.addEventListener('input', (e) => {
      const el = e.target;
      const li = parseInt(el.dataset.line, 10);
      const wi = parseInt(el.dataset.word, 10);
      const field = el.dataset.field;
      if (isNaN(li) || isNaN(wi) || !field) return;
      lines[li][wi][field] = el.value;
    });
    editor.addEventListener('change', (e) => {
      const el = e.target;
      if (el.tagName !== 'SELECT') return;
      const li = parseInt(el.dataset.line, 10);
      const wi = parseInt(el.dataset.word, 10);
      const field = el.dataset.field;
      if (isNaN(li) || isNaN(wi) || !field) return;
      lines[li][wi][field] = el.value;
    });

    m.querySelector('#titleAddLine').addEventListener('click', () => {
      lines.push([{ text: 'NOUVEAU', style: 'solid' }]);
      renderLines(lines);
    });

    m.querySelector('#titleCancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    m.querySelector('#titleSave').addEventListener('click', () => {
      setByPath(working, path, lines);
      document.body.removeChild(overlay);
      rerender();
    });
  };

  // ─────────────────────────────────────────────────────────────
  // CARD EDITOR
  // ─────────────────────────────────────────────────────────────
  const openCardEditor = (categoryId, cardIndex) => {
    cardModalCtx = { categoryId, cardIndex };
    const isNew = cardIndex === -1;
    const cat = working.gallery.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const card = isNew
      ? { image: 'assets/products/', badge: '', badgeStyle: 'default', category: '', name: '', sub: '' }
      : cat.cards[cardIndex];

    cardModalEls.name.value = card.name || '';
    cardModalEls.category.value = card.category || '';
    cardModalEls.sub.value = card.sub || '';
    cardModalEls.badge.value = card.badge || '';
    cardModalEls.badgeStyle.value = card.badgeStyle || 'default';
    cardModalEls.image.value = card.image || '';
    cardModalEls.delete.style.display = isNew ? 'none' : '';

    openModal(cardModal);
    setTimeout(() => cardModalEls.name.focus(), 100);
  };

  cardModalEls.save.addEventListener('click', () => {
    if (!cardModalCtx) return;
    const { categoryId, cardIndex } = cardModalCtx;
    const cat = working.gallery.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const newCard = {
      image: cardModalEls.image.value.trim(),
      badge: cardModalEls.badge.value.trim(),
      badgeStyle: cardModalEls.badgeStyle.value || 'default',
      category: cardModalEls.category.value.trim(),
      name: cardModalEls.name.value.trim(),
      sub: cardModalEls.sub.value.trim(),
    };
    if (cardIndex === -1) {
      cat.cards.push(newCard);
    } else {
      cat.cards[cardIndex] = newCard;
    }
    closeModal(cardModal);
    rerender();
  });
  cardModalEls.cancel.addEventListener('click', () => closeModal(cardModal));
  cardModalEls.delete.addEventListener('click', () => {
    if (!cardModalCtx || cardModalCtx.cardIndex === -1) return;
    if (!confirm('Supprimer cette carte ?')) return;
    const cat = working.gallery.categories.find((c) => c.id === cardModalCtx.categoryId);
    if (cat) cat.cards.splice(cardModalCtx.cardIndex, 1);
    closeModal(cardModal);
    rerender();
  });

  // ─────────────────────────────────────────────────────────────
  // CATEGORY EDITOR
  // ─────────────────────────────────────────────────────────────
  const openCategoryEditor = (categoryId) => {
    catModalCtx = { categoryId };
    const isNew = categoryId === null;
    const cat = isNew ? null : working.gallery.categories.find((c) => c.id === categoryId);

    catModalEls.name.value = cat?.name || '';
    catModalEls.id.value = cat?.id || '';
    catModalEls.num.value = cat?.num || String(working.gallery.categories.length + 1).padStart(2, '0');
    catModalEls.delete.style.display = isNew ? 'none' : '';

    openModal(catModal);
    setTimeout(() => catModalEls.name.focus(), 100);
  };

  const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

  catModalEls.save.addEventListener('click', () => {
    if (!catModalCtx) return;
    const name = catModalEls.name.value.trim();
    if (!name) { alert('Nom requis'); return; }
    let id = catModalEls.id.value.trim() || slugify(name);
    const num = catModalEls.num.value.trim() || String(working.gallery.categories.length + 1).padStart(2, '0');

    if (catModalCtx.categoryId === null) {
      // New category — ensure id is unique
      let baseId = id, i = 2;
      while (working.gallery.categories.some((c) => c.id === id)) {
        id = baseId + '-' + (i++);
      }
      working.gallery.categories.push({ id, num, name, cards: [] });
    } else {
      const cat = working.gallery.categories.find((c) => c.id === catModalCtx.categoryId);
      if (cat) {
        cat.name = name;
        cat.num = num;
        // Only rename id if it actually changed AND new id is unique
        if (id !== cat.id) {
          if (working.gallery.categories.some((c) => c.id === id && c !== cat)) {
            alert('Cet identifiant existe déjà — id non modifié.');
          } else {
            cat.id = id;
          }
        }
      }
    }
    closeModal(catModal);
    rerender();
  });
  catModalEls.cancel.addEventListener('click', () => closeModal(catModal));
  catModalEls.delete.addEventListener('click', () => {
    if (!catModalCtx?.categoryId) return;
    const cat = working.gallery.categories.find((c) => c.id === catModalCtx.categoryId);
    if (!cat) return;
    if (!confirm(`Supprimer la catégorie "${cat.name}" et ses ${cat.cards.length} cartes ?`)) return;
    working.gallery.categories = working.gallery.categories.filter((c) => c.id !== catModalCtx.categoryId);
    closeModal(catModal);
    rerender();
  });

  // ─────────────────────────────────────────────────────────────
  // STATUS BAR EDITOR (bande défilante)
  // ─────────────────────────────────────────────────────────────
  let statusItems = null; // local copy while the modal is open

  const renderStatusRows = () => {
    statusModalEls.rows.innerHTML = '';
    statusItems.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'row-edit';
      row.innerHTML = `
        <input type="text" data-idx="${idx}" data-field="text" placeholder="Message">
        <label class="warn-toggle"><input type="checkbox" data-idx="${idx}" data-field="warn"> ⚠ orange</label>
        <button class="modal-btn mini-btn" data-action="up" data-idx="${idx}"${idx === 0 ? ' disabled' : ''}>↑</button>
        <button class="modal-btn mini-btn" data-action="down" data-idx="${idx}"${idx === statusItems.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="modal-btn mini-btn danger" data-action="del" data-idx="${idx}" title="Supprimer">×</button>
      `;
      // set values via properties — no HTML-escaping worries
      row.querySelector('input[data-field="text"]').value = item.text || '';
      row.querySelector('input[data-field="warn"]').checked = !!item.warn;
      statusModalEls.rows.appendChild(row);
    });
  };

  const openStatusEditor = () => {
    statusItems = deepClone(working.statusBar || []);
    if (!statusItems.length) statusItems.push({ text: '', warn: false });
    renderStatusRows();
    openModal(statusModal);
  };

  statusModalEls.rows.addEventListener('input', (e) => {
    if (!statusItems) return;
    const idx = parseInt(e.target.dataset.idx, 10);
    if (isNaN(idx)) return;
    if (e.target.dataset.field === 'text') statusItems[idx].text = e.target.value;
    else if (e.target.dataset.field === 'warn') statusItems[idx].warn = e.target.checked;
  });

  statusModalEls.rows.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || !statusItems) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const action = btn.dataset.action;
    if (action === 'up' && idx > 0) {
      [statusItems[idx - 1], statusItems[idx]] = [statusItems[idx], statusItems[idx - 1]];
    } else if (action === 'down' && idx < statusItems.length - 1) {
      [statusItems[idx + 1], statusItems[idx]] = [statusItems[idx], statusItems[idx + 1]];
    } else if (action === 'del') {
      if (statusItems.length <= 1) { alert('Il faut au moins un message.'); return; }
      statusItems.splice(idx, 1);
    } else {
      return;
    }
    renderStatusRows();
  });

  statusModalEls.add.addEventListener('click', () => {
    statusItems.push({ text: '', warn: false });
    renderStatusRows();
    const inputs = statusModalEls.rows.querySelectorAll('input[data-field="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  statusModalEls.cancel.addEventListener('click', () => closeModal(statusModal));
  statusModalEls.save.addEventListener('click', () => {
    const cleaned = statusItems
      .map((s) => ({ text: String(s.text || '').trim(), warn: !!s.warn }))
      .filter((s) => s.text); // empty rows are dropped
    if (!cleaned.length) { alert('Il faut au moins un message.'); return; }
    working.statusBar = cleaned;
    closeModal(statusModal);
    rerender();
  });

  // ─────────────────────────────────────────────────────────────
  // FOOTER COLUMNS EDITOR
  // Column count stays fixed at 3 — the footer grid (display:contents
  // into .foot) is tuned for 3 columns; adding/removing is out of scope.
  // ─────────────────────────────────────────────────────────────
  let footerCols = null; // local copy while the modal is open

  const renderFooterColsEditor = () => {
    footerColsEls.editor.innerHTML = '';
    footerCols.forEach((col, colIdx) => {
      const block = document.createElement('div');
      block.className = 'col-block';
      block.innerHTML = `
        <div class="modal-field" style="margin-bottom:10px">
          <label>Colonne ${colIdx + 1} — Titre</label>
          <input type="text" data-col="${colIdx}" data-field="title">
        </div>
        <div class="links"></div>
        <button class="modal-btn mini-btn" data-action="add-link" data-col="${colIdx}">+ Ajouter un lien</button>
      `;
      block.querySelector('input[data-field="title"]').value = col.title || '';
      const linksDiv = block.querySelector('.links');
      (col.links || []).forEach((l, linkIdx) => {
        const row = document.createElement('div');
        row.className = 'link-row';
        row.innerHTML = `
          <div class="link-inputs">
            <input type="text" data-col="${colIdx}" data-idx="${linkIdx}" data-field="label" placeholder="Libellé">
            <input type="text" data-col="${colIdx}" data-idx="${linkIdx}" data-field="href" placeholder="#ancre, mailto:… ou https://…">
          </div>
          <div class="link-btns">
            <button class="modal-btn mini-btn" data-action="up" data-col="${colIdx}" data-idx="${linkIdx}"${linkIdx === 0 ? ' disabled' : ''}>↑</button>
            <button class="modal-btn mini-btn" data-action="down" data-col="${colIdx}" data-idx="${linkIdx}"${linkIdx === col.links.length - 1 ? ' disabled' : ''}>↓</button>
            <button class="modal-btn mini-btn danger" data-action="del" data-col="${colIdx}" data-idx="${linkIdx}" title="Supprimer">×</button>
          </div>
        `;
        row.querySelector('input[data-field="label"]').value = l.label || '';
        row.querySelector('input[data-field="href"]').value = l.href || '';
        linksDiv.appendChild(row);
      });
      footerColsEls.editor.appendChild(block);
    });
  };

  const openFooterColumnsEditor = () => {
    footerCols = deepClone(working.footer.columns || []);
    footerCols.forEach((c) => { if (!Array.isArray(c.links)) c.links = []; });
    renderFooterColsEditor();
    openModal(footerColsModal);
  };

  footerColsEls.editor.addEventListener('input', (e) => {
    if (!footerCols) return;
    const colIdx = parseInt(e.target.dataset.col, 10);
    const field = e.target.dataset.field;
    if (isNaN(colIdx) || !field) return;
    if (field === 'title') { footerCols[colIdx].title = e.target.value; return; }
    const linkIdx = parseInt(e.target.dataset.idx, 10);
    if (isNaN(linkIdx)) return;
    footerCols[colIdx].links[linkIdx][field] = e.target.value;
  });

  footerColsEls.editor.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || !footerCols) return;
    const colIdx = parseInt(btn.dataset.col, 10);
    if (isNaN(colIdx)) return;
    const links = footerCols[colIdx].links;
    const action = btn.dataset.action;
    if (action === 'add-link') {
      links.push({ label: '', href: '#' });
    } else {
      const idx = parseInt(btn.dataset.idx, 10);
      if (action === 'up' && idx > 0) {
        [links[idx - 1], links[idx]] = [links[idx], links[idx - 1]];
      } else if (action === 'down' && idx < links.length - 1) {
        [links[idx + 1], links[idx]] = [links[idx], links[idx + 1]];
      } else if (action === 'del') {
        links.splice(idx, 1);
      } else {
        return;
      }
    }
    renderFooterColsEditor();
    if (action === 'add-link') {
      const labels = footerColsEls.editor.querySelectorAll(`input[data-col="${colIdx}"][data-field="label"]`);
      if (labels.length) labels[labels.length - 1].focus();
    }
  });

  footerColsEls.cancel.addEventListener('click', () => closeModal(footerColsModal));
  footerColsEls.save.addEventListener('click', () => {
    const cleaned = footerCols.map((col) => ({
      title: String(col.title || '').trim(),
      links: (col.links || [])
        .map((l) => ({ label: String(l.label || '').trim(), href: String(l.href || '').trim() || '#' }))
        .filter((l) => l.label), // a link without a label is dropped
    }));
    working.footer.columns = cleaned;
    closeModal(footerColsModal);
    rerender();
  });

  // ─────────────────────────────────────────────────────────────
  // ORDER HANDLES EDITOR (@insta · email · pays livrés)
  // ─────────────────────────────────────────────────────────────
  let handleItems = null; // local copy while the modal is open

  const renderHandlesRows = () => {
    handlesModalEls.rows.innerHTML = '';
    handleItems.forEach((h, idx) => {
      const row = document.createElement('div');
      row.className = 'link-row';
      row.innerHTML = `
        <div class="link-inputs">
          <input type="text" data-idx="${idx}" data-field="label" placeholder="Texte affiché">
          <input type="text" data-idx="${idx}" data-field="href" placeholder="https://…, mailto:… ou # (sans lien)">
        </div>
        <div class="link-btns">
          <button class="modal-btn mini-btn" data-action="up" data-idx="${idx}"${idx === 0 ? ' disabled' : ''}>↑</button>
          <button class="modal-btn mini-btn" data-action="down" data-idx="${idx}"${idx === handleItems.length - 1 ? ' disabled' : ''}>↓</button>
          <button class="modal-btn mini-btn danger" data-action="del" data-idx="${idx}" title="Supprimer">×</button>
        </div>
      `;
      row.querySelector('input[data-field="label"]').value = h.label || '';
      row.querySelector('input[data-field="href"]').value = h.href || '';
      handlesModalEls.rows.appendChild(row);
    });
  };

  const openHandlesEditor = () => {
    handleItems = deepClone(working.order.handles || []);
    if (!handleItems.length) handleItems.push({ label: '', href: '#' });
    renderHandlesRows();
    openModal(handlesModal);
  };

  handlesModalEls.rows.addEventListener('input', (e) => {
    if (!handleItems) return;
    const idx = parseInt(e.target.dataset.idx, 10);
    const field = e.target.dataset.field;
    if (isNaN(idx) || !field) return;
    handleItems[idx][field] = e.target.value;
  });

  handlesModalEls.rows.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || !handleItems) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const action = btn.dataset.action;
    if (action === 'up' && idx > 0) {
      [handleItems[idx - 1], handleItems[idx]] = [handleItems[idx], handleItems[idx - 1]];
    } else if (action === 'down' && idx < handleItems.length - 1) {
      [handleItems[idx + 1], handleItems[idx]] = [handleItems[idx], handleItems[idx + 1]];
    } else if (action === 'del') {
      if (handleItems.length <= 1) { alert('Il faut au moins une ligne.'); return; }
      handleItems.splice(idx, 1);
    } else {
      return;
    }
    renderHandlesRows();
  });

  handlesModalEls.add.addEventListener('click', () => {
    handleItems.push({ label: '', href: '#' });
    renderHandlesRows();
    const labels = handlesModalEls.rows.querySelectorAll('input[data-field="label"]');
    if (labels.length) labels[labels.length - 1].focus();
  });

  handlesModalEls.cancel.addEventListener('click', () => closeModal(handlesModal));
  handlesModalEls.save.addEventListener('click', () => {
    const cleaned = handleItems
      .map((h) => ({ label: String(h.label || '').trim(), href: String(h.href || '').trim() || '#' }))
      .filter((h) => h.label); // rows without a label are dropped
    if (!cleaned.length) { alert('Il faut au moins une ligne.'); return; }
    working.order.handles = cleaned;
    closeModal(handlesModal);
    rerender();
  });

  // ─────────────────────────────────────────────────────────────
  // ATELIER PHOTOS EDITOR (photo strip — list of image paths)
  // ─────────────────────────────────────────────────────────────
  let photoItems = null; // local copy while the modal is open

  const renderPhotosRows = () => {
    photosModalEls.rows.innerHTML = '';
    photoItems.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'row-edit';
      row.innerHTML = `
        <input type="text" data-idx="${idx}" placeholder="assets/atelier/photo.jpg">
        <button class="modal-btn mini-btn" data-action="up" data-idx="${idx}"${idx === 0 ? ' disabled' : ''}>↑</button>
        <button class="modal-btn mini-btn" data-action="down" data-idx="${idx}"${idx === photoItems.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="modal-btn mini-btn danger" data-action="del" data-idx="${idx}" title="Supprimer">×</button>
      `;
      row.querySelector('input').value = p || '';
      photosModalEls.rows.appendChild(row);
    });
  };

  const openPhotosEditor = () => {
    photoItems = deepClone(working.atelier.photos || []);
    if (!photoItems.length) photoItems.push('assets/atelier/');
    renderPhotosRows();
    openModal(photosModal);
  };

  photosModalEls.rows.addEventListener('input', (e) => {
    if (!photoItems) return;
    const idx = parseInt(e.target.dataset.idx, 10);
    if (isNaN(idx)) return;
    photoItems[idx] = e.target.value;
  });

  photosModalEls.rows.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || !photoItems) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const action = btn.dataset.action;
    if (action === 'up' && idx > 0) {
      [photoItems[idx - 1], photoItems[idx]] = [photoItems[idx], photoItems[idx - 1]];
    } else if (action === 'down' && idx < photoItems.length - 1) {
      [photoItems[idx + 1], photoItems[idx]] = [photoItems[idx], photoItems[idx + 1]];
    } else if (action === 'del') {
      if (photoItems.length <= 1) { alert('Il faut au moins une photo.'); return; }
      photoItems.splice(idx, 1);
    } else {
      return;
    }
    renderPhotosRows();
  });

  photosModalEls.add.addEventListener('click', () => {
    photoItems.push('assets/atelier/');
    renderPhotosRows();
    const inputs = photosModalEls.rows.querySelectorAll('input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  photosModalEls.cancel.addEventListener('click', () => closeModal(photosModal));
  photosModalEls.save.addEventListener('click', () => {
    const cleaned = photoItems
      .map((p) => String(p || '').trim())
      .filter((p) => p && p !== 'assets/atelier/'); // empty / untouched rows are dropped
    if (!cleaned.length) { alert('Il faut au moins une photo.'); return; }
    working.atelier.photos = cleaned;
    closeModal(photosModal);
    rerender();
  });

  // ─────────────────────────────────────────────────────────────
  // MACHINE EDITOR (atelier bench)
  // status: 'printing' drives the progress bar + animated dot in
  // render.js; every other value renders as a plain "ready" card.
  // ─────────────────────────────────────────────────────────────
  const openMachineEditor = (idx) => {
    machineModalCtx = { idx };
    const isNew = idx === -1;
    const m = isNew
      ? { id: '', name: '', tagline: '', idx: '', status: 'ready', statusLabel: 'Prêt', image: 'assets/atelier/', chips: [], bestLead: '', bestRest: '' }
      : working.atelier.machines[idx];
    if (!m) return;

    machineModalEls.name.value = m.name || '';
    machineModalEls.tagline.value = m.tagline || '';
    machineModalEls.idx.value = m.idx || '';
    machineModalEls.status.value = m.status === 'printing' ? 'printing' : 'ready';
    machineModalEls.statusLabel.value = m.statusLabel || '';
    machineModalEls.chips.value = (m.chips || []).join(', ');
    machineModalEls.bestLead.value = m.bestLead || '';
    machineModalEls.bestRest.value = m.bestRest || '';
    machineModalEls.image.value = m.image || '';
    machineModalEls.delete.style.display = isNew ? 'none' : '';

    openModal(machineModal);
    setTimeout(() => machineModalEls.name.focus(), 100);
  };

  machineModalEls.save.addEventListener('click', () => {
    if (!machineModalCtx) return;
    const { idx } = machineModalCtx;
    const isNew = idx === -1;
    const name = machineModalEls.name.value.trim();
    if (!name) { alert('Nom requis'); return; }
    const existing = isNew ? null : working.atelier.machines[idx];
    const machine = {
      id: existing?.id || slugify(name) || 'machine',
      name,
      tagline: machineModalEls.tagline.value.trim(),
      idx: machineModalEls.idx.value.trim(),
      status: machineModalEls.status.value === 'printing' ? 'printing' : 'ready',
      statusLabel: machineModalEls.statusLabel.value.trim() || (machineModalEls.status.value === 'printing' ? 'En impression' : 'Prêt'),
      image: machineModalEls.image.value.trim(),
      chips: machineModalEls.chips.value.split(',').map((c) => c.trim()).filter(Boolean),
      bestLead: machineModalEls.bestLead.value.trim(),
      bestRest: machineModalEls.bestRest.value.trim(),
    };
    if (isNew) {
      working.atelier.machines.push(machine);
    } else {
      working.atelier.machines[idx] = machine;
    }
    closeModal(machineModal);
    rerender();
  });
  machineModalEls.cancel.addEventListener('click', () => closeModal(machineModal));
  machineModalEls.delete.addEventListener('click', () => {
    if (!machineModalCtx || machineModalCtx.idx === -1) return;
    const m = working.atelier.machines[machineModalCtx.idx];
    if (!m) return;
    if (!confirm(`Supprimer la machine "${m.name}" ?`)) return;
    working.atelier.machines.splice(machineModalCtx.idx, 1);
    closeModal(machineModal);
    rerender();
  });

  // ─────────────────────────────────────────────────────────────
  // MATERIAL EDITOR (atelier filaments)
  // finish/icon are dropdowns on purpose: legal finishes are the
  // finish-* classes in styles.css (matte/satin/gloss), legal icons
  // are the ICONS map keys in render.js (leaf/heat/impact/sun) —
  // free-typing either would silently break the rendering.
  // ─────────────────────────────────────────────────────────────
  const openMaterialEditor = (idx) => {
    materialModalCtx = { idx };
    const mt = working.atelier.materials[idx];
    if (!mt) return;

    materialModalEls.code.value = mt.code || '';
    materialModalEls.property.value = mt.property || '';
    materialModalEls.desc.value = mt.desc || '';
    materialModalEls.finish.value = ['matte', 'satin', 'gloss'].includes(mt.finish) ? mt.finish : 'matte';
    materialModalEls.icon.value = ['leaf', 'heat', 'impact', 'sun', 'flex', 'plus'].includes(mt.icon) ? mt.icon : 'leaf';
    materialModalEls.image.value = mt.image || '';

    openModal(materialModal);
    setTimeout(() => materialModalEls.code.focus(), 100);
  };

  materialModalEls.save.addEventListener('click', () => {
    if (!materialModalCtx) return;
    const mt = working.atelier.materials[materialModalCtx.idx];
    if (!mt) return;
    const code = materialModalEls.code.value.trim();
    if (!code) { alert('Code requis'); return; }
    mt.code = code;
    mt.property = materialModalEls.property.value.trim();
    mt.desc = materialModalEls.desc.value.trim();
    mt.finish = materialModalEls.finish.value;
    mt.icon = materialModalEls.icon.value;
    mt.image = materialModalEls.image.value.trim();
    closeModal(materialModal);
    rerender();
  });
  materialModalEls.cancel.addEventListener('click', () => closeModal(materialModal));

  // ─────────────────────────────────────────────────────────────
  // RE-RENDER from working copy
  // ─────────────────────────────────────────────────────────────
  const rerender = () => {
    window.__BULLPRINT_CONTENT__ = working;
    if (window.__BULLPRINT_RENDER__) {
      window.__BULLPRINT_RENDER__(working);
    }
    setTimeout(() => {
      // Force all reveal/card animations to "visible" state in admin —
      // no scroll observers needed here, owner needs to see everything
      $$('.reveal, .card').forEach(el => el.classList.add('visible'));
      attachAdminOverlays();
      updateDirty();
    }, 30);
  };

  // ─────────────────────────────────────────────────────────────
  // DIRTY TRACKING
  // ─────────────────────────────────────────────────────────────
  const updateDirty = () => {
    const wasDirty = dirty;
    dirty = JSON.stringify(working) !== JSON.stringify(pristine);
    if (dirty) {
      changesInd.textContent = '● Modifications non publiées';
      changesInd.classList.add('has-changes');
    } else {
      changesInd.textContent = 'Aucun changement';
      changesInd.classList.remove('has-changes');
    }
  };

  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ─────────────────────────────────────────────────────────────
  // DISCARD
  // ─────────────────────────────────────────────────────────────
  btnDiscard.addEventListener('click', () => {
    if (!dirty) return;
    if (!confirm('Annuler toutes les modifications non publiées ?')) return;
    working = deepClone(pristine);
    rerender();
  });

  // ─────────────────────────────────────────────────────────────
  // VALIDATE / COMMIT
  // ─────────────────────────────────────────────────────────────
  btnValidate.addEventListener('click', () => {
    if (!dirty) {
      showToast('Aucun changement à publier');
      return;
    }
    buildCommitSummary();
    commitMsg.value = '';
    openModal(commitModal);
  });

  commitCancel.addEventListener('click', () => closeModal(commitModal));

  commitConfirm.addEventListener('click', async () => {
    closeModal(commitModal);
    setBusy(true, 'Publication en cours...');
    try {
      const res = await fetch('/.netlify/functions/commit-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': secret,
        },
        body: JSON.stringify({
          content: working,
          message: commitMsg.value.trim() || 'mise à jour du contenu',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || ('HTTP ' + res.status));
      }
      // Success — adopt working as new pristine
      pristine = deepClone(working);
      updateDirty();
      setBusy(false);

      const linkNode = document.createElement('span');
      linkNode.textContent = '✓ Publié — Netlify rebuild ~1 min';
      if (data.commit?.url) {
        linkNode.innerHTML = `✓ Publié — <a href="${data.commit.url}" target="_blank">voir commit</a> · rebuild ~1 min`;
      }
      showToast(linkNode, 'ok', 6000);
    } catch (e) {
      setBusy(false);
      showToast('Erreur: ' + e.message, 'error', 8000);
      console.error(e);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // COMMIT SUMMARY (diff between pristine and working)
  // ─────────────────────────────────────────────────────────────
  const buildCommitSummary = () => {
    const changes = [];
    diffObjects(pristine, working, '', changes);
    if (!changes.length) {
      commitSummary.innerHTML = '<div class="empty">Aucun changement détecté.</div>';
      return;
    }
    commitSummary.innerHTML = changes.map((c) => {
      if (c.kind === 'added') {
        return `<div class="change">
          <div class="path"><span class="added">+ AJOUTÉ</span> · ${escapeHtml(c.path)}</div>
          <div class="diff-to">${escapeHtml(truncate(JSON.stringify(c.to), 200))}</div>
        </div>`;
      }
      if (c.kind === 'removed') {
        return `<div class="change">
          <div class="path"><span class="removed">- SUPPRIMÉ</span> · ${escapeHtml(c.path)}</div>
          <div class="diff-from">${escapeHtml(truncate(JSON.stringify(c.from), 200))}</div>
        </div>`;
      }
      // modified
      return `<div class="change">
        <div class="path">${escapeHtml(c.path)}</div>
        <div class="diff-from">${escapeHtml(truncate(String(c.from), 200))}</div>
        <div class="diff-to">→ ${escapeHtml(truncate(String(c.to), 200))}</div>
      </div>`;
    }).join('');
  };

  const truncate = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;
  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const diffObjects = (a, b, path, out) => {
    if (a === b) return;
    if (a == null && b != null) { out.push({ kind: 'added', path, to: b }); return; }
    if (a != null && b == null) { out.push({ kind: 'removed', path, from: a }); return; }
    if (typeof a !== typeof b) {
      out.push({ kind: 'modified', path, from: a, to: b });
      return;
    }
    if (Array.isArray(a)) {
      // shallow compare arrays — if lengths or any element differ, treat as full replace summary
      if (!Array.isArray(b) || a.length !== b.length || JSON.stringify(a) !== JSON.stringify(b)) {
        // Try to give per-index hints for cards
        if (a.length !== b.length) {
          out.push({ kind: 'modified', path, from: `${a.length} éléments`, to: `${b.length} éléments` });
        } else {
          for (let i = 0; i < a.length; i++) {
            diffObjects(a[i], b[i], `${path}[${i}]`, out);
          }
        }
      }
      return;
    }
    if (typeof a === 'object') {
      const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
      for (const k of keys) {
        if (k === 'updatedAt' || k === 'version') continue;
        diffObjects(a?.[k], b?.[k], path ? `${path}.${k}` : k, out);
      }
      return;
    }
    if (a !== b) {
      out.push({ kind: 'modified', path, from: a, to: b });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // BOOT
  // ─────────────────────────────────────────────────────────────
  gateForm.addEventListener('submit', handleGateSubmit);
  btnLogout.addEventListener('click', handleLogout);

  // Close modals on outside click
  [cardModal, catModal, statusModal, footerColsModal, handlesModal, machineModal, materialModal, photosModal, commitModal].forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m);
    });
  });

  // If session has secret, auto-unlock and load
  if (secret) {
    tryUnlock(secret).then((ok) => {
      if (ok) {
        hideGate();
        loadContent();
      } else {
        sessionStorage.removeItem('bp_admin_secret');
        secret = '';
        showGate();
      }
    });
  } else {
    showGate();
  }
})();
