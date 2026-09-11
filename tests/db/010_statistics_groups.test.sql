begin;
set local search_path = public, extensions;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Each assertion below exercises the real schema, privileges, RPC side effects or RLS.
select has_table('public', 'statistics_groups', '통계 그룹 테이블이 있다');
select has_column('public', 'categories', 'statistics_group_id', '분류에 통계 그룹 연결 열이 있다');
select policies_are('public', 'statistics_groups', array[
  'statistics_groups_select_members', 'statistics_groups_insert_owner',
  'statistics_groups_update_owner', 'statistics_groups_delete_owner'
]);
select ok((select relrowsecurity from pg_class where oid = 'public.statistics_groups'::regclass),
  '통계 그룹 RLS가 활성화되어 있다');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sg-a@example.com', crypt('password1!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"login_id":"sg_owner_a","display_name":"그룹 A","phone_normalized":"01012340001"}'::jsonb, now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sg-b@example.com', crypt('password1!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"login_id":"sg_owner_b","display_name":"그룹 B","phone_normalized":"01012340002"}'::jsonb, now(), now());

select set_config('tests.sg_ledger_a', (select id::text from public.ledgers
  where owner_id = 'a0000000-0000-0000-0000-000000000001' and kind = 'personal'), true);
select set_config('tests.sg_ledger_b', (select id::text from public.ledgers
  where owner_id = 'a0000000-0000-0000-0000-000000000002' and kind = 'personal'), true);

insert into public.categories (id, ledger_id, type, name, color, sort_order) values
  ('a1000000-0000-0000-0000-000000000001'::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', '그룹 테스트 식비', '#112233', 201),
  ('a1000000-0000-0000-0000-000000000002'::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', '그룹 테스트 교통', '#445566', 202),
  ('a1000000-0000-0000-0000-000000000003'::uuid, current_setting('tests.sg_ledger_a')::uuid, 'income', '그룹 테스트 급여', '#778899', 203),
  ('a1000000-0000-0000-0000-000000000004'::uuid, current_setting('tests.sg_ledger_b')::uuid, 'expense', '다른 장부 분류', '#112233', 201);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);

insert into public.transactions (
  ledger_id, type, occurred_on, description, amount, category_id, created_by, idempotency_key
) values
  (current_setting('tests.sg_ledger_a')::uuid, 'expense', '2026-09-01', '첫 지출', 12000, 'a1000000-0000-0000-0000-000000000001'::uuid, auth.uid(), gen_random_uuid()),
  (current_setting('tests.sg_ledger_a')::uuid, 'expense', '2026-09-02', '둘째 지출', 3000, 'a1000000-0000-0000-0000-000000000001'::uuid, auth.uid(), gen_random_uuid()),
  (current_setting('tests.sg_ledger_a')::uuid, 'expense', '2026-09-03', '교통 지출', 5000, 'a1000000-0000-0000-0000-000000000002'::uuid, auth.uid(), gen_random_uuid()),
  (current_setting('tests.sg_ledger_a')::uuid, 'income', '2026-09-03', '급여 수입', 3000000, 'a1000000-0000-0000-0000-000000000003'::uuid, auth.uid(), gen_random_uuid()),
  (current_setting('tests.sg_ledger_a')::uuid, 'expense', '2026-09-04', '삭제 지출', 90000, 'a1000000-0000-0000-0000-000000000001'::uuid, auth.uid(), gen_random_uuid()),
  (current_setting('tests.sg_ledger_a')::uuid, 'expense', '2026-10-01', '다음 기간', 7000, 'a1000000-0000-0000-0000-000000000001'::uuid, auth.uid(), gen_random_uuid()),
  (current_setting('tests.sg_ledger_a')::uuid, 'expense', '2026-08-31', '이전 기간', 8000, 'a1000000-0000-0000-0000-000000000001'::uuid, auth.uid(), gen_random_uuid());

-- Use privileged fixture setup: active-only SELECT RLS must not prevent creating a deleted fixture.
reset role;
update public.transactions set deleted_at = now(), deleted_by = created_by where description = '삭제 지출' and ledger_id = current_setting('tests.sg_ledger_a')::uuid;
set local role authenticated;
update public.categories set is_active = false where id = 'a1000000-0000-0000-0000-000000000001'::uuid;

select lives_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_a')::uuid, 'expense', '  Living  ', '#ABCDEF', array['a1000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000002'::uuid])$$, '소유자는 숨긴 분류를 포함한 지출 그룹을 저장한다');
select set_config('tests.sg_group_a', (select id::text from public.statistics_groups where ledger_id = current_setting('tests.sg_ledger_a')::uuid and name = 'Living'), true);
select is((select count(*) from public.categories where statistics_group_id = current_setting('tests.sg_group_a')::uuid), 2::bigint, '지출 분류 두 개가 한 그룹에 연결된다');
select lives_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Travel', '#ABCDEF', array['a1000000-0000-0000-0000-000000000002'::uuid])$$, '다른 그룹의 분류를 새 그룹으로 이동한다');
select set_config('tests.sg_group_b', (select id::text from public.statistics_groups where ledger_id = current_setting('tests.sg_ledger_a')::uuid and name = 'Travel'), true);
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000002'::uuid), current_setting('tests.sg_group_b')::uuid, '이동한 분류에는 새 그룹 ID만 남는다');
select is((select count(*) from public.categories where statistics_group_id = current_setting('tests.sg_group_a')::uuid), 1::bigint, '이전 그룹에서 이동한 분류가 빠진다');
select throws_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Invalid new group', '#ABCDEF', array['a1000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-000000000003'::uuid])$$, 'P0001', null, '잘못된 분류가 포함된 새 그룹 생성 전체를 거부한다');
select is((select count(*) from public.statistics_groups where ledger_id = current_setting('tests.sg_ledger_a')::uuid), 2::bigint, '실패한 생성은 빈 그룹을 남기지 않는다');
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000002'::uuid), current_setting('tests.sg_group_b')::uuid, '실패한 생성은 다른 그룹의 연결도 이동하지 않는다');
select throws_ok($$select public.save_statistics_group(current_setting('tests.sg_group_a')::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Changed', '#ABCDEF', array['a1000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000004'::uuid])$$, 'P0001', null, '다른 장부 분류 입력은 전체 저장을 거부한다');
select is((select name from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 'Living'::text, '다른 장부 분류 실패 후 그룹 이름도 복구된다');
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000001'::uuid), current_setting('tests.sg_group_a')::uuid, '다른 장부 분류 실패 후 기존 연결이 유지된다');
select throws_ok($$select public.save_statistics_group(current_setting('tests.sg_group_a')::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Changed', '#ABCDEF', array['a1000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000003'::uuid])$$, 'P0001', null, '수입 분류 입력은 전체 저장을 거부한다');
select is((select name from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 'Living'::text, '수입 분류 실패 후 그룹 이름도 복구된다');
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000001'::uuid), current_setting('tests.sg_group_a')::uuid, '수입 분류 실패 후 기존 연결이 유지된다');
select throws_ok($$select public.save_statistics_group(current_setting('tests.sg_group_a')::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Changed', '#ABCDEF', array['a1000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid])$$, 'P0001', null, '중복 분류 입력은 전체 저장을 거부한다');
select is((select name from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 'Living'::text, '중복 분류 실패 후 그룹 이름도 복구된다');
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000001'::uuid), current_setting('tests.sg_group_a')::uuid, '중복 분류 실패 후 기존 연결이 유지된다');
select throws_ok($$select public.save_statistics_group(current_setting('tests.sg_group_a')::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Changed', '#ABCDEF', array['a1000000-0000-0000-0000-000000000001'::uuid, null::uuid])$$, 'P0001', null, 'null 원소 입력은 전체 저장을 거부한다');
select is((select name from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 'Living'::text, 'null 원소 실패 후 그룹 이름도 복구된다');
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000001'::uuid), current_setting('tests.sg_group_a')::uuid, 'null 원소 실패 후 기존 연결이 유지된다');
select throws_ok($$select public.save_statistics_group(current_setting('tests.sg_group_a')::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Changed', '#ABCDEF', array['ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid])$$, 'P0001', null, '없는 분류 입력은 전체 저장을 거부한다');
select is((select name from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 'Living'::text, '없는 분류 실패 후 그룹 이름도 복구된다');
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000001'::uuid), current_setting('tests.sg_group_a')::uuid, '없는 분류 실패 후 기존 연결이 유지된다');
select throws_ok($$select public.save_statistics_group(current_setting('tests.sg_group_a')::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Changed', '#ABCDEF', null::uuid[])$$, 'P0001', null, 'null 목록 입력은 전체 저장을 거부한다');
select is((select name from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 'Living'::text, 'null 목록 실패 후 그룹 이름도 복구된다');
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000001'::uuid), current_setting('tests.sg_group_a')::uuid, 'null 목록 실패 후 기존 연결이 유지된다');
select throws_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_a')::uuid, 'expense', '  lIvInG  ', '#ABCDEF', array[]::uuid[])$$, '23505', null, '공백과 대소문자만 다른 그룹명은 중복이다');
select throws_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_a')::uuid, 'expense', '', '#ABCDEF', array[]::uuid[])$$, '23514', null, '빈 그룹 이름을 거부한다');
select throws_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_a')::uuid, 'expense', '색상 오류', 'red', array[]::uuid[])$$, '23514', null, '잘못된 색상을 거부한다');
select lives_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_a')::uuid, 'income', 'Living', '#ABCDEF', array['a1000000-0000-0000-0000-000000000003'::uuid])$$, '수입 그룹은 지출과 같은 이름을 사용할 수 있다');
select set_config('tests.sg_group_income', (select id::text from public.statistics_groups where ledger_id = current_setting('tests.sg_ledger_a')::uuid and type = 'income'), true);
select throws_ok($$select public.save_statistics_group(current_setting('tests.sg_group_income')::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Wrong', '#ABCDEF', array[]::uuid[])$$, 'P0001', null, '기존 수입 그룹을 지출 그룹으로 변경하지 못한다');
select throws_ok($$update public.statistics_groups set type = 'income' where id = current_setting('tests.sg_group_a')::uuid$$, '42501', null, '직접 변경으로 그룹 유형을 바꾸지 못한다');
select throws_ok($$update public.statistics_groups set ledger_id = current_setting('tests.sg_ledger_b')::uuid where id = current_setting('tests.sg_group_a')::uuid$$, '42501', null, '직접 변경으로 그룹 장부를 바꾸지 못한다');
select throws_ok($$update public.categories set statistics_group_id = current_setting('tests.sg_group_income')::uuid where id = 'a1000000-0000-0000-0000-000000000001'::uuid$$, 'P0001', null, '직접 연결 변경에도 유형 트리거가 적용된다');
select throws_ok($$insert into public.categories (ledger_id,type,name,color,sort_order,statistics_group_id) values (current_setting('tests.sg_ledger_b')::uuid,'expense','잘못된 연결','#112233',999,current_setting('tests.sg_group_a')::uuid)$$, 'P0001', null, '직접 삽입도 다른 장부 그룹 연결을 거부한다');
select throws_ok($$select public.set_statistics_group_order(current_setting('tests.sg_ledger_a')::uuid, 'expense', array[current_setting('tests.sg_group_a')::uuid])$$, 'P0001', null, '누락 그룹 순서 목록을 거부한다');
select is((select sort_order from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 0, '실패한 순서 변경은 원래 순서를 유지한다');
select throws_ok($$select public.set_statistics_group_order(current_setting('tests.sg_ledger_a')::uuid, 'expense', array[current_setting('tests.sg_group_a')::uuid,current_setting('tests.sg_group_a')::uuid])$$, 'P0001', null, '중복 그룹 순서 목록을 거부한다');
select is((select sort_order from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 0, '실패한 순서 변경은 원래 순서를 유지한다');
select throws_ok($$select public.set_statistics_group_order(current_setting('tests.sg_ledger_a')::uuid, 'expense', array[current_setting('tests.sg_group_a')::uuid,current_setting('tests.sg_group_income')::uuid])$$, 'P0001', null, '다른 유형 그룹 순서 목록을 거부한다');
select is((select sort_order from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 0, '실패한 순서 변경은 원래 순서를 유지한다');
select throws_ok($$select public.set_statistics_group_order(current_setting('tests.sg_ledger_a')::uuid, 'expense', null::uuid[])$$, 'P0001', null, 'null 그룹 순서 목록을 거부한다');
select is((select sort_order from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 0, '실패한 순서 변경은 원래 순서를 유지한다');
select throws_ok($$select public.set_statistics_group_order(current_setting('tests.sg_ledger_a')::uuid, 'expense', array[current_setting('tests.sg_group_a')::uuid,null::uuid])$$, 'P0001', null, 'null 원소 그룹 순서 목록을 거부한다');
select is((select sort_order from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 0, '실패한 순서 변경은 원래 순서를 유지한다');
select lives_ok($$select public.set_statistics_group_order(current_setting('tests.sg_ledger_a')::uuid, 'expense', array[current_setting('tests.sg_group_b')::uuid,current_setting('tests.sg_group_a')::uuid])$$, '전체 지출 그룹 순서를 원자적으로 저장한다');
select is((select sort_order from public.statistics_groups where id = current_setting('tests.sg_group_b')::uuid), 0, '첫 번째 그룹 순서가 0이다');
select is((select sort_order from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid), 1, '두 번째 그룹 순서가 1이다');
select results_eq(
  $$select category_id, category_name, category_color, category_sort_order, amount_total,
    statistics_group_id, statistics_group_name, statistics_group_color, statistics_group_sort_order from public.get_grouped_category_statistics(current_setting('tests.sg_ledger_a')::uuid, '2026-09-01', '2026-10-01', 'expense')$$,
  $$values ('a1000000-0000-0000-0000-000000000001'::uuid, '그룹 테스트 식비'::text, '#112233'::text, 201, 15000::bigint, current_setting('tests.sg_group_a')::uuid, 'Living'::text, '#ABCDEF'::text, 1),
    ('a1000000-0000-0000-0000-000000000002'::uuid, '그룹 테스트 교통'::text, '#445566'::text, 202, 5000::bigint, current_setting('tests.sg_group_b')::uuid, 'Travel'::text, '#ABCDEF'::text, 0)$$,
  '숨긴 분류와 그룹 메타데이터를 반환하고 삭제·기간 밖·다른 유형 거래는 제외한다');
select is((select amount_total from public.get_grouped_category_statistics(current_setting('tests.sg_ledger_a')::uuid, '2026-09-01', '2026-10-01', 'income')), 3000000::bigint, '수입 그룹 통계를 지출과 분리한다');
select is((select count(*) from public.get_grouped_category_statistics(current_setting('tests.sg_ledger_a')::uuid, '2025-01-01', '2025-02-01', 'expense')), 0::bigint, '거래가 없는 그룹과 기간은 통계 행을 만들지 않는다');
select lives_ok($$select public.save_statistics_group(current_setting('tests.sg_group_a')::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Living', '#ABCDEF', array[]::uuid[])$$, '빈 분류 목록은 기존 연결을 해제한다');
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000001'::uuid), null::uuid, '목록에서 빠진 분류는 그룹 미지정 상태가 된다');
select is((select amount_total from public.get_grouped_category_statistics(current_setting('tests.sg_ledger_a')::uuid, '2026-09-01', '2026-10-01', 'expense') where statistics_group_id is null), 15000::bigint, '미지정 분류도 원래 금액을 반환한다');
select lives_ok($$select public.save_statistics_group(current_setting('tests.sg_group_a')::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Living', '#ABCDEF', array['a1000000-0000-0000-0000-000000000001'::uuid])$$, '그룹 연결을 다시 저장한다');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.statistics_groups where ledger_id = current_setting('tests.sg_ledger_a')::uuid), 0::bigint, '비구성원은 다른 장부 그룹을 읽을 수 없다');
select is((select count(*) from public.get_grouped_category_statistics(current_setting('tests.sg_ledger_a')::uuid, '2026-09-01', '2026-10-01', 'expense')), 0::bigint, '비구성원은 다른 장부 통계를 읽을 수 없다');
select throws_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Unauthorized', '#ABCDEF', array[]::uuid[])$$, '42501', null, '비소유자는 그룹 저장 RPC를 호출하지 못한다');
select throws_ok($$select public.delete_statistics_group(current_setting('tests.sg_group_a')::uuid)$$, '42501', null, '비소유자는 그룹 삭제 RPC를 호출하지 못한다');
select throws_ok($$select public.set_statistics_group_order(current_setting('tests.sg_ledger_a')::uuid, 'expense', array[current_setting('tests.sg_group_a')::uuid,current_setting('tests.sg_group_b')::uuid])$$, '42501', null, '비소유자는 그룹 순서 RPC를 호출하지 못한다');
select lives_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_b')::uuid, 'expense', 'Living', '#ABCDEF', array['a1000000-0000-0000-0000-000000000004'::uuid])$$, '다른 장부에는 같은 이름의 그룹을 만들 수 있다');
select set_config('tests.sg_group_foreign', (select id::text from public.statistics_groups where ledger_id = current_setting('tests.sg_ledger_b')::uuid), true);
reset role;
insert into public.ledger_members (ledger_id, user_id, role)
values (current_setting('tests.sg_ledger_a')::uuid, 'a0000000-0000-0000-0000-000000000002', 'member');
set local role authenticated;
select is((select count(*) from public.statistics_groups where ledger_id = current_setting('tests.sg_ledger_a')::uuid), 3::bigint, '일반 구성원은 장부의 그룹을 조회한다');
select is((select count(*) from public.get_grouped_category_statistics(current_setting('tests.sg_ledger_a')::uuid, '2026-09-01', '2026-10-01', 'expense')), 2::bigint, '일반 구성원은 거래 RLS에 따라 그룹 통계를 조회한다');
select throws_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Member', '#ABCDEF', array[]::uuid[])$$, '42501', null, '일반 구성원은 그룹 저장 RPC를 호출하지 못한다');
select throws_ok($$select public.delete_statistics_group(current_setting('tests.sg_group_a')::uuid)$$, '42501', null, '일반 구성원은 그룹 삭제 RPC를 호출하지 못한다');
select throws_ok($$select public.set_statistics_group_order(current_setting('tests.sg_ledger_a')::uuid, 'expense', array[current_setting('tests.sg_group_a')::uuid,current_setting('tests.sg_group_b')::uuid])$$, '42501', null, '일반 구성원은 그룹 순서 RPC를 호출하지 못한다');
select throws_ok($$insert into public.statistics_groups(ledger_id,type,name,color,sort_order) values (current_setting('tests.sg_ledger_a')::uuid,'expense','Member','#ABCDEF',2)$$, '42501', null, '일반 구성원 직접 그룹 삽입을 RLS가 막는다');
select results_eq($$update public.statistics_groups set name = 'Member' where id = current_setting('tests.sg_group_a')::uuid returning id$$, $$select null::uuid where false$$, '일반 구성원의 직접 그룹 수정은 행을 변경하지 않는다');
select results_eq($$delete from public.statistics_groups where id = current_setting('tests.sg_group_a')::uuid returning id$$, $$select null::uuid where false$$, '일반 구성원의 직접 그룹 삭제는 행을 변경하지 않는다');
select results_eq($$update public.categories set statistics_group_id = null where id = 'a1000000-0000-0000-0000-000000000001'::uuid returning id$$, $$select null::uuid where false$$, '일반 구성원의 직접 분류 연결 해제를 RLS가 막는다');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select throws_ok($$select public.save_statistics_group(current_setting('tests.sg_group_foreign')::uuid, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'Foreign', '#ABCDEF', array[]::uuid[])$$, 'P0001', null, '다른 장부 그룹 ID로 기존 그룹을 덮어쓸 수 없다');
select throws_ok($$update public.categories set statistics_group_id = current_setting('tests.sg_group_foreign')::uuid where id = 'a1000000-0000-0000-0000-000000000001'::uuid$$, 'P0001', null, '직접 연결 변경에도 장부 트리거가 적용된다');
select throws_ok($$select public.set_statistics_group_order(current_setting('tests.sg_ledger_a')::uuid, 'expense', array[current_setting('tests.sg_group_a')::uuid,current_setting('tests.sg_group_foreign')::uuid])$$, 'P0001', null, '다른 장부 그룹이 포함된 순서 목록을 거부한다');
reset role;
select set_config('tests.sg_categories_before', (select count(*)::text from public.categories where ledger_id = current_setting('tests.sg_ledger_a')::uuid), true);
select set_config('tests.sg_transactions_before', (select count(*)::text from public.transactions where ledger_id = current_setting('tests.sg_ledger_a')::uuid), true);
set local role authenticated;
select lives_ok($$select public.delete_statistics_group(current_setting('tests.sg_group_a')::uuid)$$, '소유자는 그룹을 삭제한다');
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000001'::uuid), null::uuid, '그룹 삭제는 분류 연결만 null로 만든다');
select is((select statistics_group_id from public.categories where id = 'a1000000-0000-0000-0000-000000000002'::uuid), current_setting('tests.sg_group_b')::uuid, '다른 그룹 연결은 유지한다');
reset role;
select is((select count(*) from public.categories where ledger_id = current_setting('tests.sg_ledger_a')::uuid), current_setting('tests.sg_categories_before')::bigint, '그룹 삭제 후 분류 수가 유지된다');
select is((select count(*) from public.transactions where ledger_id = current_setting('tests.sg_ledger_a')::uuid), current_setting('tests.sg_transactions_before')::bigint, '그룹 삭제 후 삭제 거래를 포함한 거래 수가 유지된다');
select ok(has_function_privilege('authenticated', 'public.save_statistics_group(uuid,uuid,public.transaction_type,text,text,uuid[])', 'execute'), '로그인 역할에 save_statistics_group 실행을 허용한다');
select ok(not has_function_privilege('anon', 'public.save_statistics_group(uuid,uuid,public.transaction_type,text,text,uuid[])', 'execute'), '익명 역할의 save_statistics_group 실행을 차단한다');
select ok(has_function_privilege('authenticated', 'public.delete_statistics_group(uuid)', 'execute'), '로그인 역할에 delete_statistics_group 실행을 허용한다');
select ok(not has_function_privilege('anon', 'public.delete_statistics_group(uuid)', 'execute'), '익명 역할의 delete_statistics_group 실행을 차단한다');
select ok(has_function_privilege('authenticated', 'public.set_statistics_group_order(uuid,public.transaction_type,uuid[])', 'execute'), '로그인 역할에 set_statistics_group_order 실행을 허용한다');
select ok(not has_function_privilege('anon', 'public.set_statistics_group_order(uuid,public.transaction_type,uuid[])', 'execute'), '익명 역할의 set_statistics_group_order 실행을 차단한다');
select ok(has_function_privilege('authenticated', 'public.get_grouped_category_statistics(uuid,date,date,public.transaction_type)', 'execute'), '로그인 역할에 get_grouped_category_statistics 실행을 허용한다');
select ok(not has_function_privilege('anon', 'public.get_grouped_category_statistics(uuid,date,date,public.transaction_type)', 'execute'), '익명 역할의 get_grouped_category_statistics 실행을 차단한다');
select ok((select not prosecdef from pg_proc where oid = 'public.get_grouped_category_statistics(uuid,date,date,public.transaction_type)'::regprocedure), '새 통계 RPC는 호출자의 거래 RLS를 적용한다');
select ok(not exists (
  select 1 from pg_proc as routine,
    lateral aclexplode(coalesce(routine.proacl, acldefault('f', routine.proowner))) as privilege
  where routine.oid in (
    'public.save_statistics_group(uuid,uuid,public.transaction_type,text,text,uuid[])'::regprocedure,
    'public.delete_statistics_group(uuid)'::regprocedure,
    'public.set_statistics_group_order(uuid,public.transaction_type,uuid[])'::regprocedure,
    'public.get_grouped_category_statistics(uuid,date,date,public.transaction_type)'::regprocedure
  ) and privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
), 'PUBLIC 기본 실행 권한을 네 RPC 모두에서 제거한다');
select ok((select bool_and(proconfig @> array['search_path=""']) from pg_proc where oid in (
  'private.enforce_category_statistics_group()'::regprocedure,
  'public.save_statistics_group(uuid,uuid,public.transaction_type,text,text,uuid[])'::regprocedure,
  'public.delete_statistics_group(uuid)'::regprocedure,
  'public.set_statistics_group_order(uuid,public.transaction_type,uuid[])'::regprocedure,
  'public.get_grouped_category_statistics(uuid,date,date,public.transaction_type)'::regprocedure
)), '모든 새 함수는 빈 search_path를 고정한다');
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.save_statistics_group(null, current_setting('tests.sg_ledger_a')::uuid, 'expense', 'No session', '#ABCDEF', array[]::uuid[])$$, '42501', null, '인증 사용자 ID가 없으면 저장을 거부한다');
select throws_ok($$select public.delete_statistics_group(current_setting('tests.sg_group_b')::uuid)$$, '42501', null, '인증 사용자 ID가 없으면 삭제를 거부한다');
select throws_ok($$select public.set_statistics_group_order(current_setting('tests.sg_ledger_a')::uuid, 'expense', array[current_setting('tests.sg_group_b')::uuid])$$, '42501', null, '인증 사용자 ID가 없으면 정렬을 거부한다');

reset role;
select * from finish();
rollback;
