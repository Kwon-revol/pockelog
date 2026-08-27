begin;
set local search_path = public, extensions;

create extension if not exists pgtap with schema extensions;
select plan(19);

select has_table('public', 'ledger_invitations', '공동 장부 초대 테이블이 존재한다');
select has_function('public', 'create_shared_ledger', array['text'], '공동 장부 생성 함수가 존재한다');
select has_function('public', 'respond_to_ledger_invitation', array['uuid', 'text'], '초대 응답 함수가 존재한다');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '60000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'shared-a@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"shared_a","display_name":"공동 사용자 A","phone_normalized":"01011112222"}'::jsonb,
    now(), now()
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'shared-b@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"shared_b","display_name":"공동 사용자 B","phone_normalized":"01033334444"}'::jsonb,
    now(), now()
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'shared-c@example.com',
    crypt('password1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"login_id":"shared_c","display_name":"공동 사용자 C","phone_normalized":"01055556666"}'::jsonb,
    now(), now()
  );

select set_config(
  'tests.shared_a_personal',
  (select id::text from public.ledgers where owner_id = '60000000-0000-0000-0000-000000000001' and kind = 'personal'),
  true
);
select set_config(
  'tests.shared_b_personal',
  (select id::text from public.ledgers where owner_id = '60000000-0000-0000-0000-000000000002' and kind = 'personal'),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.create_shared_ledger('우리 집 공동 장부')$$,
  '로그인 사용자는 공동 장부를 만든다'
);

select set_config(
  'tests.shared_ledger',
  (select id::text from public.ledgers where owner_id = auth.uid() and kind = 'shared'),
  true
);

select is(
  (select count(*)::integer from public.ledger_members where ledger_id = current_setting('tests.shared_ledger')::uuid and role = 'owner'),
  1,
  '공동 장부에는 소유자 구성원 한 명이 생성된다'
);
select is(
  (select count(*)::integer from public.categories where ledger_id = current_setting('tests.shared_ledger')::uuid),
  15,
  '공동 장부에는 기본 분류 15개가 생성된다'
);
select is(
  (select default_ledger_id from public.user_private_profiles where user_id = auth.uid()),
  current_setting('tests.shared_ledger')::uuid,
  '새 공동 장부가 현재 장부로 선택된다'
);

select throws_ok(
  format(
    'select public.create_ledger_invitation(%L::uuid, %L::uuid)',
    current_setting('tests.shared_a_personal'),
    '60000000-0000-0000-0000-000000000002'
  ),
  'P0001',
  'shared ledger required',
  '개인 장부에는 초대할 수 없다'
);

select throws_ok(
  format(
    'select public.create_ledger_invitation(%L::uuid, %L::uuid)',
    current_setting('tests.shared_ledger'),
    '60000000-0000-0000-0000-000000000001'
  ),
  'P0001',
  'cannot invite self',
  '본인은 초대할 수 없다'
);

select lives_ok(
  format(
    'select public.create_ledger_invitation(%L::uuid, %L::uuid)',
    current_setting('tests.shared_ledger'),
    '60000000-0000-0000-0000-000000000002'
  ),
  '소유자는 기존 사용자를 초대한다'
);

select set_config(
  'tests.shared_invitation',
  (
    select id::text from public.ledger_invitations
    where ledger_id = current_setting('tests.shared_ledger')::uuid
      and target_user_id = '60000000-0000-0000-0000-000000000002'
      and status = 'pending'
  ),
  true
);

select throws_ok(
  format(
    'select public.create_ledger_invitation(%L::uuid, %L::uuid)',
    current_setting('tests.shared_ledger'),
    '60000000-0000-0000-0000-000000000002'
  ),
  '23505',
  null,
  '같은 대상의 대기 초대는 하나만 허용한다'
);

select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*)::integer from public.ledger_invitations where id = current_setting('tests.shared_invitation')::uuid),
  0,
  '관계없는 사용자는 초대를 볼 수 없다'
);

select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000002', true);
select is(
  public.respond_to_ledger_invitation(current_setting('tests.shared_invitation')::uuid, 'accept'),
  'accepted',
  '초대 대상은 초대를 수락한다'
);
select ok(
  public.is_ledger_member(current_setting('tests.shared_ledger')::uuid),
  '수락 직후 공동 장부 구성원이 된다'
);

select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select is(
  public.remove_ledger_member(
    current_setting('tests.shared_ledger')::uuid,
    '60000000-0000-0000-0000-000000000002'
  ),
  'removed',
  '소유자는 일반 구성원을 제거한다'
);

select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000002', true);
select is(
  (select default_ledger_id from public.user_private_profiles where user_id = auth.uid()),
  current_setting('tests.shared_b_personal')::uuid,
  '제거된 사용자의 현재 장부는 개인 장부로 복구된다'
);
select is(
  (select count(*)::integer from public.ledgers where id = current_setting('tests.shared_ledger')::uuid),
  0,
  '제거된 사용자는 공동 장부를 볼 수 없다'
);

select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select is(
  public.delete_shared_ledger(current_setting('tests.shared_ledger')::uuid, '우리 집 공동 장부'),
  'deleted',
  '소유자는 이름 확인 후 공동 장부를 삭제한다'
);
select is(
  (select default_ledger_id from public.user_private_profiles where user_id = auth.uid()),
  current_setting('tests.shared_a_personal')::uuid,
  '삭제한 소유자도 개인 장부로 복구된다'
);

reset role;
select * from finish();
rollback;
