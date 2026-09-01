create index if not exists transactions_deleted_ledger_order_index
  on public.transactions (ledger_id, deleted_at desc, id desc)
  where deleted_at is not null;

create or replace function public.get_deleted_transactions(
  target_ledger_id uuid,
  cursor_deleted_at timestamptz default null,
  cursor_id uuid default null,
  page_size integer default 50
)
returns table (
  id uuid,
  type public.transaction_type,
  occurred_on date,
  description text,
  amount bigint,
  memo text,
  category_name text,
  category_color text,
  created_by uuid,
  creator_name text,
  deleted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.ledgers as ledger
    where ledger.id = target_ledger_id
      and ledger.owner_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  return query
  select
    transaction_row.id,
    transaction_row.type,
    transaction_row.occurred_on,
    transaction_row.description,
    transaction_row.amount,
    coalesce(transaction_row.memo, ''),
    category.name,
    category.color,
    transaction_row.created_by,
    coalesce(profile.display_name, '알 수 없는 사용자'),
    transaction_row.deleted_at
  from public.transactions as transaction_row
  join public.categories as category
    on category.id = transaction_row.category_id
  left join public.profiles as profile
    on profile.id = transaction_row.created_by
  where transaction_row.ledger_id = target_ledger_id
    and transaction_row.deleted_at is not null
    and (
      cursor_deleted_at is null
      or (transaction_row.deleted_at, transaction_row.id) < (cursor_deleted_at, cursor_id)
    )
  order by transaction_row.deleted_at desc, transaction_row.id desc
  limit least(greatest(page_size, 1), 50) + 1;
end;
$$;

create or replace function public.restore_deleted_transaction(
  target_transaction_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select transaction_row.id into owned_transaction_id
  from public.transactions as transaction_row
  join public.ledgers as ledger
    on ledger.id = transaction_row.ledger_id
  where transaction_row.id = target_transaction_id
    and transaction_row.deleted_at is not null
    and ledger.owner_id = auth.uid()
  for update of transaction_row;

  if owned_transaction_id is null then
    return 'missing';
  end if;

  update public.transactions
  set deleted_at = null, deleted_by = null
  where id = owned_transaction_id;

  return 'restored';
end;
$$;

create or replace function public.permanently_delete_transaction(
  target_transaction_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select transaction_row.id into owned_transaction_id
  from public.transactions as transaction_row
  join public.ledgers as ledger
    on ledger.id = transaction_row.ledger_id
  where transaction_row.id = target_transaction_id
    and transaction_row.deleted_at is not null
    and ledger.owner_id = auth.uid()
  for update of transaction_row;

  if owned_transaction_id is null then
    return 'missing';
  end if;

  delete from public.transactions
  where id = owned_transaction_id;

  return 'deleted';
end;
$$;

revoke all on function public.get_deleted_transactions(uuid, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function public.restore_deleted_transaction(uuid) from public, anon, authenticated;
revoke all on function public.permanently_delete_transaction(uuid) from public, anon, authenticated;

grant execute on function public.get_deleted_transactions(uuid, timestamptz, uuid, integer) to authenticated;
grant execute on function public.restore_deleted_transaction(uuid) to authenticated;
grant execute on function public.permanently_delete_transaction(uuid) to authenticated;
