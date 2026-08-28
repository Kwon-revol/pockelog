begin;
set local search_path = public, extensions;

create extension if not exists pgtap with schema extensions;
select plan(30);

select has_column('public', 'categories', 'system_code', '분류에 시스템 식별자가 존재한다');
select has_table('public', 'user_tax_profiles', '개인 과세연도 설정 테이블이 존재한다');
select has_function(
  'public',
  'get_my_pension_tax_summary',
  array['integer'],
  '본인 연금 납입 요약 함수가 존재한다'
);
select has_function(
  'public',
  'get_my_pension_contributions',
  array['integer', 'integer', 'date', 'timestamp with time zone', 'uuid'],
  '본인 연금 납입 목록 함수가 존재한다'
);
select is(
  pg_get_function_result(to_regprocedure('public.get_my_pension_tax_summary(integer)')),
  'TABLE(pension_paid bigint, irp_paid bigint)'::text,
  '연금 납입 요약 함수는 고정된 bigint 열을 반환한다'
);
select is(
  pg_get_function_result(to_regprocedure(
    'public.get_my_pension_contributions(integer,integer,date,timestamp with time zone,uuid)'
  )),
  'TABLE(id uuid, ledger_id uuid, ledger_name text, can_manage boolean, occurred_on date, description text, amount bigint, created_at timestamp with time zone, category_name text, system_code text)'::text,
  '연금 납입 목록 함수는 고정된 페이지 행 계약을 반환한다'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '70000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'tax-a@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"tax_user_a","display_name":"세금 사용자 A","phone_normalized":"01011112222"}'::jsonb,
    now(), now()
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'tax-b@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"tax_user_b","display_name":"세금 사용자 B","phone_normalized":"01033334444"}'::jsonb,
    now(), now()
  ),
  (
    '70000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'tax-c@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"tax_user_c","display_name":"세금 사용자 C","phone_normalized":"01055556666"}'::jsonb,
    now(), now()
  );

select set_config(
  'tests.tax_a_personal',
  (select id::text from public.ledgers where owner_id = '70000000-0000-0000-0000-000000000001' and kind = 'personal'),
  true
);
select set_config(
  'tests.tax_c_personal',
  (select id::text from public.ledgers where owner_id = '70000000-0000-0000-0000-000000000003' and kind = 'personal'),
  true
);

insert into public.ledgers (id, owner_id, kind, name, currency_code, period_start_day)
values
  (
    '71000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'shared', '현재 공동 장부', 'KRW', 1
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000003',
    'shared', '떠난 공동 장부', 'KRW', 1
  );

insert into public.ledger_members (ledger_id, user_id, role)
values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'member'),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'member');

select is(
  (
    select count(*)::integer
    from (
      select ledger_id
      from public.categories
      group by ledger_id
      having count(*) filter (where system_code = 'pension_savings') = 1
    ) as ledgers_with_one_pension
  ),
  (select count(*)::integer from public.ledgers),
  '모든 기존 장부에는 연금저축 시스템 분류가 하나만 존재한다'
);
select is(
  (
    select count(*)::integer
    from (
      select ledger_id
      from public.categories
      group by ledger_id
      having count(*) filter (where system_code = 'irp') = 1
    ) as ledgers_with_one_irp
  ),
  (select count(*)::integer from public.ledgers),
  '모든 기존 장부에는 IRP 시스템 분류가 하나만 존재한다'
);

update public.categories
set name = '장기 연금'
where ledger_id = current_setting('tests.tax_a_personal')::uuid
  and system_code = 'pension_savings';

update public.categories
set name = '연금저축'
where ledger_id = current_setting('tests.tax_a_personal')::uuid
  and system_code = 'irp';

\ir ../../supabase/migrations/202608280006_pension_tax_credit.sql

select is(
  (
    select system_code
    from public.categories
    where ledger_id = current_setting('tests.tax_a_personal')::uuid
      and name = '장기 연금'
  ),
  'pension_savings'::text,
  '마이그레이션 재실행은 표시 이름을 바꾼 연금저축 시스템 코드를 유지한다'
);
select is(
  (
    select system_code
    from public.categories
    where ledger_id = current_setting('tests.tax_a_personal')::uuid
      and name = '연금저축'
  ),
  'irp'::text,
  '마이그레이션 재실행은 다른 시스템 분류의 연금저축 표시 이름을 덮어쓰지 않는다'
);
select throws_ok(
  format(
    'insert into public.categories (ledger_id, type, name, color, sort_order, system_code) values (%L::uuid, %L, %L, %L, 999, %L)',
    current_setting('tests.tax_a_personal'),
    'expense',
    '중복 연금저축',
    '#111111',
    'pension_savings'
  ),
  '23505',
  null,
  '같은 장부에는 같은 시스템 분류 코드를 추가할 수 없다'
);

insert into public.user_tax_profiles (user_id, tax_year, income_type, gross_salary)
values ('70000000-0000-0000-0000-000000000002', 2026, 'employment', 60000000);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);

select throws_ok(
  format(
    'update public.categories set system_code = %L where ledger_id = %L::uuid and system_code = %L',
    'irp',
    current_setting('tests.tax_a_personal'),
    'pension_savings'
  ),
  '42501',
  null,
  '로그인 사용자는 시스템 분류 코드를 직접 변경할 수 없다'
);
select lives_ok(
  $$insert into public.user_tax_profiles (user_id, tax_year, income_type, gross_salary)
    values (auth.uid(), 2026, 'employment', 50000000)$$,
  '로그인 사용자는 본인 과세연도 설정을 추가한다'
);
select is(
  (select gross_salary from public.user_tax_profiles where user_id = auth.uid() and tax_year = 2026),
  50000000::bigint,
  '로그인 사용자는 본인 과세연도 설정을 조회한다'
);
select is(
  (
    with changed as (
      update public.user_tax_profiles
      set gross_salary = 51000000
      where user_id = auth.uid() and tax_year = 2026
      returning 1
    )
    select count(*)::integer from changed
  ),
  1,
  '로그인 사용자는 본인 과세연도 설정을 변경한다'
);
select is(
  (
    select count(*)::integer
    from public.user_tax_profiles
    where user_id = '70000000-0000-0000-0000-000000000002'
  ),
  0,
  '로그인 사용자는 다른 사용자의 과세연도 설정을 볼 수 없다'
);
select is(
  (
    with changed as (
      update public.user_tax_profiles
      set gross_salary = 1
      where user_id = '70000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::integer from changed
  ),
  0,
  '로그인 사용자는 다른 사용자의 과세연도 설정을 변경하지 못한다'
);
select ok(
  not has_function_privilege('anon', 'public.get_my_pension_tax_summary(integer)', 'execute'),
  '익명 사용자는 연금 납입 요약 함수를 실행할 수 없다'
);
select ok(
  has_function_privilege('authenticated', 'public.get_my_pension_tax_summary(integer)', 'execute'),
  '로그인 사용자만 연금 납입 요약 함수를 실행할 수 있다'
);

insert into public.transactions (
  id, ledger_id, type, occurred_on, description, amount, category_id,
  created_by, idempotency_key, created_at
)
values
  (
    '72000000-0000-0000-0000-000000000002',
    current_setting('tests.tax_a_personal')::uuid,
    'expense', '2026-03-03', '개인 연금저축', 100,
    (select id from public.categories where ledger_id = current_setting('tests.tax_a_personal')::uuid and system_code = 'pension_savings'),
    auth.uid(), gen_random_uuid(), '2026-03-03 10:00:00+00'
  ),
  (
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'expense', '2026-03-03', '공동 IRP', 200,
    (select id from public.categories where ledger_id = '71000000-0000-0000-0000-000000000001' and system_code = 'irp'),
    auth.uid(), gen_random_uuid(), '2026-03-03 10:00:00+00'
  ),
  (
    '72000000-0000-0000-0000-000000000003',
    '71000000-0000-0000-0000-000000000002',
    'expense', '2026-03-02', '탈퇴 전 연금저축', 300,
    (select id from public.categories where ledger_id = '71000000-0000-0000-0000-000000000002' and system_code = 'pension_savings'),
    auth.uid(), gen_random_uuid(), '2026-03-02 11:00:00+00'
  ),
  (
    '72000000-0000-0000-0000-000000000004',
    current_setting('tests.tax_a_personal')::uuid,
    'expense', '2026-03-01', '개인 IRP', 400,
    (select id from public.categories where ledger_id = current_setting('tests.tax_a_personal')::uuid and system_code = 'irp'),
    auth.uid(), gen_random_uuid(), '2026-03-01 12:00:00+00'
  ),
  (
    '72000000-0000-0000-0000-000000000005',
    '71000000-0000-0000-0000-000000000001',
    'expense', '2026-02-28', '휴지통 연금저축', 700,
    (select id from public.categories where ledger_id = '71000000-0000-0000-0000-000000000001' and system_code = 'pension_savings'),
    auth.uid(), gen_random_uuid(), '2026-02-28 10:00:00+00'
  );

update public.transactions
set deleted_at = now(), deleted_by = auth.uid()
where id = '72000000-0000-0000-0000-000000000005';

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000002', true);
insert into public.transactions (
  id, ledger_id, type, occurred_on, description, amount, category_id,
  created_by, idempotency_key, created_at
)
values (
  '72000000-0000-0000-0000-000000000006',
  '71000000-0000-0000-0000-000000000001',
  'expense', '2026-02-27', '다른 사용자 IRP', 900,
  (select id from public.categories where ledger_id = '71000000-0000-0000-0000-000000000001' and system_code = 'irp'),
  auth.uid(), gen_random_uuid(), '2026-02-27 10:00:00+00'
);

reset role;
update public.categories
set system_code = null
where ledger_id = current_setting('tests.tax_c_personal')::uuid
  and system_code = 'pension_savings';
update public.categories
set system_code = 'pension_savings'
where ledger_id = current_setting('tests.tax_c_personal')::uuid
  and type = 'income'
  and name = '급여';
insert into public.ledger_members (ledger_id, user_id, role)
values (
  current_setting('tests.tax_c_personal')::uuid,
  '70000000-0000-0000-0000-000000000001',
  'member'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);
insert into public.transactions (
  id, ledger_id, type, occurred_on, description, amount, category_id,
  created_by, idempotency_key, created_at
)
values (
  '72000000-0000-0000-0000-000000000007',
  current_setting('tests.tax_c_personal')::uuid,
  'income', '2026-02-26', '연금 코드 수입', 800,
  (
    select id from public.categories
    where ledger_id = current_setting('tests.tax_c_personal')::uuid
      and type = 'income'
      and system_code = 'pension_savings'
  ),
  auth.uid(), gen_random_uuid(), '2026-02-26 10:00:00+00'
);

reset role;
delete from public.ledger_members
where ledger_id = '71000000-0000-0000-0000-000000000002'
  and user_id = '70000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);

select is(
  (select pension_paid from public.get_my_pension_tax_summary(2026)),
  400::bigint,
  '요약은 개인·공동 장부의 본인 작성 활성 연금저축 지출만 합산한다'
);
select is(
  (select irp_paid from public.get_my_pension_tax_summary(2026)),
  600::bigint,
  '요약은 다른 사용자·수입·휴지통 거래를 제외한 본인 IRP 지출만 합산한다'
);
select is(
  (
    select ledger_name
    from public.get_my_pension_contributions(2026, 10, null, null, null)
    where id = '72000000-0000-0000-0000-000000000001'
  ),
  '현재 공동 장부'::text,
  '현재 구성원 거래는 실제 장부명을 반환한다'
);
select is(
  (
    select can_manage
    from public.get_my_pension_contributions(2026, 10, null, null, null)
    where id = '72000000-0000-0000-0000-000000000001'
  ),
  true,
  '현재 구성원인 본인 거래는 기존 거래 권한에 따라 관리할 수 있다'
);
select is(
  (
    select ledger_name
    from public.get_my_pension_contributions(2026, 10, null, null, null)
    where id = '72000000-0000-0000-0000-000000000003'
  ),
  '이전 장부'::text,
  '탈퇴한 장부의 본인 거래는 장부명을 숨긴다'
);
select is(
  (
    select can_manage
    from public.get_my_pension_contributions(2026, 10, null, null, null)
    where id = '72000000-0000-0000-0000-000000000003'
  ),
  false,
  '탈퇴한 장부의 본인 거래는 읽기 전용이다'
);
select is(
  (
    select array_agg(id order by occurred_on desc, created_at desc, id desc)
    from public.get_my_pension_contributions(2026, 2, null, null, null)
  ),
  array[
    '72000000-0000-0000-0000-000000000002'::uuid,
    '72000000-0000-0000-0000-000000000001'::uuid
  ],
  '첫 페이지는 날짜·생성시각·식별자 내림차순으로 반환된다'
);
select is(
  (
    select array_agg(id order by occurred_on desc, created_at desc, id desc)
    from public.get_my_pension_contributions(
      2026,
      2,
      '2026-03-03',
      '2026-03-03 10:00:00+00',
      '72000000-0000-0000-0000-000000000001'
    )
  ),
  array[
    '72000000-0000-0000-0000-000000000003'::uuid,
    '72000000-0000-0000-0000-000000000004'::uuid
  ],
  '다음 페이지는 마지막 튜플 뒤에서 중복 없이 이어진다'
);
select ok(
  (
    with first_page as (
      select id
      from public.get_my_pension_contributions(2026, 2, null, null, null)
    ),
    second_page as (
      select id
      from public.get_my_pension_contributions(
        2026,
        2,
        '2026-03-03',
        '2026-03-03 10:00:00+00',
        '72000000-0000-0000-0000-000000000001'
      )
    ),
    combined as (
      select id from first_page
      union all
      select id from second_page
    )
    select count(*) = 4 and count(distinct id) = 4 from combined
  ),
  '페이지 커서는 납입 거래를 누락하거나 중복하지 않는다'
);
select is(
  (
    with deleted as (
      delete from public.user_tax_profiles
      where user_id = auth.uid() and tax_year = 2026
      returning 1
    )
    select count(*)::integer from deleted
  ),
  1,
  '로그인 사용자는 본인 과세연도 설정을 삭제한다'
);
select is(
  (
    with deleted as (
      delete from public.user_tax_profiles
      where user_id = '70000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::integer from deleted
  ),
  0,
  '로그인 사용자는 다른 사용자의 과세연도 설정을 삭제하지 못한다'
);

reset role;
select * from finish();
rollback;
