do $$
begin
  if exists (
    select 1
    from public.categories
    group by ledger_id, type, lower(btrim(name))
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'category names conflict after trimming whitespace';
  end if;
end;
$$;

update public.categories
set name = btrim(name)
where name <> btrim(name);

drop index if exists public.categories_ledger_type_name_unique;
create unique index if not exists categories_ledger_type_trimmed_name_unique
  on public.categories (ledger_id, type, lower(btrim(name)));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_name_trimmed'
  ) then
    alter table public.categories
      add constraint categories_name_trimmed check (name = btrim(name));
  end if;
end;
$$;

create or replace function public.set_category_order(
  target_ledger_id uuid,
  target_type public.transaction_type,
  ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_count integer;
  supplied_count integer;
  matching_count integer;
begin
  if not public.is_ledger_owner(target_ledger_id) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  supplied_count := cardinality(ordered_ids);
  if supplied_count is null then
    raise exception using errcode = 'P0001', message = 'ordered category list mismatch';
  end if;

  select count(*) into expected_count
  from public.categories
  where ledger_id = target_ledger_id and type = target_type;

  select count(distinct category_id) into matching_count
  from unnest(ordered_ids) as supplied(category_id)
  join public.categories as category on category.id = supplied.category_id
  where category.ledger_id = target_ledger_id and category.type = target_type;

  if supplied_count <> expected_count or matching_count <> expected_count then
    raise exception using errcode = 'P0001', message = 'ordered category list mismatch';
  end if;

  update public.categories as category
  set sort_order = ordering.ordinality - 1
  from unnest(ordered_ids) with ordinality as ordering(category_id, ordinality)
  where category.id = ordering.category_id
    and category.ledger_id = target_ledger_id
    and category.type = target_type;
end;
$$;

revoke all on function public.set_category_order(uuid, public.transaction_type, uuid[]) from public, anon;
grant execute on function public.set_category_order(uuid, public.transaction_type, uuid[]) to authenticated;
