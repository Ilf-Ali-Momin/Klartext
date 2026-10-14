-- Paid letter credits and the hourly request counter per credit code.
-- No emails, names or letter content are stored.

create table if not exists credits (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- random, 10 chars, unambiguous alphabet
  stripe_session_id text unique not null,
  pack text not null,
  credits_total int not null,
  credits_left int not null check (credits_left >= 0),
  created_at timestamptz default now()
);

-- Requests per credit code per hour, for abuse limits.
create table if not exists paid_usage (
  credit_id uuid not null references credits (id) on delete cascade,
  hour timestamptz not null,              -- start of the hour, UTC
  count int not null default 0,
  primary key (credit_id, hour)
);

-- Only the server, using the service role key, reads or writes these tables.
alter table credits enable row level security;
alter table paid_usage enable row level security;

-- Create the credit row for a paid Checkout session. Idempotent on stripe_session_id: whichever of the
-- webhook and the success page runs first creates the row, and both get the same code back.
-- Raises unique_violation if p_code is already taken by another session, so the caller retries with a new code.
create or replace function create_credit(p_code text, p_stripe_session_id text, p_pack text, p_credits int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text;
begin
  insert into credits (code, stripe_session_id, pack, credits_total, credits_left)
  values (p_code, p_stripe_session_id, p_pack, p_credits, p_credits)
  on conflict (stripe_session_id) do nothing;
  select code into existing from credits where stripe_session_id = p_stripe_session_id;
  return existing;
end;
$$;

-- Atomically take one credit. Returns the credits left afterwards, or null if the code is unknown or empty.
create or replace function reserve_credit(p_code text)
returns int
language sql
security definer
set search_path = public
as $$
  update credits
  set credits_left = credits_left - 1
  where code = p_code and credits_left > 0
  returning credits_left;
$$;

-- Give back a credit that was not used. Never exceeds credits_total. Returns the credits left afterwards.
create or replace function refund_credit(p_code text)
returns int
language sql
security definer
set search_path = public
as $$
  update credits
  set credits_left = least(credits_left + 1, credits_total)
  where code = p_code
  returning credits_left;
$$;

-- Credits left for a code, or null if the code is unknown.
create or replace function credits_left(p_code text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select credits_left from credits where code = p_code;
$$;

-- Atomically count one request for a code in the given hour. Returns false when the limit is reached
-- or the code is unknown.
create or replace function consume_paid_usage(p_code text, p_hour timestamptz, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit_id uuid;
  new_count int;
begin
  select id into v_credit_id from credits where code = p_code;
  if v_credit_id is null then
    return false;
  end if;
  insert into paid_usage as p (credit_id, hour, count)
  values (v_credit_id, p_hour, 1)
  on conflict (credit_id, hour) do update
    set count = p.count + 1
    where p.count < p_limit
  returning p.count into new_count;
  return new_count is not null;
end;
$$;

-- Extend the scheduled cleanup to hourly counters older than one day.
create or replace function cleanup_free_usage()
returns void
language sql
security definer
set search_path = public
as $$
  delete from free_usage where day < current_date - 7;
  delete from paid_usage where hour < now() - interval '1 day';
$$;

revoke all on function create_credit(text, text, text, int) from public, anon, authenticated;
revoke all on function reserve_credit(text) from public, anon, authenticated;
revoke all on function refund_credit(text) from public, anon, authenticated;
revoke all on function credits_left(text) from public, anon, authenticated;
revoke all on function consume_paid_usage(text, timestamptz, int) from public, anon, authenticated;
revoke all on function cleanup_free_usage() from public, anon, authenticated;
