-- Phase 3 retest fixes: new notification kinds (own migration: a new enum value can't be used in the same transaction).
alter type public.notification_kind add value if not exists 'report_received';
alter type public.notification_kind add value if not exists 'club_leader_assigned';
