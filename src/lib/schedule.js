const iso = d => new Date(d).toISOString().slice(0,10);
export function dueDate(year, monthIndex, paymentDay) { const last = new Date(year, monthIndex + 1, 0).getDate(); return iso(new Date(Date.UTC(year, monthIndex, Math.min(paymentDay, last)))); }
export function nextDueDate(paymentDay, paidThrough) { const d = new Date(`${paidThrough}T12:00:00Z`); return dueDate(d.getUTCFullYear(), d.getUTCMonth() + 1, paymentDay); }
export function billingDateForPayment(paymentDay, paymentDate, nextPaymentDate) {
  const paymentMonth = paymentDate.slice(0, 7);
  // A late payment settles the oldest outstanding month. A backdated payment
  // from before the current due month stays in its own historical month.
  if (nextPaymentDate && paymentMonth >= nextPaymentDate.slice(0, 7)) return nextPaymentDate;
  const d = new Date(`${paymentDate}T12:00:00Z`);
  return dueDate(d.getUTCFullYear(), d.getUTCMonth(), paymentDay);
}
export function addPauseDays(nextPaymentDate, start, end) { const days = Math.max(0, Math.round((new Date(`${end}T12:00:00Z`) - new Date(`${start}T12:00:00Z`)) / 86400000)); const d = new Date(`${nextPaymentDate}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return iso(d); }
export function localDateString(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function paymentStatus(student, today = localDateString()) { if(student.status==='paused') return 'paused'; if(student.status==='expelled') return 'expelled'; const diff=Math.round((new Date(`${student.next_payment_date}T12:00:00Z`)-new Date(`${today}T12:00:00Z`))/86400000); return diff<0?'overdue':diff===0?'today':diff<=3?'soon':'paid'; }
export function paymentBillingMonth(payment) { const period=payment.billing_period_end||payment.billing_period_start||payment.payment_date||''; return period.slice(0,7); }
export function paymentsForBillingMonth(payments, studentId, month) { return payments.filter(p=>p.student_id===studentId&&paymentBillingMonth(p)===month).sort((a,b)=>(a.payment_date||'').localeCompare(b.payment_date||'')); }
export function studentExistedByMonth(student, month) { return !student.created_at || student.created_at.slice(0,7)<=month; }
export function studentBelongsInReportMonth(student, payments, month) { return studentExistedByMonth(student,month)||payments.some(p=>p.student_id===student.id&&paymentBillingMonth(p)===month); }
export function paymentProgress(student, payments) {
  const currentPeriod = (student.next_payment_date || '').slice(0, 7);
  const paid = payments.filter(p => p.student_id === student.id && (p.billing_period_end || p.billing_period_start || p.payment_date || '').slice(0, 7) === currentPeriod).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const price = Number(student.monthly_price) || 0;
  return { paid, remaining: Math.max(0, price - paid), complete: price > 0 && paid >= price };
}
export function scheduleFromPayments(student, payments, fallbackDate = student.next_payment_date) {
  const periods = new Map();
  for (const payment of payments) {
    if (payment.student_id !== student.id) continue;
    const period = payment.billing_period_end || payment.billing_period_start || payment.payment_date;
    if (!period) continue;
    const key = period.slice(0, 7);
    const group = periods.get(key) || { period, paid: 0, lastPayment: null };
    group.paid += Number(payment.amount) || 0;
    if (period > group.period) group.period = period;
    if (!group.lastPayment || payment.payment_date > group.lastPayment) group.lastPayment = payment.payment_date;
    periods.set(key, group);
  }
  const groups = [...periods.values()].sort((a, b) => a.period.localeCompare(b.period));
  if (!groups.length) return { last_payment_date: null, paid_through_date: null, next_payment_date: fallbackDate };
  const latest = groups.at(-1), price = Number(student.monthly_price) || 0;
  const latestComplete = price > 0 && latest.paid >= price;
  const lastComplete = [...groups].reverse().find(group => price > 0 && group.paid >= price);
  const lastPayment = payments.filter(p => p.student_id === student.id).map(p => p.payment_date).filter(Boolean).sort().at(-1) || null;
  return {
    last_payment_date: lastPayment,
    paid_through_date: lastComplete?.period || null,
    next_payment_date: latestComplete ? nextDueDate(student.payment_day, latest.period) : latest.period,
  };
}
