-- Hashed free tier counters. No letter content and no raw IP addresses are stored.

create table if not exists free_usage (
  ip_hash text not null,                  -- sha256(ip + IP_HASH_SALT + day)
  day date not null,
  count int not null default 0,
  primary key (ip_hash, day)
);

-- Only the server, using the service role key, reads or writes this table.
alter table free_usage enable row level security;

-- Atomically count one free letter. Returns false when the daily limit is already reached.
create or replace function consume_free_usage(p_ip_hash text, p_day date, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into free_usage as f (ip_hash, day, count)
  values (p_ip_hash, p_day, 1)
  on conflict (ip_hash, day) do update
    set count = f.count + 1
    where f.count < p_limit
  returning f.count into new_count;
  return new_count is not null;
end;
$$;

-- Give back a free letter that was not used, for example when the photo was unreadable.
create or replace function release_free_usage(p_ip_hash text, p_day date)
returns void
language sql
security definer
set search_path = public
as $$
  update free_usage
  set count = greatest(count - 1, 0)
  where ip_hash = p_ip_hash and day = p_day;
$$;

-- Delete counters older than 7 days. Scheduled in a later phase.
create or replace function cleanup_free_usage()
returns void
language sql
security definer
set search_path = public
as $$
  delete from free_usage where day < current_date - 7;
$$;

revoke all on function consume_free_usage(text, date, int) from public, anon, authenticated;
revoke all on function release_free_usage(text, date) from public, anon, authenticated;
revoke all on function cleanup_free_usage() from public, anon, authenticated;
