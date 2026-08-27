do $$
begin
  create type public.ledger_invitation_status as enum (
    'pending', 'accepted', 'declined', 'revoked', 'expired'
  );
exception
  when duplicate_object then null;
end;
$$;

update public.ledgers
set name = btrim(name)
where name <> btrim(name);

create unique index if not exists ledgers_owner_trimmed_name_unique
  on public.ledgers (owner_id, lower(btrim(name)));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ledgers'::regclass
      and conname = 'ledgers_name_trimmed'
  ) then
    alter table public.ledgers
      add constraint ledgers_name_trimmed check (name = btrim(name));
  end if;
end;
$$;

create table if not exists public.ledger_invitations (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid not null references auth.users (id) on delete cascade,
  status public.ledger_invitation_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint ledger_invitations_future_expiry check (expires_at > created_at),
  constraint ledger_invitations_response_time check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

create unique index if not exists ledger_invitations_one_pending_target
  on public.ledger_invitations (ledger_id, target_user_id)
  where status = 'pending';
create index if not exists ledger_invitations_target_status_index
  on public.ledger_invitations (target_user_id, status, expires_at);
create index if not exists ledger_invitations_ledger_status_index
  on public.ledger_invitations (ledger_id, status, expires_at);

create or replace function public.has_ledger_invitation_with(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ledger_invitations as invitation
    join public.ledgers as ledger on ledger.id = invitation.ledger_id
    where invitation.status = 'pending'
      and invitation.expires_at > now()
      and (
        (ledger.owner_id = auth.uid() and invitation.target_user_id = other_user_id)
        or (invitation.target_user_id = auth.uid() and ledger.owner_id = other_user_id)
      )
  );
$$;

drop policy if exists profiles_select_shared_members on public.profiles;
create policy profiles_select_shared_members
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.shares_ledger_with(id)
  or public.has_ledger_invitation_with(id)
);

alter table public.ledger_invitations enable row level security;

drop policy if exists ledger_invitations_select_parties on public.ledger_invitations;
create policy ledger_invitations_select_parties
on public.ledger_invitations for select
to authenticated
using (
  target_user_id = auth.uid()
  or public.is_ledger_owner(ledger_id)
);

create or replace function private.reset_removed_member_default_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_private_profiles as private_profile
  set default_ledger_id = (
    select ledger.id
    from public.ledgers as ledger
    where ledger.owner_id = old.user_id
      and ledger.kind = 'personal'
    limit 1
  )
  where private_profile.user_id = old.user_id
    and private_profile.default_ledger_id = old.ledger_id;
  return old;
end;
$$;

drop trigger if exists on_ledger_member_removed on public.ledger_members;
create trigger on_ledger_member_removed
after delete on public.ledger_members
for each row execute function private.reset_removed_member_default_ledger();

create or replace function private.reset_deleted_ledger_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_private_profiles as private_profile
  set default_ledger_id = (
    select personal.id
    from public.ledgers as personal
    where personal.owner_id = private_profile.user_id
      and personal.kind = 'personal'
    limit 1
  )
  where private_profile.default_ledger_id = old.id;
  return old;
end;
$$;

drop trigger if exists before_shared_ledger_deleted on public.ledgers;
create trigger before_shared_ledger_deleted
before delete on public.ledgers
for each row execute function private.reset_deleted_ledger_defaults();

create or replace function public.create_shared_ledger(ledger_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_ledger_id uuid;
  normalized_name text := btrim(ledger_name);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'invalid ledger name';
  end if;

  insert into public.ledgers (owner_id, kind, name, currency_code, period_start_day)
  values (caller_id, 'shared', normalized_name, 'KRW', 1)
  returning id into new_ledger_id;

  insert into public.categories (ledger_id, type, name, color, sort_order)
  values
    (new_ledger_id, 'income', '급여', '#10B981', 10),
    (new_ledger_id, 'income', '부수입', '#34D399', 20),
    (new_ledger_id, 'income', '용돈', '#6EE7B7', 30),
    (new_ledger_id, 'income', '환급', '#059669', 40),
    (new_ledger_id, 'income', '기타', '#64748B', 50),
    (new_ledger_id, 'expense', '식비', '#F97316', 10),
    (new_ledger_id, 'expense', '교통', '#3B82F6', 20),
    (new_ledger_id, 'expense', '주거·공과금', '#8B5CF6', 30),
    (new_ledger_id, 'expense', '생활', '#14B8A6', 40),
    (new_ledger_id, 'expense', '건강·의료', '#EF4444', 50),
    (new_ledger_id, 'expense', '쇼핑', '#EC4899', 60),
    (new_ledger_id, 'expense', '취미·여가', '#F59E0B', 70),
    (new_ledger_id, 'expense', '교육', '#6366F1', 80),
    (new_ledger_id, 'expense', '경조·선물', '#D946EF', 90),
    (new_ledger_id, 'expense', '기타', '#64748B', 100);

  update public.user_private_profiles
  set default_ledger_id = new_ledger_id
  where user_id = caller_id;

  return new_ledger_id;
end;
$$;

create or replace function public.resolve_invitation_target(candidate_identifier text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select identifier.user_id
  from private.account_identifiers as identifier
  where identifier.login_id = lower(btrim(candidate_identifier))
     or identifier.email_normalized = lower(btrim(candidate_identifier))
  limit 1;
$$;

create or replace function public.create_ledger_invitation(
  target_ledger_id uuid,
  invited_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_kind public.ledger_kind;
  target_owner uuid;
  new_invitation_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select ledger.kind, ledger.owner_id
  into target_kind, target_owner
  from public.ledgers as ledger
  where ledger.id = target_ledger_id
  for update;

  if target_owner is null or target_owner <> caller_id then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;
  if target_kind <> 'shared' then
    raise exception using errcode = 'P0001', message = 'shared ledger required';
  end if;
  if invited_user_id = caller_id then
    raise exception using errcode = 'P0001', message = 'cannot invite self';
  end if;
  if not exists (select 1 from auth.users as target where target.id = invited_user_id) then
    raise exception using errcode = 'P0001', message = 'target user not found';
  end if;
  if exists (
    select 1 from public.ledger_members as member
    where member.ledger_id = target_ledger_id and member.user_id = invited_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'target already member';
  end if;

  update public.ledger_invitations
  set status = 'expired', responded_at = now()
  where ledger_id = target_ledger_id
    and target_user_id = invited_user_id
    and status = 'pending'
    and expires_at <= now();

  insert into public.ledger_invitations (ledger_id, target_user_id, invited_by)
  values (target_ledger_id, invited_user_id, caller_id)
  returning id into new_invitation_id;

  return new_invitation_id;
end;
$$;

create or replace function public.respond_to_ledger_invitation(
  target_invitation_id uuid,
  response text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  invitation public.ledger_invitations%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if response not in ('accept', 'decline') then
    raise exception using errcode = '22023', message = 'invalid invitation response';
  end if;

  select * into invitation
  from public.ledger_invitations
  where id = target_invitation_id
  for update;

  if invitation.id is null or invitation.target_user_id <> caller_id then
    raise exception using errcode = '42501', message = 'invitation target required';
  end if;
  if invitation.status <> 'pending' then
    return 'processed';
  end if;
  if invitation.expires_at <= now() then
    update public.ledger_invitations
    set status = 'expired', responded_at = now()
    where id = target_invitation_id;
    return 'expired';
  end if;

  if response = 'decline' then
    update public.ledger_invitations
    set status = 'declined', responded_at = now()
    where id = target_invitation_id;
    return 'declined';
  end if;

  insert into public.ledger_members (ledger_id, user_id, role)
  values (invitation.ledger_id, caller_id, 'member')
  on conflict (ledger_id, user_id) do nothing;

  update public.ledger_invitations
  set status = 'accepted', responded_at = now()
  where id = target_invitation_id;
  return 'accepted';
end;
$$;

create or replace function public.revoke_ledger_invitation(target_invitation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.ledger_invitations%rowtype;
begin
  select * into invitation
  from public.ledger_invitations
  where id = target_invitation_id
  for update;

  if invitation.id is null or not public.is_ledger_owner(invitation.ledger_id) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;
  if invitation.status <> 'pending' then
    return 'processed';
  end if;
  if invitation.expires_at <= now() then
    update public.ledger_invitations
    set status = 'expired', responded_at = now()
    where id = target_invitation_id;
    return 'processed';
  end if;

  update public.ledger_invitations
  set status = 'revoked', responded_at = now()
  where id = target_invitation_id;
  return 'revoked';
end;
$$;

create or replace function public.remove_ledger_member(target_ledger_id uuid, target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_role public.ledger_member_role;
begin
  if not public.is_ledger_owner(target_ledger_id) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  select role into member_role
  from public.ledger_members
  where ledger_id = target_ledger_id and user_id = target_user_id
  for update;

  if member_role is null then return 'missing'; end if;
  if member_role = 'owner' then return 'owner'; end if;

  delete from public.ledger_members
  where ledger_id = target_ledger_id and user_id = target_user_id and role = 'member';
  return 'removed';
end;
$$;

create or replace function public.leave_shared_ledger(target_ledger_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  member_role public.ledger_member_role;
  target_kind public.ledger_kind;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  select member.role, ledger.kind into member_role, target_kind
  from public.ledger_members as member
  join public.ledgers as ledger on ledger.id = member.ledger_id
  where member.ledger_id = target_ledger_id and member.user_id = caller_id
  for update of member;

  if member_role is null then return 'missing'; end if;
  if target_kind = 'personal' then return 'personal'; end if;
  if member_role = 'owner' then return 'owner'; end if;

  delete from public.ledger_members
  where ledger_id = target_ledger_id and user_id = caller_id and role = 'member';
  return 'left';
end;
$$;

create or replace function public.delete_shared_ledger(
  target_ledger_id uuid,
  confirmation_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  ledger_row public.ledgers%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into ledger_row
  from public.ledgers
  where id = target_ledger_id
  for update;

  if ledger_row.id is null or ledger_row.owner_id <> caller_id then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;
  if ledger_row.kind <> 'shared' then return 'personal'; end if;
  if btrim(confirmation_name) <> ledger_row.name then return 'confirmation'; end if;

  delete from public.ledgers where id = target_ledger_id;
  return 'deleted';
end;
$$;

revoke all on table public.ledger_invitations from public, anon, authenticated;
grant select on table public.ledger_invitations to authenticated;

revoke insert, delete on table public.ledgers from authenticated;
revoke insert, delete on table public.ledger_members from authenticated;

revoke all on function public.create_shared_ledger(text) from public, anon;
revoke all on function public.has_ledger_invitation_with(uuid) from public, anon;
revoke all on function public.resolve_invitation_target(text) from public, anon, authenticated;
revoke all on function public.create_ledger_invitation(uuid, uuid) from public, anon;
revoke all on function public.respond_to_ledger_invitation(uuid, text) from public, anon;
revoke all on function public.revoke_ledger_invitation(uuid) from public, anon;
revoke all on function public.remove_ledger_member(uuid, uuid) from public, anon;
revoke all on function public.leave_shared_ledger(uuid) from public, anon;
revoke all on function public.delete_shared_ledger(uuid, text) from public, anon;
revoke all on function private.reset_removed_member_default_ledger() from public, anon, authenticated;
revoke all on function private.reset_deleted_ledger_defaults() from public, anon, authenticated;

grant execute on function public.create_shared_ledger(text) to authenticated;
grant execute on function public.has_ledger_invitation_with(uuid) to authenticated;
grant execute on function public.resolve_invitation_target(text) to service_role;
grant execute on function public.create_ledger_invitation(uuid, uuid) to authenticated;
grant execute on function public.respond_to_ledger_invitation(uuid, text) to authenticated;
grant execute on function public.revoke_ledger_invitation(uuid) to authenticated;
grant execute on function public.remove_ledger_member(uuid, uuid) to authenticated;
grant execute on function public.leave_shared_ledger(uuid) to authenticated;
grant execute on function public.delete_shared_ledger(uuid, text) to authenticated;
