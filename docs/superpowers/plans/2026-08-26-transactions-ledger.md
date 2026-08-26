# PockeLog 거래 가계부 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자가 자신의 기본 장부에서 거래를 등록·조회·검색·수정·휴지통 이동하고 기간 합계를 확인하는 반응형 가계부를 구현한다.

**Architecture:** Next.js 서버 컴포넌트가 첫 화면 데이터를 읽고 서버 액션이 변경을 처리한다. Supabase 사용자 세션과 RLS가 최종 권한 경계이며, 순수 도메인 함수와 게이트웨이 기반 워크플로를 분리해 외부 DB 없이도 핵심 동작을 단위 테스트한다. 추가 목록은 세 키 커서와 Route Handler를 사용해 50건씩 불러오며 IntersectionObserver로 PC와 모바일 모두 자동 조회한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Supabase Auth/Postgres/RLS, Zod 4, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-08-26-transactions-ledger-design.md`

## Global Constraints

- 제품명은 `PockeLog`, 시간대는 `Asia/Seoul`, 통화는 `KRW`다.
- 거래 금액은 원 단위 양의 정수이며 DB에는 `bigint`로 저장한다.
- 기본 정산 시작일은 장부의 `period_start_day`이고 종료일은 서버 쿼리에서 다음 날 미만으로 처리한다.
- 첫 페이지와 추가 페이지는 각각 최대 50건이다.
- 정렬 키는 `occurred_on`, `created_at`, `id`이며 최신순과 오래된순을 모두 지원한다.
- PC와 모바일 모두 목록 끝 감지 시 자동 조회하며 `더 보기` 버튼을 제공하지 않는다.
- 마지막 페이지에서는 감시만 중단하고 `모든 내역을 확인했어요` 같은 완료 문구를 표시하지 않는다.
- 일반 목록과 합계는 `deleted_at is null`인 거래만 포함한다.
- 브라우저에 `SUPABASE_SECRET_KEY`를 노출하지 않는다.
- 운영에 이미 적용한 `202608260001_initial_auth_and_ledgers.sql`은 수정하지 않는다.
- 비밀번호 찾기, 휴지통 복원·영구 삭제, 통계 화면, 분류 관리 UI는 이번 범위에 포함하지 않는다.

---

## 파일 구조

- `src/features/transactions/types.ts`: 거래·분류·요약·페이지·필터 공용 타입.
- `src/features/transactions/period.ts`: 정산 기간과 포함 종료일 변환.
- `src/features/transactions/schemas.ts`: URL과 폼 입력 검증·정규화.
- `src/features/transactions/cursor.ts`: 안정적인 세 키 커서 인코딩·디코딩.
- `src/features/transactions/workflows.ts`: 인증된 거래 등록·수정·휴지통 워크플로.
- `src/features/transactions/supabase-gateway.ts`: 사용자 세션 Supabase CRUD와 목록·요약 조회.
- `src/features/transactions/queries.ts`: 기본 장부를 기준으로 첫 화면 데이터 구성.
- `src/features/transactions/actions.ts`: 서버 액션 어댑터와 `/ledger` 재검증.
- `src/features/transactions/transaction-form.tsx`: 추가·수정 패널과 필드 오류.
- `src/features/transactions/transaction-list.tsx`: 반응형 목록과 무한 스크롤.
- `src/features/transactions/ledger-screen.tsx`: 기간 요약·필터·목록·패널 상태 조합.
- `src/app/(app)/ledger/page.tsx`: 비동기 `searchParams`를 읽는 서버 페이지.
- `src/app/api/transactions/route.ts`: 인증된 커서 페이지 JSON 응답.
- `supabase/migrations/202608260002_transactions.sql`: 거래 테이블, 트리거, RLS, grants, 집계 RPC.
- `tests/unit/transactions-*.test.ts[x]`: 도메인·워크플로·UI 회귀 테스트.
- `tests/db/003_transactions.test.sql`: 거래 무결성·권한·휴지통·집계 계약.
- `tests/e2e/ledger.spec.ts`: 실제 사용 흐름과 반응형 목록 검증.

### Task 1: 거래 도메인과 조회 규칙

**Files:**
- Create: `src/features/transactions/types.ts`
- Create: `src/features/transactions/period.ts`
- Create: `src/features/transactions/schemas.ts`
- Create: `src/features/transactions/cursor.ts`
- Test: `tests/unit/transactions-domain.test.ts`

**Interfaces:**
- Consumes: `period_start_day: number | null`, URL `Record<string, string | string[] | undefined>`, 폼 `FormData`.
- Produces: `getLedgerPeriod(now: Date, startDay: number | null): { startOn: string; endOn: string; endExclusive: string }`, `normalizeTransactionFilters(input, defaults): TransactionFilters`, `transactionFormSchema`, `encodeCursor(cursor): string`, `decodeCursor(value): TransactionCursor | null`.

- [ ] **Step 1: 기간 경계를 잡는 실패 테스트를 작성한다.**

```ts
expect(getLedgerPeriod(new Date("2028-02-29T03:00:00+09:00"), 10)).toEqual({
  startOn: "2028-02-10",
  endOn: "2028-03-09",
  endExclusive: "2028-03-10",
});
expect(getLedgerPeriod(new Date("2026-08-31T12:00:00+09:00"), null)).toEqual({
  startOn: "2026-08-31",
  endOn: "2026-09-29",
  endExclusive: "2026-09-30",
});
```

Run: `npm test -- --run tests/unit/transactions-domain.test.ts`
Expected: 모듈이 없어 FAIL.

- [ ] **Step 2: `Asia/Seoul` 달력 날짜만 사용하는 기간 함수를 구현하고 테스트를 PASS시킨다.**

1~28은 이번 또는 직전 시작일에서 다음 달 같은 날 미만으로 계산한다. `null`은 현재 또는 직전 월말에서 다음 월말 미만으로 계산하며 윤년과 연도 경계를 포함한다.

- [ ] **Step 3: 필터·폼·커서 실패 테스트를 추가한다.**

```ts
expect(normalizeTransactionFilters({ type: "invalid", q: "  점심  " }, defaults)).toMatchObject({ type: "all", query: "점심" });
expect(transactionFormSchema.safeParse({ type: "expense", occurredOn: "2026-08-26", description: "점심", amount: "0", categoryId: crypto.randomUUID(), memo: "" }).success).toBe(false);
expect(decodeCursor(encodeCursor({ occurredOn: "2026-08-26", createdAt: "2026-08-26T01:02:03.000Z", id: "11111111-1111-4111-8111-111111111111" }))).toEqual({ occurredOn: "2026-08-26", createdAt: "2026-08-26T01:02:03.000Z", id: "11111111-1111-4111-8111-111111111111" });
```

Run: `npm test -- --run tests/unit/transactions-domain.test.ts`
Expected: 새 입력 규칙이 없어 FAIL.

- [ ] **Step 4: 공용 타입, Zod 스키마, URL 정규화와 URL-safe 커서를 구현한다.**

`TransactionFilters`는 `startOn`, `endOn`, `endExclusive`, `query`, `type`, `categoryId`, `sort`를 가진다. 폼은 설명 trim 1~100자, 메모 trim 최대 500자, 양의 안전 정수 금액, UUID 분류와 멱등성 키를 보장한다. 커서는 JSON을 UTF-8 base64url로 만들고 잘못된 값에는 `null`을 반환한다.

- [ ] **Step 5: 도메인 테스트 전체를 PASS시키고 `기능: 거래 도메인 규칙 추가`로 커밋한다.**

### Task 2: 거래 데이터베이스와 보안 경계

**Files:**
- Create: `supabase/migrations/202608260002_transactions.sql`
- Create: `tests/db/003_transactions.test.sql`

**Interfaces:**
- Consumes: 기존 `transaction_type`, `ledgers`, `ledger_members`, `categories`, `is_ledger_member()`, `is_ledger_owner()`.
- Produces: `public.transactions`, `private.validate_transaction()`, `public.get_transaction_summary(uuid,date,date)`.

- [ ] **Step 1: pgTAP 계약 테스트를 먼저 작성한다.**

```sql
select throws_ok(
  $$ insert into public.transactions (ledger_id,type,occurred_on,description,amount,category_id,created_by,idempotency_key)
     values (tests.get_ledger_id('user_a'),'expense','2026-08-26','잘못된 분류',1000,tests.get_income_category_id('user_a'),tests.get_supabase_uid('user_a'),gen_random_uuid()) $$,
  'P0001',
  'transaction category type mismatch',
  '수입 분류로 지출을 만들 수 없다'
);
```

동일 멱등성 키 거부, 다른 장부 분류 거부, 타 사용자 조회 차단, 소유자 CRUD, 일반 멤버 본인 행만 수정, 휴지통 제외와 RPC 합계를 각각 독립 assertion으로 작성한다.

Run when hosted test database is available: `supabase test db tests/db/003_transactions.test.sql`
Expected before migration: `relation public.transactions does not exist`로 FAIL. 로컬 Docker를 사용하지 않는 현재 운영 방식에서는 SQL Editor 적용 직후 같은 계약을 실행한다.

- [ ] **Step 2: 거래 테이블·인덱스·수정 시각 트리거를 구현한다.**

`amount bigint check (amount > 0)`, 설명과 메모 길이, `(ledger_id,idempotency_key)` unique, 일반 목록 partial index를 포함한다.

- [ ] **Step 3: 데이터 무결성 트리거를 구현한다.**

트리거는 분류의 장부·유형·활성 상태, 생성자의 `auth.uid()`, 삭제 시각/사용자 쌍을 검사한다. 비활성 분류를 유지한 채 설명·금액만 바꾸는 것은 허용하되 유형 또는 분류를 바꾸는 경우 활성 조합만 허용한다.

- [ ] **Step 4: RLS와 열 단위 grants를 구현한다.**

구성원은 삭제되지 않은 행만 조회하고, 소유자는 장부의 모든 일반 행을, 일반 구성원은 자신이 만든 일반 행만 변경한다. `ledger_id`, `created_by`, `created_at`, `idempotency_key`는 update grant에서 제외한다.

- [ ] **Step 5: `security invoker` 집계 RPC와 execute grant를 구현한다.**

반환 열은 `income_total bigint`, `expense_total bigint`, `balance bigint`이며 `[start_on,end_exclusive)`와 `deleted_at is null`을 적용한다.

- [ ] **Step 6: SQL 문법·diff를 점검하고 `데이터베이스: 거래 및 합계 정책 추가`로 커밋한다.**

Run: `git diff --check && rg -n "enable row level security|security invoker|deleted_at is null" supabase/migrations/202608260002_transactions.sql`
Expected: whitespace 오류가 없고 세 보안 조건이 확인됨. 실제 권한 동작 PASS는 배포 전 호스팅된 Supabase 계약 실행에서 확인한다.

### Task 3: 조회·변경 워크플로와 Supabase 어댑터

**Files:**
- Create: `src/features/transactions/workflows.ts`
- Create: `src/features/transactions/supabase-gateway.ts`
- Create: `src/features/transactions/queries.ts`
- Test: `tests/unit/transactions-workflows.test.ts`

**Interfaces:**
- Consumes: Task 1의 스키마·필터·커서와 사용자 세션 Supabase 클라이언트.
- Produces: `TransactionGateway`, `createTransaction(input,gateway)`, `updateTransaction(id,input,gateway)`, `trashTransaction(id,gateway)`, `getLedgerPageData(searchParams)`, `getTransactionPage(filters,cursor)`.

- [ ] **Step 1: 성공·검증 실패·권한 실패 워크플로 테스트를 작성한다.**

```ts
await expect(createTransaction(validInput, gateway)).resolves.toEqual({ status: "success" });
await expect(updateTransaction(otherUsersId, validInput, gateway)).resolves.toEqual({ status: "error", message: "이 내역을 변경할 수 없습니다." });
await expect(trashTransaction(missingId, gateway)).resolves.toEqual({ status: "error", message: "이 내역을 변경할 수 없습니다." });
```

가짜 게이트웨이는 실제 반환 구조 전체를 구현하고 결과 상태를 검사하며, 호출 횟수 자체를 성공 조건으로 삼지 않는다.

Run: `npm test -- --run tests/unit/transactions-workflows.test.ts`
Expected: 워크플로 모듈이 없어 FAIL.

- [ ] **Step 2: `TransactionGateway`와 검증·오류 매핑 워크플로를 최소 구현한다.**

게이트웨이는 `getSessionContext`, `create`, `update`, `trash`를 제공한다. 모든 변경은 세션과 기본 장부를 서버에서 다시 확인하고, 중복 멱등성 키는 성공으로 반환한다.

- [ ] **Step 3: Supabase 변경 어댑터를 구현한다.**

클라이언트가 보낸 장부 ID를 쓰지 않고 기본 장부 ID를 사용한다. update와 trash는 대상 ID와 기본 장부 ID를 함께 조건에 넣고, RLS 또는 0행 변경을 공통 권한 메시지로 매핑한다.

- [ ] **Step 4: 조회 어댑터의 필터와 양방향 커서 테스트를 추가한다.**

최신순은 마지막 키보다 작은 행, 오래된순은 큰 행만 이어 받아야 하며 내용·메모 검색, 유형, 분류, 날짜 범위를 함께 유지한다. 51건을 요청해 앞 50건과 다음 커서를 반환하는 동작을 검증한다.

- [ ] **Step 5: 기본 장부·활성 분류·목록·RPC 요약 조회를 구현한다.**

목록은 분류 `id,name,color,type`을 조인하고 `limit(51)`로 다음 페이지 여부를 계산한다. 첫 화면은 기본 장부가 없으면 명시적 오류, 세션이 없으면 로그인 redirect가 가능하도록 결과를 구분한다.

- [ ] **Step 6: 단위 테스트와 타입 검사를 PASS시키고 `기능: 거래 조회 및 변경 흐름 추가`로 커밋한다.**

### Task 4: 서버 액션과 추가 페이지 API

**Files:**
- Create: `src/features/transactions/actions.ts`
- Create: `src/app/api/transactions/route.ts`
- Test: `tests/unit/transactions-route.test.ts`

**Interfaces:**
- Consumes: `createTransaction`, `updateTransaction`, `trashTransaction`, `getTransactionPage`.
- Produces: `createTransactionAction(previousState,formData)`, `updateTransactionAction(id,previousState,formData)`, `trashTransactionAction(id)`, `GET(request)`.

- [ ] **Step 1: Route Handler 입력과 응답 계약 실패 테스트를 작성한다.**

```ts
expect(await requestPage("?cursor=broken")).toMatchObject({ status: 400 });
expect(await requestPage("?start=2026-08-01&end=2026-08-31&sort=newest")).toMatchObject({ status: 200, body: { items: expect.any(Array), nextCursor: null } });
```

Run: `npm test -- --run tests/unit/transactions-route.test.ts`
Expected: route 계약이 없어 FAIL.

- [ ] **Step 2: 인증·필터 검증 후 JSON을 반환하는 GET Route Handler를 구현한다.**

잘못된 입력은 400, 세션 없음은 401, 예상 가능한 조회 실패는 403/500으로 최소 정보만 반환한다. 응답은 `{ items, nextCursor }`만 공개한다.

- [ ] **Step 3: 서버 액션을 구현한다.**

각 액션은 외부 입력을 다시 검증하고 워크플로를 호출한다. 성공 시 `revalidatePath("/ledger")` 후 직렬화 가능한 `{ status, message?, fieldErrors? }`를 반환한다.

- [ ] **Step 4: Route Handler 테스트·전체 단위 테스트·타입 검사를 PASS시키고 `기능: 거래 서버 액션과 페이지 API 추가`로 커밋한다.**

### Task 5: 반응형 가계부 화면과 무한 스크롤

**Files:**
- Create: `src/features/transactions/transaction-form.tsx`
- Create: `src/features/transactions/transaction-list.tsx`
- Create: `src/features/transactions/ledger-screen.tsx`
- Modify: `src/app/(app)/ledger/page.tsx`
- Test: `tests/unit/transactions-ui.test.tsx`

**Interfaces:**
- Consumes: `LedgerPageData`, 세 서버 액션, `/api/transactions` 페이지 응답.
- Produces: 기간 필터·요약 카드·PC 표·모바일 카드·추가/수정 패널·자동 페이지 누적 화면.

- [ ] **Step 1: 화면의 핵심 사용자 동작 실패 테스트를 작성한다.**

```tsx
render(<LedgerScreen initialData={fixture} loadPage={loadPage} />);
expect(screen.getByText("총 지출").nextSibling).toHaveTextContent("46,500원");
await user.click(screen.getByRole("button", { name: "내역 추가" }));
expect(screen.getByRole("dialog", { name: "내역 추가" })).toBeVisible();
```

모바일·PC 표현, 유형 변경 시 분류 초기화, 제출 중 버튼 잠금, 수정 패널, 삭제 확인, 빈 상태를 각각 관찰 가능한 동작으로 검사한다.

Run: `npm test -- --run tests/unit/transactions-ui.test.tsx`
Expected: UI 모듈이 없어 FAIL.

- [ ] **Step 2: 요약·필터·빈 상태·목록의 정적 UI를 구현한다.**

PC `lg` 이상은 표, 모바일은 날짜별 카드이며 동일 데이터를 중복 렌더링하되 CSS로 표시를 전환한다. 금액은 `Intl.NumberFormat("ko-KR")`로 표시하고 지출은 `-`, 수입은 `+` 기호를 붙인다.

- [ ] **Step 3: 추가·수정·휴지통 패널을 구현한다.**

모바일은 하단 패널, PC는 우측 패널로 같은 form을 사용한다. HTML 기본 검증과 `useActionState` 서버 오류를 함께 표시하고 실패 시 값을 유지한다. 모바일 추가 버튼은 하단 탭 위에 고정한다.

- [ ] **Step 4: IntersectionObserver 실패 테스트를 작성한다.**

감지 지점이 보일 때 한 번만 요청하고 응답 전 중복 호출하지 않으며, 다음 커서가 `null`이면 observer를 해제하고 완료 문구를 렌더링하지 않아야 한다. 필터가 바뀌면 누적 항목과 커서를 첫 페이지 값으로 되돌린다.

- [ ] **Step 5: 자동 무한 스크롤을 구현한다.**

첫 50건 뒤 sentinel을 관찰해 `/api/transactions`를 요청한다. 로딩 중에는 작은 진행 상태만, 실패 시 `다시 시도` 버튼만 표시한다. 마지막 페이지는 sentinel 관찰을 중단하고 아무 완료 문구도 추가하지 않는다.

- [ ] **Step 6: URL 필터 form과 Next.js 16 비동기 `searchParams` 서버 페이지를 구현한다.**

페이지는 `const query = await searchParams` 후 `getLedgerPageData(query)`를 호출한다. GET form으로 기간·검색·유형·분류·정렬을 URL에 보존하고, 화면 데이터는 클라이언트 컴포넌트에 직렬화 가능한 값만 전달한다.

- [ ] **Step 7: UI 테스트·전체 단위 테스트·타입 검사를 PASS시키고 `기능: 반응형 거래 가계부 화면 구현`으로 커밋한다.**

### Task 6: 통합 검증과 배포 안내

**Files:**
- Create: `tests/e2e/ledger.spec.ts`
- Modify: `docs/supabase-setup.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: 완성된 거래 마이그레이션과 가계부 화면.
- Produces: 반복 가능한 운영 적용 순서와 PC·모바일 회귀 시나리오.

- [ ] **Step 1: 거래 E2E 시나리오를 먼저 작성한다.**

로그인 fixture를 사용해 지출 등록 → 합계 확인 → 수입 등록 → 잔액 확인 → 수정 → 휴지통 이동을 검사한다. 51건 fixture가 허용된 비운영 환경에서만 자동 추가 조회를 검증하고, 안전장치가 꺼져 있으면 destructive 시나리오는 skip한다.

- [ ] **Step 2: 운영 적용 문서를 갱신한다.**

`202608260002_transactions.sql`을 Supabase SQL Editor에서 앱 코드 병합 전에 한 번 실행하고, SQL 계약 결과와 Vercel 환경변수를 확인한 다음 배포하도록 정확한 순서를 기록한다.

- [ ] **Step 3: 전체 품질 게이트를 한 번에 실행한다.**

Run:

```powershell
npm test -- --run
npm run typecheck
npm run lint
$env:NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example_for_build_only'
$env:NEXT_PUBLIC_APP_URL='http://localhost:3000'
npm run build
npm run test:e2e
```

Expected: 단위 테스트, TypeScript, ESLint, 프로덕션 빌드, 비파괴 E2E가 모두 PASS. 실제 DB 거래 E2E는 두 번째 마이그레이션 적용 후 실행한다.

- [ ] **Step 4: `git diff --check`와 비밀키 노출 검사를 실행한다.**

Run: `git diff --check && rg -n "SUPABASE_SECRET_KEY" src --glob "*.tsx" --glob "*.ts"`
Expected: whitespace 오류 없음. 비밀 키는 기존 서버 전용 환경·관리자 모듈 밖의 클라이언트 파일에서 발견되지 않음.

- [ ] **Step 5: 통합 검증 중 발견된 결함마다 재현 실패 테스트를 먼저 추가한 뒤 수정한다.**

각 결함은 실패 이유를 확인하고 최소 수정 후 해당 테스트와 전체 품질 게이트를 다시 실행한다.

- [ ] **Step 6: 최종 변경을 `검증: 거래 가계부 통합 검증 완료`로 커밋한다.**

## 실행 방식

사용자가 이 대화에서 개발 시작을 명시했으므로 별도 선택 질문 없이 Inline Execution으로 진행한다. `superpowers:executing-plans`와 `superpowers:using-git-worktrees`를 적용하고, 사용자가 요청한 대로 기능을 묶어서 구현한 뒤 통합 검증 결과를 한 번에 정리한다.
