# PockeLog Foundation and Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배포 가능한 Next.js 기반과 Supabase 인증을 구축하여 사용자가 가입·로그인하고 자동 생성된 개인 장부의 앱 셸에 진입하게 한다.

**Architecture:** Next.js App Router의 서버 액션과 쿠키 기반 Supabase 세션을 사용한다. 가입 데이터는 `auth.users` 트리거가 원자적으로 만들며, 공개 키는 브라우저에서 쓰고 비밀 키는 아이디 조회용 서버 모듈에만 격리한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Auth/Postgres/RLS, Zod, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-08-26-pocketlog-design.md`

## Global Constraints

- 제품명 `PockeLog`, 시간대 `Asia/Seoul`, 통화 `KRW`를 사용한다.
- 가입은 아이디, 비밀번호/확인, 사용자명, 이메일, 전화번호를 받는다.
- 아이디는 4~20자 영문 소문자·숫자·밑줄, 비밀번호는 8자 이상, 사용자명은 1~30자다.
- 로그인은 아이디 또는 이메일을 받고 계정 존재 여부를 노출하지 않는다.
- 가입 직후 프로필, 개인 장부, 소유자 멤버십, 기본 분류를 DB 트리거 한 건으로 생성한다.
- 공개 테이블은 RLS를 활성화하고 식별자는 `private` 스키마에 둔다.
- 브라우저 공개 값은 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`뿐이다.
- `SUPABASE_SECRET_KEY`는 서버 전용 모듈에서만 읽는다.
- 이메일 확인은 초기에는 선택이지만 `/auth/callback`은 구현한다.
- 모바일 하단 탭과 PC 좌측 메뉴를 갖는 반응형 셸을 만든다.

---

## File Map

- `src/app/*`: App Router 화면, 레이아웃, 콜백, 전역 스타일.
- `src/features/auth/*`: 인증 스키마, 서버 액션, 폼.
- `src/features/ledgers/queries.ts`: 기본 장부 조회.
- `src/shared/config/*`: 제품 상수와 환경 검증.
- `src/shared/supabase/*`: 브라우저·서버·관리자 클라이언트와 세션 갱신.
- `src/shared/ui/*`: 폼 요소와 앱 셸.
- `supabase/migrations/*`: 스키마, 가입 트리거, grants, RLS.
- `tests/unit/*`, `tests/db/*`, `tests/e2e/*`: 계층별 회귀 테스트.

### Task 1: 프로젝트 기반과 품질 게이트

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`
- Create: `.env.example`, `.gitignore`, `README.md`
- Test: `tests/unit/smoke.test.ts`

**Interfaces:**
- Consumes: 네 환경변수와 Vercel 배포 요구사항.
- Produces: `dev`, `lint`, `typecheck`, `test`, `build`, `test:e2e` npm 명령.

- [ ] **Step 1: 공식 스캐폴드로 TypeScript, App Router, Tailwind, ESLint, `src/` 구조를 만든다.**

Run: `npx create-next-app@latest . --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --use-npm`
Expected: 기존 `docs/`를 보존하며 코드가 생성된다.

- [ ] **Step 2: 실패하는 제품명 smoke test를 작성한다.**

```ts
import { expect, test } from "vitest";
test("public product name", () => expect("PocketLog").toBe("PockeLog"));
```

Run: `npm test -- --run tests/unit/smoke.test.ts`
Expected: 이름 불일치로 FAIL.

- [ ] **Step 3: `PRODUCT_NAME = "PockeLog"`와 metadata를 구현한다.**

Run: `npm test -- --run tests/unit/smoke.test.ts && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: `.env.example`과 실행 문서를 작성한다.**

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 5: `git commit -m "chore: scaffold PockeLog application"`로 커밋한다.**

### Task 2: 인증 입력 도메인과 환경 경계

**Files:**
- Create: `src/shared/config/product.ts`, `src/shared/config/env.ts`
- Create: `src/shared/domain/phone.ts`, `src/features/auth/schemas.ts`
- Test: `tests/unit/phone.test.ts`, `tests/unit/auth-schemas.test.ts`

**Interfaces:**
- Consumes: Task 1의 테스트 설정.
- Produces: `normalizePhone(value: string): string`, `signupSchema`, `loginSchema`, `publicEnv`, `getServerEnv()`.

- [ ] **Step 1: 정규화와 입력 검증 실패 테스트를 작성한다.**

```ts
expect(normalizePhone("010-1234-5678")).toBe("01012345678");
expect(signupSchema.safeParse({ loginId: "ABC", password: "short" }).success).toBe(false);
expect(loginSchema.parse({ identifier: " User@Example.com ", password: "password1" }).identifier).toBe("user@example.com");
```

Run: `npm test -- --run tests/unit/phone.test.ts tests/unit/auth-schemas.test.ts`
Expected: 모듈 부재로 FAIL.

- [ ] **Step 2: 전화번호 함수와 Zod 스키마를 구현한다.**

```ts
export const normalizePhone = (value: string) => value.replace(/\D/g, "");
export const loginIdSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{4,20}$/);
```

비밀번호 확인, 이메일 소문자화, 사용자명 trim, 전화번호 숫자화와 빈 값 거부를 포함한다.

- [ ] **Step 3: 공개 환경과 `import "server-only"` 비밀 환경을 분리한다.**

```ts
export function getServerEnv() {
  return serverSchema.parse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
}
```

- [ ] **Step 4: 단위 테스트와 타입 검사를 실행해 PASS를 확인한다.**

- [ ] **Step 5: `git commit -m "feat: validate authentication inputs"`로 커밋한다.**

### Task 3: Supabase 초기 스키마와 가입 초기화

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608260001_initial_auth_and_ledgers.sql`
- Create: `tests/db/001_signup_bootstrap.test.sql`, `tests/db/002_initial_rls.test.sql`

**Interfaces:**
- Consumes: Auth 메타데이터 `login_id`, `display_name`, `phone_normalized`.
- Produces: `profiles`, `user_private_profiles`, `private.account_identifiers`, `ledgers`, `ledger_members`, `categories`, `handle_new_user()`.

- [ ] **Step 1: 가입 초기화 pgTAP 실패 테스트를 작성한다.**

```sql
select tests.create_supabase_user('user_a', 'a@example.com', '{"login_id":"user_a","display_name":"사용자 A","phone_normalized":"01012345678"}'::jsonb);
select is((select count(*) from public.ledgers where owner_id=tests.get_supabase_uid('user_a')), 1::bigint, '개인 장부 한 개');
```

Run: `supabase test db tests/db/001_signup_bootstrap.test.sql`
Expected: 스키마 부재로 FAIL.

- [ ] **Step 2: 계정·장부·멤버십·분류 테이블, enum, 고유 인덱스와 CHECK 제약을 구현한다.**

개인 장부는 사용자당 하나, 로그인 아이디와 이메일은 대소문자 구분 없이 고유, 기준일은 1~28 또는 `null`이다.

- [ ] **Step 3: `security definer set search_path = ''` 가입 트리거를 구현한다.**

```sql
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare new_ledger_id uuid := gen_random_uuid();
begin
  insert into private.account_identifiers(user_id, login_id, email_normalized)
  values (new.id, lower(new.raw_user_meta_data->>'login_id'), lower(new.email));
  return new;
end; $$;
```

실제 함수에는 프로필, 개인 장부, 소유자 멤버십, 기본 수입 5개·지출 10개 분류 삽입을 모두 포함한다.

- [ ] **Step 4: 타인 개인 장부 차단 테스트를 먼저 추가한 뒤 grants와 RLS를 구현한다.**

```sql
select tests.authenticate_as('user_b');
select is_empty($$ select * from public.ledgers where owner_id=tests.get_supabase_uid('user_a') $$, '타인 장부 차단');
```

- [ ] **Step 5: `supabase db reset && supabase test db`를 통과시키고 `git commit -m "feat: bootstrap users and personal ledgers"`로 커밋한다.**

### Task 4: Supabase 세션 클라이언트와 경로 보호

**Files:**
- Create: `src/shared/supabase/browser.ts`, `server.ts`, `admin.ts`, `middleware.ts`
- Create: `src/middleware.ts`
- Test: `tests/unit/auth-routing.test.ts`

**Interfaces:**
- Consumes: 환경 모듈과 Supabase 쿠키.
- Produces: `createBrowserClient()`, `createServerClient()`, `createAdminClient()`, `updateSession(request)`, `isPublicPath(path)`.

- [ ] **Step 1: `/login`, `/auth/callback`은 공개이고 `/ledger`는 보호 경로라는 실패 테스트를 작성한다.**
- [ ] **Step 2: `@supabase/ssr` 브라우저·서버 클라이언트와 쿠키 getAll/setAll 어댑터를 구현한다.**
- [ ] **Step 3: admin 클라이언트를 `server-only`, `persistSession: false`, `autoRefreshToken: false`로 격리한다.**
- [ ] **Step 4: 로그아웃 보호 경로는 `/login?next=...`, 로그인 인증 화면은 `/ledger`로 보내는 미들웨어를 구현한다.**
- [ ] **Step 5: 테스트·lint·typecheck를 통과시키고 `git commit -m "feat: add Supabase session middleware"`로 커밋한다.**

### Task 5: 회원가입, 로그인, 로그아웃과 콜백

**Files:**
- Create: `src/features/auth/actions.ts`, `login-form.tsx`, `signup-form.tsx`
- Create: `src/shared/ui/form-field.tsx`, `submit-button.tsx`
- Create: `src/app/(auth)/layout.tsx`, `login/page.tsx`, `signup/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Test: `tests/unit/auth-actions.test.ts`

**Interfaces:**
- Consumes: schema와 세 Supabase client factory.
- Produces: `signupAction(previousState, formData)`, `loginAction(previousState, formData)`, `logoutAction()`, callback GET.

- [ ] **Step 1: 잘못된 가입과 아이디 이메일 해석의 실패 테스트를 작성한다.**

```ts
expect(await signupAction(initialState, invalidFormData)).toMatchObject({ status: "error" });
expect(await resolveLoginEmail("user_a")).toBe("a@example.com");
```

- [ ] **Step 2: 정규화 데이터와 Auth metadata를 전달하는 가입 액션을 구현한다.**
- [ ] **Step 3: 이메일은 직접, 아이디는 서버 RPC로 해석해 `signInWithPassword()`를 호출하고 실패 메시지를 통일한다.**
- [ ] **Step 4: label, autocomplete, aria-describedby, 오류, 제출 잠금이 있는 폼과 안전한 `next`만 받는 콜백을 구현한다.**
- [ ] **Step 5: 테스트·lint·typecheck·build를 통과시키고 `git commit -m "feat: add signup and login flows"`로 커밋한다.**

### Task 6: 기본 장부 앱 셸

**Files:**
- Create: `src/features/ledgers/queries.ts`, `src/shared/ui/app-shell.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/ledger/page.tsx`, `statistics/page.tsx`, `tax-goals/page.tsx`, `settings/page.tsx`
- Test: `tests/unit/app-shell.test.tsx`

**Interfaces:**
- Consumes: 세션과 `default_ledger_id`.
- Produces: `getCurrentLedger()`, `AppShell({ledgerName, children})`.

- [ ] **Step 1: 네 탭 내비게이션을 요구하는 실패 컴포넌트 테스트를 작성한다.**
- [ ] **Step 2: 현재 사용자의 기본 장부를 조회하고 세션이 없으면 `/login`으로 보낸다.**
- [ ] **Step 3: 모바일 하단 탭, PC 좌측 메뉴, 장부명과 0원 요약, `첫 거래 추가` CTA를 구현한다.**
- [ ] **Step 4: 컴포넌트 테스트·lint·typecheck·build를 통과시킨다.**
- [ ] **Step 5: `git commit -m "feat: add responsive ledger shell"`로 커밋한다.**

### Task 7: E2E와 배포 검증

**Files:**
- Create: `tests/e2e/auth.spec.ts`, `tests/e2e/app-shell.spec.ts`
- Modify: `README.md`, `package.json`

**Interfaces:**
- Consumes: 로컬 Supabase와 Next.js 앱.
- Produces: 가입→개인 장부, 로그아웃→두 로그인 방식, 모바일/PC 셸 회귀 검증.

- [ ] **Step 1: 고유 계정 가입 후 `/ledger`를 확인하는 실패 E2E를 작성한다.**

```ts
await page.goto("/signup");
await page.getByLabel("아이디").fill(uniqueLoginId);
await page.getByLabel("이메일").fill(uniqueEmail);
await page.getByRole("button", { name: "가입하기" }).click();
await expect(page).toHaveURL(/\/ledger$/);
```

- [ ] **Step 2: 운영 Supabase URL이면 중단하는 보호 로직을 넣고 가입·아이디/이메일 로그인 E2E를 통과시킨다.**
- [ ] **Step 3: Chromium 모바일/데스크톱에서 하단 탭과 좌측 메뉴를 각각 검증한다.**
- [ ] **Step 4: `npm run lint && npm run typecheck && npm test -- --run && npm run build && npm run test:e2e`를 모두 통과시킨다.**
- [ ] **Step 5: 실제 비밀키가 Git에 없음을 검사하고 README의 마이그레이션·Vercel 절차를 `git commit -m "test: verify authentication vertical slice"`로 커밋한다.**

## Self-Review Record

- Coverage: 기반, 입력 검증, 가입 원자성, 개인 장부/기본 분류, 두 로그인 방식, 콜백, 세션, 반응형 셸, RLS와 계층별 테스트를 Task에 연결했다.
- Milestone boundary: 거래, 통계, 공동 장부, 절세 목표, 휴지통, CSV, PWA는 독립 검토 가능한 후속 수직 구간이다.
- Type consistency: 환경, client factory, schema, action, ledger query 이름을 File Map과 Interfaces에 고정했다.
