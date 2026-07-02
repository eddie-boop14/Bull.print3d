/* ===========================================================
   BULLPRINT 3D — Boutique client (cart + checkout + retour)
   Architecture portée de "La Serre à Colas", rail SumUp.

   - Panier localStorage `bp_cart_v1` : les prix stockés servent
     UNIQUEMENT à l'affichage. Le montant débité est recalculé
     côté serveur (create-checkout.js) depuis content.json —
     falsifier le localStorage ne change rien à l'encaissement.
   - Frais de port : UNE source de vérité, `shop.shipping` dans
     content.json (lu ici pour l'affichage, relu par la fonction
     pour le calcul réel — jamais codé en dur en deux endroits).
   =========================================================== */

(function () {
  'use strict';

  const CART_KEY = 'bp_cart_v1';
  const PENDING_KEY = 'bp_pending_order_v1';

  let shopData = null;   // data.shop from content.json (via content:ready)

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Parseur de prix tolérant à la virgule FR — même logique que la fonction
  const parsePrice = (s) => {
    const n = parseFloat(String(s == null ? '' : s).replace(/[^\d,.-]/g, '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const fmtEUR = (n) => n.toFixed(2).replace('.', ',') + ' €';

  const slugify = (s) => String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const skuOf = (productId, variantLabel) =>
    variantLabel ? productId + '-' + slugify(variantLabel) : productId;

  // ── Cart state ────────────────────────────────────────────
  const loadCart = () => {
    try {
      const c = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(c) ? c.filter(i => i && i.sku && i.qty > 0) : [];
    } catch { return []; }
  };
  const saveCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCartUI();
  };

  const addToCart = (item) => {
    const cart = loadCart();
    const existing = cart.find(i => i.sku === item.sku);
    if (existing) existing.qty = Math.min(99, existing.qty + item.qty);
    else cart.push(item);
    saveCart(cart);
    openDrawer();
  };

  const setQty = (sku, qty) => {
    let cart = loadCart();
    const it = cart.find(i => i.sku === sku);
    if (!it) return;
    it.qty = Math.max(0, Math.min(99, qty));
    cart = cart.filter(i => i.qty > 0);
    saveCart(cart);
  };

  const clearCart = () => saveCart([]);

  // ── Totals (display only — server recomputes for the charge) ──
  const shippingFor = (subtotal, method) => {
    const sh = shopData?.shipping || {};
    if (method === 'pickup') return 0;
    const flat = Number(sh.flat) || 0;
    const freeAbove = Number(sh.freeAbove) || Infinity;
    return subtotal >= freeAbove ? 0 : flat;
  };

  const totals = (method) => {
    const cart = loadCart();
    const subtotal = cart.reduce((t, i) => t + parsePrice(i.price) * i.qty, 0);
    const shipping = cart.length ? shippingFor(subtotal, method || 'domicile') : 0;
    return { subtotal, shipping, total: subtotal + shipping, count: cart.reduce((n, i) => n + i.qty, 0) };
  };

  // ── Drawer UI (boutique page) ─────────────────────────────
  const drawer = () => $('#cartDrawer');
  const openDrawer = () => { drawer()?.classList.add('open'); $('#cartOverlay')?.classList.add('shown'); };
  const closeDrawer = () => { drawer()?.classList.remove('open'); $('#cartOverlay')?.classList.remove('shown'); };

  const renderCartUI = () => {
    const t = totals();
    // badge (present on boutique + checkout)
    $$('[data-cart-count]').forEach(el => {
      el.textContent = t.count;
      el.style.display = t.count ? '' : 'none';
    });

    const list = $('#cartItems');
    if (list) {
      const cart = loadCart();
      if (!cart.length) {
        list.innerHTML = '<div class="cart-empty">Panier vide.<br>Les belles pièces sont juste là ↓</div>';
      } else {
        list.innerHTML = cart.map(i => `
          <div class="cart-item" data-sku="${escapeHtml(i.sku)}">
            <img src="${escapeHtml(i.image || '')}" alt="">
            <div class="ci-body">
              <div class="ci-name">${escapeHtml(i.name)}</div>
              ${i.variantLabel ? `<div class="ci-variant">${escapeHtml(i.variantLabel)}</div>` : ''}
              <div class="ci-price">${escapeHtml(i.price)} €</div>
            </div>
            <div class="ci-qty">
              <button type="button" data-cart-dec aria-label="Moins">−</button>
              <span>${i.qty}</span>
              <button type="button" data-cart-inc aria-label="Plus">+</button>
            </div>
          </div>`).join('');
      }
      const foot = $('#cartFooter');
      if (foot) {
        const sh = shopData?.shipping || {};
        const freeNote = Number(sh.freeAbove) > 0 ? `Offerts dès ${fmtEUR(Number(sh.freeAbove)).replace(',00', '')}` : '';
        foot.innerHTML = cart.length ? `
          <div class="cart-line"><span>Sous-total</span><b>${fmtEUR(t.subtotal)}</b></div>
          <div class="cart-line dim"><span>Livraison (calculée à l'étape suivante)</span><span>${escapeHtml(freeNote)}</span></div>
          <a class="btn btn-primary cart-checkout" href="/checkout.html"><span class="label">Commander</span> <span class="arrow">→</span></a>
        ` : '';
      }
    }

    renderCheckoutRecap();
  };

  // ── Boutique page bindings ────────────────────────────────
  const bindBoutique = () => {
    const grid = $('[data-bind="shop.products"]');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.shop-add');
      if (!btn) return;
      const card = btn.closest('.shop-card');
      const pid = card?.dataset.productId;
      const product = (shopData?.products || []).find(p => p.id === pid);
      if (!product) return;
      const visibleVariants = (product.variants || []).filter(v => v.visible);
      const sel = card.querySelector('.shop-variant');
      const vIdx = Math.max(0, parseInt(sel?.value || '0', 10) || 0);
      const variant = visibleVariants[vIdx] || visibleVariants[0];
      if (!variant) return;
      addToCart({
        sku: skuOf(product.id, variant.label),
        productId: product.id,
        variantLabel: variant.label || '',
        name: product.name,
        price: variant.price,   // display only
        image: product.image,
        qty: 1,
      });
    });

    $('#cartOpen')?.addEventListener('click', openDrawer);
    $('#cartClose')?.addEventListener('click', closeDrawer);
    $('#cartOverlay')?.addEventListener('click', closeDrawer);
  };

  // quantity buttons (drawer + checkout recap share markup)
  document.addEventListener('click', (e) => {
    const dec = e.target.closest('[data-cart-dec]');
    const inc = e.target.closest('[data-cart-inc]');
    if (!dec && !inc) return;
    const sku = e.target.closest('[data-sku]')?.dataset.sku;
    if (!sku) return;
    const it = loadCart().find(i => i.sku === sku);
    if (!it) return;
    setQty(sku, it.qty + (inc ? 1 : -1));
  });

  // ── Checkout page ─────────────────────────────────────────
  const renderCheckoutRecap = () => {
    const recap = $('#checkoutRecap');
    if (!recap) return;
    const cart = loadCart();
    const method = $('input[name="shippingMethod"]:checked')?.value || 'domicile';
    const t = totals(method);
    if (!cart.length) {
      recap.innerHTML = '<div class="cart-empty">Panier vide. <a href="/boutique.html">Retour à la boutique →</a></div>';
      const btn = $('#payBtn');
      if (btn) btn.disabled = true;
      return;
    }
    const btn = $('#payBtn');
    if (btn) btn.disabled = false;
    recap.innerHTML = cart.map(i => `
      <div class="cart-item" data-sku="${escapeHtml(i.sku)}">
        <img src="${escapeHtml(i.image || '')}" alt="">
        <div class="ci-body">
          <div class="ci-name">${escapeHtml(i.name)}</div>
          ${i.variantLabel ? `<div class="ci-variant">${escapeHtml(i.variantLabel)}</div>` : ''}
          <div class="ci-price">${escapeHtml(i.price)} €</div>
        </div>
        <div class="ci-qty">
          <button type="button" data-cart-dec aria-label="Moins">−</button>
          <span>${i.qty}</span>
          <button type="button" data-cart-inc aria-label="Plus">+</button>
        </div>
      </div>`).join('') + `
      <div class="cart-line"><span>Sous-total</span><b>${fmtEUR(t.subtotal)}</b></div>
      <div class="cart-line"><span>Livraison</span><b>${t.shipping === 0 ? 'Offerte' : fmtEUR(t.shipping)}</b></div>
      <div class="cart-line total"><span>Total</span><b>${fmtEUR(t.total)}</b></div>
      <div class="cart-note">Montant recalculé et vérifié au paiement.</div>`;
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const CP_RE = /^\d{5}$/;

  const bindCheckout = () => {
    const form = $('#checkoutForm');
    if (!form) return;

    // pickup toggle hides address block
    $$('input[name="shippingMethod"]').forEach(r => r.addEventListener('change', () => {
      const pickup = $('input[name="shippingMethod"]:checked')?.value === 'pickup';
      $('#addressBlock').style.display = pickup ? 'none' : '';
      renderCheckoutRecap();
    }));

    // hide pickup option if disabled in config
    document.addEventListener('content:ready', () => {
      if (shopData && shopData.shipping?.pickup?.enabled === false) {
        $('#pickupOption')?.remove();
      }
      const pl = $('#pickupLabel');
      if (pl && shopData?.shipping?.pickup?.label) pl.textContent = shopData.shipping.pickup.label;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#checkoutError');
      err.textContent = '';

      const cart = loadCart();
      if (!cart.length) { err.textContent = 'Panier vide.'; return; }

      const f = new FormData(form);
      const method = f.get('shippingMethod') || 'domicile';
      const customer = {
        name: String(f.get('name') || '').trim(),
        email: String(f.get('email') || '').trim(),
        phone: String(f.get('phone') || '').trim(),
        address: String(f.get('address') || '').trim(),
        postcode: String(f.get('postcode') || '').trim(),
        city: String(f.get('city') || '').trim(),
        notes: String(f.get('notes') || '').trim().slice(0, 500),
      };

      // same rules as the function — fail fast with clean FR messages
      if (customer.name.length < 2) { err.textContent = 'Nom requis.'; return; }
      if (!EMAIL_RE.test(customer.email)) { err.textContent = 'Email invalide.'; return; }
      if (method === 'domicile') {
        if (customer.address.length < 5) { err.textContent = 'Adresse requise pour la livraison.'; return; }
        if (!CP_RE.test(customer.postcode)) { err.textContent = 'Code postal invalide (5 chiffres).'; return; }
        if (customer.city.length < 2) { err.textContent = 'Ville requise.'; return; }
      }

      const btn = $('#payBtn');
      btn.disabled = true;
      btn.querySelector('.label').textContent = 'Création du paiement…';

      try {
        const res = await fetch('/.netlify/functions/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: cart.map(i => ({ sku: i.sku, qty: i.qty })),
            customer,
            shippingMethod: method,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.checkoutUrl) {
          throw new Error(data.error || 'Le paiement n\'a pas pu être initialisé.');
        }
        // keep what the return page needs to verify + log the order
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({
          checkoutId: data.checkoutId,
          reference: data.reference,
          cart,
          customer,
          shippingMethod: method,
        }));
        window.location.href = data.checkoutUrl;
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
        btn.querySelector('.label').textContent = 'Payer par carte';
      }
    });
  };

  // ── Payment return page (paiement-ok.html) ────────────────
  // The redirect is NEVER trusted: we ask our function to GET the
  // checkout status from SumUp server-side. Only PAID renders success.
  const bindReturnPage = () => {
    const box = $('#paymentResult');
    if (!box) return;

    const pendingRaw = sessionStorage.getItem(PENDING_KEY);
    const params = new URLSearchParams(location.search);
    const pending = (() => { try { return JSON.parse(pendingRaw || 'null'); } catch { return null; } })();
    const checkoutId = pending?.checkoutId || params.get('checkout_id') || params.get('id');

    if (!checkoutId) {
      box.innerHTML = `<h2>Aucune commande en attente</h2>
        <p>Si tu viens de payer, vérifie tes emails — sinon direction <a href="/boutique.html">la boutique</a>.</p>`;
      return;
    }

    box.innerHTML = '<h2>Vérification du paiement…</h2><p>Deux secondes, on vérifie auprès de la banque.</p>';

    fetch('/.netlify/functions/verify-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkoutId, order: pending ? {
        reference: pending.reference,
        cart: (pending.cart || []).map(i => ({ sku: i.sku, qty: i.qty })),
        customer: pending.customer,
        shippingMethod: pending.shippingMethod,
      } : null }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'PAID') {
          sessionStorage.removeItem(PENDING_KEY);
          clearCart();
          box.innerHTML = `
            <div class="pay-ok-mark">✓</div>
            <h2>Paiement confirmé</h2>
            <p class="pay-ref">Référence : <b>${escapeHtml(data.reference || pending?.reference || '')}</b></p>
            <p>Merci ! La commande part en impression. ${escapeHtml(pending?.cart?.[0] ? '' : '')}
            Un email de confirmation arrive — réponse de l'atelier sous 24h.</p>
            <p class="dim">Chaque pièce est imprimée à la commande : compte le délai indiqué sur la fiche produit.</p>
            <a class="btn btn-ghost" href="/"><span class="label">Retour au site</span></a>`;
        } else if (data.status === 'PENDING') {
          box.innerHTML = `<h2>Paiement en cours de traitement</h2>
            <p>La banque n'a pas encore confirmé. Recharge cette page dans une minute — ou écris-nous si ça persiste.</p>`;
        } else {
          box.innerHTML = `<h2>Paiement non confirmé</h2>
            <p>Statut : ${escapeHtml(data.status || 'inconnu')}. Rien n'a été débité si le paiement n'a pas abouti.</p>
            <a class="btn btn-primary" href="/checkout.html"><span class="label">Réessayer</span> <span class="arrow">→</span></a>`;
        }
      })
      .catch(() => {
        box.innerHTML = `<h2>Vérification impossible</h2>
          <p>Impossible de joindre le serveur. Si tu as payé, tu recevras l'email de confirmation — sinon écris-nous.</p>`;
      });
  };

  // ── Boot ──────────────────────────────────────────────────
  document.addEventListener('content:ready', (e) => {
    shopData = e.detail?.shop || null;
    renderCartUI();
  });

  const boot = () => {
    bindBoutique();
    bindCheckout();
    bindReturnPage();
    renderCartUI();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
