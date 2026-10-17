begin;
select plan(3);

select is(
  (select value #>> '{}' from public.app_settings where key = 'payments.refund_processing_days'),
  '10', 'refund processing window is a setting (default 10 business days)');
select ok(
  (select is_public from public.app_settings where key = 'payments.refund_processing_days'),
  'refund window is public (it is shown on the Refund Policy page)');

set local role anon;
select is(
  (select count(*)::int from public.app_settings where key = 'payments.refund_processing_days'),
  1, 'anonymous visitors can read it');

select * from finish();
rollback;
