# PockeLog

혼자 또는 여러 사용자가 개인·공동 장부를 관리하는 반응형 가계부입니다. Next.js App Router로 만들고 Vercel에 배포하며, 인증과 데이터는 Supabase를 사용합니다.

## 로컬 실행

Node.js 20.9 이상과 npm이 필요합니다.

```bash
npm install
copy .env.example .env.local
npm run dev
```

`.env.local`에 다음 값을 입력합니다.

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: 브라우저용 publishable key
- `SUPABASE_SECRET_KEY`: 서버 전용 secret key
- `NEXT_PUBLIC_APP_URL`: 로컬에서는 `http://localhost:3000`, 운영에서는 Vercel 도메인

실제 키가 들어 있는 `.env*` 파일은 Git에 커밋하지 않습니다.

## 앱 설치(PWA)

운영 사이트를 HTTPS로 열면 Android와 PC의 Chromium 계열 브라우저에서 브라우저가
제공하는 설치 메뉴로 PockeLog를 설치할 수 있습니다. iPhone과 iPad에서는 Safari의
공유 메뉴에서 `홈 화면에 추가`를 선택합니다. 앱 내부에는 별도 설치 버튼을 두지 않습니다.

설치 앱은 standalone 창으로 `/ledger`에서 시작합니다. 공개 앱 아이콘과 Next.js의
버전이 붙은 정적 번들만 오프라인 캐시에 저장하며, 로그인·가계부·통계·설정·API 응답은
캐시하지 않으므로 인터넷 연결이 필요합니다.

아이콘 원본을 변경한 뒤 다음 명령으로 설치 아이콘을 다시 생성합니다.

```bash
npm run icons:generate
```

## Supabase 초기 설정

Docker는 필요하지 않습니다. 새 Supabase 프로젝트의 SQL Editor에서
`supabase/migrations/202608260001_initial_auth_and_ledgers.sql`을 먼저 한 번 실행하세요.
기존 프로젝트에는 앱 코드 배포 전에
`supabase/migrations/202608260002_transactions.sql`을 한 번 실행해야 합니다.
통계 기능을 배포하기 전에는 이어서
`supabase/migrations/202608260003_statistics.sql`을 한 번 실행해야 합니다.
설정 기능을 배포하기 전에는 이어서
`supabase/migrations/202608270004_settings.sql`을 한 번 실행해야 합니다.
공동 장부 기능을 배포하기 전에는 마지막으로
`supabase/migrations/202608270005_shared_ledgers.sql`을 한 번 실행해야 합니다.
연금 세액공제 기능을 배포하기 전에는 이어서
`supabase/migrations/202608280006_pension_tax_credit.sql`을 한 번 실행해야 합니다.
거래 휴지통 기능을 배포하기 전에는 마지막으로
`supabase/migrations/202609010007_transaction_trash.sql`을 한 번 실행해야 합니다.
계정 프로필 설정 기능을 배포하기 전에는 이어서
`supabase/migrations/202609020008_account_profile_settings.sql`을 한 번 실행해야 합니다.
세부 순서와 확인 항목은 `docs/supabase-setup.md`에 정리되어 있습니다.

초기 개발 중 이메일 인증을 끄면 가입 직후 개인 장부로 이동합니다. 이메일 인증을
켠 경우에는 Supabase Auth URL 설정에 운영 도메인의 `/auth/callback`을 허용해야 합니다.
비밀번호 재설정 메일은 Supabase의 Reset password 템플릿을 `token_hash` 콜백 형식으로
설정해야 하며, 정확한 URL과 템플릿은 `docs/supabase-setup.md`에 정리되어 있습니다.
Supabase 기본 메일 서버는 프로젝트 팀 이메일로만 시험할 수 있으므로 일반 사용자에게
메일을 보내려면 별도 SMTP 설정이 필요합니다.

## 계정 프로필 설정

`설정`에서 로그인한 본인은 사용자명과 전화번호만 수정할 수 있으며 가입 이메일과 로그인
아이디는 바꿀 수 없습니다. 공동 장부의 일반 구성원도 자신의 프로필은 수정할 수 있지만,
다른 구성원의 프로필이나 장부 설정은 변경할 수 없습니다. 비밀번호 변경에는 현재 비밀번호가
필요하고, 성공하면 모든 기기의 로그인 세션이 종료되므로 새 비밀번호로 다시 로그인해야 합니다.

## 연금 세액공제 사용

`세금` 탭에서 2026년 총급여를 저장한 뒤 `연금저축 추가` 또는 `IRP 추가`를 누르면
가계부의 지출 입력 화면에 해당 시스템 분류가 미리 선택됩니다. 이 분류로 저장한 지출은
별도 세금용 사본을 만들지 않고 세금 탭의 납입액·예상 세액공제와 일반 가계부·지출 통계에
동시에 반영됩니다. 가계부에서 금액을 수정하거나 휴지통으로 이동하면 세금 탭에도 같은
변경이 반영됩니다.

현재 계산은 2026년 근로소득자 연금계좌 세액공제만 지원합니다. 화면의 금액은 입력한
총급여와 PockeLog 지출을 바탕으로 한 예상치이며, 실제 공제 또는 환급을 보장하지 않습니다.
결정세액, 다른 공제 항목, 납입금의 적격 여부와 세법 변경에 따라 실제 결과가 달라질 수
있습니다. 공식 근거는 [소득세법 제59조의3](https://law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900470390)과
[국세청 근로소득 연금계좌 세액공제 안내](https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875&mi=6596)를 확인하세요.

## Vercel 배포

Vercel 프로젝트에는 네 환경변수를 등록하고 `NEXT_PUBLIC_APP_URL`만 배포 주소로
바꿉니다. 공개 키와 URL은 Production/Preview에 둘 수 있지만,
`SUPABASE_SECRET_KEY`는 절대 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 환경변수를
바꾼 뒤에는 새 배포를 실행해야 적용됩니다.

## 품질 검사

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run test:e2e
```

`npm run test:e2e`는 기본적으로 로그인·회원가입 공개 화면만 검사합니다. 실제 계정을
만들고 거래·통계·설정·프로필·비밀번호·공동 장부·세금·휴지통 정보를 변경하는 E2E는 여덟 번째 마이그레이션까지 적용한 전용 개발 Supabase에서만
아래 값을 추가해 실행하세요.

```dotenv
E2E_ALLOW_HOSTED_SUPABASE=1
E2E_SUPABASE_PROJECT_REF=your-development-project-ref
```

프로젝트 ref와 `NEXT_PUBLIC_SUPABASE_URL`의 호스트가 다르면 테스트는 즉시 중단됩니다.
추가로 개발 프로젝트 SQL Editor에서 아래 값을 명시적으로 켠 경우에만 계정을 만듭니다.

```sql
update private.project_settings
set allow_destructive_e2e = true
where singleton = true;
```

이 값은 운영 프로젝트에서는 항상 `false`로 유지하세요. 테스트 가입 직후 앱 화면을
확인하므로 개발 프로젝트에서는 이메일 확인도 꺼야 합니다.
프로필·비밀번호 E2E는 본인 저장값 새로고침, 공동 장부 참여자의 본인 프로필 변경, 이전·새 비밀번호 재로그인을 PC와 모바일에서 확인합니다.
공동 장부와 세금 E2E는 두 테스트 계정을 만든 뒤 안전 표시를 다시 확인하고 계정을 삭제합니다.
세금 E2E는 PC·모바일 프로젝트에서 프리셋 입력, 가계부·통계 합계, 편집·휴지통·복원,
공동 장부 작성자 분리와 추가 페이지 로딩을 확인합니다. 안전 환경변수나 데이터베이스 표시가
없으면 호스팅 데이터를 변경하지 않고 명시적으로 건너뜁니다. 휴지통 E2E는 거래를 추가한 뒤
삭제·복원·재삭제·영구 삭제를 PC와 모바일에서 확인합니다.

제품 설계와 구현 계획은 `docs/superpowers/`에서 관리합니다.
