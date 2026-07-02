/**
 * ═══════════════════════════════════════════════════════════════════
 *  CREATE CHECKOUT — SumUp Hosted Checkout  (Bullprint 3D · SHOP-01)
 *
 *  POST /.netlify/functions/create-checkout
 *  Body: { cart: [{sku, qty}], customer: {...}, shippingMethod }
 *
 *  Portage du pattern create-payment.js de "La Serre à Colas",
 *  rail Monetico remplacé par SumUp. LE POINT NON NÉGOCIABLE :
 *  le montant est recalculé ici depuis content.json — le client
 *  n'envoie que des SKU et des quantités, jamais des prix.
 *
 *  SumUp (codé contre https://developer.sumup.com/api, 07/2026) :
 *    POST https://api.sumup.com/v0.1/checkouts
 *    Bearer SUMUP_API_KEY
 *    { checkout_reference, amount, currency, merchant_code,
 *      description, redirect_url, hosted_checkout: { enabled: true } }
 *    → réponse : { id, status, hosted_checkout_url, ... }
 *
 *  Env (Netlify, jamais dans le repo) :
 *    SUMUP_API_KEY, SUMUP_MERCHANT_CODE, SUMUP_ENV (sandbox|live)
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

const lib = require('./lib/shop-lib.js');

const SUMUP_API = 'https://api.sumup.com/v0.1/checkouts';

exports.handler = async (event) => {
  const cors = lib.CORS;
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  if (event.httpMethod === 'GET') {
    return lib.reply(200, {
      ok: true,
      service: 'create-checkout',
      env: process.env.SUMUP_ENV || 'sandbox',
      hasKey: !!process.env.SUMUP_API_KEY,
      hasMerchant: !!process.env.SUMUP_MERCHANT_CODE,
    }, cors);
  }

  if (event.httpMethod !== 'POST') return lib.reply(405, { error: 'méthode non autorisée' }, cors);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return lib.reply(400, { error: 'requête invalide' }, cors); }

  // ── 1. Panier → prix serveur (content.json, jamais le client) ──
  let priced;
  try { priced = await lib.priceOrder(body.cart, body.shippingMethod); }
  catch (e) {
    console.error('create-checkout priceOrder:', e);
    return lib.reply(500, { error: 'erreur serveur — réessaie dans une minute' }, cors);
  }
  if (priced.error) return lib.reply(400, { error: priced.error }, cors);

  if (!priced.shop.enabled) {
    return lib.reply(403, { error: 'la boutique est fermée pour le moment' }, cors);
  }

  // ── 2. Client ──
  const custRes = lib.validateCustomer(body.customer, priced.method);
  if (custRes.error) return lib.reply(400, { error: custRes.error }, cors);

  // ── 3. Config SumUp ──
  const apiKey = process.env.SUMUP_API_KEY;
  const merchantCode = process.env.SUMUP_MERCHANT_CODE;
  if (!apiKey || !merchantCode) {
    return lib.reply(503, { error: 'paiement non configuré — écris-nous pour commander' }, cors);
  }
  const env = (process.env.SUMUP_ENV || 'sandbox').toLowerCase();

  const reference = lib.makeReference();
  const siteUrl = process.env.URL || 'https://bullprint3d.com';

  const itemsSummary = priced.items
    .map(i => `${i.qty}× ${i.name}${i.variantLabel ? ' (' + i.variantLabel + ')' : ''}`)
    .join(', ').slice(0, 180);

  const payload = {
    checkout_reference: reference,
    amount: priced.total,
    currency: priced.currency,
    merchant_code: merchantCode,
    description: `${env === 'live' ? '' : '[SANDBOX] '}Bullprint 3D ${reference} — ${itemsSummary}`.slice(0, 250),
    redirect_url: `${siteUrl}/paiement-ok.html`,
    hosted_checkout: { enabled: true },
  };

  try {
    const r = await fetch(SUMUP_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data.id) {
      console.error('SumUp create failed:', r.status, JSON.stringify(data).slice(0, 500));
      return lib.reply(502, { error: 'le paiement n\'a pas pu être initialisé — réessaie ou écris-nous' }, cors);
    }

    const checkoutUrl = data.hosted_checkout_url;
    if (!checkoutUrl) {
      console.error('SumUp: pas de hosted_checkout_url dans la réponse', JSON.stringify(data).slice(0, 500));
      return lib.reply(502, { error: 'paiement indisponible — écris-nous pour commander' }, cors);
    }

    return lib.reply(200, {
      ok: true,
      checkoutId: data.id,
      checkoutUrl,
      reference,
      amount: priced.total,
      currency: priced.currency,
      breakdown: { subtotal: priced.subtotal, shipping: priced.shipping },
    }, cors);
  } catch (e) {
    console.error('create-checkout SumUp error:', e);
    return lib.reply(502, { error: 'paiement injoignable — réessaie dans une minute' }, cors);
  }
};
