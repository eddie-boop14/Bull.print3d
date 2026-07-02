/**
 * ═══════════════════════════════════════════════════════════════════
 *  BULLPRINT 3D — Journal de commandes (Google Apps Script)
 *
 *  Reçoit les commandes payées depuis verify-checkout.js (Netlify),
 *  ajoute une ligne dans la feuille "Commandes" et envoie 2 emails :
 *  un à Cedric, un au client. Pattern "La Serre à Colas".
 *
 *  Installation : voir README.md dans ce dossier.
 * ═══════════════════════════════════════════════════════════════════
 */

// ⚙️ À CONFIGURER PAR CEDRIC (voir README) :
const SHARED_SECRET = 'CHANGE-MOI-longue-phrase-secrete';   // = APPS_SCRIPT_SHARED_SECRET côté Netlify
const NOTIFY_EMAIL  = 'contact.bullprint3d@gmail.com';       // boîte de l'atelier
const SHEET_NAME    = 'Commandes';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Auth par secret partagé — tout le reste est rejeté en silence
    if (!data || data.secret !== SHARED_SECRET) {
      return out({ ok: false, error: 'unauthorized' });
    }
    if (data.type !== 'order') return out({ ok: false, error: 'unknown type' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['Date', 'Référence', 'Checkout ID', 'Montant payé', 'Devise',
        'Articles', 'Livraison', 'Client', 'Email', 'Téléphone', 'Adresse', 'Notes', 'Drapeau']);
      sheet.setFrozenRows(1);
    }

    // Déduplication : un refresh de paiement-ok ne crée pas 2 lignes
    const refs = sheet.getRange(1, 3, sheet.getLastRow() || 1, 1).getValues().flat();
    if (data.checkoutId && refs.indexOf(data.checkoutId) !== -1) {
      return out({ ok: true, deduped: true });
    }

    const items = (data.items || [])
      .map(function (i) {
        return i.qty + '× ' + i.name + (i.variant ? ' (' + i.variant + ')' : '') + ' — ' + i.price + ' €';
      })
      .join('\n');
    const c = data.customer || {};
    const address = [c.address, c.postcode, c.city].filter(String).join(', ');

    sheet.appendRow([
      new Date(), data.reference || '', data.checkoutId || '',
      data.paidAmount, data.currency || 'EUR',
      items, data.shippingMethod || '', c.name || '', c.email || '',
      c.phone || '', address, c.notes || '', data.flag || '',
    ]);

    // ── Email atelier ──
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: '🟢 Commande ' + (data.reference || '') + ' — ' + data.paidAmount + ' € payés',
      body: 'Nouvelle commande payée sur bullprint3d.com\n\n'
        + 'Référence : ' + (data.reference || '') + '\n'
        + 'Montant payé : ' + data.paidAmount + ' ' + (data.currency || 'EUR') + '\n'
        + (data.flag ? '\n' + data.flag + '\n' : '')
        + '\nArticles :\n' + items + '\n\n'
        + 'Livraison : ' + (data.shippingMethod || '') + '\n'
        + 'Client : ' + (c.name || '') + ' — ' + (c.email || '') + (c.phone ? ' — ' + c.phone : '') + '\n'
        + (address ? 'Adresse : ' + address + '\n' : '')
        + (c.notes ? 'Notes : ' + c.notes + '\n' : '')
        + '\n— Journal automatique Bullprint 3D',
    });

    // ── Email client ──
    if (c.email) {
      MailApp.sendEmail({
        to: c.email,
        subject: 'Bullprint 3D — commande ' + (data.reference || '') + ' confirmée ✓',
        body: 'Salut ' + (c.name || '') + ',\n\n'
          + 'Ton paiement de ' + data.paidAmount + ' ' + (data.currency || 'EUR')
          + ' est bien passé. La commande part en impression.\n\n'
          + 'Référence : ' + (data.reference || '') + '\n\nRécap :\n' + items + '\n\n'
          + 'Livraison : ' + (data.shippingMethod || '') + '\n'
          + 'Chaque pièce est imprimée à la commande — compte le délai indiqué '
          + 'sur la fiche produit. On te répond sous 24h.\n\n'
          + 'Bullprint 3D — atelier d\'impression 3D\n'
          + 'https://bullprint3d.com · Instagram @bull.print3d',
      });
    }

    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
