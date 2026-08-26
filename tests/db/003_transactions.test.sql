begin;
set local search_path = public, extensions;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'transaction-a@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"transaction_a","display_name":"거래 사용자 A","phone_normalized":"01011112222"}'::jsonb,
    now(), now()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'transaction-b@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"transaction_b","display_name":"거래 사용자 B","phone_normalized":"01033334444"}'::jsonb,
    now(), now()
  );

select set_config(
  'tests.user_b_expense_category',
  (
    select c.id::text
    from public.categories c
    join public.ledgers l on l.id = c.ledger_id
    where l.owner_id = '30000000-0000-0000-0000-000000000002'
      and c.type = 'expense'
    limit 1
  ),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    insert into public.transactions (
      ledger_id, type, occurred_on, description, amount, category_id, created_by, idempotency_key
    ) values (
      (select id from public.ledgers where owner_id = '30000000-0000-0000-0000-000000000001'),
      'expense', '2026-08-26', '  점심  ', 12500,
      (select c.id from public.categories c join public.ledgers l on l.id = c.ledger_id where l.owner_id = '30000000-0000-0000-0000-000000000001' and c.type = 'expense' order by c.sort_order limit 1),
      '30000000-0000-0000-0000-000000000001',
      '31000000-0000-4000-8000-000000000001'
    )
  $$,
  '장부 구성원이 올바른 거래를 만든다'
);

select is(
  (select description from public.transactions limit 1),
  '점심',
  '거래 텍스트의 앞뒤 공백을 제거해 저장한다'
);

select throws_ok(
  $$
    insert into public.transactions (
      ledger_id, type, occurred_on, description, amount, category_id, created_by, idempotency_key
    ) values (
      (select id from public.ledgers where owner_id = '30000000-0000-0000-0000-000000000001'),
      'expense', '2026-08-26', '잘못된 분류', 1000,
      (select c.id from public.categories c join public.ledgers l on l.id = c.ledger_id where l.owner_id = '30000000-0000-0000-0000-000000000001' and c.type = 'income' limit 1),
      '30000000-0000-0000-0000-000000000001', gen_random_uuid()
    )
  $$,
  'P0001',
  'transaction category type mismatch',
  '수입 분류로 지출을 만들 수 없다'
);

select throws_ok(
  $$
    insert into public.transactions (
      ledger_id, type, occurred_on, description, amount, category_id, created_by, idempotency_key
    ) values (
      (select id from public.ledgers where owner_id = '30000000-0000-0000-0000-000000000001'),
      'expense', '2026-08-26', '다른 장부 분류', 1000,
      current_setting('tests.user_b_expense_category')::uuid,
      '30000000-0000-0000-0000-000000000001', gen_random_uuid()
    )
  $$,
  'P0001',
  'transaction category ledger mismatch',
  '다른 장부의 분류를 사용할 수 없다'
);

select throws_ok(
  $$
    insert into public.transactions (
      ledger_id, type, occurred_on, description, amount, category_id, created_by, idempotency_key
    ) values (
      (select id from public.ledgers where owner_id = '30000000-0000-0000-0000-000000000001'),
      'expense', '2026-08-27', '중복 저장', 12500,
      (select c.id from public.categories c join public.ledgers l on l.id = c.ledger_id where l.owner_id = '30000000-0000-0000-0000-000000000001' and c.type = 'expense' order by c.sort_order limit 1),
      '30000000-0000-0000-0000-000000000001',
      '31000000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  null,
  '같은 장부의 멱등성 키는 중복될 수 없다'
);

select is(
  (select expense_total from public.get_transaction_summary(
    (select id from public.ledgers where owner_id = '30000000-0000-0000-0000-000000000001'),
    '2026-08-01', '2026-09-01'
  )),
  12500::bigint,
  '기간 지출 합계를 계산한다'
);

select lives_ok(
  $$
    update public.transactions
    set deleted_at = now(), deleted_by = '30000000-0000-0000-0000-000000000001'
    where description = '점심'
  $$,
  '작성자는 거래를 휴지통으로 이동한다'
);

select is((select count(*) from public.transactions), 0::bigint, '휴지통 거래는 일반 조회에서 제외된다');

select is(
  (select expense_total from public.get_transaction_summary(
    (select id from public.ledgers where owner_id = '30000000-0000-0000-0000-000000000001'),
    '2026-08-01', '2026-09-01'
  )),
  0::bigint,
  '휴지통 거래는 합계에서 제외된다'
);

select ok(
  not has_table_privilege('authenticated', 'public.transactions', 'delete'),
  '인증 사용자는 거래를 하드 삭제할 수 없다'
);

select ok(
  not has_column_privilege('authenticated', 'public.transactions', 'created_by', 'update'),
  '인증 사용자는 거래 생성자를 바꿀 수 없다'
);

reset role;
select * from finish();
rollback;
