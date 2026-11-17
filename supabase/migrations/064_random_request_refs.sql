-- Request refs were sequential ('REQ-2041', 'REQ-2042', ...), so anyone could
-- walk the sequence and try refs with a phone number. New requests now get the
-- same 40-bit random suffix as mk_bookings.ref (055). Existing refs are kept
-- so guests' saved links keep working.

alter table public.mk_requests
  alter column ref set default ('REQ-' || upper(encode(gen_random_bytes(5), 'hex')));
