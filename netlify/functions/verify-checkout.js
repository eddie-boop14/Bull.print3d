/**
 * ═══════════════════════════════════════════════════════════════════
 *  VERIFY CHECKOUT — retour paiement  (Bullprint 3D · SHOP-01)
 *
 *  POST /.netlify/functions/verify-checkout
 *  Body: { checkoutId, order?: { reference, cart, customer, shippingMethod } }
 *
 *  LE SERVEUR EST LA SOURCE DE VÉRITÉ, JAMAIS LA REDIRECTION :
 *  on interroge GET /v0.1/checkouts/{id} côté serveur ; seul un
 *  statut PAID déclenche le succès et l'enregistrement.
 *
 *  v1 : GET-au-retour (pattern monetico-retour). Les webhooks SumUp
 *  ne sont pas assez documentés pour s'y fier les yeux fermés —
 *  dette notée, pas cachée.
 *
 *  Enregistrement : POST vers Apps Script (Sheet + 2 emails) avec
 *  secret partagé — pattern Serre. Le montant loggé vient de SumUp ;
 *  le détail des articles est recalculé depuis content.json et
 *  comparé au montant payé (drapeau ⚠ si incohérence).
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

const lib = require('./lib/shop-lib.js');

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

exports.handler = async (event) => {
  const cors = lib.CORS;
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return lib.reply(405, { error: 'méthode non autorisée' }, cors);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return lib.reply(400, { error: 'requête invalide' }, cors); }

  const checkoutId = String(body.checkoutId || '').trim();
  if (!ID_RE.test(checkoutId)) return lib.reply(400, { error: 'identifiant invalide' }, cors);

  const apiKey = process.env.SUMUP_API_KEY;
  if (!apiKey) return lib.reply(503, { error: 'paiement non configuré' }, cors);

  // ── 1. Statut réel, demandé à SumUp (jamais au client) ──
  let checkout;
  try {
    const r = await fetch(`https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(checkoutId)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (r.status === 404) return lib.reply(200, { ok: true, status: 'INCONNU' }, cors);
    if (!r.ok) throw new Error('SumUp GET ' + r.status);
    checkout = await r.json();
  } catch (e) {
    console.error('verify-checkout SumUp error:', e);
    return lib.reply(502, { error: 'vérification impossible — réessaie dans une minute' }, cors);
  }

  const status = String(checkout.status || 'INCONNU').toUpperCase();
  const result = {
    ok: true,
    status,
    reference: checkout.checkout_reference || null,
    amount: checkout.amount,
    currency: checkout.currency,
  };

  if (status !== 'PAID') return lib.reply(200, result, cors);

  // ── 2. Commande payée → journal (Sheet + emails via Apps Script) ──
  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const scriptSecret = process.env.APPS_SCRIPT_SHARED_SECRET;
  if (scriptUrl && scriptSecret && body.order && Array.isArray(body.order.cart)) {
    try {
      // le détail est revalidé contre content.json ; le montant payé
      // fait foi (SumUp) — toute incohérence est flaguée, pas masquée
      let itemsDetail = [];
      let expectedTotal = null;
      let flag = '';
      try {
        const priced = await lib.priceOrder(body.order.cart, body.order.shippingMethod);
        if (!priced.error) {
          itemsDetail = priced.items;
          expectedTotal = priced.total;
          if (Math.abs(priced.total - Number(checkout.amount)) > 0.01) {
            flag = `⚠ montant payé ${checkout.amount} ≠ catalogue ${priced.total}`;
          }
        } else {
          flag = '⚠ panier non recalculable : ' + priced.error;
        }
      } catch (e) {
        flag = '⚠ recalcul indisponible';
      }

      const custRes = lib.validateCustomer(body.order.customer, 'pickup'); // shape-clean only
      const r = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: scriptSecret,
          type: 'order',
          reference: checkout.checkout_reference || body.order.reference || '',
          checkoutId,
          paidAmount: checkout.amount,
          currency: checkout.currency,
          expectedTotal,
          flag,
          shippingMethod: body.order.shippingMethod === 'pickup' ? 'retrait atelier' : 'domicile',
          items: itemsDetail.map(i => ({
            sku: i.sku, name: i.name, variant: i.variantLabel, qty: i.qty, price: i.price,
          })),
          customer: custRes.customer || {},
          paidAt: new Date().toISOString(),
        }),
      });
      if (!r.ok) console.error('Apps Script log failed:', r.status, await r.text().catch(() => ''));
      result.logged = r.ok;
    } catch (e) {
      console.error('Apps Script unreachable:', e);
      result.logged = false;
    }
  }

  return lib.reply(200, result, cors);
};
