create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.ledger_kind as enum ('personal', 'shared');
create type public.ledger_member_role as enum ('owner', 'member');
create type public.transaction_type as enum ('income', 'expense');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (
    char_length(btrim(display_name)) between 1 and 30
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_private_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone_normalized text not null check (phone_normalized ~ '^[0-9]+$'),
  default_ledger_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.account_identifiers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  login_id text not null check (
    login_id = lower(login_id)
    and login_id ~ '^[a-z0-9_]{4,20}$'
  ),
  email_normalized text not null check (
    email_normalized = lower(email_normalized)
    and char_length(email_normalized) > 3
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index account_identifiers_login_id_unique
  on private.account_identifiers (lower(login_id));
create unique index account_identifiers_email_unique
  on private.account_identifiers (lower(email_normalized));

create table public.ledgers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind public.ledger_kind not null,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  currency_code text not null default 'KRW' check (currency_code = 'KRW'),
  period_start_day smallint check (
    period_start_day is null or period_start_day between 1 and 28
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ledgers_one_personal_per_owner
  on public.ledgers (owner_id)
  where kind = 'personal';

alter table public.user_private_profiles
  add constraint user_private_profiles_default_ledger_fk
  foreign key (default_ledger_id) references public.ledgers (id) on delete set null;

create table public.ledger_members (
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.ledger_member_role not null,
  joined_at timestamptz not null default now(),
  primary key (ledger_id, user_id)
);

create unique index ledger_members_one_owner
  on public.ledger_members (ledger_id)
  where role = 'owner';

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  type public.transaction_type not null,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_ledger_type_name_unique
  on public.categories (ledger_id, type, lower(name));
create index categories_ledger_sort_index
  on public.categories (ledger_id, type, is_active, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger user_private_profiles_set_updated_at
before update on public.user_private_profiles
for each row execute function public.set_updated_at();

create trigger account_identifiers_set_updated_at
before update on private.account_identifiers
for each row execute function public.set_updated_at();

create trigger ledgers_set_updated_at
before update on public.ledgers
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create or replace function public.is_ledger_member(target_ledger_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ledger_members as member
    where member.ledger_id = target_ledger_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.is_ledger_owner(target_ledger_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ledgers as ledger
    where ledger.id = target_ledger_id
      and ledger.owner_id = auth.uid()
  );
$$;

create or replace function public.shares_ledger_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ledger_members as own_membership
    join public.ledger_members as target_membership
      on target_membership.ledger_id = own_membership.ledger_id
    where own_membership.user_id = auth.uid()
      and target_membership.user_id = target_user_id
  );
$$;

create or replace function public.resolve_login_email(candidate_login_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select identifier.email_normalized
  from private.account_identifiers as identifier
  where identifier.login_id = lower(btrim(candidate_login_id))
  limit 1;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_ledger_id uuid := gen_random_uuid();
  normalized_login_id text := lower(btrim(new.raw_user_meta_data ->> 'login_id'));
  normalized_display_name text := btrim(new.raw_user_meta_data ->> 'display_name');
  raw_phone text := btrim(new.raw_user_meta_data ->> 'phone_normalized');
  normalized_phone text;
begin
  if normalized_login_id is null
    or normalized_login_id !~ '^[a-z0-9_]{4,20}$' then
    raise exception 'invalid signup metadata';
  end if;

  if normalized_display_name is null
    or char_length(normalized_display_name) not between 1 and 30 then
    raise exception 'invalid signup metadata';
  end if;

  if raw_phone is null or raw_phone !~ '^[0-9-]+$' then
    raise exception 'invalid signup metadata';
  end if;

  normalized_phone := regexp_replace(raw_phone, '[^0-9]', '', 'g');

  if new.email is null or char_length(btrim(new.email)) <= 3 then
    raise exception 'invalid signup metadata';
  end if;

  insert into private.account_identifiers (
    user_id,
    login_id,
    email_normalized
  ) values (
    new.id,
    normalized_login_id,
    lower(btrim(new.email))
  );

  insert into public.profiles (id, display_name)
  values (new.id, normalized_display_name);

  insert into public.ledgers (id, owner_id, kind, name, currency_code, period_start_day)
  values (new_ledger_id, new.id, 'personal', '내 장부', 'KRW', 1);

  insert into public.ledger_members (ledger_id, user_id, role)
  values (new_ledger_id, new.id, 'owner');

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

  insert into public.user_private_profiles (
    user_id,
    phone_normalized,
    default_ledger_id
  ) values (
    new.id,
    normalized_phone,
    new_ledger_id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_private_profiles enable row level security;
alter table public.ledgers enable row level security;
alter table public.ledger_members enable row level security;
alter table public.categories enable row level security;

create policy profiles_select_shared_members
on public.profiles for select
to authenticated
using (id = auth.uid() or public.shares_ledger_with(id));

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy private_profiles_select_self
on public.user_private_profiles for select
to authenticated
using (user_id = auth.uid());

create policy private_profiles_update_self
on public.user_private_profiles for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    default_ledger_id is null
    or public.is_ledger_member(default_ledger_id)
  )
);

create policy ledgers_select_members
on public.ledgers for select
to authenticated
using (public.is_ledger_member(id));

create policy ledgers_insert_shared
on public.ledgers for insert
to authenticated
with check (owner_id = auth.uid() and kind = 'shared');

create policy ledgers_update_owner
on public.ledgers for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy ledgers_delete_shared_owner
on public.ledgers for delete
to authenticated
using (owner_id = auth.uid() and kind = 'shared');

create policy ledger_members_select_members
on public.ledger_members for select
to authenticated
using (public.is_ledger_member(ledger_id));

create policy ledger_members_insert_owner
on public.ledger_members for insert
to authenticated
with check (public.is_ledger_owner(ledger_id));

create policy ledger_members_delete_owner_or_self
on public.ledger_members for delete
to authenticated
using (
  role = 'member'
  and (
    public.is_ledger_owner(ledger_id)
    or user_id = auth.uid()
  )
);

create policy categories_select_members
on public.categories for select
to authenticated
using (public.is_ledger_member(ledger_id));

create policy categories_insert_owner
on public.categories for insert
to authenticated
with check (public.is_ledger_owner(ledger_id));

create policy categories_update_owner
on public.categories for update
to authenticated
using (public.is_ledger_owner(ledger_id))
with check (public.is_ledger_owner(ledger_id));

create policy categories_delete_owner
on public.categories for delete
to authenticated
using (public.is_ledger_owner(ledger_id));

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.user_private_profiles to authenticated;
grant update (phone_normalized, default_ledger_id) on public.user_private_profiles to authenticated;

grant select, insert, delete on public.ledgers to authenticated;
grant update (name, period_start_day) on public.ledgers to authenticated;

grant select, insert, delete on public.ledger_members to authenticated;

grant select, insert, delete on public.categories to authenticated;
grant update (name, color, sort_order, is_active) on public.categories to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.is_ledger_member(uuid) from public, anon;
revoke all on function public.is_ledger_owner(uuid) from public, anon;
revoke all on function public.shares_ledger_with(uuid) from public, anon;
revoke all on function public.resolve_login_email(text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.is_ledger_member(uuid) to authenticated;
grant execute on function public.is_ledger_owner(uuid) to authenticated;
grant execute on function public.shares_ledger_with(uuid) to authenticated;
grant execute on function public.resolve_login_email(text) to service_role;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from public, anon;
