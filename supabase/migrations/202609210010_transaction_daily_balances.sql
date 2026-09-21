create function public.get_transaction_daily_balances(
  target_ledger_id uuid,
  start_on date,
  end_exclusive date,
  search_term text,
  target_type public.transaction_type,
  target_category_id uuid
)
returns table (occurred_on date, balance bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    transaction_row.occurred_on,
    (
      coalesce(sum(transaction_row.amount) filter (where transaction_row.type = 'income'), 0)
      - coalesce(sum(transaction_row.amount) filter (where transaction_row.type = 'expense'), 0)
    )::bigint as balance
  from public.transactions as transaction_row
  where transaction_row.ledger_id = target_ledger_id
    and transaction_row.occurred_on >= start_on
    and transaction_row.occurred_on < end_exclusive
    and transaction_row.deleted_at is null
    and (target_type is null or transaction_row.type = target_type)
    and (target_category_id is null or transaction_row.category_id = target_category_id)
    and (
      search_term = ''
      or transaction_row.description ilike '%' || search_term || '%'
      or transaction_row.memo ilike '%' || search_term || '%'
    )
  group by transaction_row.occurred_on
  order by transaction_row.occurred_on desc;
$$;

revoke all on function public.get_transaction_daily_balances(
  uuid, date, date, text, public.transaction_type, uuid
) from public, anon;
grant execute on function public.get_transaction_daily_balances(
  uuid, date, date, text, public.transaction_type, uuid
) to authenticated;
