begin;
set local search_path = public, extensions;

create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'statistics-a@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"statistics_a","display_name":"통계 사용자 A","phone_normalized":"01055556666"}'::jsonb,
    now(), now()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'statistics-b@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"statistics_b","display_name":"통계 사용자 B","phone_normalized":"01077778888"}'::jsonb,
    now(), now()
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.transactions (
  ledger_id, type, occurred_on, description, amount, category_id, created_by, idempotency_key
)
values
  (
    (select id from public.ledgers where owner_id = '40000000-0000-0000-0000-000000000001'),
    'expense', '2026-08-10', '식사', 12000,
    (select c.id from public.categories c join public.ledgers l on l.id = c.ledger_id where l.owner_id = '40000000-0000-0000-0000-000000000001' and c.type = 'expense' order by c.sort_order limit 1),
    '40000000-0000-0000-0000-000000000001', gen_random_uuid()
  ),
  (
    (select id from public.ledgers where owner_id = '40000000-0000-0000-0000-000000000001'),
    'income', '2026-08-11', '급여', 3000000,
    (select c.id from public.categories c join public.ledgers l on l.id = c.ledger_id where l.owner_id = '40000000-0000-0000-0000-000000000001' and c.type = 'income' order by c.sort_order limit 1),
    '40000000-0000-0000-0000-000000000001', gen_random_uuid()
  ),
  (
    (select id from public.ledgers where owner_id = '40000000-0000-0000-0000-000000000001'),
    'expense', '2026-08-12', '삭제 내역', 50000,
    (select c.id from public.categories c join public.ledgers l on l.id = c.ledger_id where l.owner_id = '40000000-0000-0000-0000-000000000001' and c.type = 'expense' order by c.sort_order limit 1),
    '40000000-0000-0000-0000-000000000001', gen_random_uuid()
  );

update public.transactions
set deleted_at = now(), deleted_by = '40000000-0000-0000-0000-000000000001'
where description = '삭제 내역';

update public.categories
set is_active = false
where id = (select category_id from public.transactions where description = '식사');

select is(
  (select expense_total from public.get_period_statistics(
    (select id from public.ledgers where owner_id = '40000000-0000-0000-0000-000000000001'),
    array['2026-08-01'::date], array['2026-09-01'::date]
  )),
  12000::bigint,
  '기간별 지출을 집계하고 휴지통 거래를 제외한다'
);

select is(
  (select income_total from public.get_period_statistics(
    (select id from public.ledgers where owner_id = '40000000-0000-0000-0000-000000000001'),
    array['2026-08-01'::date], array['2026-09-01'::date]
  )),
  3000000::bigint,
  '기간별 수입을 집계한다'
);

select is(
  (select balance from public.get_period_statistics(
    (select id from public.ledgers where owner_id = '40000000-0000-0000-0000-000000000001'),
    array['2026-08-01'::date], array['2026-09-01'::date]
  )),
  2988000::bigint,
  '기간별 차액을 계산한다'
);

select is(
  (select count(*) from public.get_period_statistics(
    (select id from public.ledgers where owner_id = '40000000-0000-0000-0000-000000000001'),
    array['2026-08-01'::date, '2026-07-01'::date],
    array['2026-09-01'::date, '2026-08-01'::date]
  )),
  2::bigint,
  '거래가 없는 기간도 0원 행으로 반환한다'
);

select is(
  (select amount_total from public.get_category_statistics(
    (select id from public.ledgers where owner_id = '40000000-0000-0000-0000-000000000001'),
    '2026-08-01', '2026-09-01', 'expense'
  ) order by amount_total desc limit 1),
  12000::bigint,
  '비활성화된 분류의 기존 거래도 분류 통계에 포함한다'
);

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.get_period_statistics(
    (select id from public.ledgers where owner_id = '40000000-0000-0000-0000-000000000001'),
    array['2026-08-01'::date], array['2026-09-01'::date]
  )),
  0::bigint,
  '다른 사용자의 장부 통계를 조회할 수 없다'
);

select is(
  (select count(*) from public.get_category_statistics(
    (select id from public.ledgers where owner_id = '40000000-0000-0000-0000-000000000001'),
    '2026-08-01', '2026-09-01', 'expense'
  )),
  0::bigint,
  '다른 사용자의 분류 통계를 조회할 수 없다'
);

reset role;
select * from finish();
rollback;
