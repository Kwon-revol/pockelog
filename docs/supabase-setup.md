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

두 번째 SQL도 같은 프로젝트에서 반복 실행하지 않는다. `type already exists`와 같은 오류가
발생했을 때 전체 파일을 다시 실행하지 말고, 먼저 Tables와 Functions에서 적용 여부를 확인한다.

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

`tests/db/`의 pgTAP 테스트는 추후 Docker 또는 CI 기반 Supabase 테스트 환경을 추가할 때 실행한다.
현재 방식에서는 전용 개발 Supabase에 두 마이그레이션을 적용한 뒤 파괴적 E2E 안전 표시를
켠 경우에만 `tests/e2e/ledger.spec.ts`를 실행한다. 운영 프로젝트의
`private.project_settings.allow_destructive_e2e`는 항상 `false`로 유지한다.
