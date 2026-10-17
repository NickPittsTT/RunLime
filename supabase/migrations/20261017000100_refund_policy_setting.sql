-- Refund Policy (docs/legal/refund-policy.md): the refund payment window is a setting, shown on /legal/refunds.
insert into public.app_settings (key, value, is_public, description) values
  ('payments.refund_processing_days', '"10"', true,
   'Business days within which an organiser listing-fee refund is sent after it is confirmed (Refund Policy).')
on conflict (key) do nothing;
