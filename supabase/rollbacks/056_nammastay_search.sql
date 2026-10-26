-- Rollback for 056_nammastay_search.sql (removes all NammaStay Search data; mk_listings / mk_rooms keep their extra columns)
drop trigger if exists mk2_guard_listing on public.mk_listings;
drop function if exists public.mk2_is_admin(), public.mk2_owns(uuid), public._mk2_require_owner(uuid), public._mk2_require_admin(), public.mk2_expire(),
  public._mk2_guard_listing(), public._mk2_digits(text), public.mk2_free_beds(uuid, date, date), public.mk2_bill(uuid, date), public.mk2_paused(uuid),
  public._mk2_rating(uuid), public.mk2_search(text, date, date, int, text, boolean), public.mk2_listing(uuid, date, date),
  public.mk2_request(uuid, date, date, int, text, text, text, boolean, text, timestamptz), public.mk2_track(text, text), public.mk2_cancel_request(text, text),
  public.mk2_review(text, text, int, text, text[]), public.mk2_create_listing(jsonb), public.mk2_my_listings(),
  public.mk2_owner_save(uuid, jsonb, text[], text, text, text), public.mk2_owner_requests(uuid), public.mk2_respond(uuid, boolean), public.mk2_mark_stay(uuid, boolean),
  public.mk2_owner_bill(uuid, date), public.mk2_owner_reply_review(uuid, text), public.mk2_owner_reviews(uuid), public.mk2_pay_utr(uuid, date, text),
  public.mk2_admin_queue(), public.mk2_admin_decide(uuid, text, text, jsonb, text), public.mk2_admin_bills(date), public.mk2_admin_confirm_paid(uuid, date),
  public.mk2_admin_set_settings(date, numeric, int, int), public.mk2_admin_hide_review(uuid, boolean), public.mk2_public_settings();
drop table if exists public.mk_bill_payments, public.mk_reviews, public.mk_requests, public.mk_admins, public.mk_settings;
drop sequence if exists public.mk_request_seq;
