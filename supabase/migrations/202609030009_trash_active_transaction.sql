grant update (updated_at) on public.transactions to authenticated;

create or replace function public.trash_active_transaction(
  target_transaction_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  visible_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select transaction_row.id into visible_transaction_id
  from public.transactions as transaction_row
  join public.ledgers as ledger
    on ledger.id = transaction_row.ledger_id
  where transaction_row.id = target_transaction_id
    and transaction_row.deleted_at is null
    and (
      ledger.owner_id = auth.uid()
      or transaction_row.created_by = auth.uid()
    )
  for update of transaction_row;

  if visible_transaction_id is null then
    return 'missing';
  end if;

  update public.transactions
  set deleted_at = now(), deleted_by = auth.uid()
  where id = visible_transaction_id;

  return 'trashed';
end;
$$;

revoke all on function public.trash_active_transaction(uuid) from public, anon, authenticated;
grant execute on function public.trash_active_transaction(uuid) to authenticated;
