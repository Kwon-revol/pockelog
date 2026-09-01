# Supabase 프로젝트 적용

현재 개발 방식은 Docker 없이 호스팅된 Supabase 프로젝트를 사용한다.

## 최초 스키마 적용

1. Supabase Dashboard에서 PockeLog 프로젝트를 연다.
2. 왼쪽 메뉴에서 **SQL Editor**를 선택한다.
3. **New query**를 선택한다.
4. `supabase/migrations/202608260001_initial_auth_and_ledgers.sql` 전체를 붙여 넣는다.
5. 대상 프로젝트가 PockeLog의 새 프로젝트인지 다시 확인한 뒤 **Run**을 누른다.

이 SQL은 최초 적용용이므로 같은 프로젝트에서 반복 실행하지 않는다. 이후 변경은 새 번호의 마이그레이션 파일로 추가한다.

## 거래 가계부 마이그레이션 적용

초기 스키마를 적용한 프로젝트에서 다음 순서로 진행한다.

1. 아직 새 거래 화면 코드를 `main`에 병합하지 않는다.
2. SQL Editor에서 새 쿼리를 연다.
3. `supabase/migrations/202608260002_transactions.sql` 전체를 붙여 넣는다.
4. 대상이 PockeLog 운영 프로젝트인지 확인하고 **Run**을 한 번 누른다.
5. Database의 Tables에서 `transactions`와 RLS 활성화를 확인한다.
6. Database의 Functions에서 `get_transaction_summary`를 확인한다.
7. 그다음 애플리케이션 기능 브랜치를 `main`에 병합하고 Vercel 배포를 확인한다.

## 통계 마이그레이션 적용

거래 가계부 마이그레이션 적용이 끝난 프로젝트에서
`supabase/migrations/202608260003_statistics.sql`을 SQL Editor에 한 번 실행합니다.
이 마이그레이션은 로그인 사용자의 RLS를 그대로 적용하는 기간별·분류별 집계 함수를 추가합니다.
앱 코드 병합과 Vercel 재배포보다 먼저 실행해야 합니다.

실행 후 아래 확인 쿼리의 두 값이 모두 `true`인지 확인합니다.

```sql
select
  to_regprocedure('public.get_period_statistics(uuid,date[],date[])') is not null
    as period_statistics_exists,
  to_regprocedure('public.get_category_statistics(uuid,date,date,transaction_type)') is not null
    as category_statistics_exists;
```

두 번째와 세 번째 SQL도 같은 프로젝트에서 반복 실행하지 않는다. `type already exists`나 `relation already exists` 같은 오류가
발생했을 때 전체 파일을 다시 실행하지 말고, 먼저 Tables와 Functions에서 적용 여부를 확인한다.

## 설정 마이그레이션 적용

통계 마이그레이션까지 적용된 프로젝트에서 앱 설정 코드 병합 전에
`supabase/migrations/202608270004_settings.sql`을 SQL Editor에 한 번 실행한다.
이 마이그레이션은 분류명의 앞뒤 공백을 정리하고 공백·대소문자만 다른 중복을 데이터베이스에서 차단하며,
장부 소유자가 한 유형의 전체 분류 순서를 원자적으로 바꾸는 함수를 추가한다.

실행 후 아래 값이 `true`인지 확인한다.

```sql
select to_regprocedure('public.set_category_order(uuid,transaction_type,uuid[])') is not null
  as category_order_function_exists;
```

기존 데이터에 `식비`와 `식비 `처럼 정리 후 같은 이름이 되는 분류가 있으면 마이그레이션이 안전하게 중단된다.
이 경우 중복 분류를 먼저 정리한 뒤 다시 실행한다. 그 밖의 실행 중 오류는 전체 파일을 다시 실행하기 전에
Database의 Functions에서 `set_category_order` 존재 여부를 먼저 확인한다.

## 공동 장부 마이그레이션 적용

설정 마이그레이션까지 적용된 프로젝트에서 공동 장부 코드 배포 전에
`supabase/migrations/202608270005_shared_ledgers.sql`을 SQL Editor에 한 번 실행한다.
이 마이그레이션은 앱 내부 초대, 구성원 변경, 탈퇴·삭제 후 개인 장부 복구 함수와 RLS를 추가한다.

실행 후 아래 값이 모두 `true`인지 확인한다.

```sql
select
  to_regclass('public.ledger_invitations') is not null
    as ledger_invitations_exists,
  to_regprocedure('public.create_shared_ledger(text)') is not null
    as create_shared_ledger_exists,
  to_regprocedure('public.respond_to_ledger_invitation(uuid,text)') is not null
    as invitation_response_exists,
  to_regprocedure('public.get_transaction_creator_profiles(uuid,uuid[])') is not null
    as transaction_creator_profiles_exists;
```

`resolve_invitation_target(text)`는 비공개 로그인 식별자를 읽으므로 `service_role`에만 실행 권한이 있다.
브라우저와 일반 장부·거래·통계 요청에는 `SUPABASE_SECRET_KEY`를 사용하지 않는다.
같은 소유자의 장부 이름이 앞뒤 공백과 대소문자를 제외하고 중복되면 마이그레이션이 명확한 오류로 중단된다.
이 경우 중복 이름을 먼저 바꾼 뒤 전체 마이그레이션을 다시 실행한다.

## 연금 세액공제 마이그레이션 적용

공동 장부 마이그레이션까지 적용된 프로젝트에서 세금 기능 코드 배포 전에
`supabase/migrations/202608280006_pension_tax_credit.sql`을 SQL Editor에 한 번 실행한다.
이 마이그레이션은 장부별 연금저축·IRP 시스템 분류, 개인 과세연도 설정 RLS,
본인 작성 연금 납입 요약·페이지 조회 함수를 추가한다.

실행 후 아래 값이 모두 `true`인지 확인한다.

```sql
select
  to_regclass('public.user_tax_profiles') is not null as tax_profiles_exists,
  to_regprocedure('public.get_my_pension_tax_summary(integer)') is not null as summary_rpc_exists,
  to_regprocedure('public.get_my_pension_contributions(integer,integer,date,timestamp with time zone,uuid)') is not null as list_rpc_exists,
  count(*) filter (where system_code = 'pension_savings') > 0 as pension_categories_exist,
  count(*) filter (where system_code = 'irp') > 0 as irp_categories_exist
from public.categories;
```

기존 지출 분류명이 앞뒤 공백과 대소문자를 제외하고 `연금저축` 또는 `IRP`와 일치하면
그 분류를 유지한 채 시스템 코드를 연결한다. 일치하는 분류가 없는 장부에만 새 분류를 만든다.
운영 적용 전에는 호스팅된 개발 Supabase의 SQL Editor에서 위 확인 쿼리를 실행하고,
Task 7의 호스팅 검증 단계에서 `tests/db/007_pension_tax_credit.test.sql` 계약을 확인한다.

### 세금 기능 배포 순서

1. 전용 개발 Supabase에 여섯 번째 마이그레이션을 한 번 적용한다.
2. 위 확인 쿼리를 SQL Editor에서 실행해 다섯 열이 모두 `true`인지 확인한다.
3. 개발 프로젝트에서만 `private.project_settings.allow_destructive_e2e`를 잠시 `true`로 바꾸고,
   프로젝트 ref·URL·키를 명시한 상태로 `npm run test:e2e -- tests/e2e/tax.spec.ts`를 실행한다.
4. 검증 직후 개발 프로젝트의 `allow_destructive_e2e`를 다시 `false`로 바꾼다.
5. 운영 Supabase의 프로젝트 이름과 ref를 다시 확인한 뒤 여섯 번째 마이그레이션을 한 번 적용하고,
   같은 확인 쿼리의 다섯 열이 모두 `true`인지 확인한다. 운영 프로젝트의 파괴적 E2E 표시는 켜지 않는다.
6. Vercel의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`이 해당 운영 프로젝트와 도메인을 가리키는지 확인한다.
7. 마이그레이션 확인이 끝난 다음 세금 기능 코드를 배포하고 Vercel에서 새 Production 배포를 실행한다.
   이전 빌드를 단순 승격하지 말고 현재 환경변수로 다시 빌드한다.
8. 배포된 사이트에서 로그인 후 세금 탭, 연금저축·IRP 프리셋, 가계부와 통계 합계를
   비파괴적으로 확인한다.

## 거래 휴지통 마이그레이션 적용

연금 세액공제 마이그레이션까지 적용된 프로젝트에서 휴지통 화면 코드 배포 전에
`supabase/migrations/202609010007_transaction_trash.sql`을 SQL Editor에 한 번 실행한다.
이 마이그레이션은 장부 소유자 전용 삭제 거래 조회·복원·영구 삭제 RPC를 추가한다.

실행 후 아래 확인 쿼리의 함수 존재, 로그인 역할 실행 권한, `transactions` RLS가 모두
`true`이고 직접 `delete` 권한은 `false`인지 확인한다.

```sql
select
  to_regprocedure('public.get_deleted_transactions(uuid,timestamp with time zone,uuid,integer)') is not null
    as deleted_transactions_rpc_exists,
  to_regprocedure('public.restore_deleted_transaction(uuid)') is not null
    as restore_deleted_transaction_rpc_exists,
  to_regprocedure('public.permanently_delete_transaction(uuid)') is not null
    as permanently_delete_transaction_rpc_exists,
  has_function_privilege('authenticated', 'public.get_deleted_transactions(uuid,timestamp with time zone,uuid,integer)', 'execute')
    as authenticated_can_list_trash,
  has_function_privilege('authenticated', 'public.restore_deleted_transaction(uuid)', 'execute')
    as authenticated_can_restore_trash,
  has_function_privilege('authenticated', 'public.permanently_delete_transaction(uuid)', 'execute')
    as authenticated_can_permanently_delete_trash,
  not has_function_privilege('anon', 'public.get_deleted_transactions(uuid,timestamp with time zone,uuid,integer)', 'execute')
    as anon_cannot_list_trash,
  not has_table_privilege('authenticated', 'public.transactions', 'delete')
    as authenticated_cannot_directly_delete_transactions,
  (select relrowsecurity from pg_class where oid = 'public.transactions'::regclass)
    as transactions_rls_enabled;
```

휴지통 RPC는 개인 장부와 공동 장부 모두 소유자만 사용할 수 있다. 일반 구성원과 관계없는
사용자가 삭제 거래의 존재를 알아낼 수 없도록 복원·영구 삭제는 권한이 없거나 대상이 없을 때
같은 `missing` 결과를 반환한다. SQL Editor에서 마이그레이션 적용 후 소유자 계정으로 조회·복원을,
일반 구성원 계정으로 조회 거부를 각각 확인한 다음 애플리케이션 코드를 배포한다.
삭제된 거래는 장부 소유자가 복원하거나 영구 삭제할 때까지 기간 제한 없이 보관된다. 자동 만료나
자동 영구 삭제는 제공하지 않는다.

### 휴지통 기능 배포 순서

1. 전용 개발 Supabase의 SQL Editor에서 일곱 번째 마이그레이션을 한 번 적용한다.
2. 위 확인 쿼리를 실행해 함수 존재·`authenticated` 실행 권한·RLS·직접 `delete` 권한 차단이 모두 `true`인지 확인한다.
3. 소유자 계정으로 삭제 거래 조회와 복원을, 일반 구성원 계정으로 휴지통 조회 거부를 수동으로 확인한다.
4. 개발 프로젝트에서만 `allow_destructive_e2e`를 잠시 `true`로 바꾸고, 프로젝트 ref·URL·키를 명시한 상태로 `npm run test:e2e -- --project=desktop-chromium --project=mobile-chromium tests/e2e/ledger.spec.ts`를 실행한다. 검증 직후 표시는 다시 `false`로 바꾼다.
5. 운영 Supabase의 프로젝트 이름과 ref를 다시 확인한 뒤 일곱 번째 마이그레이션을 한 번 적용하고, 위 확인 쿼리와 소유자·일반 구성원 확인을 반복한다. 운영 프로젝트의 파괴적 E2E 표시는 켜지 않는다.
6. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`이 운영 대상인지 확인한 뒤, 휴지통 기능을 포함한 현재 빌드를 Vercel에서 새 Production 배포로 다시 빌드·배포한다.

휴지통에는 CSV 내보내기나 CSV 가져오기 기능을 제공하지 않는다.

로컬에 Docker 또는 Supabase CLI가 없으면 `supabase test db`를 대신할 수 없으므로, 위 확인
쿼리를 대상 프로젝트의 SQL Editor에서 직접 실행한 결과를 배포 기록에 남긴다. 이 경로는
스키마 항목의 존재를 확인하는 수동 검증이며, 전용 개발 프로젝트의 호스팅 E2E를 운영에서
실행해도 된다는 뜻이 아니다.

### 계산 범위와 공식 근거

현재 앱은 **2026년 근로소득자 연금계좌 세액공제만** 계산한다. 다른 과세연도,
종합소득자 규칙, 의료비·교육비·월세 공제는 이번 범위에 포함하지 않는다. 화면의 예상 절세액은
입력한 총급여와 PockeLog의 연금저축·IRP 지출을 적용한 운영상 예상치다. 실제 공제·환급액은
결정세액, 다른 공제 항목, 납입금의 적격 여부와 세법 변경에 따라 달라질 수 있으며 앱이 이를
보장하지 않는다.

- [소득세법 제59조의3](https://law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900470390)
- [국세청 근로소득 연금계좌 세액공제 안내](https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875&mi=6596)

## Auth 설정

- 초기 개발 중에는 **Confirm email**을 끈다.
- Site URL은 로컬에서 `http://localhost:3000`, 운영 전에는 Vercel 운영 주소로 변경한다.
- Redirect URLs에는 로컬의 `http://localhost:3000/auth/callback`과 Vercel 주소의 `/auth/callback`을 추가한다.

## 이번 마이그레이션이 만드는 항목

- 공개 프로필과 비공개 전화번호 프로필
- 비공개 아이디·이메일 로그인 식별자
- 개인 장부, 장부 소유자 멤버십, 기본 수입·지출 분류 15개
- 가입 자동 초기화 트리거
- 본인 및 장부 구성원 기준 RLS 정책
- 서버 비밀키만 호출 가능한 아이디 로그인 이메일 조회 함수

두 번째 마이그레이션은 다음을 추가한다.

- 수입·지출 거래와 안정적인 무한 스크롤용 인덱스
- 장부·분류·유형 일치 및 휴지통 상태 무결성 트리거
- 장부 소유자와 일반 구성원의 거래 권한을 구분하는 RLS
- 삭제되지 않은 거래만 계산하는 기간 합계 함수

세 번째 마이그레이션은 다음을 추가한다.

- 최근 정산 기간들의 수입·지출·차액을 한 번에 계산하는 집계 함수
- 선택 기간과 유형을 분류별로 합산하는 집계 함수
- 로그인 사용자의 기존 장부 RLS를 그대로 적용하는 실행 권한

네 번째 마이그레이션은 다음을 추가한다.

- 소유자만 호출할 수 있는 분류 순서 일괄 변경 함수
- 누락·중복·다른 장부·다른 유형 분류가 섞인 순서 입력 거부
- 로그인 사용자의 기존 장부·분류 RLS를 그대로 적용하는 실행 권한

다섯 번째 마이그레이션은 다음을 추가한다.

- 공동 장부 생성과 기본 분류 초기화 함수
- 기존 가입자 대상 7일짜리 앱 내부 초대와 초대 RLS
- 초대 수락·거절·취소, 구성원 제거, 나가기, 공동 장부 삭제 함수
- 접근권한 상실 시 사용자의 개인 장부로 기본 장부를 복구하는 트리거
- 서비스 역할만 호출할 수 있는 초대 대상 식별 함수

여섯 번째 마이그레이션은 다음을 추가한다.

- 이름 변경과 비활성화에도 유지되는 장부별 연금저축·IRP 시스템 분류
- 본인만 조회·추가·변경·삭제할 수 있는 과세연도별 총급여 설정
- 현재 또는 이전 장부의 본인 작성 활성 지출만 계산하는 연금 납입 요약
- 탈퇴한 장부명을 숨기고 거래 권한을 함께 반환하는 안정적인 페이지 조회 함수

일곱 번째 마이그레이션은 다음을 추가한다.

- 장부 소유자만 읽을 수 있는 삭제 거래 페이지 조회 함수와 51번째 sentinel 행
- 삭제 시각·삭제자를 함께 비우는 소유자 전용 복원 함수
- 직접 테이블 삭제 권한 없이 삭제 거래만 제거하는 소유자 전용 영구 삭제 함수

`tests/db/`의 pgTAP 테스트는 추후 Docker 또는 CI 기반 Supabase 테스트 환경을 추가할 때 실행한다.
현재 방식에서는 전용 개발 Supabase에 일곱 마이그레이션을 적용한 뒤 파괴적 E2E 안전 표시를
켠 경우에만 `tests/e2e/ledger.spec.ts`, `tests/e2e/statistics.spec.ts`, `tests/e2e/settings.spec.ts`,
`tests/e2e/shared-ledgers.spec.ts`, `tests/e2e/tax.spec.ts`를 실행한다. 공동 장부와 세금 시나리오는 두 계정을 생성해 초대·거래·작성자 분리를 확인하고,
안전 표시를 다시 검증한 뒤 테스트 계정을 삭제한다. 운영 프로젝트의
`private.project_settings.allow_destructive_e2e`는 항상 `false`로 유지한다.
