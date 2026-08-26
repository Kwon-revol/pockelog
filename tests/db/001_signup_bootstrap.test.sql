begin;
set local search_path = public, extensions;

create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'user-a@example.com',
  crypt('password1!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"login_id":"user_a","display_name":"사용자 A","phone_normalized":"01012345678"}'::jsonb,
  now(),
  now()
);

select is(
  (select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  '가입 시 공개 프로필을 만든다'
);

select is(
  (select count(*) from public.user_private_profiles where user_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  '가입 시 비공개 프로필을 만든다'
);

select is(
  (select count(*) from private.account_identifiers where user_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  '가입 시 로그인 식별자를 만든다'
);

select is(
  (select count(*) from public.ledgers where owner_id = '10000000-0000-0000-0000-000000000001' and kind = 'personal'),
  1::bigint,
  '가입 시 개인 장부 한 개를 만든다'
);

select is(
  (select count(*) from public.ledger_members where user_id = '10000000-0000-0000-0000-000000000001' and role = 'owner'),
  1::bigint,
  '가입자를 개인 장부 소유자로 등록한다'
);

select ok(
  (
    select member.user_id = ledger.owner_id
    from public.ledger_members as member
    join public.ledgers as ledger on ledger.id = member.ledger_id
    where member.role = 'owner'
      and ledger.owner_id = '10000000-0000-0000-0000-000000000001'
  ),
  '장부 owner 멤버십은 실제 owner_id와 일치한다'
);

select is(
  (
    select count(*)
    from public.categories as c
    join public.ledgers as l on l.id = c.ledger_id
    where l.owner_id = '10000000-0000-0000-0000-000000000001'
  ),
  15::bigint,
  '기본 수입·지출 분류 열다섯 개를 만든다'
);

select * from finish();
rollback;
