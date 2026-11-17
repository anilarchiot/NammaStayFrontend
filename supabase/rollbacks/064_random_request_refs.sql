-- Restores the sequential default for mk_requests.ref. Re-opens ref enumeration.
alter table public.mk_requests
  alter column ref set default ('REQ-' || nextval('public.mk_request_seq'));
