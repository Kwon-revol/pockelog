# PockeLog 통계 탭 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자가 장부 정산 기준일에 맞춘 최근 12개 기간의 수입·지출·차액을 보고, 기간을 선택해 분류별 비율과 원본 거래를 확인하는 반응형 통계 탭을 구현한다.

**Architecture:** 기간 경계는 기존 한국 시간 기준 순수 함수에서 계산하고, 합계는 로그인 사용자의 RLS를 통과하는 `security invoker` Postgres RPC 두 개가 집계한다. Next.js 서버 컴포넌트가 월별/상세 첫 화면을 읽고, 상세 거래는 기존 거래 커서 API와 공용 무한 스크롤 훅을 재사용한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Supabase PostgreSQL/RLS, Vitest, Testing Library, pgTAP, Playwright

**Spec:** `docs/superpowers/specs/2026-08-26-pocketlog-design.md`

## Global Constraints

- 모든 수정은 `D:\myProject\pockelog\.worktrees\statistics` 안에서만 수행한다.
- 통계는 서비스 역할 키가 아니라 로그인 사용자 세션과 기존 RLS로 조회한다.
- 휴지통 거래는 모든 통계와 원본 목록에서 제외한다.
- 정산 시작일은 `1~28` 또는 `null`(말일)이며 한국 시간 달력을 사용한다.
- 금액은 원 단위 양의 정수로 저장하고 합계는 `bigint`에서 안전한 JavaScript 숫자로 변환한다.
- 모바일과 PC 모두 동일한 정보와 자동 추가 조회 동작을 제공한다.
- 통계 기능은 기존 가계부 등록·수정 동작을 변경하지 않는다.

---

### Task 1: 정산 기간 도메인

**Files:**
- Modify: `src/features/transactions/period.ts`
- Create: `src/features/statistics/types.ts`
- Create: `tests/unit/statistics-domain.test.ts`

**Interfaces:**
- Consumes: 기존 `getLedgerPeriod(now, startDay)`와 `formatDate(date)`.
- Produces: `listLedgerPeriods(now, startDay, count): StatisticsPeriod[]`, `getLedgerPeriodFromStart(startOn, startDay): StatisticsPeriod | null`, `StatisticsPeriod`, `PeriodSummary`, `CategorySummary`, `StatisticsOverviewData`, `StatisticsDetailData`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
expect(listLedgerPeriods(new Date("2026-08-26T12:00:00+09:00"), 10, 3)).toEqual([
  { key: "2026-08-10", startOn: "2026-08-10", endOn: "2026-09-09", endExclusive: "2026-09-10" },
  { key: "2026-07-10", startOn: "2026-07-10", endOn: "2026-08-09", endExclusive: "2026-08-10" },
  { key: "2026-06-10", startOn: "2026-06-10", endOn: "2026-07-09", endExclusive: "2026-07-10" },
]);
expect(getLedgerPeriodFromStart("2026-02-28", null)?.endExclusive).toBe("2026-03-31");
expect(getLedgerPeriodFromStart("2026-02-27", null)).toBeNull();
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run tests/unit/statistics-domain.test.ts`
Expected: 새 함수와 타입이 없어 FAIL.

- [ ] **Step 3: 최소 구현**

`period.ts`에 UTC 달력 연산만 사용하는 기간 역산 함수와 목록 함수를 추가한다. `periodStartDay=null`이면 시작일이 실제 월말인지 검증하고 다음 월말을 종료 경계로 사용한다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- --run tests/unit/statistics-domain.test.ts tests/unit/transactions-domain.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/features/transactions/period.ts src/features/statistics/types.ts tests/unit/statistics-domain.test.ts
git commit -m "기능: 통계 정산 기간 도메인 추가"
```

### Task 2: 통계 집계 RPC와 RLS 계약

**Files:**
- Create: `supabase/migrations/202608260003_statistics.sql`
- Create: `tests/db/004_statistics.test.sql`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: `transactions`, `categories`, `transaction_type`, `is_ledger_member(uuid)`.
- Produces: `get_period_statistics(uuid,date[],date[])`, `get_category_statistics(uuid,date,date,transaction_type)`.

- [ ] **Step 1: 실패하는 pgTAP 계약 작성**

```sql
select is(
  (select expense_total from public.get_period_statistics(
    tests.get_ledger_id('user_a'), array['2026-08-01'::date], array['2026-09-01'::date]
  )),
  12000::bigint,
  '기간별 지출을 집계한다'
);

select is(
  (select amount_total from public.get_category_statistics(
    tests.get_ledger_id('user_a'), '2026-08-01', '2026-09-01', 'expense'
  ) order by amount_total desc limit 1),
  12000::bigint,
  '분류별 지출을 집계한다'
);
```

타 사용자 장부는 0행, 휴지통 거래는 제외, 기간 순서는 입력 배열의 ordinality 유지, 비활성 분류의 기존 거래는 포함하는 assertion도 독립 작성한다.

- [ ] **Step 2: 실패 확인**

Run: `supabase test db tests/db/004_statistics.test.sql`
Expected: RPC가 없어 FAIL. 로컬 Supabase가 없으면 SQL 계약 파일을 작성하고 전체 검증 단계에서 호스팅 적용 절차를 명시한다.

- [ ] **Step 3: 최소 RPC 구현**

`get_period_statistics`는 동일 길이의 시작/종료 배열을 `unnest ... with ordinality`로 묶고 삭제되지 않은 거래를 left join해 0원 기간도 반환한다. `get_category_statistics`는 선택 유형의 거래를 분류별로 합산하고 금액이 있는 행만 반환한다. 두 함수 모두 `security invoker`, 빈 `search_path`, authenticated 실행 권한만 사용한다.

- [ ] **Step 4: SQL 계약 확인**

Run: `supabase test db tests/db/004_statistics.test.sql`
Expected: PASS 또는 로컬 Docker 미사용 사유와 Supabase SQL Editor 검증 쿼리를 문서화.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/202608260003_statistics.sql tests/db/004_statistics.test.sql docs/supabase-setup.md
git commit -m "데이터베이스: 기간별 및 분류별 통계 집계 추가"
```

### Task 3: 통계 조회 변환과 서버 쿼리

**Files:**
- Create: `src/features/statistics/query-utils.ts`
- Create: `src/features/statistics/queries.ts`
- Modify: `src/features/transactions/queries.ts`
- Create: `tests/unit/statistics-query.test.ts`

**Interfaces:**
- Consumes: `listLedgerPeriods`, `getLedgerPeriodFromStart`, `resolveTransactionContext`, Supabase RPC 결과, 기존 거래 필터/커서 페이지.
- Produces: `toPeriodSummaries(rows, periods)`, `toCategorySummaries(rows, total)`, `getStatisticsOverviewData(now?)`, `getStatisticsDetailData(periodKey,type)`, `getInitialTransactionPageForCurrentUser(filters)`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
expect(toPeriodSummaries([
  { period_ordinal: 1, income_total: "3000000", expense_total: "800000" },
], periods)[0]).toMatchObject({ incomeTotal: 3000000, expenseTotal: 800000, balance: 2200000 });

expect(toCategorySummaries([
  { category_id: "food", category_name: "식비", category_color: "#F97316", amount_total: "30000", sort_order: 1 },
], 40000)[0].ratio).toBe(75);
```

0원, 동률 정렬, 잘못된 기간 키, 잘못된 `type`, 인증 없음, RPC 오류를 각각 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run tests/unit/statistics-query.test.ts`
Expected: 모듈이 없어 FAIL.

- [ ] **Step 3: 최소 구현**

개요는 최근 12개 경계를 배열로 RPC에 전달한다. 상세는 기간 키가 현재 장부 기준일과 일치하는지 검증하고 기본 유형을 `expense`로 정규화한 뒤 분류 RPC와 첫 거래 50건을 병렬 조회한다. 데이터베이스 오류는 `StatisticsQueryError`, 세션 없음은 `StatisticsAuthenticationError`로 구분한다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- --run tests/unit/statistics-query.test.ts tests/unit/transactions-query.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/features/statistics/query-utils.ts src/features/statistics/queries.ts src/features/transactions/queries.ts tests/unit/statistics-query.test.ts
git commit -m "기능: 통계 개요와 상세 조회 흐름 추가"
```

### Task 4: 월별 통계 개요 화면

**Files:**
- Create: `src/features/statistics/overview-screen.tsx`
- Modify: `src/app/(app)/statistics/page.tsx`
- Create: `tests/unit/statistics-ui.test.tsx`

**Interfaces:**
- Consumes: `StatisticsOverviewData`.
- Produces: 서버 렌더링되는 최근 12개 정산 기간 카드와 `/statistics/[period-key]` 링크.

- [ ] **Step 1: 실패 UI 테스트 작성**

```tsx
render(<StatisticsOverviewScreen data={overviewFixture} />);
expect(screen.getByText("수입 3,000,000원")).toBeVisible();
expect(screen.getByText("지출 800,000원")).toBeVisible();
expect(screen.getByRole("link", { name: /8월 10일.*9월 9일/ })).toHaveAttribute(
  "href", "/statistics/2026-08-10"
);
```

큰 금액을 100%로 둔 비교 막대, 0원 `기록 없음`, 음수 차액 표현을 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run tests/unit/statistics-ui.test.tsx`
Expected: 컴포넌트가 없어 FAIL.

- [ ] **Step 3: 최소 반응형 화면 구현**

모바일은 세로 카드, PC는 넓은 카드 그리드로 표시한다. 각 카드에 기간, 수입, 지출, 차액, 두 비교 막대를 제공하고 색상만으로 의미를 전달하지 않도록 텍스트 레이블을 유지한다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- --run tests/unit/statistics-ui.test.tsx`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/features/statistics/overview-screen.tsx src/app/'(app)'/statistics/page.tsx tests/unit/statistics-ui.test.tsx
git commit -m "기능: 월별 통계 개요 화면 구현"
```

### Task 5: 분류 상세와 원본 거래 자동 조회

**Files:**
- Create: `src/features/transactions/use-transaction-pages.ts`
- Modify: `src/features/transactions/ledger-screen.tsx`
- Modify: `src/features/transactions/transaction-list.tsx`
- Create: `src/features/statistics/detail-screen.tsx`
- Create: `src/app/(app)/statistics/[periodKey]/page.tsx`
- Modify: `tests/unit/transactions-ui.test.tsx`
- Modify: `tests/unit/statistics-ui.test.tsx`

**Interfaces:**
- Consumes: `StatisticsDetailData`, 기존 `/api/transactions` 커서 API, `TransactionList`.
- Produces: `useTransactionPages(initialPage, filters, loadPage?)`, 읽기 전용 거래 목록 모드, 수입/지출 전환 상세 화면.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
render(<StatisticsDetailScreen initialData={detailFixture} loadPage={loadPage} />);
expect(screen.getByRole("heading", { name: "분류별 지출" })).toBeVisible();
expect(screen.getByText("식비")).toBeVisible();
expect(screen.getByText("75%")).toBeVisible();
expect(screen.getByRole("link", { name: "수입" })).toHaveAttribute("href", "?type=income");
expect(screen.getByRole("region", { name: "거래 내역" })).toBeVisible();
```

IntersectionObserver 진입 시 다음 페이지 1회 호출, 응답 전 중복 방지, 마지막 페이지 완료 문구 없음, 읽기 전용 행 클릭 시 수정 패널 미노출을 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run tests/unit/statistics-ui.test.tsx tests/unit/transactions-ui.test.tsx`
Expected: 상세 컴포넌트와 공용 훅이 없어 FAIL.

- [ ] **Step 3: 최소 구현**

기존 `LedgerScreen`의 누적 페이지/observer 로직을 공용 훅으로 이동해 동작을 보존한다. `TransactionList`는 `onEdit`이 없으면 button/클릭 가능한 row가 아닌 읽기 전용 마크업을 사용한다. 상세 화면은 분류별 금액·비율 막대 아래 동일 기간/유형 거래를 자동 추가 조회한다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- --run tests/unit/statistics-ui.test.tsx tests/unit/transactions-ui.test.tsx`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/features/transactions/use-transaction-pages.ts src/features/transactions/ledger-screen.tsx src/features/transactions/transaction-list.tsx src/features/statistics/detail-screen.tsx src/app/'(app)'/statistics/'[periodKey]'/page.tsx tests/unit/transactions-ui.test.tsx tests/unit/statistics-ui.test.tsx
git commit -m "기능: 분류별 통계 상세와 자동 거래 조회 구현"
```

### Task 6: 통계 E2E, 문서, 전체 검증

**Files:**
- Create: `tests/e2e/statistics.spec.ts`
- Modify: `README.md`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: 완성된 통계 마이그레이션과 화면.
- Produces: 배포 순서와 PC/모바일 통계 회귀 검증.

- [ ] **Step 1: 실패 E2E 작성**

호스팅 개발 Supabase 안전 변수가 있을 때 테스트 사용자를 만들고 수입·지출을 입력한다. 통계 개요에서 합계를 확인하고 기간 상세에서 지출 분류 비율과 원본 거래를 PC/모바일 모두 확인한다. 안전 변수가 없으면 기존 `requireHostedE2E` 규칙으로 skip한다.

- [ ] **Step 2: 실패 또는 안전 skip 확인**

Run: `npm run test:e2e -- tests/e2e/statistics.spec.ts`
Expected: 마이그레이션 미적용 환경에서는 명확히 FAIL, 안전 변수 없는 기본 환경에서는 skip.

- [ ] **Step 3: 적용 문서 완성**

`202608260003_statistics.sql`을 앱 코드 병합 전에 SQL Editor에서 한 번 실행하고 함수 존재·RLS 결과를 확인하도록 순서를 기록한다. 동일 SQL 재실행 시 already exists 오류가 날 수 있으므로 검증 쿼리와 단회 실행 원칙을 함께 적는다.

- [ ] **Step 4: 전체 검증**

Run:

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
```

Expected: 단위 테스트, 타입, 린트, 프로덕션 빌드 모두 PASS. 기본 E2E는 공개 시나리오 PASS, 호스팅 변경 시나리오는 안전 변수에 따라 PASS 또는 의도된 skip.

- [ ] **Step 5: 최종 커밋**

```bash
git add README.md docs/supabase-setup.md tests/e2e/statistics.spec.ts
git commit -m "검증: 통계 탭 통합 검증 및 배포 문서 추가"
```

## 계획 자체 검토

- 설계의 최근 12개 기간, 정산 기준일, 수입·지출·차액, 비교 막대, 분류별 비율, 원본 거래를 모두 Task 1~5에 연결했다.
- 통계 RPC는 RLS와 휴지통 제외를 DB 계약으로 검증하며 서비스 역할 키를 사용하지 않는다.
- 상세 거래 자동 조회는 기존 API를 재사용해 가계부와 통계의 조회 규칙이 갈라지지 않는다.
- `TBD`, `TODO`, 구현 주체가 해석해야 하는 빈 단계가 없다.
- 모든 프로덕션 변경은 선행 실패 테스트와 개별 통과 확인을 가진다.
