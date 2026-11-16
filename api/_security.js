import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const cookieName = 'drimus_session';
const sessionAgeSeconds = 60 * 60 * 24 * 7;
const attempts = new Map();

function secret() {
  const value = process.env.DRIMUS_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('DRIMUS_SESSION_SECRET must contain at least 32 characters.');
  return value;
}
function signature(value) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}
function getCookie(req) {
  const cookies = (req.headers.cookie || '').split(';');
  const entry = cookies.map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`));
  return entry ? decodeURIComponent(entry.slice(cookieName.length + 1)) : '';
}
function secureCookie(req) {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}
function matchesPin(input) {
  const expected = process.env.DRIMUS_PIN || '';
  if (!/^\d{6,12}$/.test(expected) || typeof input !== 'string') return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function limited(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now - record.startedAt > 15 * 60 * 1000) {
    attempts.set(ip, { startedAt: now, count: 0 });
    return false;
  }
  return record.count >= 8;
}
function recordFailure(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now - record.startedAt > 15 * 60 * 1000) attempts.set(ip, { startedAt: now, count: 1 });
  else record.count += 1;
}
function clearFailures(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  attempts.delete(ip);
}
function issueSession(req, res) {
  const expires = Math.floor(Date.now() / 1000) + sessionAgeSeconds;
  const payload = `${expires}.${randomBytes(24).toString('base64url')}`;
  const token = `${payload}.${signature(payload)}`;
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionAgeSeconds}${secure ? '; Secure' : ''}`);
}
export function validSession(req) {
  try {
    const token = getCookie(req);
    const [expiresText, nonce, supplied, ...rest] = token.split('.');
    if (!expiresText || !nonce || !supplied || rest.length) return false;
    const payload = `${expiresText}.${nonce}`;
    const expected = Buffer.from(signature(payload));
    const actual = Buffer.from(supplied);
    return Number(expiresText) > Math.floor(Date.now() / 1000) && actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
export function authHandler(req, res) {
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method === 'GET') {
    res.statusCode = 200;
    return res.json({ authenticated: validSession(req) });
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', secureCookie(req));
    res.statusCode = 200;
    return res.json({ authenticated: false });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    res.statusCode = 405;
    return res.json({ error: 'Метод не поддерживается.' });
  }
  if (limited(req)) {
    res.statusCode = 429;
    return res.json({ error: 'Слишком много попыток. Подождите 15 минут.' });
  }
  if (!matchesPin(req.body?.pin)) {
    recordFailure(req);
    res.statusCode = 401;
    return res.json({ error: 'Неверный PIN-код.' });
  }
  clearFailures(req);
  issueSession(req, res);
  res.statusCode = 200;
  return res.json({ authenticated: true });
}
export function rejectCrossOrigin(req, res) {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host && new URL(origin).host !== host) {
    res.statusCode = 403;
    res.json({ error: 'Запрос запрещён.' });
    return true;
  }
  return false;
}
