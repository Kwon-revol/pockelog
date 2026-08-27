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

`tests/db/`의 pgTAP 테스트는 추후 Docker 또는 CI 기반 Supabase 테스트 환경을 추가할 때 실행한다.
현재 방식에서는 전용 개발 Supabase에 다섯 마이그레이션을 적용한 뒤 파괴적 E2E 안전 표시를
켠 경우에만 `tests/e2e/ledger.spec.ts`, `tests/e2e/statistics.spec.ts`, `tests/e2e/settings.spec.ts`,
`tests/e2e/shared-ledgers.spec.ts`를 실행한다. 공동 장부 시나리오는 두 계정을 생성해 초대·거래·탈퇴를 확인하고,
안전 표시를 다시 검증한 뒤 테스트 계정을 삭제한다. 운영 프로젝트의
`private.project_settings.allow_destructive_e2e`는 항상 `false`로 유지한다.
