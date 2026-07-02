/**
 * ═══════════════════════════════════════════════════════════════════
 *  UPLOAD IMAGE  (Bullprint 3D · SHOP-01 · Job S7)
 *
 *  POST /.netlify/functions/upload-image
 *  Body: { filename, dir, data }   (data = base64, sans préfixe data:)
 *
 *  Une photo prise au téléphone est compressée dans le navigateur
 *  (admin.js) puis committée dans le repo via l'API GitHub — même
 *  modèle de propriété que content.json : pas de bucket, pas de CDN
 *  tiers, Cedric ne voit jamais le mot "Git".
 *
 *  Auth : X-Admin-Secret vs ADMIN_SECRET — MÊME mécanisme que
 *  commit-content.js, pas un deuxième schéma.
 *
 *  Garde-fous :
 *   - payload décodé ≤ 4 MB
 *   - magic bytes vérifiés (webp / jpeg / png) — le MIME déclaré ment
 *   - nom de fichier slugifié CÔTÉ SERVEUR, extension déduite des
 *     magic bytes, jamais du nom
 *   - chemin forcé sous assets/<dossier whitelisté>/ — tout `..`,
 *     chemin absolu ou dossier exotique est rejeté
 *
 *  Dette documentée : le repo grossit avec les binaires (~2 500
 *  photos/GB à ≤400 KB pièce — des années de marge). Si le volume
 *  l'exige un jour : pattern R2 (prototypé dans la Serre).
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

const REPO = {
  owner:  process.env.REPO_OWNER  || 'eddie-boop14',
  repo:   process.env.REPO_NAME   || 'Bull.print3d',
  branch: process.env.REPO_BRANCH || 'main',
};

const MAX_DECODED_BYTES = 4 * 1024 * 1024;      // 4 MB image décodée
const MAX_BODY_BYTES = 6 * 1024 * 1024;          // enveloppe base64
const ALLOWED_DIRS = ['shop', 'products', 'atelier'];

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  if (event.httpMethod === 'GET') {
    return reply(200, {
      ok: true,
      service: 'upload-image',
      hasToken: !!process.env.GITHUB_TOKEN,
      hasSecret: !!process.env.ADMIN_SECRET,
      dirs: ALLOWED_DIRS,
    }, cors);
  }
  if (event.httpMethod !== 'POST') return reply(405, { error: 'method not allowed' }, cors);

  // ── Auth — miroir exact de commit-content.js ──
  const secret = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'];
  if (!secret || !process.env.ADMIN_SECRET || !safeEqual(secret, process.env.ADMIN_SECRET)) {
    return reply(401, { error: 'unauthorized' }, cors);
  }

  if (!event.body || event.body.length > MAX_BODY_BYTES) {
    return reply(413, { error: 'photo trop lourde (max 4 MB après compression)' }, cors);
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return reply(400, { error: 'bad json envelope' }, cors); }

  // ── Décodage + taille ──
  const b64 = String(body.data || '').replace(/^data:[^;]+;base64,/, '');
  if (!b64) return reply(400, { error: 'data (base64) requis' }, cors);
  let buf;
  try { buf = Buffer.from(b64, 'base64'); }
  catch { return reply(400, { error: 'base64 invalide' }, cors); }
  if (!buf.length) return reply(400, { error: 'image vide' }, cors);
  if (buf.length > MAX_DECODED_BYTES) {
    return reply(413, { error: 'photo trop lourde (max 4 MB après compression)' }, cors);
  }

  // ── Magic bytes — jamais le MIME déclaré ──
  const ext = sniffImage(buf);
  if (!ext) return reply(415, { error: 'format non accepté (webp, jpeg ou png uniquement)' }, cors);

  // ── Chemin — slug serveur, dossier whitelisté, jamais de traversal ──
  const dir = ALLOWED_DIRS.includes(body.dir) ? body.dir : 'shop';
  const baseName = slugify(String(body.filename || 'photo').replace(/\.[a-z0-9]+$/i, '')) || 'photo';
  const d = new Date();
  const stamp = String(d.getFullYear()).slice(2)
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6);
  const path = `assets/${dir}/${baseName.slice(0, 40)}-${stamp}-${rand}.${ext}`;
  if (path.includes('..') || !/^assets\/[a-z]+\/[a-z0-9.-]+$/.test(path)) {
    return reply(400, { error: 'chemin invalide' }, cors);
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return reply(500, { error: 'server token not configured' }, cors);

  // ── Commit via l'API Contents (un fichier, un commit) ──
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'bullprint-upload-image',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `📷 upload: ${path} (via secret-admin)`,
        content: buf.toString('base64'),
        branch: REPO.branch,
      }),
    });
    if (!r.ok) throw new Error(`GH PUT ${r.status}: ${(await r.text()).slice(0, 300)}`);

    return reply(200, { ok: true, path }, cors);
  } catch (e) {
    console.error('upload-image error:', e);
    return reply(500, { error: 'upload failed', detail: e.message || String(e) }, cors);
  }
};

// ─── utils ──────────────────────────────────────────────────────────
function sniffImage(buf) {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
    && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) return 'png';
  // WEBP: "RIFF"...."WEBP"
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function reply(status, body, headers) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  };
}
