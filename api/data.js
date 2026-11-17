import { createClient } from '@supabase/supabase-js';
import { rejectCrossOrigin, validSession } from './_security.js';

const tables = ['studios', 'clubs', 'students', 'payments'];
let cachedClient;
function database() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server credentials are not configured.');
  cachedClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cachedClient;
}
function respondError(res, error) {
  console.error('Drimus database request failed:', error?.message || 'unknown error');
  res.statusCode = 500;
  return res.json({ error: 'Не удалось сохранить данные. Проверьте настройки базы.' });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET' && rejectCrossOrigin(req, res)) return;
  if (!validSession(req)) {
    res.statusCode = 401;
    return res.json({ error: 'Введите PIN-код, чтобы продолжить.' });
  }
  try {
    const supabase = database();
    if (req.method === 'GET') {
      const result = await Promise.all(tables.map(table => supabase.from(table).select('*').order('created_at')));
      const failed = result.find(item => item.error);
      if (failed) return respondError(res, failed.error);
      return res.status(200).json(Object.fromEntries(tables.map((table, index) => [table, result[index].data])));
    }
    const { table, row, id, entries } = req.body || {};
    if (req.method === 'POST' && Array.isArray(entries)) {
      if (!entries.length || entries.some(item => !tables.includes(item?.table) || !item?.row || typeof item.row.id !== 'string')) {
        res.statusCode = 400;
        return res.json({ error: 'Некорректные записи.' });
      }
      // Preserve the caller's order: a new club/student must exist before its
      // dependent student/payment row is inserted. Parallel inserts here can
      // race foreign-key checks and leave orphaned or missing records.
      for (const { table: target, row: value } of entries) {
        const { error } = await supabase.from(target).upsert({ ...value, user_id: null });
        if (error) return respondError(res, error);
      }
      res.statusCode = 200;
      return res.json({ ok: true });
    }
    if (!tables.includes(table)) {
      res.statusCode = 400;
      return res.json({ error: 'Недопустимый раздел данных.' });
    }
    if (req.method === 'POST') {
      if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string') {
        res.statusCode = 400;
        return res.json({ error: 'Некорректная запись.' });
      }
      const record = { ...row, user_id: null };
      const { error } = await supabase.from(table).upsert(record);
      if (error) return respondError(res, error);
      res.statusCode = 200;
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      if (typeof id !== 'string' || !id) {
        res.statusCode = 400;
        return res.json({ error: 'Не указан идентификатор записи.' });
      }
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) return respondError(res, error);
      res.statusCode = 200;
      return res.json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    res.statusCode = 405;
    return res.json({ error: 'Метод не поддерживается.' });
  } catch (error) {
    return respondError(res, error);
  }
}
