alter table public.categories
  add column if not exists system_code text
  check (system_code is null or system_code in ('pension_savings', 'irp'));

update public.categories
set system_code = 'pension_savings'
where type = 'expense'
  and lower(btrim(name)) = lower('연금저축')
  and system_code is null;

update public.categories
set system_code = 'irp'
where type = 'expense'
  and lower(btrim(name)) = lower('IRP')
  and system_code is null;

create unique index if not exists categories_ledger_system_code_unique
  on public.categories (ledger_id, system_code)
  where system_code is not null;

insert into public.categories (
  ledger_id,
  type,
  name,
  color,
  sort_order,
  is_active,
  system_code
)
select
  ledger.id,
  'expense',
  '연금저축',
  '#0F766E',
  coalesce((
    select max(category.sort_order)
    from public.categories as category
    where category.ledger_id = ledger.id
      and category.type = 'expense'
  ), 0) + 10,
  true,
  'pension_savings'
from public.ledgers as ledger
where not exists (
  select 1
  from public.categories as category
  where category.ledger_id = ledger.id
    and category.system_code = 'pension_savings'
);

insert into public.categories (
  ledger_id,
  type,
  name,
  color,
  sort_order,
  is_active,
  system_code
)
select
  ledger.id,
  'expense',
  'IRP',
  '#2563EB',
  coalesce((
    select max(category.sort_order)
    from public.categories as category
    where category.ledger_id = ledger.id
      and category.type = 'expense'
  ), 0) + 10,
  true,
  'irp'
from public.ledgers as ledger
where not exists (
  select 1
  from public.categories as category
  where category.ledger_id = ledger.id
    and category.system_code = 'irp'
);

create or replace function private.handle_new_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ledger_members (ledger_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into public.categories (
    ledger_id,
    type,
    name,
    color,
    sort_order,
    is_active,
    system_code
  )
  values
    (new.id, 'expense', '연금저축', '#0F766E', 110, true, 'pension_savings'),
    (new.id, 'expense', 'IRP', '#2563EB', 120, true, 'irp');

  return new;
end;
$$;

create table if not exists public.user_tax_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year integer not null check (tax_year between 2000 and 2100),
  income_type text not null check (income_type = 'employment'),
  gross_salary bigint not null check (gross_salary >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tax_year)
);

drop trigger if exists user_tax_profiles_set_updated_at on public.user_tax_profiles;
create trigger user_tax_profiles_set_updated_at
before update on public.user_tax_profiles
for each row execute function public.set_updated_at();

alter table public.user_tax_profiles enable row level security;

drop policy if exists user_tax_profiles_select_self on public.user_tax_profiles;
create policy user_tax_profiles_select_self
on public.user_tax_profiles for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_tax_profiles_insert_self on public.user_tax_profiles;
create policy user_tax_profiles_insert_self
on public.user_tax_profiles for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_tax_profiles_update_self on public.user_tax_profiles;
create policy user_tax_profiles_update_self
on public.user_tax_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_tax_profiles_delete_self on public.user_tax_profiles;
create policy user_tax_profiles_delete_self
on public.user_tax_profiles for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.get_my_pension_tax_summary(target_year integer)
returns table (
  pension_paid bigint,
  irp_paid bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(transaction_row.amount) filter (
      where category.system_code = 'pension_savings'
    ), 0)::bigint as pension_paid,
    coalesce(sum(transaction_row.amount) filter (
      where category.system_code = 'irp'
    ), 0)::bigint as irp_paid
  from public.transactions as transaction_row
  join public.categories as category
    on category.id = transaction_row.category_id
  where transaction_row.created_by = auth.uid()
    and transaction_row.type = 'expense'
    and transaction_row.deleted_at is null
    and transaction_row.occurred_on >= make_date(target_year, 1, 1)
    and transaction_row.occurred_on < make_date(target_year + 1, 1, 1)
    and category.system_code in ('pension_savings', 'irp');
$$;

create or replace function public.get_my_pension_contributions(
  target_year integer,
  page_size integer,
  after_on date,
  after_created_at timestamptz,
  after_id uuid
)
returns table (
  id uuid,
  ledger_id uuid,
  ledger_name text,
  can_manage boolean,
  occurred_on date,
  description text,
  amount bigint,
  created_at timestamptz,
  category_name text,
  system_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    transaction_row.id,
    transaction_row.ledger_id,
    case
      when exists (
        select 1
        from public.ledger_members as membership
        where membership.ledger_id = transaction_row.ledger_id
          and membership.user_id = auth.uid()
      ) then ledger.name
      else '이전 장부'
    end as ledger_name,
    (
      exists (
        select 1
        from public.ledger_members as membership
        where membership.ledger_id = transaction_row.ledger_id
          and membership.user_id = auth.uid()
      )
      and (
        ledger.owner_id = auth.uid()
        or transaction_row.created_by = auth.uid()
      )
    ) as can_manage,
    transaction_row.occurred_on,
    transaction_row.description,
    transaction_row.amount,
    transaction_row.created_at,
    category.name as category_name,
    category.system_code
  from public.transactions as transaction_row
  join public.categories as category
    on category.id = transaction_row.category_id
  join public.ledgers as ledger
    on ledger.id = transaction_row.ledger_id
  where transaction_row.created_by = auth.uid()
    and transaction_row.type = 'expense'
    and transaction_row.deleted_at is null
    and transaction_row.occurred_on >= make_date(target_year, 1, 1)
    and transaction_row.occurred_on < make_date(target_year + 1, 1, 1)
    and category.system_code in ('pension_savings', 'irp')
    and (
      (
        after_on is null
        and after_created_at is null
        and after_id is null
      )
      or (
        after_on is not null
        and after_created_at is not null
        and after_id is not null
        and (
          transaction_row.occurred_on,
          transaction_row.created_at,
          transaction_row.id
        ) < (after_on, after_created_at, after_id)
      )
    )
  order by
    transaction_row.occurred_on desc,
    transaction_row.created_at desc,
    transaction_row.id desc
  limit least(greatest(coalesce(page_size, 50), 1), 100);
$$;

revoke insert on table public.categories from authenticated;
grant insert (
  ledger_id,
  type,
  name,
  color,
  sort_order,
  is_active
) on table public.categories to authenticated;

revoke all on table public.user_tax_profiles from public, anon, authenticated;
grant select, insert, delete on table public.user_tax_profiles to authenticated;
grant update (income_type, gross_salary) on table public.user_tax_profiles to authenticated;

revoke all on function private.handle_new_ledger() from public, anon, authenticated;
revoke all on function public.get_my_pension_tax_summary(integer) from public, anon, authenticated;
revoke all on function public.get_my_pension_contributions(
  integer,
  integer,
  date,
  timestamptz,
  uuid
) from public, anon, authenticated;

grant execute on function public.get_my_pension_tax_summary(integer) to authenticated;
grant execute on function public.get_my_pension_contributions(
  integer,
  integer,
  date,
  timestamptz,
  uuid
) to authenticated;
