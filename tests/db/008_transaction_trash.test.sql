begin;
set local search_path = public, extensions;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '81000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'trash-a@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"trash_a","display_name":"휴지통 사용자 A","phone_normalized":"01011112222"}'::jsonb,
    now(), now()
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'trash-b@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"trash_b","display_name":"휴지통 사용자 B","phone_normalized":"01033334444"}'::jsonb,
    now(), now()
  ),
  (
    '81000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'trash-c@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"trash_c","display_name":"휴지통 사용자 C","phone_normalized":"01055556666"}'::jsonb,
    now(), now()
  );

insert into public.ledgers (id, owner_id, kind, name, currency_code, period_start_day)
values (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  'shared', '휴지통 공동 장부', 'KRW', 1
);
insert into public.ledger_members (ledger_id, user_id, role)
values (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002',
  'member'
);
insert into public.categories (id, ledger_id, type, name, color, sort_order, is_active)
values
  (
    '83000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    'expense', '휴지통 활성 분류', '#F97316', 1, true
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000001',
    'expense', '휴지통 비활성 분류', '#64748B', 2, true
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

insert into public.transactions (
  id, ledger_id, type, occurred_on, description, amount, category_id,
  created_by, idempotency_key, created_at
)
values
  (
    '84000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    'expense', '2026-09-01', '활성 거래', 900,
    '83000000-0000-4000-8000-000000000001', auth.uid(), gen_random_uuid(), '2026-09-01 00:00:00+00'
  ),
  (
    '84000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000001',
    'expense', '2026-09-01', '복원 거래', 100,
    '83000000-0000-4000-8000-000000000001', auth.uid(), gen_random_uuid(), '2026-09-01 00:01:00+00'
  ),
  (
    '84000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000001',
    'expense', '2026-08-31', '영구 삭제 거래', 200,
    '83000000-0000-4000-8000-000000000001', auth.uid(), gen_random_uuid(), '2026-08-31 00:01:00+00'
  ),
  (
    '84000000-0000-4000-8000-000000000004',
    '82000000-0000-4000-8000-000000000001',
    'expense', '2026-08-30', '비활성 분류 복원 거래', 300,
    '83000000-0000-4000-8000-000000000002', auth.uid(), gen_random_uuid(), '2026-08-30 00:01:00+00'
  );

insert into public.transactions (
  id, ledger_id, type, occurred_on, description, amount, category_id,
  created_by, idempotency_key, created_at
)
select
  ('84000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '82000000-0000-4000-8000-000000000001',
  'expense', '2026-08-01', 'sentinel 거래 ' || series, 1,
  '83000000-0000-4000-8000-000000000001', auth.uid(), gen_random_uuid(),
  '2026-08-01 00:00:00+00'::timestamptz - (series * interval '1 minute')
from generate_series(5, 52) as series;

update public.transactions
set
  deleted_at = case id
    when '84000000-0000-4000-8000-000000000002'::uuid then '2026-09-01 01:00:00+00'::timestamptz
    when '84000000-0000-4000-8000-000000000003'::uuid then '2026-08-31 01:00:00+00'::timestamptz
    when '84000000-0000-4000-8000-000000000004'::uuid then '2026-08-30 01:00:00+00'::timestamptz
    else '2026-08-01 01:00:00+00'::timestamptz - (right(id::text, 2)::integer * interval '1 minute')
  end,
  deleted_by = auth.uid()
where ledger_id = '82000000-0000-4000-8000-000000000001'
  and id <> '84000000-0000-4000-8000-000000000001';

update public.categories
set is_active = false
where id = '83000000-0000-4000-8000-000000000002';

reset role;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
insert into public.transactions (
  id, ledger_id, type, occurred_on, description, amount, category_id,
  created_by, idempotency_key, deleted_at, deleted_by
)
values (
  '84000000-0000-4000-8000-000000000053',
  (select id from public.ledgers where owner_id = '81000000-0000-4000-8000-000000000003' and kind = 'personal'),
  'expense', '2026-08-01', '다른 장부 삭제 거래', 400,
  (
    select id from public.categories
    where ledger_id = (select id from public.ledgers where owner_id = '81000000-0000-4000-8000-000000000003' and kind = 'personal')
      and type = 'expense'
    order by sort_order
    limit 1
  ),
  '81000000-0000-4000-8000-000000000003', gen_random_uuid(),
  '2026-08-01 01:00:00+00', '81000000-0000-4000-8000-000000000003'
);

select has_function(
  'public', 'get_deleted_transactions',
  array['uuid', 'timestamp with time zone', 'uuid', 'integer'],
  '휴지통 조회 함수가 존재한다'
);
select has_function('public', 'restore_deleted_transaction', array['uuid'], '휴지통 복원 함수가 존재한다');
select has_function('public', 'permanently_delete_transaction', array['uuid'], '휴지통 영구 삭제 함수가 존재한다');
select function_privs_are(
  'public', 'restore_deleted_transaction', array['uuid'], 'authenticated', array['EXECUTE'],
  '로그인 사용자만 휴지통 복원 함수를 실행할 수 있다'
);
select ok(
  not has_function_privilege('public', 'public.get_deleted_transactions(uuid,timestamptz,uuid,integer)', 'execute')
  and not has_function_privilege('public', 'public.restore_deleted_transaction(uuid)', 'execute')
  and not has_function_privilege('public', 'public.permanently_delete_transaction(uuid)', 'execute'),
  'PUBLIC 역할은 휴지통 함수를 실행할 수 없다'
);
select ok(
  not has_function_privilege('anon', 'public.get_deleted_transactions(uuid,timestamptz,uuid,integer)', 'execute')
  and not has_function_privilege('anon', 'public.restore_deleted_transaction(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.permanently_delete_transaction(uuid)', 'execute'),
  '익명 사용자는 휴지통 함수를 실행할 수 없다'
);
select ok(
  has_function_privilege('authenticated', 'public.get_deleted_transactions(uuid,timestamptz,uuid,integer)', 'execute')
  and has_function_privilege('authenticated', 'public.restore_deleted_transaction(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.permanently_delete_transaction(uuid)', 'execute'),
  '로그인 사용자는 세 휴지통 함수를 실행할 수 있다'
);
select ok(
  not has_table_privilege('authenticated', 'public.transactions', 'delete'),
  '로그인 사용자에게 거래 직접 삭제 권한이 없다'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select * from public.get_deleted_transactions('82000000-0000-4000-8000-000000000001', null, null, 50)$$,
  '42501', 'ledger owner required', '일반 구성원은 휴지통을 조회할 수 없다'
);
select is(
  public.restore_deleted_transaction('84000000-0000-4000-8000-000000000002'),
  'missing', '일반 구성원은 휴지통 거래를 복원할 수 없다'
);
select is(
  public.permanently_delete_transaction('84000000-0000-4000-8000-000000000003'),
  'missing', '일반 구성원은 휴지통 거래를 영구 삭제할 수 없다'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select * from public.get_deleted_transactions('82000000-0000-4000-8000-000000000001', null, null, 50)$$,
  '42501', 'ledger owner required', '외부 사용자는 휴지통을 조회할 수 없다'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select is(
  (
    select array_agg(id order by deleted_at desc, id desc)
    from public.get_deleted_transactions('82000000-0000-4000-8000-000000000001', null, null, 50)
  ),
  array[
    '84000000-0000-4000-8000-000000000002'::uuid,
    '84000000-0000-4000-8000-000000000003'::uuid,
    '84000000-0000-4000-8000-000000000004'::uuid
  ] || (
    select array_agg(('84000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid order by series)
    from generate_series(5, 52) as series
  ),
  '소유자는 삭제 거래만 삭제 시각 최신순으로 보고 활성 거래를 제외한다'
);
select is(
  (
    select count(*)::integer
    from public.get_deleted_transactions('82000000-0000-4000-8000-000000000001', null, null, 50)
  ),
  51,
  '휴지통 조회는 다음 페이지 확인용 51번째 sentinel 행을 반환한다'
);
select is(
  public.restore_deleted_transaction('84000000-0000-4000-8000-000000000002'),
  'restored', '소유자는 삭제 거래를 복원한다'
);
select ok(
  (select deleted_at is null and deleted_by is null from public.transactions where id = '84000000-0000-4000-8000-000000000002'),
  '복원은 삭제 시각과 삭제자를 함께 비운다'
);
select is(
  (select count(*)::integer from public.transactions where ledger_id = '82000000-0000-4000-8000-000000000001'),
  2,
  '복원된 거래는 일반 거래 조회에 다시 포함된다'
);
select is(
  (
    select expense_total
    from public.get_transaction_summary('82000000-0000-4000-8000-000000000001', '2026-01-01', '2027-01-01')
  ),
  1000::bigint,
  '복원된 거래는 일반 거래 합계에 다시 포함된다'
);
select is(
  public.restore_deleted_transaction('84000000-0000-4000-8000-000000000004'),
  'restored', '소유자는 비활성 분류의 삭제 거래도 복원한다'
);
select is(
  public.restore_deleted_transaction('84000000-0000-4000-8000-000000000004'),
  'missing', '이미 복원한 거래는 다시 복원할 수 없다'
);
select is(
  public.permanently_delete_transaction('84000000-0000-4000-8000-000000000003'),
  'deleted', '소유자는 삭제 거래를 영구 삭제한다'
);
select is(
  (select count(*)::integer from public.transactions where id = '84000000-0000-4000-8000-000000000003'),
  0,
  '영구 삭제한 거래 행은 남지 않는다'
);
select is(
  array[
    public.restore_deleted_transaction('84000000-0000-4000-8000-000000000053'),
    public.permanently_delete_transaction('84000000-0000-4000-8000-000000000053')
  ],
  array['missing', 'missing']::text[],
  '다른 장부의 삭제 거래는 복원과 영구 삭제 모두 missing으로 숨긴다'
);

reset role;
select * from finish();
rollback;
