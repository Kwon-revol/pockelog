# Supabase 프로젝트 적용

현재 개발 방식은 Docker 없이 호스팅된 Supabase 프로젝트를 사용한다.

## 최초 스키마 적용

1. Supabase Dashboard에서 PockeLog 프로젝트를 연다.
2. 왼쪽 메뉴에서 **SQL Editor**를 선택한다.
3. **New query**를 선택한다.
4. `supabase/migrations/202608260001_initial_auth_and_ledgers.sql` 전체를 붙여 넣는다.
5. 대상 프로젝트가 PockeLog의 새 프로젝트인지 다시 확인한 뒤 **Run**을 누른다.

이 SQL은 최초 적용용이므로 같은 프로젝트에서 반복 실행하지 않는다. 이후 변경은 새 번호의 마이그레이션 파일로 추가한다.

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

`tests/db/`의 pgTAP 테스트는 추후 Docker 또는 CI 기반 Supabase 테스트 환경을 추가할 때 실행한다.
