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
      const sn = document.querySelector('[data-bind="atelier.sectionNum"]');
      if (sn) sn.textContent = data.atelier.sectionNum + ' /';
      const sl = document.querySelector('[data-bind="atelier.sectionLabel"]');
      if (sl) sl.textContent = data.atelier.sectionLabel;

      const at = document.querySelector('[data-bind="atelier.title"]');
      if (at) at.innerHTML = renderTitleLines(data.atelier.titleLines).replace(/\n/g, '<br>');

      const ap = document.querySelector('[data-bind="atelier.paragraphs"]');
      if (ap && data.atelier.paragraphs) {
        ap.innerHTML = data.atelier.paragraphs.map(p => `<p>${renderRichText(p)}</p>`).join('');
      }

      const ast = document.querySelector('[data-bind="atelier.postes"]');
      if (ast && data.atelier.postes) {
        ast.innerHTML = data.atelier.postes.map(p => `
          <div class="atelier-block">
            <div class="ab-photo">
              <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
              <span class="ab-bracket tl"></span>
              <span class="ab-bracket br"></span>
            </div>
            <div class="ab-label">${escapeHtml(p.label)}</div>
            <div class="ab-name">${escapeHtml(p.name)}</div>
            <div class="ab-desc">${escapeHtml(p.desc)}</div>
          </div>
        `).join('');
      }

      const af = document.querySelector('[data-bind="atelier.footNote"]');
      if (af) af.innerHTML = `<em>${escapeHtml(data.atelier.footNote)}</em>`;
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
