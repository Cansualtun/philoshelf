import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {createHmac, createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import bcrypt from 'bcrypt';

const dir = process.env.DATA_DIR || new URL('../../.data/', import.meta.url).pathname;
mkdirSync(dir, {recursive: true});
const db = new DatabaseSync(`${dir}/philoshelf.sqlite`);

db.exec(`
CREATE TABLE IF NOT EXISTS links(
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Keşfet',
  position INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS settings(
  id INTEGER PRIMARY KEY CHECK(id=1),
  name TEXT NOT NULL,
  bio TEXT NOT NULL
);
INSERT OR IGNORE INTO settings VALUES(
  1,
  'Philoshelf',
  'Bir kitap, bir fikir, yeni bir bakış. Düşünce dünyamıza hoş geldin.'
);
CREATE TABLE IF NOT EXISTS admins(
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS refresh_tokens(
  id INTEGER PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE CASCADE
);
`);

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
const AUTH_SECRET = process.env.AUTH_SECRET || randomBytes(32).toString('hex');
if (!process.env.AUTH_SECRET) {
  console.log('AUTH_SECRET tanımlı değil; bu oturum için geçici imza anahtarı üretildi.');
}

// Seed: bcrypt hash of Sarikedi98! (cost 12). Plain password is not stored.
const SEED_EMAIL = 'altuncansu98@gmail.com';
const SEED_PASSWORD_HASH = '$2b$12$20EKr5lymQSGsj5.e./WJ.JoTqfcTRDFCzqzlBaK0B38rXyt7g.Pq';
if (!db.prepare('SELECT id FROM admins WHERE email = ?').get(SEED_EMAIL)) {
  db.prepare('INSERT INTO admins(email, password_hash) VALUES (?, ?)').run(SEED_EMAIL, SEED_PASSWORD_HASH);
  console.log(`Yönetici seed edildi: ${SEED_EMAIL}`);
}

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signAccessToken(admin) {
  const header = b64urlJson({alg: 'HS256', typ: 'JWT'});
  const now = Math.floor(Date.now() / 1000);
  const payload = b64urlJson({
    sub: String(admin.id),
    email: admin.email,
    typ: 'access',
    iat: now,
    exp: now + ACCESS_TTL_SEC,
  });
  const data = `${header}.${payload}`;
  const sig = createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyAccessToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const data = `${header}.${payload}`;
  const expected = createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let body;
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (body.typ !== 'access' || !body.sub || !body.exp) return null;
  if (body.exp < Math.floor(Date.now() / 1000)) return null;
  return body;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function issueRefreshToken(adminId) {
  const token = randomBytes(32).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'INSERT INTO refresh_tokens(admin_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).run(adminId, hashToken(token), now + REFRESH_TTL_SEC, now);
  return token;
}

function revokeRefreshToken(token) {
  db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hashToken(token));
}

function rotateRefreshToken(oldToken) {
  const row = db.prepare(
    'SELECT id, admin_id, expires_at FROM refresh_tokens WHERE token_hash = ?'
  ).get(hashToken(oldToken));
  if (!row) return null;
  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
    return null;
  }
  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
  const admin = db.prepare('SELECT id, email FROM admins WHERE id = ?').get(row.admin_id);
  if (!admin) return null;
  return {
    accessToken: signAccessToken(admin),
    refreshToken: issueRefreshToken(admin.id),
  };
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

function requireAdmin(req) {
  const payload = verifyAccessToken(bearer(req));
  if (!payload) return null;
  return db.prepare('SELECT id, email FROM admins WHERE id = ?').get(Number(payload.sub));
}

async function body(req) {
  let s = '';
  for await (const c of req) {
    s += c;
    if (s.length > 16384) throw Error('İstek çok büyük');
  }
  return JSON.parse(s || '{}');
}

function fields(b) {
  if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 120) {
    throw Error('Başlık 1–120 karakter olmalı');
  }
  const u = new URL(b.url);
  if (!['https:', 'http:'].includes(u.protocol)) throw Error('Geçerli bir http/https bağlantısı girin');
  if (u.username || u.password) throw Error('Bağlantı kimlik bilgisi içeremez');
  if (
    typeof b.description !== 'string' ||
    b.description.length > 300 ||
    typeof b.category !== 'string' ||
    b.category.length > 50
  ) {
    throw Error('Açıklama veya kategori geçersiz');
  }
  if (!Number.isInteger(b.position) || Math.abs(b.position) > 100000) throw Error('Sıra geçersiz');
  return [
    b.title.trim(),
    b.description.trim(),
    u.href,
    b.category.trim() || 'Keşfet',
    b.position,
    b.active ? 1 : 0,
  ];
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 190;
}

export const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, data) => {
    res.writeHead(status);
    res.end(JSON.stringify(data));
  };
  const path = new URL(req.url, 'http://localhost').pathname;

  try {
    if (path === '/api/health' && req.method === 'GET') return send(200, {ok: true});

    if (path === '/api/public' && req.method === 'GET') {
      return send(200, {
        profile: db.prepare('SELECT name, bio FROM settings WHERE id = 1').get(),
        links: db.prepare('SELECT * FROM links WHERE active = 1 ORDER BY position, id').all(),
      });
    }

    if (path === '/api/admin/login' && req.method === 'POST') {
      const b = await body(req);
      if (!isEmail(b.email) || typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 200) {
        return send(400, {error: 'E-posta veya şifre geçersiz'});
      }
      const admin = db.prepare('SELECT id, email, password_hash FROM admins WHERE email = ?').get(String(b.email).trim().toLowerCase());
      if (!admin || !(await bcrypt.compare(b.password, admin.password_hash))) {
        return send(401, {error: 'E-posta veya şifre hatalı'});
      }
      return send(200, {
        accessToken: signAccessToken(admin),
        refreshToken: issueRefreshToken(admin.id),
        expiresIn: ACCESS_TTL_SEC,
        admin: {id: admin.id, email: admin.email},
      });
    }

    if (path === '/api/admin/refresh' && req.method === 'POST') {
      const b = await body(req);
      if (typeof b.refreshToken !== 'string' || !b.refreshToken) {
        return send(400, {error: 'Yenileme anahtarı gerekli'});
      }
      const tokens = rotateRefreshToken(b.refreshToken);
      if (!tokens) return send(401, {error: 'Yenileme anahtarı geçersiz veya süresi dolmuş'});
      return send(200, {...tokens, expiresIn: ACCESS_TTL_SEC});
    }

    if (path === '/api/admin/logout' && req.method === 'POST') {
      const b = await body(req);
      if (typeof b.refreshToken === 'string' && b.refreshToken) revokeRefreshToken(b.refreshToken);
      return send(200, {ok: true});
    }

    if (!path.startsWith('/api/admin')) return send(404, {error: 'Bulunamadı'});

    const admin = requireAdmin(req);
    if (!admin) return send(401, {error: 'Oturum gerekli'});

    if (path === '/api/admin/me' && req.method === 'GET') {
      return send(200, {admin: {id: admin.id, email: admin.email}});
    }

    if (path === '/api/admin/links' && req.method === 'GET') {
      return send(200, {
        links: db.prepare('SELECT * FROM links ORDER BY position, id').all(),
        profile: db.prepare('SELECT name, bio FROM settings WHERE id = 1').get(),
      });
    }

    if (path === '/api/admin/profile' && req.method === 'PUT') {
      const b = await body(req);
      if (
        typeof b.name !== 'string' ||
        !b.name.trim() ||
        b.name.length > 80 ||
        typeof b.bio !== 'string' ||
        b.bio.length > 300
      ) {
        throw Error('Profil bilgileri geçersiz');
      }
      db.prepare('UPDATE settings SET name = ?, bio = ? WHERE id = 1').run(b.name.trim(), b.bio.trim());
      return send(200, {ok: true});
    }

    if (path === '/api/admin/links' && req.method === 'POST') {
      const v = fields(await body(req));
      const result = db
        .prepare(
          'INSERT INTO links(title, description, url, category, position, active) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(...v);
      return send(201, {id: Number(result.lastInsertRowid)});
    }

    const match = path.match(/^\/api\/admin\/links\/(\d+)$/);
    if (match && ['PUT', 'DELETE'].includes(req.method)) {
      const id = Number(match[1]);
      const result =
        req.method === 'DELETE'
          ? db.prepare('DELETE FROM links WHERE id = ?').run(id)
          : db
              .prepare(
                'UPDATE links SET title = ?, description = ?, url = ?, category = ?, position = ?, active = ? WHERE id = ?'
              )
              .run(...fields(await body(req)), id);
      return send(result.changes ? 200 : 404, result.changes ? {ok: true} : {error: 'Bağlantı bulunamadı'});
    }

    return send(404, {error: 'Bulunamadı'});
  } catch (e) {
    return send(400, {error: e.message || 'Geçersiz istek'});
  }
});

server.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('Philoshelf API hazır'));
