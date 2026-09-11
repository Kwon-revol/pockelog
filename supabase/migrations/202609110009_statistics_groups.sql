create table public.statistics_groups (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  type public.transaction_type not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 30),
  color text not null check (color ~ '^#[0-9A-F]{6}$'),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index statistics_groups_ledger_type_name_unique
  on public.statistics_groups (ledger_id, type, lower(btrim(name)));
create index statistics_groups_ledger_type_order_index
  on public.statistics_groups (ledger_id, type, sort_order, id);

alter table public.categories
  add column statistics_group_id uuid
  references public.statistics_groups(id) on delete set null;
create index categories_statistics_group_index
  on public.categories (statistics_group_id)
  where statistics_group_id is not null;

create function private.enforce_category_statistics_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statistics_group_id is not null then
    perform 1 from public.statistics_groups as statistics_group
    where statistics_group.id = new.statistics_group_id
      and statistics_group.ledger_id = new.ledger_id
      and statistics_group.type = new.type
    for key share;

    if not found then
      raise exception using errcode = 'P0001', message = 'category statistics group mismatch';
    end if;
  end if;
  return new;
end;
$$;

create trigger categories_enforce_statistics_group
before insert or update of statistics_group_id, ledger_id, type on public.categories
for each row execute function private.enforce_category_statistics_group();

create trigger statistics_groups_set_updated_at
before update on public.statistics_groups
for each row execute function public.set_updated_at();

alter table public.statistics_groups enable row level security;

create policy statistics_groups_select_members
on public.statistics_groups for select to authenticated
using (public.is_ledger_member(ledger_id));

create policy statistics_groups_insert_owner
on public.statistics_groups for insert to authenticated
with check (public.is_ledger_owner(ledger_id));

create policy statistics_groups_update_owner
on public.statistics_groups for update to authenticated
using (public.is_ledger_owner(ledger_id))
with check (public.is_ledger_owner(ledger_id));

create policy statistics_groups_delete_owner
on public.statistics_groups for delete to authenticated
using (public.is_ledger_owner(ledger_id));

revoke all on table public.statistics_groups from public, anon, authenticated;
grant select, delete on table public.statistics_groups to authenticated;
grant insert (ledger_id, type, name, color, sort_order)
  on public.statistics_groups to authenticated;
-- Group identity is immutable to API roles, so existing category links cannot
-- become cross-ledger/type through an update of the referenced group.
grant update (name, color, sort_order) on public.statistics_groups to authenticated;
-- Existing categories_update_owner RLS also governs this new writable column.
grant update (statistics_group_id) on public.categories to authenticated;

create function public.save_statistics_group(
  target_group_id uuid,
  target_ledger_id uuid,
  target_type public.transaction_type,
  target_name text,
  target_color text,
  target_category_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_group_id uuid;
  supplied_count integer;
  matching_count integer;
begin
  if auth.uid() is null or not public.is_ledger_owner(target_ledger_id) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  -- All three mutation RPCs acquire the ledger lock first. Concurrent saves,
  -- deletes and reorder calls for this ledger therefore share one lock order.
  perform 1 from public.ledgers where id = target_ledger_id for update;
  if not public.is_ledger_owner(target_ledger_id) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  if target_type is null then
    raise exception using errcode = 'P0001', message = 'statistics group type required';
  end if;

  if target_group_id is null then
    insert into public.statistics_groups (ledger_id, type, name, color, sort_order)
    select target_ledger_id, target_type, btrim(target_name), upper(target_color),
      coalesce(max(statistics_group.sort_order), -1) + 1
    from public.statistics_groups as statistics_group
    where statistics_group.ledger_id = target_ledger_id and statistics_group.type = target_type
    returning id into saved_group_id;
  else
    update public.statistics_groups
    set name = btrim(target_name), color = upper(target_color)
    where id = target_group_id and ledger_id = target_ledger_id and type = target_type
    returning id into saved_group_id;

    if saved_group_id is null then
      raise exception using errcode = 'P0001', message = 'statistics group mismatch';
    end if;
  end if;

  supplied_count := cardinality(target_category_ids);
  if supplied_count is null then
    raise exception using errcode = 'P0001', message = 'statistics group category list mismatch';
  end if;

  -- Lock affected categories before validating. Hidden categories remain valid.
  perform category.id from public.categories as category
  where category.ledger_id = target_ledger_id and category.type = target_type
    and (category.id = any(target_category_ids) or category.statistics_group_id = saved_group_id)
  order by category.id
  for update;

  select count(distinct category.id) into matching_count
  from unnest(target_category_ids) as supplied(category_id)
  join public.categories as category on category.id = supplied.category_id
  where category.ledger_id = target_ledger_id and category.type = target_type;

  if matching_count <> supplied_count then
    raise exception using errcode = 'P0001', message = 'statistics group category list mismatch';
  end if;

  -- No links change before the entire supplied list has passed validation.
  -- Any exception rolls back the group metadata write above as well.
  update public.categories
  set statistics_group_id = null
  where statistics_group_id = saved_group_id
    and not (id = any(target_category_ids));

  update public.categories
  set statistics_group_id = saved_group_id
  where id = any(target_category_ids)
    and ledger_id = target_ledger_id and type = target_type;

  return saved_group_id;
end;
$$;

create function public.delete_statistics_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_ledger_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  select ledger_id into target_ledger_id
  from public.statistics_groups where id = target_group_id;
  if target_ledger_id is null or not public.is_ledger_owner(target_ledger_id) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  perform 1 from public.ledgers where id = target_ledger_id for update;
  if not public.is_ledger_owner(target_ledger_id) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  -- The FK nulls only group links; categories and transactions remain intact.
  delete from public.statistics_groups
  where id = target_group_id and ledger_id = target_ledger_id;
end;
$$;

create function public.set_statistics_group_order(
  target_ledger_id uuid,
  target_type public.transaction_type,
  ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_count integer;
  supplied_count integer;
  matching_count integer;
begin
  if auth.uid() is null or not public.is_ledger_owner(target_ledger_id) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  perform 1 from public.ledgers where id = target_ledger_id for update;
  if not public.is_ledger_owner(target_ledger_id) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  supplied_count := cardinality(ordered_ids);
  if target_type is null or supplied_count is null then
    raise exception using errcode = 'P0001', message = 'ordered statistics group list mismatch';
  end if;

  perform statistics_group.id from public.statistics_groups as statistics_group
  where statistics_group.ledger_id = target_ledger_id and statistics_group.type = target_type
  order by statistics_group.id
  for update;

  select count(*) into expected_count from public.statistics_groups
  where ledger_id = target_ledger_id and type = target_type;

  select count(distinct statistics_group.id) into matching_count
  from unnest(ordered_ids) as supplied(group_id)
  join public.statistics_groups as statistics_group on statistics_group.id = supplied.group_id
  where statistics_group.ledger_id = target_ledger_id and statistics_group.type = target_type;

  if supplied_count <> expected_count or matching_count <> expected_count then
    raise exception using errcode = 'P0001', message = 'ordered statistics group list mismatch';
  end if;

  update public.statistics_groups as statistics_group
  set sort_order = (ordering.ordinality - 1)::integer
  from unnest(ordered_ids) with ordinality as ordering(group_id, ordinality)
  where statistics_group.id = ordering.group_id
    and statistics_group.ledger_id = target_ledger_id and statistics_group.type = target_type;
end;
$$;

create function public.get_grouped_category_statistics(
  target_ledger_id uuid,
  start_on date,
  end_exclusive date,
  target_type public.transaction_type
)
returns table (
  category_id uuid,
  category_name text,
  category_color text,
  category_sort_order integer,
  amount_total bigint,
  statistics_group_id uuid,
  statistics_group_name text,
  statistics_group_color text,
  statistics_group_sort_order integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select category.id, category.name, category.color, category.sort_order,
    sum(transaction_row.amount)::bigint as amount_total,
    statistics_group.id, statistics_group.name, statistics_group.color, statistics_group.sort_order
  from public.transactions as transaction_row
  join public.categories as category on category.id = transaction_row.category_id
  left join public.statistics_groups as statistics_group on statistics_group.id = category.statistics_group_id
  where transaction_row.ledger_id = target_ledger_id
    and transaction_row.occurred_on >= start_on
    and transaction_row.occurred_on < end_exclusive
    and transaction_row.type = target_type
    and transaction_row.deleted_at is null
    and public.is_ledger_member(target_ledger_id)
  group by category.id, category.name, category.color, category.sort_order,
    statistics_group.id, statistics_group.name, statistics_group.color, statistics_group.sort_order
  having sum(transaction_row.amount) > 0
  order by amount_total desc, category.sort_order, category.id;
$$;

revoke all on function private.enforce_category_statistics_group() from public, anon, authenticated;
revoke all on function public.save_statistics_group(uuid, uuid, public.transaction_type, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.delete_statistics_group(uuid) from public, anon, authenticated;
revoke all on function public.set_statistics_group_order(uuid, public.transaction_type, uuid[]) from public, anon, authenticated;
revoke all on function public.get_grouped_category_statistics(uuid, date, date, public.transaction_type) from public, anon, authenticated;

grant execute on function public.save_statistics_group(uuid, uuid, public.transaction_type, text, text, uuid[]) to authenticated;
grant execute on function public.delete_statistics_group(uuid) to authenticated;
grant execute on function public.set_statistics_group_order(uuid, public.transaction_type, uuid[]) to authenticated;
grant execute on function public.get_grouped_category_statistics(uuid, date, date, public.transaction_type) to authenticated;
