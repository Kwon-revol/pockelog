begin;
set local search_path = public, extensions;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'settings-a@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"settings_a","display_name":"설정 사용자 A","phone_normalized":"01012121212"}'::jsonb,
    now(), now()
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'settings-b@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"settings_b","display_name":"설정 사용자 B","phone_normalized":"01034343434"}'::jsonb,
    now(), now()
  );

select set_config(
  'tests.settings_ledger',
  (select id::text from public.ledgers where owner_id = '50000000-0000-0000-0000-000000000001'),
  true
);

select set_config(
  'tests.other_settings_ledger',
  (select id::text from public.ledgers where owner_id = '50000000-0000-0000-0000-000000000002'),
  true
);

select set_config(
  'tests.other_expense_category',
  (
    select id::text from public.categories
    where ledger_id = current_setting('tests.other_settings_ledger')::uuid and type = 'expense'
    order by sort_order, id
    limit 1
  ),
  true
);

insert into public.ledger_members (ledger_id, user_id, role)
values (
  current_setting('tests.settings_ledger')::uuid,
  '50000000-0000-0000-0000-000000000002',
  'member'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config(
  'tests.expected_expense_order',
  (
    select array_to_string(array_agg(id order by sort_order desc, id), ',')
    from public.categories
    where ledger_id = current_setting('tests.settings_ledger')::uuid and type = 'expense'
  ),
  true
);

select lives_ok(
  format(
    'select public.set_category_order(%L::uuid, ''expense'', array[%s]::uuid[])',
    current_setting('tests.settings_ledger'),
    (
      select string_agg(quote_literal(id::text), ',' order by sort_order desc, id)
      from public.categories
      where ledger_id = current_setting('tests.settings_ledger')::uuid and type = 'expense'
    )
  ),
  '소유자는 한 유형의 전체 분류 순서를 바꿀 수 있다'
);

select is(
  (
    select array_agg(id order by sort_order, id)
    from public.categories
    where ledger_id = current_setting('tests.settings_ledger')::uuid and type = 'expense'
  ),
  string_to_array(current_setting('tests.expected_expense_order'), ',')::uuid[],
  '요청한 ID 순서가 그대로 저장된다'
);

select is(
  (
    select array_agg(sort_order order by sort_order)
    from public.categories
    where ledger_id = current_setting('tests.settings_ledger')::uuid and type = 'expense'
  ),
  array[0,1,2,3,4,5,6,7,8,9],
  '순서 값은 0부터 빠짐없이 다시 부여된다'
);

select throws_ok(
  format(
    'select public.set_category_order(%L::uuid, ''expense'', array[%L::uuid])',
    current_setting('tests.settings_ledger'),
    (
      select id::text from public.categories
      where ledger_id = current_setting('tests.settings_ledger')::uuid and type = 'expense'
      limit 1
    )
  ),
  'P0001',
  'ordered category list mismatch',
  '일부 분류만 전달한 순서 변경은 거부한다'
);

select throws_ok(
  format(
    'select public.set_category_order(%L::uuid, ''expense'', array_fill(%L::uuid, array[%s]))',
    current_setting('tests.settings_ledger'),
    split_part(current_setting('tests.expected_expense_order'), ',', 1),
    cardinality(string_to_array(current_setting('tests.expected_expense_order'), ','))
  ),
  'P0001',
  'ordered category list mismatch',
  '중복 ID가 포함된 순서 변경은 거부한다'
);

select throws_ok(
  format(
    'select public.set_category_order(%L::uuid, ''expense'', array_append((string_to_array(%L, '','')::uuid[])[1:%s], %L::uuid))',
    current_setting('tests.settings_ledger'),
    current_setting('tests.expected_expense_order'),
    cardinality(string_to_array(current_setting('tests.expected_expense_order'), ',')) - 1,
    (
      select id::text from public.categories
      where ledger_id = current_setting('tests.settings_ledger')::uuid and type = 'income'
      order by sort_order, id
      limit 1
    )
  ),
  'P0001',
  'ordered category list mismatch',
  '다른 유형의 ID가 포함된 순서 변경은 거부한다'
);

select throws_ok(
  format(
    'select public.set_category_order(%L::uuid, ''expense'', array_append((string_to_array(%L, '','')::uuid[])[1:%s], %L::uuid))',
    current_setting('tests.settings_ledger'),
    current_setting('tests.expected_expense_order'),
    cardinality(string_to_array(current_setting('tests.expected_expense_order'), ',')) - 1,
    current_setting('tests.other_expense_category')
  ),
  'P0001',
  'ordered category list mismatch',
  '다른 장부의 ID가 포함된 순서 변경은 거부한다'
);

select is(
  (
    select array_agg(id order by sort_order, id)
    from public.categories
    where ledger_id = current_setting('tests.settings_ledger')::uuid and type = 'expense'
  ),
  string_to_array(current_setting('tests.expected_expense_order'), ',')::uuid[],
  '실패한 요청 뒤에도 기존 순서가 유지된다'
);

select throws_ok(
  format(
    'update public.categories set name = name || '' '' where id = %L::uuid',
    split_part(current_setting('tests.expected_expense_order'), ',', 1)
  ),
  '23514',
  'new row for relation "categories" violates check constraint "categories_name_trimmed"',
  '공백이 붙은 분류명은 데이터베이스에서도 거부한다'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

select throws_ok(
  format(
    'select public.set_category_order(%L::uuid, ''expense'', array[%s]::uuid[])',
    current_setting('tests.settings_ledger'),
    (
      select string_agg(quote_literal(id::text), ',' order by sort_order, id)
      from public.categories
      where ledger_id = current_setting('tests.settings_ledger')::uuid and type = 'expense'
    )
  ),
  '42501',
  'ledger owner required',
  '일반 구성원은 분류 순서를 변경할 수 없다'
);

reset role;
select * from finish();
rollback;
