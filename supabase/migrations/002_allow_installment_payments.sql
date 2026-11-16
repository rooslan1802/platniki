-- Several partial payments may belong to the same student's monthly period.
alter table public.payments
  drop constraint if exists payments_student_id_billing_period_start_billing_period_end_key;
