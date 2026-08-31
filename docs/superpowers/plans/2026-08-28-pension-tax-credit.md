# PockeLog 연금저축·IRP 예상 세액공제 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 근로소득자가 가계부의 연금저축·IRP 지출을 기반으로 2026년 납입 현황과 예상 세액공제 효과를 개인 세금 탭에서 확인하게 한다.

**Architecture:** 가계부 거래를 납입액의 단일 원본으로 유지하고 `categories.system_code`로 연금 분류를 안정적으로 식별한다. 본인 전용 Supabase RPC가 현재 또는 이전 장부의 본인 작성 거래만 집계·페이지 조회하며, TypeScript의 연도별 순수 규칙 모듈이 총급여와 납입액으로 예상 공제액을 계산한다. Next.js 서버 컴포넌트와 서버 액션은 개인 총급여를 RLS로 저장하고 반응형 클라이언트 화면에 계산 결과와 자동 조회 목록을 제공한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Supabase PostgreSQL/RLS, Zod 4, Vitest, Testing Library, pgTAP, Playwright

**Spec:** `docs/superpowers/specs/2026-08-28-pension-tax-credit-design.md`

## Global Constraints

- 모든 구현은 `D:\myProject\pockelog` 저장소에 만든 격리 worktree 안에서만 수행한다.
- 구현 기준선에는 공동 장부 완료 커밋 `61c90d1` 또는 그 커밋이 병합된 최신 `main`이 반드시 포함되어야 한다.
- 1차 계산 대상은 2026년 근로소득자의 연금저축·IRP뿐이다. 종합소득자, 의료비, 교육비, 월세, ISA 전환 추가 한도는 포함하지 않는다.
- 연금저축 인정 한도는 6,000,000원, 연금저축과 IRP 합계 인정 한도는 9,000,000원이다.
- 총급여 55,000,000원 이하는 소득세 공제율 15%, 초과는 12%를 적용하고 지방소득세 효과는 소득세 공제 예상액의 10%로 계산한다.
- 계산 결과는 실제 환급액이 아닌 예상 세액공제 및 예상 절세 효과로만 표현한다.
- 연금저축·IRP 거래는 일반 지출 및 월별 지출 통계에 그대로 포함한다.
- 총급여와 세금 계산 결과는 로그인 사용자 본인에게만 제공한다.
- 공동 장부에서는 `transactions.created_by = auth.uid()`인 거래만 본인 세금 탭에 집계한다.
- 공동 장부를 떠난 뒤에도 본인 작성 연금 거래는 세금 탭에서 읽기 전용으로 유지하고 장부명은 `이전 장부`로 표시한다.
- 분류 표시 이름이 변경되거나 비활성화돼도 `system_code`는 유지하며 세금 집계가 끊기지 않아야 한다.
- 목록은 PC와 모바일 모두 스크롤 자동 추가 조회를 사용하고 목록 종료 문구를 표시하지 않는다.
- 서비스 역할 키를 애플리케이션 요청 경로에서 사용하지 않는다.
- 사용자 요청에 따라 모든 구현 커밋 메시지는 한국어로 작성하고 저장소 로컬 Git 작성자 `kwon_revol <259511148+Kwon-revol@users.noreply.github.com>`를 유지한다.

---

### Task 1: 연금 분류 식별자와 개인 세금 데이터베이스 계약

**Files:**
- Create: `supabase/migrations/202608280006_pension_tax_credit.sql`
- Create: `tests/db/007_pension_tax_credit.test.sql`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: `public.categories`, `public.transactions`, `public.ledgers`, `public.ledger_members`, `public.is_ledger_member(uuid)`, 기존 거래 휴지통 규칙.
- Produces: `categories.system_code`, `public.user_tax_profiles`, `public.get_my_pension_tax_summary(integer)`, `public.get_my_pension_contributions(integer, integer, date, timestamptz, uuid)`.
- RPC 요약 행: `pension_paid bigint`, `irp_paid bigint`.
- RPC 목록 행: `id uuid`, `ledger_id uuid`, `ledger_name text`, `can_manage boolean`, `occurred_on date`, `description text`, `amount bigint`, `created_at timestamptz`, `category_name text`, `system_code text`.

- [ ] **Step 1: 격리 worktree에서 공동 장부 기준선 준비**

`superpowers:using-git-worktrees`로 `codex/tax-pension-credit` 전용 worktree를 만들고, 기준선에 `61c90d1`이 없다면 먼저 공동 장부 브랜치를 병합한다. 설계·계획 커밋 `de15f15`와 이 계획 커밋도 동일 브랜치에 포함한다.

Run:

```bash
git merge-base --is-ancestor 61c90d1 HEAD
git config --local user.name
git config --local user.email
```

Expected: 첫 명령 exit 0, 작성자는 `kwon_revol`, 이메일은 `259511148+Kwon-revol@users.noreply.github.com`.

- [ ] **Step 2: 실패하는 pgTAP 계약 작성**

`tests/db/007_pension_tax_credit.test.sql`에 다음 계약을 실제 사용자·개인 장부·공동 장부 fixture로 작성한다.

```sql
select has_column('public', 'categories', 'system_code');
select has_table('public', 'user_tax_profiles');
select has_function('public', 'get_my_pension_tax_summary', array['integer']);
select has_function(
  'public',
  'get_my_pension_contributions',
  array['integer', 'integer', 'date', 'timestamp with time zone', 'uuid']
);
```

추가 검증은 다음을 포함한다.

- 기존 장부에 `pension_savings`, `irp`가 각각 하나만 존재한다.
- 동일 장부에 같은 `system_code`를 추가하면 고유 제약으로 실패한다.
- authenticated 사용자가 `system_code`를 직접 변경하면 권한 오류가 난다.
- 본인 `user_tax_profiles` CRUD만 성공하고 타인 행은 보이지 않으며 변경되지 않는다.
- 개인 장부와 공동 장부의 본인 작성 활성 지출만 요약된다.
- 다른 사용자의 거래, 수입, 휴지통 거래는 제외된다.
- 장부 탈퇴 후에도 본인 거래는 목록에 남고 `ledger_name='이전 장부'`, `can_manage=false`다.
- 현재 구성원인 본인 거래는 실제 장부명과 기존 거래 권한에 맞는 `can_manage` 값을 반환한다.
- 페이지 커서는 `(occurred_on, created_at, id)` 내림차순으로 중복·누락 없이 이어진다.

- [ ] **Step 3: 데이터베이스 테스트가 실패하는지 확인**

Run: `supabase test db tests/db/007_pension_tax_credit.test.sql`

Expected: 새 열·테이블·함수가 없어서 FAIL. 로컬 Supabase CLI 또는 Docker가 없으면 실행 불가 사유를 기록하고 SQL 정적 검토 및 호스팅 검증 쿼리를 Task 7에서 수행한다.

- [ ] **Step 4: 멱등 마이그레이션 구현**

마이그레이션은 다음 핵심 구조를 구현한다.

```sql
alter table public.categories
  add column if not exists system_code text
  check (system_code is null or system_code in ('pension_savings', 'irp'));

create unique index if not exists categories_ledger_system_code_unique
  on public.categories (ledger_id, system_code)
  where system_code is not null;

create table if not exists public.user_tax_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year integer not null check (tax_year between 2000 and 2100),
  income_type text not null check (income_type = 'employment'),
  gross_salary bigint not null check (gross_salary >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tax_year)
);
```

기존 장부는 정규화한 이름이 일치하는 지출 분류에 내부 코드를 먼저 연결하고, 없는 코드만 `insert ... where not exists`로 생성한다. `private.handle_new_ledger()`의 기본 분류 삽입에도 두 코드를 추가한다. `categories`의 authenticated update 열 권한에는 `system_code`를 넣지 않는다.

두 RPC는 `security definer`, 빈 `search_path`, authenticated 전용 실행 권한을 사용하고 내부에서만 `auth.uid()`를 읽는다. 입력으로 사용자 ID를 받지 않는다. 목록 함수의 `ledger_name`은 현재 구성원일 때만 실제 이름을 반환한다.

- [ ] **Step 5: 데이터베이스 계약 통과 확인**

Run: `supabase test db tests/db/007_pension_tax_credit.test.sql`

Expected: PASS 또는 Task 3에서 기록한 환경 제약만 남음. `git diff --check`도 PASS.

- [ ] **Step 6: 적용 문서와 커밋**

`docs/supabase-setup.md`에 `202608280006_pension_tax_credit.sql` 적용 순서와 아래 확인 쿼리를 추가한다.

```sql
select
  to_regclass('public.user_tax_profiles') is not null as tax_profiles_exists,
  to_regprocedure('public.get_my_pension_tax_summary(integer)') is not null as summary_rpc_exists,
  to_regprocedure('public.get_my_pension_contributions(integer,integer,date,timestamp with time zone,uuid)') is not null as list_rpc_exists,
  count(*) filter (where system_code = 'pension_savings') > 0 as pension_categories_exist,
  count(*) filter (where system_code = 'irp') > 0 as irp_categories_exist
from public.categories;
```

```bash
git add supabase/migrations/202608280006_pension_tax_credit.sql tests/db/007_pension_tax_credit.test.sql docs/supabase-setup.md
git commit -m "데이터베이스: 연금 납입 집계와 개인 세금 설정 추가"
```

### Task 2: 2026년 연금 세액공제 순수 계산 모듈

**Files:**
- Create: `src/features/tax/types.ts`
- Create: `src/features/tax/rules.ts`
- Create: `src/features/tax/schemas.ts`
- Create: `tests/unit/tax-domain.test.ts`

**Interfaces:**
- Produces: `TaxCategoryCode`, `TaxRule`, `PensionTaxInput`, `PensionTaxResult`, `getTaxRule(year)`, `calculatePensionTaxBenefit(rule, input)`, `taxProfileFormSchema`.
- Consumes: 정수 원 단위 `grossSalary`, `pensionPaid`, `irpPaid`.

- [ ] **Step 1: 실패하는 계산 및 스키마 테스트 작성**

다음 표를 `it.each`로 고정한다.

```ts
it.each([
  [{ grossSalary: 55_000_000, pensionPaid: 6_000_000, irpPaid: 3_000_000 }, 1_350_000, 135_000, 1_485_000],
  [{ grossSalary: 55_000_001, pensionPaid: 6_000_000, irpPaid: 3_000_000 }, 1_080_000, 108_000, 1_188_000],
  [{ grossSalary: 40_000_000, pensionPaid: 9_000_000, irpPaid: 0 }, 900_000, 90_000, 990_000],
  [{ grossSalary: 40_000_000, pensionPaid: 0, irpPaid: 9_000_000 }, 1_350_000, 135_000, 1_485_000],
])("calculates the 2026 pension credit", (input, incomeTax, localTax, total) => {
  expect(calculatePensionTaxBenefit(getTaxRule(2026)!, input)).toMatchObject({
    incomeTaxCredit: incomeTax,
    localIncomeTaxEffect: localTax,
    estimatedTotalBenefit: total,
  });
});
```

`getTaxRule(2025)`와 `getTaxRule(2027)`는 `null`, 음수·소수·안전 정수 초과 입력은 검증 실패, `grossSalary="55,000,000"`은 55,000,000으로 정규화되는지 확인한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- --run tests/unit/tax-domain.test.ts`

Expected: `@/features/tax/rules`와 스키마가 없어 FAIL.

- [ ] **Step 3: 타입과 연도별 규칙 구현**

`types.ts`에 다음 핵심 계약을 정의한다.

```ts
export type TaxCategoryCode = "pension_savings" | "irp";
export type PensionTaxInput = { grossSalary: number; pensionPaid: number; irpPaid: number };
export type PensionTaxResult = {
  pensionPaid: number;
  irpPaid: number;
  pensionEligible: number;
  irpEligible: number;
  totalEligible: number;
  pensionRemaining: number;
  totalRemaining: number;
  pensionExcess: number;
  irpExcess: number;
  incomeTaxRate: 0.15 | 0.12;
  incomeTaxCredit: number;
  localIncomeTaxEffect: number;
  estimatedTotalBenefit: number;
  ruleVersion: string;
};
```

`rules.ts`는 `kr-employment-pension-2026-v1`만 등록하고 다음 계산 순서를 그대로 사용한다.

```ts
const pensionEligible = Math.min(input.pensionPaid, rule.pensionLimit);
const totalEligible = Math.min(pensionEligible + input.irpPaid, rule.combinedLimit);
const irpEligible = totalEligible - pensionEligible;
const incomeTaxRate = input.grossSalary <= rule.salaryThreshold ? 0.15 : 0.12;
const incomeTaxCredit = Math.floor(totalEligible * incomeTaxRate);
const localIncomeTaxEffect = Math.floor(incomeTaxCredit * 0.1);
```

- [ ] **Step 4: Zod 폼 계약 구현**

쉼표 제거 후 0 이상의 안전 정수로 변환하고 과세연도를 2026으로 제한한다.

```ts
export const taxProfileFormSchema = z.object({
  taxYear: z.coerce.number().int().refine((year) => getTaxRule(year) !== null),
  grossSalary: z.string().transform((value) => Number(value.replaceAll(",", "")))
    .pipe(z.number().int().nonnegative().safe()),
});
```

- [ ] **Step 5: 계산 테스트 통과 및 커밋**

Run: `npm test -- --run tests/unit/tax-domain.test.ts`

Expected: PASS.

```bash
git add src/features/tax/types.ts src/features/tax/rules.ts src/features/tax/schemas.ts tests/unit/tax-domain.test.ts
git commit -m "기능: 2026년 연금 세액공제 계산 규칙 추가"
```

### Task 3: 개인 총급여 저장과 세금 페이지 워크플로

**Files:**
- Create: `src/features/tax/workflows.ts`
- Create: `src/features/tax/supabase-gateway.ts`
- Create: `src/features/tax/actions.ts`
- Create: `tests/unit/tax-workflows.test.ts`
- Create: `tests/unit/tax-actions.test.ts`

**Interfaces:**
- Consumes: Task 2의 `taxProfileFormSchema`, `getTaxRule`, `calculatePensionTaxBenefit`.
- Produces: `TaxActionState`, `TaxGateway`, `saveTaxProfile(gateway, input)`, `saveTaxProfileAction(state, formData)`.
- `TaxGateway` 정확한 계약:

```ts
export type TaxGateway = {
  getSessionUserId(): Promise<string | null>;
  upsertProfile(userId: string, input: { taxYear: 2026; grossSalary: number }): Promise<"saved" | "forbidden" | "error">;
};
```

- [ ] **Step 1: 실패하는 워크플로 테스트 작성**

로그아웃은 `로그인이 필요합니다.`, RLS 거부는 `본인의 세금 정보만 변경할 수 있습니다.`, 일반 저장 오류는 재시도 메시지, 성공은 `{ status: "success", message: "총급여를 저장했어요." }`를 반환하는 fake gateway 테스트를 작성한다.

- [ ] **Step 2: 워크플로 테스트 실패 확인**

Run: `npm test -- --run tests/unit/tax-workflows.test.ts`

Expected: 모듈이 없어 FAIL.

- [ ] **Step 3: 워크플로와 Supabase 게이트웨이 구현**

게이트웨이 upsert는 사용자 ID와 2026년 복합 키만 사용한다.

```ts
await supabase.from("user_tax_profiles").upsert({
  user_id: userId,
  tax_year: input.taxYear,
  income_type: "employment",
  gross_salary: input.grossSalary,
}, { onConflict: "user_id,tax_year" });
```

오류 코드 `42501`은 `forbidden`, 나머지는 `error`로 매핑한다.

- [ ] **Step 4: 실패하는 서버 액션 테스트 작성 후 구현**

잘못된 폼은 Zod의 `fieldErrors`, 올바른 폼은 워크플로 결과를 반환하며 성공 시 `/tax-goals`를 재검증하는지 검증한다. `saveTaxProfileAction`은 `FormData` 외부의 사용자 ID를 받지 않는다.

Run: `npm test -- --run tests/unit/tax-workflows.test.ts tests/unit/tax-actions.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/features/tax/workflows.ts src/features/tax/supabase-gateway.ts src/features/tax/actions.ts tests/unit/tax-workflows.test.ts tests/unit/tax-actions.test.ts
git commit -m "기능: 개인 총급여 저장 흐름 추가"
```

### Task 4: 세금 요약 조회와 납입 내역 자동 페이지 조회

**Files:**
- Create: `src/features/tax/cursor.ts`
- Create: `src/features/tax/query-utils.ts`
- Create: `src/features/tax/queries.ts`
- Create: `src/features/tax/use-contribution-pages.ts`
- Create: `src/app/api/tax-contributions/route.ts`
- Create: `tests/unit/tax-query.test.ts`
- Create: `tests/unit/tax-route.test.ts`

**Interfaces:**
- Consumes: Task 1 RPC와 Task 2 계산 모듈.
- Produces: `TaxPageData`, `TaxContribution`, `TaxContributionPage`, `getTaxPageData(2026)`, `getTaxContributionPage(2026, cursor)`, `encodeTaxCursor`, `decodeTaxCursor`, `useContributionPages`.
- `TaxPageData` 정확한 계약:

```ts
export type TaxPageData = {
  taxYear: 2026;
  supportedYears: readonly [2026];
  grossSalary: number | null;
  rule: TaxRule;
  result: PensionTaxResult | null;
  contributions: TaxContributionPage;
};
```

- [ ] **Step 1: 실패하는 행 변환·커서 테스트 작성**

RPC의 snake_case 행을 다음 타입으로 변환하는지 검증한다.

```ts
export type TaxContribution = {
  id: string;
  ledgerId: string;
  ledgerName: string;
  canManage: boolean;
  occurredOn: string;
  description: string;
  amount: number;
  createdAt: string;
  categoryName: string;
  systemCode: TaxCategoryCode;
};
```

51개를 요청해 50개만 반환하고 마지막 행으로 다음 커서를 만들며, 잘못된 Base64·날짜·UUID 커서는 거부하는 테스트를 작성한다.

- [ ] **Step 2: 조회 테스트 실패 확인**

Run: `npm test -- --run tests/unit/tax-query.test.ts`

Expected: 조회 및 커서 모듈이 없어 FAIL.

- [ ] **Step 3: 서버 조회 구현**

`getTaxPageData(2026)`는 `auth.getUser`, `user_tax_profiles`, 요약 RPC, 첫 목록 RPC를 병렬 조회한다. 총급여가 있으면 순수 계산 함수를 호출하고, 없으면 `result=null`을 반환한다. 세션 없음은 `TaxAuthenticationError`, DB 오류는 사용자 메시지를 포함하지 않는 `TaxQueryError`로 구분한다.

목록 RPC 호출은 다음 형태를 고정한다.

```ts
supabase.rpc("get_my_pension_contributions", {
  target_year: 2026,
  page_size: 51,
  after_on: cursor?.occurredOn ?? null,
  after_created_at: cursor?.createdAt ?? null,
  after_id: cursor?.id ?? null,
});
```

- [ ] **Step 4: 실패하는 API 라우트 테스트 작성 후 구현**

`GET /api/tax-contributions?year=2026&cursor=...`는 성공 시 `TaxContributionPage`, 잘못된 연도·커서는 400, 로그아웃은 401, 조회 실패는 500을 반환한다. 응답에 총급여나 계산 결과를 넣지 않는다.

Run: `npm test -- --run tests/unit/tax-query.test.ts tests/unit/tax-route.test.ts`

Expected: PASS.

- [ ] **Step 5: 자동 조회 훅 구현과 커밋**

`IntersectionObserver`가 sentinel을 볼 때 다음 커서를 한 번만 요청하고, 중복 ID를 제거하며 오류 시 재시도할 수 있게 한다. 마지막 페이지에서는 sentinel을 제거하고 종료 문구는 렌더링하지 않는다.

```bash
git add src/features/tax/cursor.ts src/features/tax/query-utils.ts src/features/tax/queries.ts src/features/tax/use-contribution-pages.ts src/app/api/tax-contributions/route.ts tests/unit/tax-query.test.ts tests/unit/tax-route.test.ts
git commit -m "기능: 개인 연금 납입 요약과 자동 조회 추가"
```

### Task 5: 반응형 세금 탭 화면

**Files:**
- Create: `src/features/tax/tax-screen.tsx`
- Create: `src/features/tax/tax-profile-form.tsx`
- Create: `src/features/tax/contribution-list.tsx`
- Modify: `src/app/(app)/tax-goals/page.tsx`
- Create: `tests/unit/tax-ui.test.tsx`

**Interfaces:**
- Consumes: `TaxPageData`, `saveTaxProfileAction`, `useContributionPages`.
- Produces: 총급여 폼, 연금저축·IRP 진행률, 공제 결과 카드, 자동 조회 납입 목록, `/ledger?new=pension_savings|irp` 추가 링크.

- [ ] **Step 1: 실패하는 UI 테스트 작성**

다음을 Testing Library로 검증한다.

- 제목 `세금`과 2026년 선택 상태
- 총급여가 없을 때 입력 안내 및 계산 금액 비노출
- 연금저축·전체 한도 progressbar의 `aria-valuenow`, `aria-valuemax`
- 소득세, 지방소득세, 총 예상 절세액 분리 표시
- 한도 초과액과 남은 한도
- 공식 근거 링크와 예상치 안내
- `연금저축 추가`, `IRP 추가` 링크의 정확한 query string
- 현재 구성원 거래는 편집 버튼, 이전 장부 거래는 읽기 전용과 `이전 장부`
- sentinel 진입 후 다음 페이지 자동 추가 및 종료 문구 부재
- 모바일 viewport에서도 동일한 항목이 접근 가능

- [ ] **Step 2: UI 테스트 실패 확인**

Run: `npm test -- --run tests/unit/tax-ui.test.tsx`

Expected: 세금 화면 컴포넌트가 없어 FAIL.

- [ ] **Step 3: 총급여 폼과 요약 카드 구현**

총급여 입력은 `inputMode="numeric"`, 원 단위, 쉼표 입력을 지원한다. 계산 결과가 없으면 납입 현황만 보여주고 `총급여를 입력하면 예상 세액공제를 계산할 수 있어요.`를 표시한다. 결과 카드 제목에는 모두 `예상`을 포함한다.

진행률은 시각 폭을 100%로 제한하되 실제 값은 별도로 표시한다.

```tsx
<div
  aria-label="연금저축 공제 한도 진행률"
  aria-valuemax={6_000_000}
  aria-valuemin={0}
  aria-valuenow={Math.min(pensionPaid, 6_000_000)}
  role="progressbar"
/>
```

- [ ] **Step 4: 납입 목록과 페이지 연결 구현**

PC는 날짜·장부·분류·내용·금액을 넓은 행으로, 모바일은 카드로 표시한다. `canManage=false`에는 편집 동작을 만들지 않는다. API 오류는 `다시 시도` 버튼으로 같은 커서를 다시 요청한다.

세금 페이지는 세션이 없으면 `/login?next=%2Ftax-goals`로 이동하고 그 밖의 조회 오류는 재시도 안내를 표시한다.

- [ ] **Step 5: UI 테스트 통과 및 커밋**

Run: `npm test -- --run tests/unit/tax-ui.test.tsx tests/unit/app-shell.test.tsx`

Expected: PASS.

```bash
git add src/features/tax/tax-screen.tsx src/features/tax/tax-profile-form.tsx src/features/tax/contribution-list.tsx src/app/'(app)'/tax-goals/page.tsx tests/unit/tax-ui.test.tsx
git commit -m "기능: 연금 세액공제 현황 화면 구현"
```

### Task 6: 가계부 사전 선택 추가와 기존 거래 편집 연결

**Files:**
- Modify: `src/features/transactions/types.ts`
- Modify: `src/features/transactions/queries.ts`
- Modify: `src/features/transactions/ledger-screen.tsx`
- Modify: `src/features/transactions/transaction-form.tsx`
- Modify: `src/app/(app)/ledger/page.tsx`
- Modify: `src/features/tax/actions.ts`
- Modify: `src/features/tax/contribution-list.tsx`
- Modify: `tests/unit/transactions-query.test.ts`
- Modify: `tests/unit/transactions-ui.test.tsx`
- Modify: `tests/unit/tax-actions.test.ts`
- Modify: `tests/unit/tax-ui.test.tsx`

**Interfaces:**
- Consumes: `categories.system_code`, 기존 `switchLedgerAction`의 기본 장부 변경 방식, 기존 거래 조회·편집 권한.
- Produces: `CategoryOption.systemCode`, `LedgerPageData.initialEditorItem`, `LedgerPageData.initialCategoryId`, `openTaxContributionAction(ledgerId, transactionId)`.

- [ ] **Step 1: 실패하는 가계부 사전 선택 테스트 작성**

`/ledger?new=pension_savings`에서 폼이 자동으로 열리고 지출 및 연금저축 분류가 선택되는지 검증한다. `new=unknown`은 무시하고 일반 가계부를 보여준다. 분류 조회는 다음 필드를 포함해야 한다.

```ts
export type CategoryOption = {
  id: string;
  name: string;
  color: string;
  type: TransactionType;
  systemCode: TaxCategoryCode | null;
};
```

- [ ] **Step 2: 실패하는 편집 연결 테스트 작성**

현재 구성원인 거래에서 `openTaxContributionAction`을 호출하면 해당 장부를 기본 장부로 바꾸고 `/ledger?edit=<transactionId>`로 이동하는지 검증한다. 본인 거래가 아니거나 더 이상 구성원이 아니거나 `can_manage=false`면 변경하지 않고 세금 화면 오류 결과를 반환해야 한다.

- [ ] **Step 3: 테스트 실패 확인**

Run:

```bash
npm test -- --run tests/unit/transactions-query.test.ts tests/unit/transactions-ui.test.tsx tests/unit/tax-actions.test.ts tests/unit/tax-ui.test.tsx
```

Expected: 사전 선택과 편집 연결 계약이 없어 FAIL.

- [ ] **Step 4: 분류 사전 선택과 편집 항목 조회 구현**

`getLedgerPageData(searchParams)`가 `categories.system_code`를 매핑하고 `new` 코드와 일치하는 활성 지출 분류 ID를 `initialCategoryId`로 반환한다. `edit` UUID가 현재 장부의 관리 가능한 활성 거래라면 기존 `TransactionListItem`으로 변환해 `initialEditorItem`에 넣는다.

`TransactionForm`은 새 거래일 때만 `initialCategoryId`를 초기값으로 사용한다.

```ts
const [type, setType] = useState<TransactionType>(item?.type ?? "expense");
const [categoryId, setCategoryId] = useState(item?.category.id ?? initialCategoryId ?? "");
```

- [ ] **Step 5: 세금 목록의 편집 서버 액션 구현**

액션은 현재 세션 사용자 ID를 구한 뒤, 기존 거래 RLS를 적용받는 직접 조회로 전달받은 거래 ID가 해당 사용자가 작성한 활성 거래인지 확인한다. 이어 `ledger_members`에서 현재 활성 구성원인지 확인하고 조회된 실제 `ledger_id`를 사용해 `user_private_profiles.default_ledger_id`를 갱신한다. 클라이언트가 보낸 장부 ID만 신뢰하지 않는다. 성공 후 `redirect('/ledger?edit=' + transactionId)`를 호출한다.

- [ ] **Step 6: 관련 테스트 통과 및 커밋**

Run:

```bash
npm test -- --run tests/unit/transactions-query.test.ts tests/unit/transactions-ui.test.tsx tests/unit/tax-actions.test.ts tests/unit/tax-ui.test.tsx
```

Expected: PASS.

```bash
git add src/features/transactions/types.ts src/features/transactions/queries.ts src/features/transactions/ledger-screen.tsx src/features/transactions/transaction-form.tsx src/app/'(app)'/ledger/page.tsx src/features/tax/actions.ts src/features/tax/contribution-list.tsx tests/unit/transactions-query.test.ts tests/unit/transactions-ui.test.tsx tests/unit/tax-actions.test.ts tests/unit/tax-ui.test.tsx
git commit -m "기능: 연금 납입 추가와 가계부 편집 흐름 연결"
```

### Task 7: 통합 E2E, 공식 근거 문서, 전체 검증

**Files:**
- Create: `tests/e2e/tax.spec.ts`
- Modify: `README.md`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: Tasks 1~6의 완성된 데이터베이스·계산·화면·가계부 연결.
- Produces: PC·모바일 세금 탭 회귀 시나리오, 배포 적용 순서, 운영상 예상치 안내.

- [ ] **Step 1: 안전한 호스팅 E2E 작성**

전용 개발 Supabase에서 다음 흐름을 PC와 모바일 프로젝트로 검증한다.

1. 사용자 A가 총급여 55,000,000원을 저장한다.
2. 가계부에서 연금저축 6,000,000원, IRP 3,000,000원을 지출로 저장한다.
3. 세금 탭에서 납입 9,000,000원, 소득세 1,350,000원, 지방소득세 135,000원, 합계 1,485,000원을 확인한다.
4. 같은 기간 가계부와 통계의 지출 합계에 9,000,000원이 포함됐는지 확인한다.
5. IRP 금액 수정, 휴지통 이동, 복원 때 결과가 함께 바뀌는지 확인한다.
6. 공동 장부에서 사용자 B가 작성한 IRP 거래는 A의 세금 탭에 합산되지 않는지 확인한다.
7. 자동 조회에 충분한 납입 내역을 만든 후 스크롤로 다음 페이지가 붙고 종료 문구가 없는지 확인한다.

호스팅 데이터 변경은 기존 `verifyHostedSupabaseE2ESafety()`를 통과한 경우에만 실행하고 생성한 사용자를 종료 시 정리한다.

- [ ] **Step 2: E2E 안전 skip 또는 통과 확인**

Run: `npm run test:e2e -- tests/e2e/tax.spec.ts`

Expected: 안전 환경변수가 없으면 파괴적 시나리오가 의도대로 skip, 전용 개발 프로젝트에서는 PC·모바일 PASS.

- [ ] **Step 3: 사용자·배포 문서 완성**

README에는 `연금저축`, `IRP` 분류 지출이 세금 탭과 일반 지출 통계에 동시에 반영된다는 사용법을 기록한다. Supabase 문서에는 마이그레이션 적용 후 확인 쿼리, Vercel 재배포 순서, 2026년만 계산 가능하다는 범위, 다음 공식 근거를 기록한다.

- [소득세법 제59조의3](https://law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900470390)
- [국세청 근로소득 연금계좌 세액공제 안내](https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875&mi=6596)

- [ ] **Step 4: 전체 자동 검증**

Run:

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: 모든 단위 테스트, 타입 검사, ESLint, 프로덕션 빌드 PASS. 공개 E2E PASS. 호스팅 변경 E2E는 안전 변수에 따라 PASS 또는 명시적 skip. 의도하지 않은 변경과 미추적 파일 없음.

- [ ] **Step 5: 데이터베이스 검증**

Run: `supabase test db`

Expected: Docker와 로컬 Supabase가 있으면 전체 pgTAP PASS. 사용할 수 없으면 `docs/supabase-setup.md`의 확인 SQL을 대상 Supabase SQL Editor에서 실행해 모든 열이 `true`인지 확인한다.

- [ ] **Step 6: 최종 커밋**

```bash
git add README.md docs/supabase-setup.md tests/e2e/tax.spec.ts
git commit -m "검증: 연금 세액공제 통합 시나리오와 적용 문서 추가"
```

## 계획 자체 검토

- 설계의 가계부 단일 원본, 내부 분류 코드, 개인 총급여, 2026년 계산 규칙을 Tasks 1~4에 연결했다.
- 일반 지출·통계 포함은 기존 거래 유형을 유지하고 Task 7 E2E로 회귀 검증한다.
- 공동 장부 작성자 분리, 탈퇴 후 개인 기록 유지, 다른 사용자 정보 차단을 데이터베이스 계약과 E2E에 포함했다.
- 거래 생성·수정·삭제·복원에 따른 자동 반영을 별도 복제 테이블 없이 검증한다.
- 모바일·PC, 자동 추가 조회, 종료 문구 미표시를 Tasks 4~7에 포함했다.
- 총급여 미입력, 한도 초과, 지원하지 않는 연도, 실제 환급액 불확실성을 도메인 및 UI 테스트에 포함했다.
- 종합소득자와 의료비·교육비·월세는 규칙 모듈 확장 지점만 남기고 이번 구현 범위에서는 제외했다.
- 모든 생산 인터페이스의 이름과 주요 반환 타입을 정의했고 이후 Task에서 동일한 이름을 사용했다.
- 구현 전에 공동 장부 완료 커밋을 기준선에 포함하도록 명시해 현재 분기 차이를 해소했다.
