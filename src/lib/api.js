const localMode = import.meta.env.DEV;
const keyName = 'drimus-local-v1';
const tables = ['studios', 'clubs', 'students', 'payments'];
const seed = {
  studios: [{id:'s1',name:'Школа №15',address:'',contact:''},{id:'s2',name:'Школа №11',address:'',contact:''}],
  clubs: [{id:'c1',name:'Футбол'},{id:'c2',name:'Вокал'},{id:'c3',name:'Танцы'}],
  students: [
    {id:'u1',full_name:'Бейбарыс Бином',parent_name:'Бином',parent_phone:'+7 701 123 45 67',studio_id:'s1',club_id:'c1',monthly_price:15000,payment_day:8,last_payment_date:'2026-11-12',next_payment_date:'2026-12-08',paid_through_date:'2026-11-08',status:'active'},
    {id:'u2',full_name:'Айсултан Маржан',parent_name:'Маржан',parent_phone:'+7 701 111 22 33',studio_id:'s2',club_id:'c1',monthly_price:15000,payment_day:12,last_payment_date:null,next_payment_date:'2026-11-12',status:'active'},
    {id:'u3',full_name:'Арлан',parent_name:'Арлан',parent_phone:'+7 777 333 44 55',studio_id:'s1',club_id:'c1',monthly_price:15000,payment_day:20,last_payment_date:'2026-11-01',next_payment_date:'2026-11-20',status:'active'},
  ],
  payments: [
    {id:'p1',student_id:'u1',amount:15000,payment_date:'2026-11-12',billing_period_start:'2026-11-08',billing_period_end:'2026-11-08',comment:''},
    {id:'p2',student_id:'u1',amount:15000,payment_date:'2026-10-08',billing_period_start:'2026-10-08',billing_period_end:'2026-10-08',comment:''},
  ],
};

function local() {
  try { return JSON.parse(localStorage.getItem(keyName)) || seed; }
  catch { return seed; }
}
function saveLocal(data) {
  localStorage.setItem(keyName, JSON.stringify(data));
  return data;
}
async function request(path, options) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Не удалось связаться с сервером.');
  return result;
}

export { localMode };
export async function checkSession() {
  if (localMode) return true;
  return (await request('/api/auth')).authenticated === true;
}
export async function login(pin) {
  if (localMode) return true;
  return (await request('/api/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({pin}) })).authenticated === true;
}
export async function logout() {
  if (!localMode) await request('/api/auth', { method: 'DELETE' });
}
export async function loadData() {
  if (localMode) return local();
  return request('/api/data');
}
export async function upsert(table, row) {
  if (!tables.includes(table)) throw new Error('Недопустимый раздел данных.');
  if (localMode) {
    const data = local();
    const index = data[table].findIndex(item => item.id === row.id);
    if (index >= 0) data[table][index] = row;
    else data[table].push(row);
    return saveLocal(data);
  }
  await request('/api/data', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({table,row}) });
}
export async function upsertMany(entries) {
  for (const { table, row } of entries) {
    if (!tables.includes(table) || !row || typeof row.id !== 'string') throw new Error('Некорректные данные для сохранения.');
  }
  if (localMode) {
    const data = local();
    for (const { table, row } of entries) {
      const index = data[table].findIndex(item => item.id === row.id);
      if (index >= 0) data[table][index] = row;
      else data[table].push(row);
    }
    return saveLocal(data);
  }
  return request('/api/data', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({entries}) });
}
export async function remove(table, id) {
  if (!tables.includes(table)) throw new Error('Недопустимый раздел данных.');
  if (localMode) {
    const data = local();
    data[table] = data[table].filter(item => item.id !== id);
    if (table === 'students') data.payments = data.payments.filter(item => item.student_id !== id);
    return saveLocal(data);
  }
  await request('/api/data', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({table,id}) });
}
