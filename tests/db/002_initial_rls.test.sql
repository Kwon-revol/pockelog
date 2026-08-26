begin;
set local search_path = public, extensions;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'rls-a@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"rls_user_a","display_name":"RLS 사용자 A","phone_normalized":"01011112222"}'::jsonb,
    now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'rls-b@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"rls_user_b","display_name":"RLS 사용자 B","phone_normalized":"01033334444"}'::jsonb,
    now(), now()
  );

select ok(
  not has_table_privilege('anon', 'public.ledgers', 'select'),
  'anon은 장부 조회 권한이 없다'
);

select ok(
  not has_function_privilege('authenticated', 'public.resolve_login_email(text)', 'execute'),
  'authenticated 사용자는 로그인 이메일 해석 함수를 호출할 수 없다'
);

select ok(
  not has_table_privilege('authenticated', 'public.categories', 'delete'),
  '분류는 하드 삭제할 수 없다'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.ledgers),
  1::bigint,
  '사용자 B는 자신의 개인 장부만 조회한다'
);

select is_empty(
  $$
    select id
    from public.ledgers
    where owner_id = '20000000-0000-0000-0000-000000000001'
  $$,
  '사용자 B는 사용자 A의 개인 장부를 조회할 수 없다'
);

select is(
  (select count(*) from public.categories),
  15::bigint,
  '사용자 B는 자신의 장부 분류만 조회한다'
);

reset role;
select * from finish();
rollback;
