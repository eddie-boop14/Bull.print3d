/* ==========================================================
   BULLPRINT 3D — Front-end logic
   ========================================================== */

(() => {
  'use strict';

  /* ----- CUSTOM CURSOR ----- */
  const cursor = document.querySelector('.cursor');
  const cursorDot = document.querySelector('.cursor-dot');
  if (cursor && window.matchMedia('(hover:hover)').matches) {
    let mx = 0, my = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      cursorDot.style.transform = `translate(${mx - 2}px, ${my - 2}px)`;
    });
    const tick = () => {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      cursor.style.transform = `translate(${cx - 12}px, ${cy - 12}px)`;
      requestAnimationFrame(tick);
    };
    tick();

    document.querySelectorAll('a, button, .piece, .chip, .step').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('expand'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('expand'));
    });
  }

  /* ----- INTRO SEQUENCE ----- */
  const intro = document.querySelector('.intro');
  const html = document.documentElement;
  html.classList.add('locked');

  // build the print letters
  const buildPrintWord = (word, baseDelay, isGreen) => {
    const el = document.createElement('div');
    el.className = 'print-word' + (isGreen ? ' green' : '');
    el.style.setProperty('--scan', baseDelay + 'ms');
    const chars = word.split('');
    chars.forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.style.setProperty('--d', (baseDelay + i * 55) + 'ms');
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      el.appendChild(span);
    });
    return el;
  };

  const stage = document.querySelector('.print-stage');
  if (stage) {
    stage.appendChild(buildPrintWord('BULLPRINT', 200, false));
    stage.appendChild(buildPrintWord('FAIT-LE', 800, true));
    stage.appendChild(buildPrintWord('EN 3D', 1400, false));
  }

  // progress counter
  const pct = document.querySelector('.progress-pct');
  if (pct) {
    let n = 0;
    const ramp = setInterval(() => {
      n += Math.random() * 6 + 2;
      if (n >= 100) { n = 100; clearInterval(ramp); }
      pct.textContent = String(Math.floor(n)).padStart(3, '0') + '%';
    }, 90);
  }

  // dismiss intro
  const dismissIntro = () => {
    intro.classList.add('done');
    document.body.classList.add('intro-done');
    document.querySelector('.topbar')?.classList.add('shown');
    document.querySelector('.status-bar')?.classList.add('shown');
    html.classList.remove('locked');
    setTimeout(() => { intro.style.display = 'none'; }, 1200);
  };

  setTimeout(dismissIntro, 3400);
  // also let user click anywhere to skip
  intro?.addEventListener('click', dismissIntro);

  /* ----- HERO PARALLAX (subtle, mouse-driven) ----- */
  const heroCard = document.querySelector('.hero-card');
  if (heroCard && window.matchMedia('(hover:hover)').matches) {
    const hero = document.querySelector('.hero');
    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5);
      const y = ((e.clientY - rect.top) / rect.height - 0.5);
      heroCard.style.transform = `perspective(1200px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) translateZ(0)`;
    });
    hero.addEventListener('mouseleave', () => {
      heroCard.style.transform = '';
    });
  }

  /* ----- REVEAL ON SCROLL ----- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  const reveals = [
    ...document.querySelectorAll('.reveal'),
    ...document.querySelectorAll('.grid .piece'),
    ...document.querySelectorAll('.stat'),
  ];
  reveals.forEach(el => io.observe(el));

  // Fallback: after a delay, force-reveal anything not yet visible (handles print, no-scroll, etc.)
  setTimeout(() => {
    reveals.forEach(el => {
      if (!el.classList.contains('visible')) {
        el.classList.add('visible');
        io.unobserve(el);
      }
    });
  }, 2500);

  /* ----- CHIP FILTERING ----- */
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const cat = chip.dataset.cat;
      document.querySelectorAll('.piece').forEach(p => {
        if (cat === 'all' || p.dataset.cat?.split(',').includes(cat)) {
          p.dataset.hidden = 'false';
        } else {
          p.dataset.hidden = 'true';
        }
      });
    });
  });

  /* ----- SHOWCASE STICKY SCROLL ----- */
  const showcaseItems = document.querySelectorAll('.showcase-item');
  const showcaseImages = document.querySelectorAll('.showcase-img');
  if (showcaseItems.length) {
    const sio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = parseInt(e.target.dataset.idx, 10);
          showcaseItems.forEach(it => it.classList.remove('active'));
          showcaseImages.forEach(im => im.classList.remove('active'));
          e.target.classList.add('active');
          if (showcaseImages[idx]) showcaseImages[idx].classList.add('active');
        }
      });
    }, { threshold: 0.5, rootMargin: '-30% 0px -30% 0px' });
    showcaseItems.forEach(it => sio.observe(it));
    // activate first by default
    showcaseItems[0]?.classList.add('active');
    showcaseImages[0]?.classList.add('active');
  }

  /* ----- PIECE MAGNETIC HOVER (subtle tilt) ----- */
  if (window.matchMedia('(hover:hover)').matches) {
    document.querySelectorAll('.piece').forEach(p => {
      p.addEventListener('mousemove', (e) => {
        const rect = p.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5);
        const y = ((e.clientY - rect.top) / rect.height - 0.5);
        p.style.transform = `translateY(-6px) perspective(800px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
      });
      p.addEventListener('mouseleave', () => {
        p.style.transform = '';
      });
    });
  }

})();
