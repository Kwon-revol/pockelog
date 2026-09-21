begin;
set local search_path = public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b0000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'daily-balance@example.com',
  crypt('password1!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"login_id":"daily_balance_user","display_name":"일별 합계","phone_normalized":"01012349999"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('tests.daily_ledger', (
  select id::text from public.ledgers
  where owner_id = 'b0000000-0000-4000-8000-000000000001' and kind = 'personal'
), true);
select set_config('tests.daily_expense', (
  select id::text from public.categories
  where ledger_id = current_setting('tests.daily_ledger')::uuid and type = 'expense'
  order by sort_order limit 1
), true);
select set_config('tests.daily_income', (
  select id::text from public.categories
  where ledger_id = current_setting('tests.daily_ledger')::uuid and type = 'income'
  order by sort_order limit 1
), true);

insert into public.transactions (
  ledger_id, type, occurred_on, description, amount, category_id, memo,
  created_by, idempotency_key
) values
  (current_setting('tests.daily_ledger')::uuid, 'income', '2026-09-20', '급여', 3000000,
   current_setting('tests.daily_income')::uuid, null,
   'b0000000-0000-4000-8000-000000000001', gen_random_uuid()),
  (current_setting('tests.daily_ledger')::uuid, 'expense', '2026-09-20', '점심', 200000,
   current_setting('tests.daily_expense')::uuid, '회사 식사',
   'b0000000-0000-4000-8000-000000000001', gen_random_uuid()),
  (current_setting('tests.daily_ledger')::uuid, 'expense', '2026-09-19', '저녁', 30000,
   current_setting('tests.daily_expense')::uuid, null,
   'b0000000-0000-4000-8000-000000000001', gen_random_uuid());

select results_eq(
  $$select occurred_on, balance from public.get_transaction_daily_balances(
    current_setting('tests.daily_ledger')::uuid, '2026-09-19', '2026-09-21', '', null, null
  )$$,
  $$values ('2026-09-20'::date, 2800000::bigint), ('2026-09-19'::date, -30000::bigint)$$,
  '일별 수입에서 지출을 뺀 전체 합계를 반환한다'
);
select results_eq(
  $$select occurred_on, balance from public.get_transaction_daily_balances(
    current_setting('tests.daily_ledger')::uuid, '2026-09-20', '2026-09-21', '', 'expense', null
  )$$,
  $$values ('2026-09-20'::date, -200000::bigint)$$,
  '기간과 유형 필터를 반영한다'
);
select results_eq(
  $$select occurred_on, balance from public.get_transaction_daily_balances(
    current_setting('tests.daily_ledger')::uuid, '2026-09-19', '2026-09-21', '식사', null, null
  )$$,
  $$values ('2026-09-20'::date, -200000::bigint)$$,
  '메모 검색 필터를 반영한다'
);
select results_eq(
  $$select occurred_on, balance from public.get_transaction_daily_balances(
    current_setting('tests.daily_ledger')::uuid, '2026-09-19', '2026-09-21', '', null,
    current_setting('tests.daily_income')::uuid
  )$$,
  $$values ('2026-09-20'::date, 3000000::bigint)$$,
  '분류 필터를 반영한다'
);

update public.transactions
set deleted_at = now(), deleted_by = 'b0000000-0000-4000-8000-000000000001'
where description = '점심';
select results_eq(
  $$select occurred_on, balance from public.get_transaction_daily_balances(
    current_setting('tests.daily_ledger')::uuid, '2026-09-20', '2026-09-21', '', null, null
  )$$,
  $$values ('2026-09-20'::date, 3000000::bigint)$$,
  '휴지통 거래는 합계에서 제외한다'
);

select * from finish();
rollback;
