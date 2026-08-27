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
세부 순서와 확인 항목은 `docs/supabase-setup.md`에 정리되어 있습니다.

초기 개발 중 이메일 인증을 끄면 가입 직후 개인 장부로 이동합니다. 이메일 인증을
켠 경우에는 Supabase Auth URL 설정에 운영 도메인의 `/auth/callback`을 허용해야 합니다.

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
만들고 거래·통계·설정·공동 장부를 변경하는 E2E는 다섯 번째 마이그레이션까지 적용한 전용 개발 Supabase에서만
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
공동 장부 E2E는 두 테스트 계정을 만든 뒤 안전 표시를 다시 확인하고 계정을 삭제합니다.

제품 설계와 구현 계획은 `docs/superpowers/`에서 관리합니다.
