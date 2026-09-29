-- Road to Send board: the Postgres side of the Supabase Edge Function (see AGENTS.md).
-- Nothing here is reachable with the anon key: RLS is on for every table and no policy exists,
-- so only the function's service-role key can read or write.

create table settings (
  id smallint primary key default 1 check (id = 1),          -- singleton
  start_date text not null,
  trip_date text not null,                                    -- 'YYYY-MM-DD', inclusive
  goal int not null check (goal between 50 and 10000),
  time_zone text not null default 'UTC',
  check (start_date <= trip_date)
);

create table participants (
  name text not null check (char_length(name) between 1 and 30),
  position int not null
);
create unique index participants_name_ci on participants (lower(name));

-- Lenient on purpose: it mirrors the Sheet, so anything the Sheet ever held can be imported.
-- Strict validation happens on write, in the function's core module.
create table activities (
  seq bigint generated always as identity,                    -- feed order
  id text primary key,
  name text not null,
  type text not null,
  category text not null default '',
  points int not null default 0,
  date text not null,
  created_at text not null,                                   -- round-trips the exact string
  hardest_grade text not null default '',
  bounty_id text not null default '',
  bounty_title text not null default '',
  note text not null default ''
);

alter table settings enable row level security;
alter table participants enable row level security;
alter table activities enable row level security;

revoke all on table settings, participants, activities from anon, authenticated;

-- Replaces the setup in one transaction: upserts the settings row (keeping time_zone), then
-- rewrites the roster with position = array index.
create function save_config(p_start text, p_trip text, p_goal int, p_crew text[])
returns void
language plpgsql
as $$
begin
  insert into settings (id, start_date, trip_date, goal)
  values (1, p_start, p_trip, p_goal)
  on conflict (id) do update
    set start_date = excluded.start_date,
        trip_date = excluded.trip_date,
        goal = excluded.goal;
  delete from participants;
  insert into participants (name, position)
  select t.name, (t.ord - 1)::int
  from unnest(coalesce(p_crew, array[]::text[])) with ordinality as t(name, ord);
end;
$$;

revoke all on function save_config(text, text, int, text[]) from public, anon, authenticated;
grant execute on function save_config(text, text, int, text[]) to service_role;
