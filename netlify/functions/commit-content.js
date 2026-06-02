/**
 * ═══════════════════════════════════════════════════════════════════
 *  CONTENT COMMIT FUNCTION  (Bullprint 3D)
 *
 *  POST /.netlify/functions/commit-content
 *
 *  Receives a new content.json payload from /secret-admin and commits
 *  it to the Bullprint repo as a single atomic commit. Netlify rebuilds
 *  the site on push.
 *
 *  Auth: X-Admin-Secret header must match ADMIN_SECRET env var.
 *  Token: GITHUB_TOKEN env var (fine-grained PAT, contents:read+write,
 *  scoped to ONE repo only).
 *
 *  Pattern adapted from picture-system commit-photo function.
 * ═══════════════════════════════════════════════════════════════════
 */

// ─── REPO CONFIG ────────────────────────────────────────────────────
// Set these via Netlify env vars OR override below.
// REPO_OWNER, REPO_NAME, REPO_BRANCH — all required.
const REPO = {
  owner:  process.env.REPO_OWNER  || 'eddie-boop14',
  repo:   process.env.REPO_NAME   || 'Bull.print3d',
  branch: process.env.REPO_BRANCH || 'main',
};

const TARGET_FILE = 'content.json';
const MAX_BODY_BYTES = 512 * 1024; // 512 KB — content.json should be ~10-30 KB

// ─── ENTRYPOINT ─────────────────────────────────────────────────────
exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  // Health check — useful for debugging deploy
  if (event.httpMethod === 'GET') {
    return reply(200, {
      ok: true,
      service: 'commit-content',
      repo: `${REPO.owner}/${REPO.repo}@${REPO.branch}`,
      hasToken: !!process.env.GITHUB_TOKEN,
      hasSecret: !!process.env.ADMIN_SECRET,
    }, cors);
  }

  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'method not allowed' }, cors);
  }

  // ── Auth
  const secret = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'];
  if (!secret || !process.env.ADMIN_SECRET) {
    return reply(401, { error: 'unauthorized' }, cors);
  }
  // constant-time-ish compare
  if (!safeEqual(secret, process.env.ADMIN_SECRET)) {
    return reply(401, { error: 'unauthorized' }, cors);
  }

  // ── Body parse
  if (!event.body) return reply(400, { error: 'empty body' }, cors);
  if (event.body.length > MAX_BODY_BYTES) {
    return reply(413, { error: 'payload too large' }, cors);
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return reply(400, { error: 'bad json envelope' }, cors); }

  const { content, message } = body;
  if (!content || typeof content !== 'object') {
    return reply(400, { error: 'content (object) required' }, cors);
  }

  // ── Validate content shape — minimum keys we expect
  const requiredTopLevel = ['site', 'hero', 'gallery', 'atelier', 'custom', 'order', 'footer'];
  for (const k of requiredTopLevel) {
    if (!content[k]) {
      return reply(400, { error: `content.${k} missing — refusing to commit broken content` }, cors);
    }
  }

  // Stamp it
  content.updatedAt = new Date().toISOString().slice(0, 10);
  content.version = (content.version || 1);

  const token = process.env.GITHUB_TOKEN;
  if (!token) return reply(500, { error: 'server token not configured' }, cors);

  // Serialize prettily so commit diffs are human-readable
  const serialized = JSON.stringify(content, null, 2) + '\n';
  const contentBase64 = Buffer.from(serialized, 'utf8').toString('base64');

  try {
    // 1. Get current branch HEAD
    const ref = await ghGet(token, `/repos/${REPO.owner}/${REPO.repo}/git/refs/heads/${REPO.branch}`);
    const baseCommit = await ghGet(token, `/repos/${REPO.owner}/${REPO.repo}/git/commits/${ref.object.sha}`);

    // 2. Create new blob with the JSON
    const blob = await ghPost(token, `/repos/${REPO.owner}/${REPO.repo}/git/blobs`, {
      content: contentBase64,
      encoding: 'base64',
    });

    // 3. Build a new tree with just content.json updated
    const newTree = await ghPost(token, `/repos/${REPO.owner}/${REPO.repo}/git/trees`, {
      base_tree: baseCommit.tree.sha,
      tree: [
        { path: TARGET_FILE, mode: '100644', type: 'blob', sha: blob.sha },
      ],
    });

    // 4. Commit message
    const cleanMsg = (message ? String(message).slice(0, 100) : '').trim() || 'content update';
    const commitMessage = `admin: ${cleanMsg}`;

    // 5. Create commit
    const commit = await ghPost(token, `/repos/${REPO.owner}/${REPO.repo}/git/commits`, {
      message: commitMessage,
      tree: newTree.sha,
      parents: [ref.object.sha],
    });

    // 6. Fast-forward the branch
    await ghPatch(token, `/repos/${REPO.owner}/${REPO.repo}/git/refs/heads/${REPO.branch}`, {
      sha: commit.sha,
    });

    return reply(200, {
      ok: true,
      commit: {
        sha: commit.sha,
        url: `https://github.com/${REPO.owner}/${REPO.repo}/commit/${commit.sha}`,
        message: commitMessage,
      },
      file: TARGET_FILE,
      branch: REPO.branch,
    }, cors);

  } catch (e) {
    console.error('commit-content error:', e);
    return reply(500, { error: 'commit failed', detail: e.message || String(e) }, cors);
  }
};

// ─── GITHUB REST HELPERS ────────────────────────────────────────────
const GH_BASE = 'https://api.github.com';
const UA = 'bullprint-commit-content';

async function ghGet(token, path) {
  const r = await fetch(GH_BASE + path, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': UA,
    },
  });
  if (!r.ok) throw new Error(`GH GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function ghPost(token, path, body) {
  const r = await fetch(GH_BASE + path, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': UA,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GH POST ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function ghPatch(token, path, body) {
  const r = await fetch(GH_BASE + path, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': UA,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GH PATCH ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

// ─── UTILS ──────────────────────────────────────────────────────────
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function reply(status, body, headers) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  };
}
