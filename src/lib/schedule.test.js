import { describe, expect, it } from 'vitest';
import { addPauseDays, billingDateForPayment, dueDate, nextDueDate, paymentProgress, paymentStatus, scheduleFromPayments } from './schedule';

describe('payment schedule', () => {
  it('keeps the fixed day after a late payment', () => {
    expect(nextDueDate(8, '2026-11-08')).toBe('2026-12-08');
  });

  it('caps day 31 to the final day of shorter months', () => {
    expect(nextDueDate(31, '2026-10-31')).toBe('2026-11-30');
    expect(dueDate(2026, 1, 31)).toBe('2026-02-28');
  });

  it('shifts the next payment by elapsed pause days', () => {
    expect(addPauseDays('2026-12-08', '2026-11-01', '2026-11-10')).toBe('2026-12-17');
    expect(addPauseDays('2026-12-08', '2026-11-10', '2026-11-10')).toBe('2026-12-08');
  });

  it('shows due today, soon, paid ahead, and overdue at the date boundaries', () => {
    const student = { status: 'active', next_payment_date: '2026-11-16' };
    expect(paymentStatus(student, '2026-11-16')).toBe('today');
    expect(paymentStatus(student, '2026-11-17')).toBe('overdue');
    expect(paymentStatus({ ...student, next_payment_date: '2026-11-19' }, '2026-11-16')).toBe('soon');
    expect(paymentStatus({ ...student, next_payment_date: '2026-11-20' }, '2026-11-16')).toBe('paid');
  });

  it('keeps an unpaid due date overdue until a payment advances the schedule', () => {
    const student = { status: 'active', next_payment_date: '2026-12-08' };
    expect(paymentStatus(student, '2026-12-03')).toBe('paid');
    expect(paymentStatus(student, '2026-12-07')).toBe('soon');
    expect(paymentStatus(student, '2026-12-08')).toBe('today');
    expect(paymentStatus(student, '2026-12-09')).toBe('overdue');
    expect(paymentStatus(student, '2027-01-08')).toBe('overdue');
  });

  it('keeps paused students out of payment reminders', () => {
    expect(paymentStatus({ status: 'paused', next_payment_date: '2026-01-01' }, '2026-11-16')).toBe('paused');
  });

  it('keeps a partial installment due and reports the remaining amount', () => {
    const student = { id: 's1', payment_day: 15, monthly_price: 15000, next_payment_date: '2026-11-15' };
    const payments = [{ student_id: 's1', amount: 1000, billing_period_end: '2026-11-15', payment_date: '2026-11-16' }];
    expect(paymentProgress(student, payments)).toEqual({ paid: 1000, remaining: 14000, complete: false });
    expect(scheduleFromPayments(student, payments).next_payment_date).toBe('2026-11-15');
  });

  it('advances only after the full monthly fee is covered', () => {
    const student = { id: 's1', payment_day: 15, monthly_price: 15000, next_payment_date: '2026-11-15' };
    const payments = [
      { student_id: 's1', amount: 1000, billing_period_end: '2026-11-15', payment_date: '2026-11-16' },
      { student_id: 's1', amount: 14000, billing_period_end: '2026-11-15', payment_date: '2026-11-18' },
    ];
    expect(paymentProgress(student, payments)).toEqual({ paid: 15000, remaining: 0, complete: true });
    expect(scheduleFromPayments(student, payments).next_payment_date).toBe('2026-12-15');
  });

  it('keeps a payment in the same billing month when the due day is edited', () => {
    const student = { id: 's1', payment_day: 15, monthly_price: 15000, next_payment_date: '2026-11-15' };
    const payments = [{ student_id: 's1', amount: 15000, billing_period_end: '2026-11-16', payment_date: '2026-11-16' }];
    expect(paymentProgress(student, payments)).toEqual({ paid: 15000, remaining: 0, complete: true });
    expect(scheduleFromPayments(student, payments).next_payment_date).toBe('2026-12-15');
  });

  it('restores the unpaid due date if the last period payment is removed', () => {
    const student = { id: 's1', payment_day: 15, monthly_price: 15000, next_payment_date: '2026-12-15' };
    const payments = [
      { student_id: 's1', amount: 15000, billing_period_end: '2026-10-15', payment_date: '2026-10-15' },
      { student_id: 's1', amount: 1000, billing_period_end: '2026-11-15', payment_date: '2026-11-16' },
    ];
    expect(scheduleFromPayments(student, payments.slice(0, 1)).next_payment_date).toBe('2026-11-15');
    expect(scheduleFromPayments(student, [], '2026-11-15').next_payment_date).toBe('2026-11-15');
  });

  it('applies a late November payment to the oldest due October period', () => {
    const student = { id: 'musa', payment_day: 11, monthly_price: 15000, next_payment_date: '2026-10-11' };
    const september = { id: 'sep', student_id: 'musa', amount: 15000, payment_date: '2026-09-11', billing_period_end: '2026-09-11' };
    const octoberDate = billingDateForPayment(11, '2026-11-02', student.next_payment_date);
    expect(octoberDate).toBe('2026-10-11');
    const october = { id: 'oct', student_id: 'musa', amount: 15000, payment_date: '2026-11-02', billing_period_end: octoberDate };
    expect(scheduleFromPayments(student, [september, october]).next_payment_date).toBe('2026-11-11');
  });

  it('keeps an old September payment in September when October is already paid', () => {
    const student = { id: 'ali', payment_day: 12, monthly_price: 15000, next_payment_date: '2026-11-12' };
    expect(billingDateForPayment(12, '2026-09-09', student.next_payment_date)).toBe('2026-09-12');
    const payments = [
      { id: 'oct', student_id: 'ali', amount: 15000, payment_date: '2026-10-12', billing_period_end: '2026-10-12' },
      { id: 'sep', student_id: 'ali', amount: 15000, payment_date: '2026-09-09', billing_period_end: '2026-09-12' },
    ];
    expect(scheduleFromPayments(student, payments).next_payment_date).toBe('2026-11-12');
  });
});
