create or replace function public.get_period_statistics(
  target_ledger_id uuid,
  start_dates date[],
  end_dates date[]
)
returns table (
  period_ordinal bigint,
  start_on date,
  end_exclusive date,
  income_total bigint,
  expense_total bigint,
  balance bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with periods as (
    select
      starts.ordinality as period_ordinal,
      starts.start_on,
      ends.end_exclusive
    from unnest(start_dates) with ordinality as starts(start_on, ordinality)
    join unnest(end_dates) with ordinality as ends(end_exclusive, ordinality)
      using (ordinality)
    where cardinality(start_dates) = cardinality(end_dates)
      and cardinality(start_dates) between 1 and 24
      and starts.start_on < ends.end_exclusive
  )
  select
    periods.period_ordinal,
    periods.start_on,
    periods.end_exclusive,
    coalesce(sum(transactions.amount) filter (where transactions.type = 'income'), 0)::bigint,
    coalesce(sum(transactions.amount) filter (where transactions.type = 'expense'), 0)::bigint,
    (
      coalesce(sum(transactions.amount) filter (where transactions.type = 'income'), 0)
      - coalesce(sum(transactions.amount) filter (where transactions.type = 'expense'), 0)
    )::bigint
  from periods
  left join public.transactions
    on transactions.ledger_id = target_ledger_id
    and transactions.occurred_on >= periods.start_on
    and transactions.occurred_on < periods.end_exclusive
    and transactions.deleted_at is null
  where public.is_ledger_member(target_ledger_id)
  group by periods.period_ordinal, periods.start_on, periods.end_exclusive
  order by periods.period_ordinal;
$$;

create or replace function public.get_category_statistics(
  target_ledger_id uuid,
  start_on date,
  end_exclusive date,
  target_type public.transaction_type
)
returns table (
  category_id uuid,
  category_name text,
  category_color text,
  sort_order integer,
  amount_total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    categories.id,
    categories.name,
    categories.color,
    categories.sort_order,
    sum(transactions.amount)::bigint as amount_total
  from public.transactions
  join public.categories on categories.id = transactions.category_id
  where transactions.ledger_id = target_ledger_id
    and transactions.occurred_on >= start_on
    and transactions.occurred_on < end_exclusive
    and transactions.type = target_type
    and transactions.deleted_at is null
    and public.is_ledger_member(target_ledger_id)
  group by categories.id, categories.name, categories.color, categories.sort_order
  having sum(transactions.amount) > 0
  order by amount_total desc, categories.sort_order, categories.id;
$$;

revoke all on function public.get_period_statistics(uuid, date[], date[]) from public, anon;
grant execute on function public.get_period_statistics(uuid, date[], date[]) to authenticated;

revoke all on function public.get_category_statistics(uuid, date, date, public.transaction_type) from public, anon;
grant execute on function public.get_category_statistics(uuid, date, date, public.transaction_type) to authenticated;
