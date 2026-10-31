-- Serialize bounty writes for a climber/date/bounty without a unique index: imported
-- duplicate rows must stay intact and editable when their claim key is unchanged.
-- No existing activity is changed by this migration.
create function guard_duplicate_bounty()
returns trigger
language plpgsql
as $$
begin
  -- Organizer snapshot imports preserve historical duplicates; the browser cannot set this.
  if current_setting('road_to_send.importing', true) = 'true' then return new; end if;
  if new.type <> 'bounty' then return new; end if;
  -- Note/grade edits (including name casing) keep historical claims, without locking.
  if tg_op = 'UPDATE' then
    if new.type = old.type and lower(new.name) = lower(old.name)
      and new.date = old.date and new.bounty_id = old.bounty_id then
      return new;
    end if;
  end if;
  -- Idempotent creates reach BEFORE INSERT even when ON CONFLICT will skip them.
  if tg_op = 'INSERT' and exists (select 1 from activities where id = new.id) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(new.name) || '|' || new.date || '|' || new.bounty_id, 0));
  if exists (
    select 1 from activities
    where id <> new.id and type = 'bounty' and lower(name) = lower(new.name)
      and date = new.date and bounty_id = new.bounty_id
  ) then
    raise sqlstate 'PT409' using message = 'duplicate_bounty';
  end if;
  return new;
end;
$$;

revoke all on function guard_duplicate_bounty() from public, anon, authenticated;
create trigger activities_duplicate_bounty
before insert or update on activities
for each row execute function guard_duplicate_bounty();
