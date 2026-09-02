begin;
set local search_path = public, extensions;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '91000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'profile-a@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"profile_a","display_name":"프로필 사용자 A","phone_normalized":"01011112222"}'::jsonb,
    now(), now()
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'profile-b@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"profile_b","display_name":"프로필 사용자 B","phone_normalized":"01033334444"}'::jsonb,
    now(), now()
  );

select has_function(
  'public',
  'update_my_profile',
  array['text', 'text'],
  '본인 프로필 수정 함수가 존재한다'
);
select function_returns(
  'public', 'update_my_profile', array['text', 'text'], 'text'
);
select function_privs_are(
  'public', 'update_my_profile', array['text', 'text'], 'anon', array[]::text[]
);
select function_privs_are(
  'public', 'update_my_profile', array['text', 'text'], 'authenticated', array['EXECUTE']
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

select is(
  public.update_my_profile(' 새 이름 ', '01012345678'),
  'updated',
  '사용자 A는 본인 프로필을 수정한다'
);
select is(
  (select display_name from public.profiles where id = auth.uid()),
  '새 이름',
  '표시 이름의 앞뒤 공백을 제거해 저장한다'
);
select is(
  (select phone_normalized from public.user_private_profiles where user_id = auth.uid()),
  '01012345678',
  '전화번호를 비공개 프로필에 함께 저장한다'
);

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select is(
  public.update_my_profile('사용자 B 새 이름', '01087654321'),
  'updated',
  '사용자 B도 본인 프로필을 수정한다'
);

reset role;
select is(
  (
    select array[profile.display_name, private_profile.phone_normalized]
    from public.profiles as profile
    join public.user_private_profiles as private_profile
      on private_profile.user_id = profile.id
    where profile.id = '91000000-0000-4000-8000-000000000001'
  ),
  array['새 이름', '01012345678']::text[],
  '사용자 B 수정 뒤에도 사용자 A 값은 유지된다'
);
select is(
  (
    select array[profile.display_name, private_profile.phone_normalized]
    from public.profiles as profile
    join public.user_private_profiles as private_profile
      on private_profile.user_id = profile.id
    where profile.id = '91000000-0000-4000-8000-000000000002'
  ),
  array['사용자 B 새 이름', '01087654321']::text[],
  '사용자 B의 두 프로필 값만 변경된다'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.update_my_profile('로그인 없음', '01011112222')$$,
  '42501',
  'authentication required',
  '비로그인 호출은 실패한다'
);

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.update_my_profile('   ', '01011112222')$$,
  '22023',
  'invalid display name',
  '빈 표시 이름은 실패한다'
);
select throws_ok(
  $$select public.update_my_profile(repeat('가', 31), '01011112222')$$,
  '22023',
  'invalid display name',
  '31자 표시 이름은 실패한다'
);
select throws_ok(
  $$select public.update_my_profile('정상 이름', '010-1234-5678')$$,
  '22023',
  'invalid phone',
  '문자가 포함된 전화번호는 실패한다'
);

reset role;
select is(
  (
    select procedure.prosecdef
    from pg_catalog.pg_proc as procedure
    where procedure.oid = 'public.update_my_profile(text,text)'::regprocedure
  ),
  false,
  '본인 프로필 수정 함수는 호출자 권한으로 실행한다'
);
select ok(
  (
    select 'search_path=""' = any(coalesce(procedure.proconfig, array[]::text[]))
    from pg_catalog.pg_proc as procedure
    where procedure.oid = 'public.update_my_profile(text,text)'::regprocedure
  ),
  '본인 프로필 수정 함수의 search_path는 비어 있다'
);

select * from finish();
rollback;
