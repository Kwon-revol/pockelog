begin;
set local search_path = public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'grouped-daily@example.com',
  crypt('password1!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"login_id":"grouped_daily_user","display_name":"그룹 일별 합계","phone_normalized":"01012349888"}'::jsonb,
  now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('tests.grouped_daily_ledger', (
  select id::text from public.ledgers
  where owner_id = 'c0000000-0000-4000-8000-000000000001' and kind = 'personal'
), true);
select set_config('tests.grouped_daily_first', (
  select id::text from public.categories
  where ledger_id = current_setting('tests.grouped_daily_ledger')::uuid and type = 'expense'
  order by sort_order limit 1
), true);
insert into public.categories (id, ledger_id, type, name, color, sort_order) values
  ('c1000000-0000-4000-8000-000000000001', current_setting('tests.grouped_daily_ledger')::uuid,
   'expense', '그룹 둘째', '#112233', 201),
  ('c1000000-0000-4000-8000-000000000002', current_setting('tests.grouped_daily_ledger')::uuid,
   'expense', '그룹 밖', '#445566', 202);

insert into public.statistics_groups (ledger_id, type, name, color, sort_order)
values (current_setting('tests.grouped_daily_ledger')::uuid, 'expense', '고정지출', '#112233', 1);
select set_config('tests.grouped_daily_group', (
  select id::text from public.statistics_groups
  where ledger_id = current_setting('tests.grouped_daily_ledger')::uuid and name = '고정지출'
), true);
update public.categories set statistics_group_id = current_setting('tests.grouped_daily_group')::uuid
where id in (current_setting('tests.grouped_daily_first')::uuid,
  'c1000000-0000-4000-8000-000000000001'::uuid);

insert into public.transactions (
  ledger_id, type, occurred_on, description, amount, category_id, memo,
  created_by, idempotency_key
) values
  (current_setting('tests.grouped_daily_ledger')::uuid, 'expense', '2026-09-20', '첫째', 20000,
   current_setting('tests.grouped_daily_first')::uuid, '고정 지출',
   'c0000000-0000-4000-8000-000000000001', gen_random_uuid()),
  (current_setting('tests.grouped_daily_ledger')::uuid, 'expense', '2026-09-20', '둘째', 30000,
   'c1000000-0000-4000-8000-000000000001', '고정 지출',
   'c0000000-0000-4000-8000-000000000001', gen_random_uuid()),
  (current_setting('tests.grouped_daily_ledger')::uuid, 'expense', '2026-09-20', '제외', 50000,
   'c1000000-0000-4000-8000-000000000002', null,
   'c0000000-0000-4000-8000-000000000001', gen_random_uuid()),
  (current_setting('tests.grouped_daily_ledger')::uuid, 'expense', '2026-09-19', '전날', 5000,
   current_setting('tests.grouped_daily_first')::uuid, null,
   'c0000000-0000-4000-8000-000000000001', gen_random_uuid());

select results_eq(
  $$select occurred_on, balance from public.get_transaction_daily_balances_for_categories(
    current_setting('tests.grouped_daily_ledger')::uuid, '2026-09-19', '2026-09-21', '',
    'expense', array[current_setting('tests.grouped_daily_first')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid]
  )$$,
  $$values ('2026-09-20'::date, -50000::bigint), ('2026-09-19'::date, -5000::bigint)$$,
  '그룹의 여러 분류만 합산하고 그룹 밖 분류를 제외한다'
);
select results_eq(
  $$select occurred_on, balance from public.get_transaction_daily_balances_for_categories(
    current_setting('tests.grouped_daily_ledger')::uuid, '2026-09-19', '2026-09-21', '고정',
    'expense', array[current_setting('tests.grouped_daily_first')::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid]
  )$$,
  $$values ('2026-09-20'::date, -50000::bigint)$$,
  '그룹 선택과 검색 조건을 동시에 반영한다'
);
select ok(not has_function_privilege('anon',
  'public.get_transaction_daily_balances_for_categories(uuid,date,date,text,public.transaction_type,uuid[])',
  'EXECUTE'), '익명 사용자는 일별 그룹 합계를 조회할 수 없다');

select results_eq(
  $$select occurred_on, balance from public.get_transaction_daily_balances_for_group(
    current_setting('tests.grouped_daily_ledger')::uuid, '2026-09-19', '2026-09-21', '',
    'expense', current_setting('tests.grouped_daily_group')::uuid
  )$$,
  $$values ('2026-09-20'::date, -50000::bigint), ('2026-09-19'::date, -5000::bigint)$$,
  '통계 그룹 ID로 모든 소속 분류의 일별 합계를 조회한다'
);
select results_eq(
  $$select occurred_on, balance from public.get_transaction_daily_balances_for_group(
    current_setting('tests.grouped_daily_ledger')::uuid, '2026-09-19', '2026-09-21', '고정',
    'expense', current_setting('tests.grouped_daily_group')::uuid
  )$$,
  $$values ('2026-09-20'::date, -50000::bigint)$$,
  '통계 그룹과 검색 조건을 동시에 반영한다'
);
select ok(not has_function_privilege('anon',
  'public.get_transaction_daily_balances_for_group(uuid,date,date,text,public.transaction_type,uuid)',
  'EXECUTE'), '익명 사용자는 그룹별 일별 합계를 조회할 수 없다');

select * from finish();
rollback;
