/**
 * Boutique — logique partagée des fonctions (create-checkout / verify-checkout).
 *
 * LE PRINCIPE (hérité de la Serre à Colas) : le serveur ne fait JAMAIS
 * confiance au panier client. Les prix sont relus depuis content.json,
 * seule source de vérité — un localStorage falsifié change l'affichage,
 * jamais le montant débité.
 *
 * Pas un endpoint : ce fichier vit dans lib/ pour ne pas être publié
 * comme fonction par Netlify.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Parseur de prix FR — tolérant à la virgule ("24,90" → 24.9) ─────
const parsePrice = (s) => {
  const n = parseFloat(String(s == null ? '' : s).replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

const slugify = (s) => String(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const skuOf = (productId, variantLabel) =>
  variantLabel ? productId + '-' + slugify(variantLabel) : productId;

// ── content.json : fichier embarqué au déploiement, sinon le site ───
// (netlify.toml → [functions] included_files = ["content.json"])
async function loadContent() {
  const candidates = [
    process.env.CONTENT_JSON_PATH,                          // tests / overrides
    path.join(__dirname, '..', '..', '..', 'content.json'), // repo layout
    path.join(process.cwd(), 'content.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* next */ }
  }
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (base) {
    const r = await fetch(base + '/content.json?fn=' + Date.now());
    if (r.ok) return r.json();
  }
  throw new Error('content.json introuvable côté serveur');
}

// ── Carte des prix serveur : sku → { price, name, variantLabel } ────
// Seuls les produits ET variantes visibles sont achetables.
function buildPriceMap(shop) {
  const map = new Map();
  for (const p of (shop.products || [])) {
    if (!p.visible) continue;
    for (const v of (p.variants || [])) {
      if (!v.visible) continue;
      map.set(skuOf(p.id, v.label), {
        price: parsePrice(v.price),
        name: p.name,
        variantLabel: v.label || '',
      });
    }
  }
  return map;
}

// ── Port : une seule source (shop.shipping), miroir de cart.js ──────
function computeShipping(shop, subtotal, method) {
  const sh = shop.shipping || {};
  if (method === 'pickup') {
    if (sh.pickup && sh.pickup.enabled === false) return { error: 'retrait atelier indisponible' };
    return { amount: 0 };
  }
  const flat = Number(sh.flat) || 0;
  const freeAbove = Number(sh.freeAbove) || Infinity;
  return { amount: subtotal >= freeAbove ? 0 : flat };
}

// ── Validation panier + client — messages FR propres ────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CP_RE = /^\d{5}$/;

const clean = (s, max) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

function validateCart(cart, priceMap) {
  if (!Array.isArray(cart) || !cart.length) return { error: 'panier vide' };
  if (cart.length > 40) return { error: 'panier trop grand' };
  const items = [];
  let subtotal = 0;
  for (const line of cart) {
    const sku = clean(line && line.sku, 120);
    const qty = Math.trunc(Number(line && line.qty));
    if (!sku || !Number.isFinite(qty) || qty < 1 || qty > 99) {
      return { error: 'ligne de panier invalide' };
    }
    const entry = priceMap.get(sku);
    if (!entry) return { error: `article indisponible : ${sku}` };
    if (!(entry.price > 0)) return { error: `prix non validé pour : ${sku}` };
    items.push({ sku, qty, price: entry.price, name: entry.name, variantLabel: entry.variantLabel });
    subtotal += entry.price * qty;
  }
  return { items, subtotal: round2(subtotal) };
}

function validateCustomer(raw, method) {
  const c = {
    name: clean(raw && raw.name, 120),
    email: clean(raw && raw.email, 160),
    phone: clean(raw && raw.phone, 40),
    address: clean(raw && raw.address, 240),
    postcode: clean(raw && raw.postcode, 12),
    city: clean(raw && raw.city, 120),
    notes: clean(raw && raw.notes, 500),
  };
  if (c.name.length < 2) return { error: 'nom requis' };
  if (!EMAIL_RE.test(c.email)) return { error: 'email invalide' };
  if (method === 'domicile') {
    if (c.address.length < 5) return { error: 'adresse requise' };
    if (!CP_RE.test(c.postcode)) return { error: 'code postal invalide (5 chiffres)' };
    if (c.city.length < 2) return { error: 'ville requise' };
  }
  return { customer: c };
}

// ── Référence commande : BP-YYMMDD-XXXX ─────────────────────────────
function makeReference() {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2)
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) rand += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `BP-${ymd}-${rand}`;
}

// ── Montant total serveur pour un panier donné ──────────────────────
async function priceOrder(cart, shippingMethod) {
  const content = await loadContent();
  const shop = content.shop;
  if (!shop) return { error: 'boutique non configurée' };
  const priceMap = buildPriceMap(shop);
  const cartRes = validateCart(cart, priceMap);
  if (cartRes.error) return cartRes;
  const method = shippingMethod === 'pickup' ? 'pickup' : 'domicile';
  const ship = computeShipping(shop, cartRes.subtotal, method);
  if (ship.error) return ship;
  return {
    shop,
    items: cartRes.items,
    subtotal: cartRes.subtotal,
    shipping: round2(ship.amount),
    total: round2(cartRes.subtotal + ship.amount),
    method,
    currency: shop.currency || 'EUR',
  };
}

function reply(status, body, headers) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

module.exports = {
  parsePrice, round2, slugify, skuOf,
  loadContent, buildPriceMap, computeShipping,
  validateCart, validateCustomer, makeReference, priceOrder,
  reply, CORS,
};
