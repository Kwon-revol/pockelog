create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  type public.transaction_type not null,
  occurred_on date not null,
  description text not null check (char_length(btrim(description)) between 1 and 100),
  amount bigint not null check (amount > 0),
  category_id uuid not null references public.categories (id),
  memo text check (memo is null or char_length(btrim(memo)) <= 500),
  created_by uuid not null references auth.users (id) on delete cascade,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  constraint transactions_ledger_idempotency_unique unique (ledger_id, idempotency_key),
  constraint transactions_deleted_pair check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  )
);

create index transactions_active_ledger_order_index
  on public.transactions (ledger_id, occurred_on desc, created_at desc, id desc)
  where deleted_at is null;

create index transactions_active_ledger_category_index
  on public.transactions (ledger_id, category_id, occurred_on)
  where deleted_at is null;

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create or replace function private.validate_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_category public.categories%rowtype;
begin
  if char_length(new.description) > 100
    or (new.memo is not null and char_length(new.memo) > 500) then
    raise exception using errcode = 'P0001', message = 'transaction text too long';
  end if;

  new.description := btrim(new.description);
  new.memo := nullif(btrim(new.memo), '');

  select * into selected_category
  from public.categories
  where id = new.category_id;

  if selected_category.id is null then
    raise exception using errcode = 'P0001', message = 'transaction category not found';
  end if;

  if selected_category.ledger_id <> new.ledger_id then
    raise exception using errcode = 'P0001', message = 'transaction category ledger mismatch';
  end if;

  if selected_category.type <> new.type then
    raise exception using errcode = 'P0001', message = 'transaction category type mismatch';
  end if;

  if (tg_op = 'INSERT' or old.category_id <> new.category_id or old.type <> new.type)
    and not selected_category.is_active then
    raise exception using errcode = 'P0001', message = 'transaction category inactive';
  end if;

  if tg_op = 'INSERT' and new.created_by <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'transaction creator mismatch';
  end if;

  if (new.deleted_at is null) <> (new.deleted_by is null) then
    raise exception using errcode = 'P0001', message = 'transaction deleted fields mismatch';
  end if;

  if tg_op = 'UPDATE'
    and old.deleted_at is null
    and new.deleted_at is not null
    and new.deleted_by <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'transaction deleter mismatch';
  end if;

  return new;
end;
$$;

create trigger transactions_validate
before insert or update on public.transactions
for each row execute function private.validate_transaction();

alter table public.transactions enable row level security;

create policy transactions_select_active_members
on public.transactions for select
to authenticated
using (
  deleted_at is null
  and public.is_ledger_member(ledger_id)
);

create policy transactions_insert_members
on public.transactions for insert
to authenticated
with check (
  created_by = auth.uid()
  and deleted_at is null
  and deleted_by is null
  and public.is_ledger_member(ledger_id)
);

create policy transactions_update_owner_or_creator
on public.transactions for update
to authenticated
using (
  deleted_at is null
  and public.is_ledger_member(ledger_id)
  and (public.is_ledger_owner(ledger_id) or created_by = auth.uid())
)
with check (
  public.is_ledger_member(ledger_id)
  and (public.is_ledger_owner(ledger_id) or created_by = auth.uid())
);

create or replace function public.get_transaction_summary(
  target_ledger_id uuid,
  start_on date,
  end_exclusive date
)
returns table (
  income_total bigint,
  expense_total bigint,
  balance bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(amount) filter (where type = 'income'), 0)::bigint as income_total,
    coalesce(sum(amount) filter (where type = 'expense'), 0)::bigint as expense_total,
    (
      coalesce(sum(amount) filter (where type = 'income'), 0)
      - coalesce(sum(amount) filter (where type = 'expense'), 0)
    )::bigint as balance
  from public.transactions
  where ledger_id = target_ledger_id
    and occurred_on >= start_on
    and occurred_on < end_exclusive
    and deleted_at is null;
$$;

revoke all on public.transactions from anon, authenticated;
grant select, insert on public.transactions to authenticated;
grant update (
  type,
  occurred_on,
  description,
  amount,
  category_id,
  memo,
  deleted_at,
  deleted_by
) on public.transactions to authenticated;

revoke all on function private.validate_transaction() from public, anon, authenticated;
revoke all on function public.get_transaction_summary(uuid, date, date) from public, anon;
grant execute on function public.get_transaction_summary(uuid, date, date) to authenticated;
