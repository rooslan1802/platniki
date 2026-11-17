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
function allocatePayments(student, payments) {
  const records=payments.filter(p=>p.student_id===student.id&&p.payment_date).sort((a,b)=>a.payment_date.localeCompare(b.payment_date)||(a.created_at||'').localeCompare(b.created_at||'')||String(a.id).localeCompare(String(b.id)));
  if(!records.length)return [];
  const price=Number(student.monthly_price)||0,day=Number(student.payment_day)||Number((records[0].billing_period_end||records[0].billing_period_start||records[0].payment_date).slice(-2)),first=records[0];
  let period=first.billing_period_start||first.billing_period_end||first.payment_date,paidInPeriod=0;
  period=period.slice(0,10);
  const allocations=[];
  for(const payment of records){
    let remaining=Math.max(0,Number(payment.amount)||0),part=0;
    if(!price){allocations.push({...payment,allocation_id:`${payment.id}:0`,amount:remaining,billing_period_start:payment.payment_date,billing_period_end:payment.payment_date});continue}
    while(remaining>0){
      const capacity=Math.max(0,price-paidInPeriod);
      if(capacity===0){period=nextDueDate(day,period);paidInPeriod=0;continue}
      const amount=Math.min(remaining,capacity),rounded=Math.round(amount*100)/100;
      allocations.push({...payment,allocation_id:`${payment.id}:${part++}`,amount:rounded,billing_period_start:period,billing_period_end:period});
      paidInPeriod=Math.round((paidInPeriod+rounded)*100)/100;remaining=Math.round((remaining-rounded)*100)/100;
      if(paidInPeriod>=price){period=nextDueDate(day,period);paidInPeriod=0}
    }
  }
  return allocations;
}
export function reconcilePaymentHistory(student, payments) {
  const allocations=allocatePayments(student,payments),bounds=new Map();
  for(const item of allocations){const range=bounds.get(item.id)||{start:item.billing_period_start,end:item.billing_period_end};if(item.billing_period_start<range.start)range.start=item.billing_period_start;if(item.billing_period_end>range.end)range.end=item.billing_period_end;bounds.set(item.id,range)}
  return payments.map(payment=>{const range=bounds.get(payment.id);return range?{...payment,billing_period_start:range.start,billing_period_end:range.end}:payment});
}
export function paymentsForBillingMonth(student, payments, month) { return allocatePayments(student,payments).filter(p=>p.billing_period_end.slice(0,7)===month).sort((a,b)=>(a.payment_date||'').localeCompare(b.payment_date||'')); }
export function studentExistedByMonth(student, month) { return !student.created_at || student.created_at.slice(0,7)<=month; }
export function studentBelongsInReportMonth(student, payments, month) { return studentExistedByMonth(student,month)||paymentsForBillingMonth(student,payments,month).length>0; }
export function paymentProgress(student, payments) {
  const currentPeriod = (student.next_payment_date || '').slice(0, 7);
  const paid = allocatePayments(student,payments).filter(p=>p.billing_period_end.slice(0,7)===currentPeriod).reduce((sum,p)=>sum+(Number(p.amount)||0),0);
  const price = Number(student.monthly_price) || 0;
  return { paid, remaining: Math.max(0, price - paid), complete: price > 0 && paid >= price };
}
export function scheduleFromPayments(student, payments, fallbackDate = student.next_payment_date) {
  const periods = new Map();
  const allocated=allocatePayments(student,payments);
  for (const payment of allocated) {
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
  const lastPayment = allocated.map(p => p.payment_date).filter(Boolean).sort().at(-1) || null;
  return {
    last_payment_date: lastPayment,
    paid_through_date: lastComplete?.period || null,
    next_payment_date: latestComplete ? nextDueDate(student.payment_day, latest.period) : latest.period,
  };
}
