/* ===========================================================
   BULLPRINT 3D — Content renderer
   Reads content.json and populates the page
   =========================================================== */

(function() {
  'use strict';

  const escapeHtml = (s) => {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // converts **bold** to <strong>, escapes everything else
  const renderRichText = (s) => {
    if (!s) return '';
    return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  };

  // word-with-style → span
  const renderWord = (w, delay) => {
    const cls = w.style === 'green' ? 'word green'
              : w.style === 'outline' ? 'word outline'
              : 'word';
    return `<span class="${cls}"${delay !== undefined ? ` style="--d:${delay}s"` : ''}>${escapeHtml(w.text)}</span>`;
  };

  // title lines [[{text,style},...], [...]]
  const renderTitleLines = (lines, animated = false) => {
    let delay = 0.05;
    return lines.map(line => {
      const words = line.map(w => {
        const out = animated ? renderWord(w, delay) : renderWord(w);
        delay += 0.13;
        return out;
      }).join(' ');
      return `<span class="line">${words}</span>`;
    }).join('\n');
  };

  // ===== POPULATE =====
  const fillSite = (data) => {
    // doc title + meta
    if (data.site?.title) document.title = data.site.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && data.site?.description) metaDesc.setAttribute('content', data.site.description);

    // brand (everywhere)
    document.querySelectorAll('[data-bind="brand.name"]').forEach(el => {
      el.textContent = data.site.brandName;
    });
    document.querySelectorAll('[data-bind="brand.sub"]').forEach(el => {
      el.textContent = data.site.brandSub;
    });

    // nav
    const nav = document.querySelector('[data-bind="nav"]');
    if (nav && data.nav) {
      nav.innerHTML = data.nav.map(n =>
        `<a href="${escapeHtml(n.href)}">${escapeHtml(n.label)}</a>`
      ).join('');
    }
    const navCta = document.querySelector('[data-bind="navCta"] span');
    if (navCta) navCta.innerHTML = escapeHtml(data.navCta || '');

    // status bar
    const sb = document.querySelector('[data-bind="statusBar"]');
    if (sb && data.statusBar) {
      const items = data.statusBar.map(s =>
        `<span class="item${s.warn ? ' warn' : ''}"><span class="dot"></span>${escapeHtml(s.text)}</span>`
      ).join('');
      // duplicate for marquee loop
      sb.innerHTML = items + items;
    }

    // hero
    if (data.hero) {
      const setText = (sel, val) => {
        const el = document.querySelector(sel);
        if (el) el.textContent = val || '';
      };
      const setHtml = (sel, val) => {
        const el = document.querySelector(sel);
        if (el) el.innerHTML = val || '';
      };

      setText('[data-bind="hero.rail"]', data.hero.rail);
      setText('[data-bind="hero.eyebrow"] .eyebrow-text', data.hero.eyebrow);

      const heroH1 = document.querySelector('[data-bind="hero.title"]');
      if (heroH1) heroH1.innerHTML = renderTitleLines(data.hero.titleLines, true);

      setHtml('[data-bind="hero.lede"]', renderRichText(data.hero.lede));

      const ctaP = document.querySelector('[data-bind="hero.ctaPrimary"]');
      if (ctaP) {
        ctaP.href = data.hero.ctaPrimaryHref || '#';
        const lbl = ctaP.querySelector('.label');
        if (lbl) lbl.textContent = data.hero.ctaPrimary || '';
      }
      const ctaG = document.querySelector('[data-bind="hero.ctaGhost"]');
      if (ctaG) {
        ctaG.href = data.hero.ctaGhostHref || '#';
        const lbl = ctaG.querySelector('.label');
        if (lbl) lbl.textContent = data.hero.ctaGhost || '';
      }

      // ig link
      const igLink = document.querySelector('[data-bind="site.instagramUrl"]');
      if (igLink) igLink.href = data.site.instagramUrl || '#';
      const igLbl = document.querySelector('[data-bind="site.instagramHandle"]');
      if (igLbl) igLbl.textContent = data.site.instagramHandle || '';

      // featured card
      const fc = data.hero.featuredCard;
      if (fc) {
        const img = document.querySelector('[data-bind="hero.featuredCard.image"]');
        if (img) {
          img.src = fc.image;
          img.alt = fc.title || '';
        }
        setText('[data-bind="hero.featuredCard.tag"]', fc.tag);
        setText('[data-bind="hero.featuredCard.num"]', fc.num);
        setText('[data-bind="hero.featuredCard.title"]', fc.title);
        setText('[data-bind="hero.featuredCard.meta"]', fc.meta);
      }
    }

    // gallery
    if (data.gallery) {
      const sn = document.querySelector('[data-bind="gallery.sectionNum"]');
      if (sn) sn.textContent = data.gallery.sectionNum + ' /';
      const sl = document.querySelector('[data-bind="gallery.sectionLabel"]');
      if (sl) sl.textContent = data.gallery.sectionLabel;

      const gt = document.querySelector('[data-bind="gallery.title"]');
      if (gt) gt.innerHTML = renderTitleLines(data.gallery.titleLines).replace(/\n/g, '<br>');

      const gm = document.querySelector('[data-bind="gallery.meta"]');
      if (gm && data.gallery.metaLines) {
        gm.innerHTML = data.gallery.metaLines.map(escapeHtml).join('<br>');
      }

      // categories
      const catStack = document.querySelector('[data-bind="gallery.categories"]');
      if (catStack && data.gallery.categories) {
        catStack.innerHTML = data.gallery.categories.map(cat => {
          const cards = (cat.cards || []).map(card => {
            const badgeCls = card.badgeStyle && card.badgeStyle !== 'default' ? ' ' + card.badgeStyle : '';
            return `<a href="#order" class="card">
              <img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" loading="lazy">
              ${card.badge ? `<span class="badge${badgeCls}">${escapeHtml(card.badge)}</span>` : ''}
              <div class="card-foot">
                <div class="card-cat">${escapeHtml(card.category || '')}</div>
                <div class="card-name">${escapeHtml(card.name || '')}</div>
                <div class="card-sub">${escapeHtml(card.sub || '')}</div>
              </div>
            </a>`;
          }).join('');
          const count = (cat.cards || []).length;
          return `<section class="cat-row reveal">
            <header class="cat-head">
              <div>
                <div class="cat-num">CAT · ${escapeHtml(cat.num)}</div>
                <h3>${escapeHtml(cat.name)}</h3>
              </div>
              <div class="cat-controls">
                <span class="cat-count">${count} pièce${count > 1 ? 's' : ''}</span>
                <button class="cat-nav prev" aria-label="Précédent">←</button>
                <button class="cat-nav next" aria-label="Suivant">→</button>
              </div>
            </header>
            <div class="cat-track">${cards}</div>
          </section>`;
        }).join('');
      }
    }

    // atelier
    if (data.atelier) {
      const A = data.atelier;

      // section label  →  <em>05 /</em> L'ATELIER
      const lbl = document.querySelector('[data-bind="atelier.label"]');
      if (lbl && A.label) lbl.innerHTML = `<em>${escapeHtml(A.label.num)} /</em> ${escapeHtml(A.label.text)}`;

      // title  →  parts with optional style / line break
      const at = document.querySelector('[data-bind="atelier.title"]');
      if (at && Array.isArray(A.title)) {
        at.innerHTML = A.title.map(p => {
          if (p.br) return '<br>';
          const cls = p.style === 'green' ? ' class="green"' : p.style === 'outline' ? ' class="outline"' : '';
          return cls ? `<span${cls}>${escapeHtml(p.t)}</span>` : escapeHtml(p.t);
        }).join('');
      }

      // lede paragraphs (supports **bold**)
      const al = document.querySelector('[data-bind="atelier.lede"]');
      if (al && Array.isArray(A.lede)) al.innerHTML = A.lede.map(p => `<p>${renderRichText(p)}</p>`).join('');

      // photo strip + tagline (Elodie's spec — replaces the old single detailImage)
      const strip = document.querySelector('[data-bind="atelier.photos"]');
      if (strip && Array.isArray(A.photos)) {
        strip.innerHTML = A.photos.map((p, i) =>
          `<figure class="atelier-photo"><img src="${escapeHtml(p)}" alt="L'atelier Bullprint 3D — photo ${i + 1}" loading="lazy"></figure>`
        ).join('');
      }
      const atg = document.querySelector('[data-bind="atelier.tagline"]');
      if (atg) atg.textContent = A.tagline || '';

      // bench status bar
      const abl = document.querySelector('[data-bind="atelier.benchLive"]');
      if (abl) abl.textContent = A.benchLive || '';
      const abn = document.querySelector('[data-bind="atelier.benchNote"]');
      if (abn) abn.textContent = A.benchNote || '';

      // machines
      const bench = document.querySelector('[data-bind="atelier.machines"]');
      if (bench && Array.isArray(A.machines)) {
        bench.innerHTML = A.machines.map(m => {
          const printing = m.status === 'printing';
          const chips = (m.chips || []).map(c => `<span class="chip">${escapeHtml(c)}</span>`).join('');
          return `<article class="machine" tabindex="0">
            <div class="m-photo"><img src="${escapeHtml(m.image)}" alt="Bambu Lab ${escapeHtml(m.name)}" loading="lazy"></div>
            ${printing ? '<div class="m-prog"><span></span></div>' : ''}
            <div class="m-top">
              <span class="m-status${printing ? ' printing' : ''}"><span class="dot"></span>${escapeHtml(m.statusLabel)}</span>
              <span class="m-idx">${escapeHtml(m.idx)}</span>
            </div>
            <div class="m-name">${escapeHtml(m.name)}</div>
            <div class="m-sub">${escapeHtml(m.tagline)}</div>
            <div class="m-chips">${chips}</div>
            <p class="m-best"><b>${escapeHtml(m.bestLead)}</b> ${escapeHtml(m.bestRest)}</p>
          </article>`;
        }).join('');
      }

      // materials label  →  <em>·</em> LA MATIÈRE …
      const aml = document.querySelector('[data-bind="atelier.materialsLabel"]');
      if (aml) aml.innerHTML = `<em>·</em> ${escapeHtml(A.materialsLabel || '')}`;

      // materials — icon id maps to an inline SVG (concept of the infographic, rebuilt natively)
      const ICONS = {
        leaf:   '<path d="M11 20A7 7 0 0 1 4 13C4 8 9 4 20 4c0 11-4 16-9 16Z"/><path d="M11 20c0-5 2-8 6-10"/>',
        heat:   '<path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0Z"/>',
        impact: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.2v3M12 18.8v3M2.2 12h3M18.8 12h3M5.1 5.1l2.1 2.1M16.8 16.8l2.1 2.1M18.9 5.1l-2.1 2.1M7.2 16.8l-2.1 2.1"/>',
        sun:    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
        flex:   '<path d="M3 12c3-6 6-6 9 0s6 6 9 0"/>',
        plus:   '<path d="M12 5.2v13.6M5.2 12h13.6"/>'
      };
      const mats = document.querySelector('[data-bind="atelier.materials"]');
      if (mats && Array.isArray(A.materials)) {
        mats.innerHTML = A.materials.map(mt => {
          const icon = ICONS[mt.icon] || '';
          return `<article class="mat" tabindex="0">
            <div class="swatch finish-${escapeHtml(mt.finish)}"><img src="${escapeHtml(mt.image)}" alt="Filament ${escapeHtml(mt.code)}" loading="lazy"><span class="sheen"></span></div>
            <div class="mat-body">
              <div class="mat-head">
                <span class="mat-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span>
                <span class="mat-code">${escapeHtml(mt.code)}</span>
              </div>
              <div class="mat-prop">${escapeHtml(mt.property)}</div>
              <p class="mat-desc">${escapeHtml(mt.desc)}</p>
            </div>
          </article>`;
        }).join('');
      }
    }

    // custom
    if (data.custom) {
      const sn = document.querySelector('[data-bind="custom.sectionNum"]');
      if (sn) sn.textContent = data.custom.sectionNum + ' /';
      const sl = document.querySelector('[data-bind="custom.sectionLabel"]');
      if (sl) sl.textContent = data.custom.sectionLabel;

      const ct = document.querySelector('[data-bind="custom.title"]');
      if (ct) ct.innerHTML = renderTitleLines(data.custom.titleLines).replace(/\n/g, '<br>');

      const cp = document.querySelector('[data-bind="custom.paragraph"]');
      if (cp) cp.innerHTML = renderRichText(data.custom.paragraph);

      const ctaP = document.querySelector('[data-bind="custom.ctaPrimary"] .label');
      if (ctaP) ctaP.textContent = data.custom.ctaPrimary;
      const ctaG = document.querySelector('[data-bind="custom.ctaGhost"] .label');
      if (ctaG) ctaG.textContent = data.custom.ctaGhost;

      const steps = document.querySelector('[data-bind="custom.steps"]');
      if (steps && data.custom.steps) {
        steps.innerHTML = data.custom.steps.map(s => `
          <div class="step">
            <div class="step-num">${escapeHtml(s.num)}</div>
            <div class="step-text">
              <h4>${escapeHtml(s.title)}</h4>
              <p>${escapeHtml(s.desc)}</p>
            </div>
          </div>
        `).join('');
      }
    }

    // order
    if (data.order) {
      const sn = document.querySelector('[data-bind="order.sectionNum"]');
      if (sn) sn.textContent = data.order.sectionNum + ' /';
      const sl = document.querySelector('[data-bind="order.sectionLabel"]');
      if (sl) sl.textContent = data.order.sectionLabel;

      const ot = document.querySelector('[data-bind="order.title"]');
      if (ot) ot.innerHTML = renderTitleLines(data.order.titleLines).replace(/\n/g, '<br>');

      const op = document.querySelector('[data-bind="order.paragraph"]');
      if (op) op.textContent = data.order.paragraph;

      const ctaP = document.querySelector('[data-bind="order.ctaPrimary"] .label');
      if (ctaP) ctaP.textContent = data.order.ctaPrimary;
      const ctaG = document.querySelector('[data-bind="order.ctaGhost"] .label');
      if (ctaG) ctaG.textContent = data.order.ctaGhost;

      // also fix mailto on primary
      const ctaPlink = document.querySelector('[data-bind="order.ctaPrimary"]');
      if (ctaPlink && data.site?.email) {
        ctaPlink.href = 'mailto:' + data.site.email;
      }
      const ctaGlink = document.querySelector('[data-bind="order.ctaGhost"]');
      if (ctaGlink && data.site?.instagramUrl) {
        ctaGlink.href = data.site.instagramUrl;
      }

      const handles = document.querySelector('[data-bind="order.handles"]');
      if (handles && data.order.handles) {
        handles.innerHTML = data.order.handles.map(h =>
          `<a href="${escapeHtml(h.href)}">${escapeHtml(h.label)}</a>`
        ).join('');
      }
    }

    // footer
    if (data.footer) {
      const ft = document.querySelector('[data-bind="footer.tagline"]');
      if (ft) ft.textContent = data.footer.tagline;

      const fc = document.querySelector('[data-bind="footer.columns"]');
      if (fc && data.footer.columns) {
        fc.innerHTML = data.footer.columns.map(col => `
          <div>
            <h4>${escapeHtml(col.title)}</h4>
            ${(col.links || []).map(l =>
              `<a href="${escapeHtml(l.href)}" class="f-link">${escapeHtml(l.label)}</a>`
            ).join('')}
          </div>
        `).join('');
      }

      const fcp = document.querySelector('[data-bind="footer.copyright"]');
      if (fcp) fcp.textContent = data.footer.copyright;
      const fsg = document.querySelector('[data-bind="footer.signature"]');
      if (fsg) {
        // teal-color the EDMASTER & CLAUDIUS part
        const sig = escapeHtml(data.footer.signature);
        const styled = sig.replace(/(EDMASTER &amp; CLAUDIUS|EDMASTER &amp;amp; CLAUDIUS)/i, 
          '<span class="sig-teal">$1</span>');
        fsg.innerHTML = styled;
      }
    }
  };

  // ===== PUBLIC RE-RENDER HOOK =====
  // Admin uses this to update the page after edits without reloading the script.
  window.__BULLPRINT_RENDER__ = (data) => {
    if (!data) return;
    fillSite(data);
    document.dispatchEvent(new CustomEvent('content:ready', { detail: data }));
  };

  // ===== LOAD =====
  // Allow content to come from a preloaded global (used by admin) OR from content.json
  const init = async () => {
    let data;
    if (window.__BULLPRINT_CONTENT__) {
      // Admin path — content already supplied
      window.__BULLPRINT_RENDER__(window.__BULLPRINT_CONTENT__);
      return;
    }
    try {
      const res = await fetch('content.json?v=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } catch (e) {
      console.error('Could not load content.json', e);
      const errBox = document.createElement('div');
      errBox.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;background:#c4351f;color:#fff;padding:14px;z-index:9999;font-family:monospace;font-size:12px;border-radius:3px';
      errBox.textContent = 'CONTENT LOAD ERROR: ' + e.message + '. Vérifier que content.json existe et est valide.';
      document.body.appendChild(errBox);
      return;
    }

    window.__BULLPRINT_RENDER__(data);
  };

  if (window.__BULLPRINT_NO_AUTOLOAD__) {
    // Admin context — caller will invoke __BULLPRINT_RENDER__ when ready
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
