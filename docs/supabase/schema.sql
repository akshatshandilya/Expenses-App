-- Expenses: cloud sync schema for Supabase. Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- The server only ever stores ciphertext and opaque ids. It cannot read amounts, notes, categories or profile names.
-- Safe to run again: everything is "create ... if not exists" or "create or replace".

create table if not exists public.profiles(
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name_box jsonb not null,                 -- profile name, encrypted: {iv, ct}
  key_ver int not null default 1,          -- goes up each time the profile key is replaced
  created_at timestamptz not null default now()
);
create table if not exists public.members(
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (profile_id, user_id)
);
create table if not exists public.devices(
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null default gen_random_uuid(),
  name text not null default 'Phone' check (char_length(name) <= 40),
  pub jsonb not null,                      -- this phone's PUBLIC key; the private half never leaves the phone
  created_at timestamptz not null default now(),
  primary key (user_id, device_id)
);
create table if not exists public.profile_keys(
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null,
  device_id uuid not null,
  key_ver int not null,
  wrapped jsonb not null,                  -- the profile key, locked so only that one phone can open it
  primary key (profile_id, user_id, device_id, key_ver),
  foreign key (user_id, device_id) references public.devices(user_id, device_id) on delete cascade
);
create table if not exists public.items(
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kid text not null check (char_length(kid) <= 64),   -- opaque item id
  key_ver int not null,
  t bigint not null,                       -- time of the change, used to pick the newest version
  iv text not null,
  ct text not null check (char_length(ct) <= 65536),
  author uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, kid)
);
create index if not exists items_profile_updated on public.items(profile_id, updated_at);
create table if not exists public.invites(
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  key_ver int not null,
  wrapped jsonb not null,                  -- profile key, locked with a secret that is only in the link's # part
  expires_at timestamptz not null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);
create table if not exists public.user_recovery(
  user_id uuid primary key references auth.users(id) on delete cascade,
  pub jsonb not null,                      -- recovery PUBLIC key: any of the person's phones can lock new profile keys to it
  priv_box jsonb not null,                 -- the matching private key, locked with the person's 12-word recovery key
  updated_at timestamptz not null default now()
);
create table if not exists public.recovery_keys(
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  key_ver int not null,
  wrapped jsonb not null,                  -- a profile key, locked so only the 12-word recovery key can open it
  primary key (user_id, profile_id, key_ver)
);

-- A person may register at most 2 phones.
create or replace function public.limit_devices() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.devices where user_id = new.user_id) >= 2 then
    raise exception 'device_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists devices_limit on public.devices;
create trigger devices_limit before insert on public.devices for each row execute function public.limit_devices();

-- Helpers (security definer so the row-level rules below can ask "is this person a member?" without looping).
create or replace function public.is_member(pid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.members where profile_id = pid and user_id = auth.uid());
$$;
create or replace function public.shares_profile(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.members a join public.members b on a.profile_id = b.profile_id where a.user_id = auth.uid() and b.user_id = uid);
$$;

-- Row-level security: nothing is readable unless a rule below allows it. Writes go through the functions further down.
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.devices enable row level security;
alter table public.profile_keys enable row level security;
alter table public.items enable row level security;
alter table public.invites enable row level security;
alter table public.user_recovery enable row level security;
alter table public.recovery_keys enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (public.is_member(id));
drop policy if exists profiles_rename on public.profiles;
create policy profiles_rename on public.profiles for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.is_member(profile_id));
drop policy if exists devices_read on public.devices;
create policy devices_read on public.devices for select to authenticated using (user_id = auth.uid() or public.shares_profile(user_id));
drop policy if exists devices_add on public.devices;
create policy devices_add on public.devices for insert to authenticated with check (user_id = auth.uid());
drop policy if exists devices_remove on public.devices;
create policy devices_remove on public.devices for delete to authenticated using (user_id = auth.uid());
drop policy if exists keys_read on public.profile_keys;
create policy keys_read on public.profile_keys for select to authenticated using (user_id = auth.uid());
drop policy if exists items_read on public.items;
create policy items_read on public.items for select to authenticated using (public.is_member(profile_id));
drop policy if exists recovery_all on public.user_recovery;
create policy recovery_all on public.user_recovery for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists recovery_keys_all on public.recovery_keys;
create policy recovery_keys_all on public.recovery_keys for all to authenticated using (user_id = auth.uid() and public.is_member(profile_id)) with check (user_id = auth.uid() and public.is_member(profile_id));
-- invites: no policy at all, so they can only be used through the functions below.

-- Create a shared profile and store the creator's own copy of its key, in one step.
create or replace function public.create_profile(p_id uuid, p_name_box jsonb, p_device uuid, p_wrapped jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid := p_id; me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if pid is null then raise exception 'bad_id'; end if;
  if (select count(*) from public.profiles where owner = me) >= 12 then raise exception 'profile_limit'; end if;
  if not exists(select 1 from public.devices where user_id = me and device_id = p_device) then raise exception 'unknown_device'; end if;
  insert into public.profiles(id, owner, name_box) values (pid, me, p_name_box);
  insert into public.members(profile_id, user_id, role, added_by) values (pid, me, 'owner', me);
  insert into public.profile_keys(profile_id, user_id, device_id, key_ver, wrapped) values (pid, me, p_device, 1, p_wrapped);
  return pid;
end $$;

-- Save changed items. Each row is {kid, t, iv, ct}. A row is kept only if it is newer than what is stored.
create or replace function public.put_items(p_profile uuid, p_ver int, p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0; me uuid := auth.uid(); cur int;
begin
  if not public.is_member(p_profile) then raise exception 'not_a_member'; end if;
  select key_ver into cur from public.profiles where id = p_profile;
  if p_ver <> cur then raise exception 'stale_key'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'bad_batch'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.items(profile_id, kid, key_ver, t, iv, ct, author)
      values (p_profile, r->>'kid', p_ver, (r->>'t')::bigint, r->>'iv', r->>'ct', me)
    on conflict (profile_id, kid) do update
      set key_ver = excluded.key_ver, t = excluded.t, iv = excluded.iv, ct = excluded.ct, author = excluded.author, updated_at = now()
      where excluded.t >= public.items.t;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Invite: any member can make one. It works once and expires after 24 hours.
create or replace function public.create_invite(p_profile uuid, p_wrapped jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare iid uuid; cur int;
begin
  if not public.is_member(p_profile) then raise exception 'not_a_member'; end if;
  select key_ver into cur from public.profiles where id = p_profile;
  insert into public.invites(profile_id, created_by, key_ver, wrapped, expires_at) values (p_profile, auth.uid(), cur, p_wrapped, now() + interval '24 hours') returning id into iid;
  delete from public.invites where profile_id = p_profile and (expires_at < now() - interval '7 days');
  return iid;
end $$;

-- Redeeming joins instantly. Returns what the phone needs to open the profile key with the secret from the link.
create or replace function public.redeem_invite(p_invite uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv public.invites; me uuid := auth.uid(); nb jsonb; already boolean;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select * into inv from public.invites where id = p_invite for update;
  if not found then raise exception 'invite_invalid'; end if;
  select exists(select 1 from public.members where profile_id = inv.profile_id and user_id = me) into already;
  if already then raise exception 'already_member'; end if;
  if inv.used_by is not null or inv.expires_at < now() then raise exception 'invite_invalid'; end if;
  update public.invites set used_by = me, used_at = now() where id = p_invite;
  insert into public.members(profile_id, user_id, role, added_by) values (inv.profile_id, me, 'member', inv.created_by);
  select name_box into nb from public.profiles where id = inv.profile_id;
  return jsonb_build_object('profile_id', inv.profile_id, 'key_ver', inv.key_ver, 'wrapped', inv.wrapped, 'name_box', nb);
end $$;

-- Store a phone's own copy of a profile key. Allowed for your own phone, or for another member's phone (re-adding a family member's device).
create or replace function public.grant_device(p_profile uuid, p_user uuid, p_device uuid, p_ver int, p_wrapped jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cur int;
begin
  if not public.is_member(p_profile) then raise exception 'not_a_member'; end if;
  if not exists(select 1 from public.members where profile_id = p_profile and user_id = p_user) then raise exception 'not_a_member'; end if;
  if not exists(select 1 from public.devices where user_id = p_user and device_id = p_device) then raise exception 'unknown_device'; end if;
  select key_ver into cur from public.profiles where id = p_profile;
  if p_ver <> cur then raise exception 'stale_key'; end if;
  if p_user <> auth.uid() and not exists(select 1 from public.profile_keys where profile_id = p_profile and user_id = auth.uid() and key_ver = cur) then raise exception 'no_key'; end if;
  insert into public.profile_keys(profile_id, user_id, device_id, key_ver, wrapped) values (p_profile, p_user, p_device, p_ver, p_wrapped)
  on conflict (profile_id, user_id, device_id, key_ver) do update set wrapped = excluded.wrapped;
end $$;

-- Phones of members that do not yet hold the current key (a new phone, or someone who just joined).
create or replace function public.pending_devices(p_profile uuid) returns table(user_id uuid, device_id uuid, name text, pub jsonb)
language sql stable security definer set search_path = public as $$
  select d.user_id, d.device_id, d.name, d.pub
  from public.members m join public.devices d on d.user_id = m.user_id
  join public.profiles p on p.id = m.profile_id
  where m.profile_id = p_profile and public.is_member(p_profile)
    and not exists(select 1 from public.profile_keys k where k.profile_id = p_profile and k.user_id = d.user_id and k.device_id = d.device_id and k.key_ver = p.key_ver);
$$;

-- Members of a profile with their sign-in email, so the family can see who is in it.
drop function if exists public.list_members(uuid);
create function public.list_members(p_profile uuid) returns table(user_id uuid, email text, role text, created_at timestamptz, name text)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role, m.created_at, nullif(left(btrim(u.raw_user_meta_data->>'name'), 40), '') from public.members m join auth.users u on u.id = m.user_id
  where m.profile_id = p_profile and public.is_member(p_profile) order by m.created_at;
$$;

-- Leave a profile (any member), or remove someone (the owner). Removal means the key must be replaced: see rotate_profile.
create or replace function public.remove_member(p_profile uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); owner_id uuid;
begin
  select owner into owner_id from public.profiles where id = p_profile;
  if not public.is_member(p_profile) then raise exception 'not_a_member'; end if;
  if p_user = owner_id then raise exception 'owner_cannot_leave'; end if;
  if p_user <> me and me <> owner_id then raise exception 'owner_only'; end if;
  delete from public.profile_keys where profile_id = p_profile and user_id = p_user;
  delete from public.recovery_keys where profile_id = p_profile and user_id = p_user;
  delete from public.members where profile_id = p_profile and user_id = p_user;
end $$;

-- Owner replaces the profile key after removing someone: all items are re-sealed under the new key and swapped in, in one step.
-- p_name_box: the profile name sealed with the new key; p_rows: items sealed with the new key; p_keys: [{user_id, device_id, wrapped}] for every remaining member's phone.
create or replace function public.rotate_profile(p_profile uuid, p_new_ver int, p_name_box jsonb, p_rows jsonb, p_keys jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare r jsonb; me uuid := auth.uid(); cur int;
begin
  if not exists(select 1 from public.profiles where id = p_profile and owner = me) then raise exception 'owner_only'; end if;
  select key_ver into cur from public.profiles where id = p_profile;
  if p_new_ver <> cur + 1 then raise exception 'stale_key'; end if;
  delete from public.items where profile_id = p_profile;
  delete from public.invites where profile_id = p_profile;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.items(profile_id, kid, key_ver, t, iv, ct, author) values (p_profile, r->>'kid', p_new_ver, (r->>'t')::bigint, r->>'iv', r->>'ct', me);
  end loop;
  update public.profiles set key_ver = p_new_ver, name_box = p_name_box where id = p_profile;
  for r in select * from jsonb_array_elements(p_keys) loop
    if not exists(select 1 from public.members where profile_id = p_profile and user_id = (r->>'user_id')::uuid) then raise exception 'not_a_member'; end if;
    insert into public.profile_keys(profile_id, user_id, device_id, key_ver, wrapped) values (p_profile, (r->>'user_id')::uuid, (r->>'device_id')::uuid, p_new_ver, r->'wrapped');
  end loop;
end $$;

-- Owner deletes a shared profile and everything in it, for everyone.
create or replace function public.delete_profile(p_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.profiles where id = p_profile and owner = auth.uid()) then raise exception 'owner_only'; end if;
  delete from public.profiles where id = p_profile;
end $$;

-- Who can call what. Signed-out visitors can call nothing.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;
grant select on public.profiles, public.members, public.devices, public.profile_keys, public.items to authenticated;
grant insert, delete on public.devices to authenticated;
grant update (name_box) on public.profiles to authenticated;
grant select, insert, update, delete on public.user_recovery, public.recovery_keys to authenticated;
grant execute on function public.create_profile(uuid, jsonb, uuid, jsonb), public.put_items(uuid, int, jsonb), public.create_invite(uuid, jsonb),
  public.redeem_invite(uuid), public.grant_device(uuid, uuid, uuid, int, jsonb), public.pending_devices(uuid), public.list_members(uuid),
  public.remove_member(uuid, uuid), public.rotate_profile(uuid, int, jsonb, jsonb, jsonb), public.delete_profile(uuid),
  public.is_member(uuid), public.shares_profile(uuid) to authenticated;
