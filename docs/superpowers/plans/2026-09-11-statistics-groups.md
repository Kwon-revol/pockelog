# Statistics Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장부 소유자가 수입·지출 상세 분류를 통계 전용 그룹으로 묶고 모든 장부 구성원이 통계 상세 화면에서 그룹 합계와 하위 분류를 볼 수 있게 한다.

**Architecture:** 새 `public.statistics_groups` 테이블과 `categories.statistics_group_id` 연결을 데이터베이스의 단일 진실 공급원으로 사용한다. 설정 변경은 소유자 전용 원자적 RPC로 처리하고, 통계는 그룹 메타데이터를 포함하는 새 RPC 행을 서버에서 계층화해 렌더링한다. 새 스키마가 없을 때 설정은 적용 안내를, 통계는 기존 분류 RPC fallback을 제공해 마이그레이션 선적용 배포 순서를 안전하게 유지한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase PostgreSQL/RLS/RPC, Zod 4, Tailwind CSS 4, Vitest/Testing Library, pgTAP, Playwright

**Spec:** `docs/superpowers/specs/2026-09-11-statistics-groups-design.md`

## Global Constraints

- 통계 그룹은 장부별로 저장하고 수입과 지출 유형을 분리한다.
- 한 상세 분류는 통계 그룹 하나에만 속할 수 있다.
- 그룹 삭제는 상세 분류와 거래를 삭제하지 않고 연결만 해제한다.
- 가계부 입력과 원본 거래 목록은 기존 상세 분류만 사용한다.
- 개인·공동 장부 소유자만 그룹 구성을 변경하고 일반 구성원은 조회만 한다.
- 그룹에는 별도 색상을 사용하고 하위 분류에는 기존 분류 색상을 사용한다.
- 빈 그룹은 통계에서 숨기고 그룹 미지정 분류는 단독 항목으로 표시한다.
- 기존 `get_category_statistics` RPC는 제거하거나 변경하지 않는다.
- 새 런타임 패키지는 추가하지 않는다.
- 모든 사용자 문구와 커밋 메시지는 한국어로 작성한다.
- `D:\myProject\pockelog` 밖의 파일은 변경하지 않는다.

---

## File Map

### 새 파일

- `supabase/migrations/202609110009_statistics_groups.sql`: 테이블, 연결 열, RLS, 무결성 트리거, 변경 RPC, 그룹 통계 RPC
- `tests/db/010_statistics_groups.test.sql`: 소유자·구성원 권한, 원자적 연결, 삭제, 통계 행 pgTAP 계약
- `src/features/settings/statistics-group-manager.tsx`: 유형 탭, 그룹 카드, 인라인 생성·수정 폼, 분류 선택 UI

### 수정 파일

- `src/features/settings/types.ts`: 그룹 입력·조회 타입과 설정 페이지 데이터 확장
- `src/features/settings/schemas.ts`: 그룹 폼 Zod 검증과 `FormData.getAll()` 변환
- `src/features/settings/workflows.ts`: 저장·삭제·순서 변경 권한 및 결과 매핑
- `src/features/settings/gateway-utils.ts`: RPC 오류·스키마 부재 코드 매핑
- `src/features/settings/supabase-gateway.ts`: 그룹 변경 RPC 어댑터
- `src/features/settings/query-utils.ts`: 그룹·분류 행을 설정 화면 타입으로 변환
- `src/features/settings/queries.ts`: 그룹과 `statistics_group_id` 조회 및 스키마 부재 fallback
- `src/features/settings/actions.ts`: 그룹 서버 액션과 설정·통계 재검증
- `src/features/settings/settings-screen.tsx`: 통계 그룹 관리 영역 연결
- `src/app/(app)/settings/page.tsx`: 그룹 액션 주입
- `src/features/statistics/types.ts`: 그룹/단독 분류 union 타입
- `src/features/statistics/query-utils.ts`: 그룹 메타데이터 행과 계층 집계 함수
- `src/features/statistics/supabase-gateway.ts`: 새 RPC 조회와 기존 RPC fallback
- `src/features/statistics/workflows.ts`: 상세 데이터에 계층형 breakdown 제공
- `src/features/statistics/detail-screen.tsx`: 그룹 펼치기와 하위 분류 렌더링
- `tests/unit/settings-domain.test.ts`: 폼 검증
- `tests/unit/settings-query.test.ts`: 조회 변환과 fallback 판별
- `tests/unit/settings-workflows.test.ts`: 소유자 동작과 오류 매핑
- `tests/unit/settings-actions.test.ts`: 그룹 서버 액션 입력·재검증 계약
- `tests/unit/settings-ui.test.tsx`: 소유자 편집과 구성원 읽기 전용 UI
- `tests/unit/statistics-query.test.ts`: 계층 집계와 gateway fallback
- `tests/unit/statistics-ui.test.tsx`: 그룹 펼치기·미지정 분류 UI
- `tests/e2e/settings.spec.ts`: 그룹 생성·이동·삭제 호스팅 시나리오
- `tests/e2e/statistics.spec.ts`: PC·모바일 그룹 합계·펼치기 시나리오
- `docs/supabase-setup.md`: 009 적용·확인·배포 순서
- `README.md`: 통계 그룹 사용과 마이그레이션 안내

---

### Task 1: 도메인 타입, 폼 계약, 통계 계층 집계

**Files:**
- Modify: `src/features/settings/types.ts`
- Modify: `src/features/settings/schemas.ts`
- Modify: `src/features/statistics/types.ts`
- Modify: `src/features/statistics/query-utils.ts`
- Test: `tests/unit/settings-domain.test.ts`
- Test: `tests/unit/statistics-query.test.ts`

**Interfaces:**
- Produces: `StatisticsGroupInput`, `SettingsStatisticsGroup`, `StatisticsBreakdownItem`, `GroupedCategoryStatisticsRow`
- Produces: `formDataToStatisticsGroupInput(formData: FormData)`
- Produces: `toStatisticsBreakdown(rows: GroupedCategoryStatisticsRow[], typeTotal: number): StatisticsBreakdownItem[]`
- Consumes: existing `TransactionType`, `CategorySummary`, safe-integer money conversion

- [ ] **Step 1: 상세 분류 연결을 포함한 설정 폼 실패 테스트 작성**

```ts
it("normalizes a statistics group and keeps unique category ids", () => {
  const data = new FormData();
  data.set("type", "expense");
  data.set("name", "  고정지출  ");
  data.set("color", "#a1b2c3");
  data.append("categoryIds", "11111111-1111-4111-8111-111111111111");
  data.append("categoryIds", "22222222-2222-4222-8222-222222222222");

  const result = formDataToStatisticsGroupInput(data);
  expect(result.success).toBe(true);
  if (result.success) expect(result.data).toEqual({
    type: "expense",
    name: "고정지출",
    color: "#A1B2C3",
    categoryIds: [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ],
  });
});

it.each([
  { name: "", color: "#10B981" },
  { name: "x".repeat(31), color: "#10B981" },
  { name: "고정지출", color: "green" },
])("rejects invalid statistics group input %#", ({ name, color }) => {
  const data = new FormData();
  data.set("type", "expense");
  data.set("name", name);
  data.set("color", color);
  data.append("categoryIds", "11111111-1111-4111-8111-111111111111");
  expect(formDataToStatisticsGroupInput(data).success).toBe(false);
});
```

- [ ] **Step 2: 그룹·미지정 분류 계층 집계 실패 테스트 작성**

```ts
const rows: GroupedCategoryStatisticsRow[] = [
  {
    category_id: "housing", category_name: "주거비", category_color: "#F97316",
    category_sort_order: 1, amount_total: "500000",
    statistics_group_id: "fixed", statistics_group_name: "고정지출",
    statistics_group_color: "#64748B", statistics_group_sort_order: 0,
  },
  {
    category_id: "phone", category_name: "통신비", category_color: "#3B82F6",
    category_sort_order: 2, amount_total: "100000",
    statistics_group_id: "fixed", statistics_group_name: "고정지출",
    statistics_group_color: "#64748B", statistics_group_sort_order: 0,
  },
  {
    category_id: "food", category_name: "식비", category_color: "#F97316",
    category_sort_order: 0, amount_total: "200000",
    statistics_group_id: null, statistics_group_name: null,
    statistics_group_color: null, statistics_group_sort_order: null,
  },
];

expect(toStatisticsBreakdown(rows, 800000)).toEqual([
  {
    kind: "group", groupId: "fixed", name: "고정지출", color: "#64748B",
    sortOrder: 0, amountTotal: 600000, ratio: 75,
    categories: [
      { categoryId: "housing", name: "주거비", color: "#F97316", sortOrder: 1, amountTotal: 500000, ratio: 62.5 },
      { categoryId: "phone", name: "통신비", color: "#3B82F6", sortOrder: 2, amountTotal: 100000, ratio: 12.5 },
    ],
  },
  {
    kind: "category",
    category: { categoryId: "food", name: "식비", color: "#F97316", sortOrder: 0, amountTotal: 200000, ratio: 25 },
  },
]);
```

그룹이 없는 행만 전달했을 때 기존 `toCategorySummaries`의 금액 내림차순 결과와 같은 순서인지, `typeTotal = 0`이면 모든 비율이 0인지, 안전 정수 범위를 벗어난 금액은 예외인지도 각각 검증한다.

- [ ] **Step 3: 실패 확인**

Run:

```bash
npm test -- --run tests/unit/settings-domain.test.ts tests/unit/statistics-query.test.ts
```

Expected: 새 타입·함수가 없어 TypeScript 변환 또는 테스트가 실패한다.

- [ ] **Step 4: 최소 타입과 스키마 구현**

`src/features/settings/types.ts`에 다음 계약을 추가한다.

```ts
export type StatisticsGroupInput = {
  type: TransactionType;
  name: string;
  color: string;
  categoryIds: string[];
};

export type SettingsStatisticsGroup = StatisticsGroupInput & {
  id: string;
  sortOrder: number;
};

export type SettingsCategory = CategoryInput & {
  id: string;
  sortOrder: number;
  isActive: boolean;
  statisticsGroupId: string | null;
};
```

`SettingsPageData`에 `statisticsGroups: SettingsStatisticsGroup[]`과 `statisticsGroupsAvailable: boolean`을 추가한다. `statisticsGroupFormSchema`는 `type`, 공백 제거 1~30자 `name`, 대문자 `#RRGGBB` `color`, 중복 없는 UUID 배열 `categoryIds`를 검증한다. `formDataToStatisticsGroupInput()`은 `formData.getAll("categoryIds")`의 문자열만 전달한다.

- [ ] **Step 5: 최소 계층 집계 구현**

`src/features/statistics/types.ts`에 다음 union을 추가하고 `StatisticsDetailData.categories`를 `breakdown`으로 교체한다.

```ts
export type StatisticsGroupSummary = {
  kind: "group";
  groupId: string;
  name: string;
  color: string;
  sortOrder: number;
  amountTotal: number;
  ratio: number;
  categories: CategorySummary[];
};

export type StatisticsBreakdownItem =
  | StatisticsGroupSummary
  | { kind: "category"; category: CategorySummary };
```

`GroupedCategoryStatisticsRow`는 기존 분류 열과 nullable 그룹 열을 선언한다. `toStatisticsBreakdown()`은 그룹 ID별 Map으로 행을 모으고 그룹 합계를 계산한다. 그룹은 `sortOrder`, 금액 내림차순, ID 순으로 먼저 정렬하고, 그룹 미지정 분류는 기존 `toCategorySummaries()` 순서로 그 뒤에 둔다.

- [ ] **Step 6: 집중 테스트와 타입 검사 통과 확인**

Run:

```bash
npm test -- --run tests/unit/settings-domain.test.ts tests/unit/statistics-query.test.ts
npm run typecheck
```

Expected: 두 테스트 파일과 타입 검사가 통과한다.

- [ ] **Step 7: 커밋**

```bash
git add src/features/settings/types.ts src/features/settings/schemas.ts src/features/statistics/types.ts src/features/statistics/query-utils.ts tests/unit/settings-domain.test.ts tests/unit/statistics-query.test.ts
git commit -m "기능: 통계 그룹 도메인 계약 추가"
```

---

### Task 2: Supabase 통계 그룹 스키마, 권한, 원자적 RPC

**Files:**
- Create: `supabase/migrations/202609110009_statistics_groups.sql`
- Create: `tests/db/010_statistics_groups.test.sql`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Produces: `public.statistics_groups`
- Produces: `public.categories.statistics_group_id`
- Produces: `public.save_statistics_group(uuid,uuid,transaction_type,text,text,uuid[]) returns uuid`
- Produces: `public.delete_statistics_group(uuid) returns void`
- Produces: `public.set_statistics_group_order(uuid,transaction_type,uuid[]) returns void`
- Produces: `public.get_grouped_category_statistics(uuid,date,date,transaction_type)`
- Consumes: `public.is_ledger_member(uuid)`, `public.is_ledger_owner(uuid)`, `public.transactions`, `public.categories`

- [ ] **Step 1: pgTAP 실패 계약 작성**

`tests/db/010_statistics_groups.test.sql`은 두 사용자와 두 개인 장부, 첫 장부의 일반 구성원, 수입·지출 거래를 준비하고 다음 계약을 명시한다.

```sql
select has_table('public', 'statistics_groups', '통계 그룹 테이블이 있다');
select has_column('public', 'categories', 'statistics_group_id', '분류에 통계 그룹 연결 열이 있다');
select policies_are('public', 'statistics_groups', array[
  'statistics_groups_select_members',
  'statistics_groups_insert_owner',
  'statistics_groups_update_owner',
  'statistics_groups_delete_owner'
]);
```

이어 `lives_ok`/`throws_ok`/`results_eq`로 아래를 검사한다.

- 소유자는 지출 그룹을 생성하고 같은 장부 지출 분류 두 개를 저장할 수 있다.
- 선택한 분류가 다른 그룹에 있었다면 새 그룹으로 이동해 한 행에 하나의 그룹 ID만 남는다.
- 다른 장부 분류와 수입 분류를 지출 그룹에 넣으면 `P0001`로 전체 호출이 실패하고 기존 연결이 유지된다.
- 일반 구성원은 그룹 조회는 가능하지만 세 변경 RPC 모두 `42501`로 실패한다.
- 비구성원은 그룹 행을 읽을 수 없다.
- 같은 장부·유형의 공백·대소문자만 다른 그룹명은 `23505`로 거부된다.
- 그룹 삭제 후 분류와 거래 수는 유지되고 `statistics_group_id`만 null이 된다.
- 그룹 순서 RPC는 같은 장부·유형의 전체 그룹 ID를 중복 없이 요구한다.
- 그룹 통계 RPC는 분류 금액과 그룹 ID·이름·색상·순서를 반환하며 삭제 거래는 제외한다.

- [ ] **Step 2: 데이터베이스 계약 실패 확인**

Run when a local Supabase test database is available:

```bash
supabase test db --file tests/db/010_statistics_groups.test.sql
```

Expected: 테이블과 함수가 없어 실패한다. 로컬 Supabase 환경이 없으면 명령 부재 또는 연결 제한을 그대로 기록하고 SQL 정적 검토를 계속한다.

- [ ] **Step 3: 테이블과 연결 무결성 구현**

마이그레이션은 다음 핵심 구조를 만든다.

```sql
create table public.statistics_groups (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  type public.transaction_type not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 30),
  color text not null check (color ~ '^#[0-9A-F]{6}$'),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index statistics_groups_ledger_type_name_unique
  on public.statistics_groups (ledger_id, type, lower(btrim(name)));

alter table public.categories
  add column statistics_group_id uuid
  references public.statistics_groups(id) on delete set null;
```

`private.enforce_category_statistics_group()` 트리거는 그룹과 분류의 장부·유형 일치를 확인한다. `statistics_groups`에는 기존 `public.set_updated_at()` 트리거를 연결한다.

- [ ] **Step 4: RLS와 변경 RPC 구현**

구성원 select, 소유자 insert/update/delete 정책을 추가하고 테이블 직접 변경 권한은 필요한 열로 제한한다. 세 변경 함수는 `security definer set search_path = ''`로 만들고 내부에서 `auth.uid()`와 `public.is_ledger_owner()`를 확인한다.

`save_statistics_group()`은 다음 순서로 한 트랜잭션 안에서 동작한다.

1. 대상 장부 소유자 확인
2. 그룹 ID가 null이면 다음 `sort_order`로 insert, 아니면 같은 장부 그룹 update
3. `target_category_ids`의 중복 여부와 모든 행의 장부·유형 일치 확인
4. 현재 그룹에 있으나 목록에서 빠진 분류를 null로 update
5. 목록의 분류를 대상 그룹 ID로 update하여 다른 그룹 연결을 교체
6. 저장한 그룹 ID 반환

함수별로 `public`, `anon` 실행 권한을 revoke하고 `authenticated`에만 grant한다.

- [ ] **Step 5: 그룹 통계 RPC 구현**

```sql
create function public.get_grouped_category_statistics(
  target_ledger_id uuid,
  start_on date,
  end_exclusive date,
  target_type public.transaction_type
)
returns table (
  category_id uuid,
  category_name text,
  category_color text,
  category_sort_order integer,
  amount_total bigint,
  statistics_group_id uuid,
  statistics_group_name text,
  statistics_group_color text,
  statistics_group_sort_order integer
)
```

함수는 `security invoker`, 빈 `search_path`를 사용하고 기존 거래 RLS를 그대로 따른다. 삭제되지 않은 대상 기간·유형 거래를 상세 분류별로 합산하고 그룹을 left join한다. 기존 `get_category_statistics`는 변경하지 않는다.

- [ ] **Step 6: DB 계약 또는 정적 검증**

로컬 Supabase가 있으면 Step 2 명령을 다시 실행해 pgTAP 전체 통과를 확인한다. 없으면 다음을 수행한다.

```bash
rg -n "enable row level security|security definer|set search_path|revoke all|grant execute|get_grouped_category_statistics|on delete set null" supabase/migrations/202609110009_statistics_groups.sql
git diff --check
```

Expected: 각 보안 계약이 파일에 존재하고 whitespace 오류가 없다.

- [ ] **Step 7: Supabase 적용 문서 작성과 커밋**

`docs/supabase-setup.md`에 009 선적용 순서와 아래 확인 쿼리를 추가한다.

```sql
select
  to_regclass('public.statistics_groups') is not null as statistics_groups_exists,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'categories'
      and column_name = 'statistics_group_id'
  ) as category_group_column_exists,
  to_regprocedure('public.save_statistics_group(uuid,uuid,transaction_type,text,text,uuid[])') is not null as save_group_exists,
  to_regprocedure('public.delete_statistics_group(uuid)') is not null as delete_group_exists,
  to_regprocedure('public.set_statistics_group_order(uuid,transaction_type,uuid[])') is not null as order_group_exists,
  to_regprocedure('public.get_grouped_category_statistics(uuid,date,date,transaction_type)') is not null as grouped_statistics_exists,
  (select relrowsecurity from pg_class where oid = 'public.statistics_groups'::regclass) as all_rls_enabled;
```

```bash
git add supabase/migrations/202609110009_statistics_groups.sql tests/db/010_statistics_groups.test.sql docs/supabase-setup.md
git commit -m "데이터베이스: 통계 그룹과 권한 정책 추가"
```

---

### Task 3: 설정 조회, 변경 워크플로, Supabase 어댑터

**Files:**
- Modify: `src/features/settings/gateway-utils.ts`
- Modify: `src/features/settings/query-utils.ts`
- Modify: `src/features/settings/queries.ts`
- Modify: `src/features/settings/workflows.ts`
- Modify: `src/features/settings/supabase-gateway.ts`
- Modify: `src/features/settings/actions.ts`
- Test: `tests/unit/settings-query.test.ts`
- Test: `tests/unit/settings-workflows.test.ts`
- Create: `tests/unit/settings-actions.test.ts`

**Interfaces:**
- Consumes: Task 1 settings types and Task 2 RPC signatures
- Produces: `isStatisticsGroupsSchemaMissing(error)`
- Produces: `saveStatisticsGroup()`, `deleteStatisticsGroup()`, `moveStatisticsGroup()` workflows
- Produces: `createStatisticsGroupAction`, `updateStatisticsGroupAction`, `deleteStatisticsGroupAction`, `moveStatisticsGroupAction`

- [ ] **Step 1: 설정 조회·fallback 실패 테스트 작성**

`tests/unit/settings-query.test.ts`에서 `mapSettingsPageData()`가 다음 행을 camelCase 타입으로 바꾸는지 확인한다.

```ts
const groupRows = [
  { id: "group-1", type: "expense", name: "고정지출", color: "#64748B", sort_order: 0 },
];
const categoryRows = [
  { id: "category-1", type: "expense", name: "주거비", color: "#F97316", sort_order: 0, is_active: true, statistics_group_id: "group-1" },
];
expect(mapSettingsPageData(ledger, owner, categoryRows, groupRows, true)).toMatchObject({
  statisticsGroupsAvailable: true,
  statisticsGroups: [{ id: "group-1", categoryIds: ["category-1"] }],
  categories: [{ id: "category-1", statisticsGroupId: "group-1" }],
});
```

PostgREST의 테이블·열·함수 부재 코드 `PGRST205`, `PGRST204`, `PGRST202`, PostgreSQL `42P01`, `42703`, `42883`만 `isStatisticsGroupsSchemaMissing()`이 true로 판단하고 일반 네트워크·권한 오류는 false인지 검증한다.

- [ ] **Step 2: 설정 워크플로 실패 테스트 작성**

가짜 gateway에 다음 메서드를 추가한다.

```ts
saveStatisticsGroup(context, groupId, input): Promise<"saved" | "duplicate" | "forbidden" | "error">;
deleteStatisticsGroup(context, groupId): Promise<SettingsChangeResult>;
setStatisticsGroupOrder(context, type, orderedIds): Promise<SettingsChangeResult>;
```

소유자 생성·수정·삭제·이동 성공 문구, 일반 구성원 사전 거부, 잘못된 UUID 사전 거부, 중복 이름 문구 `같은 이름의 통계 그룹이 있어요.`, gateway 예외 시 입력 유지용 오류 상태를 검증한다.

- [ ] **Step 3: 실패 확인**

```bash
npm test -- --run tests/unit/settings-query.test.ts tests/unit/settings-workflows.test.ts
```

Expected: 새 mapper 인수, gateway 메서드, 워크플로가 없어 실패한다.

- [ ] **Step 4: 조회 mapper와 스키마 fallback 구현**

`getSettingsPageData()`는 장부·멤버십 확인 후 그룹 조회와 `statistics_group_id`가 포함된 분류 조회를 수행한다. 새 스키마 부재 코드가 나오면 기존 분류 열로 한 번 다시 조회하고 아래 값을 반환한다.

```ts
{
  ...existingSettings,
  categories: legacyCategories.map((category) => ({ ...category, statisticsGroupId: null })),
  statisticsGroups: [],
  statisticsGroupsAvailable: false,
}
```

그 밖의 오류는 기존 `SettingsQueryError`로 처리한다. 정상 조회에서는 그룹별 `categoryIds`를 분류의 연결 열로 계산한다.

- [ ] **Step 5: 워크플로와 gateway 구현**

워크플로는 기존 `requireOwner()`를 재사용한다. 저장은 생성 여부에 따라 `통계 그룹을 추가했어요.` 또는 `통계 그룹을 수정했어요.`, 삭제는 `통계 그룹을 삭제했어요.`, 이동은 `통계 그룹 순서를 바꿨어요.`를 반환한다.

Supabase gateway의 저장 호출은 다음 payload를 사용한다.

```ts
await supabase.rpc("save_statistics_group", {
  target_group_id: groupId,
  target_ledger_id: context.ledgerId,
  target_type: input.type,
  target_name: input.name,
  target_color: input.color,
  target_category_ids: input.categoryIds,
});
```

`23505`는 duplicate, `42501`과 `P0001`은 forbidden, 나머지는 error로 매핑한다. 삭제·순서 RPC도 같은 권한 오류 규칙을 사용한다.

- [ ] **Step 6: 서버 액션 구현**

`createStatisticsGroupAction`과 `updateStatisticsGroupAction`은 `formDataToStatisticsGroupInput()` 실패 시 기존 `invalidState()`를 사용한다. 성공 시 `/settings`와 `/statistics`를 revalidate한다. 삭제와 순서 변경 액션도 성공 시 같은 경로를 revalidate하며 `/ledger`는 변경하지 않는다.

- [ ] **Step 7: 집중 테스트와 타입 검사 통과 확인**

```bash
npm test -- --run tests/unit/settings-domain.test.ts tests/unit/settings-query.test.ts tests/unit/settings-workflows.test.ts tests/unit/settings-actions.test.ts
npm run typecheck
```

- [ ] **Step 8: 커밋**

```bash
git add src/features/settings tests/unit/settings-domain.test.ts tests/unit/settings-query.test.ts tests/unit/settings-workflows.test.ts tests/unit/settings-actions.test.ts
git commit -m "기능: 통계 그룹 설정 흐름 구현"
```

---

### Task 4: 소유자 전용 통계 그룹 설정 UI

**Files:**
- Create: `src/features/settings/statistics-group-manager.tsx`
- Modify: `src/features/settings/settings-screen.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Test: `tests/unit/settings-ui.test.tsx`

**Interfaces:**
- Consumes: `SettingsPageData.statisticsGroups`, `SettingsCategory.statisticsGroupId`, Task 3 서버 액션
- Produces: `StatisticsGroupManager`와 `StatisticsGroupManagerActions`

- [ ] **Step 1: 소유자 관리 UI 실패 테스트 작성**

소유자 fixture에 `고정지출` 그룹, 주거비·통신비 연결, 그룹 미지정 식비를 넣고 다음을 검증한다.

```tsx
const region = screen.getByRole("region", { name: "통계 그룹 관리" });
expect(within(region).getByText("고정지출")).toBeVisible();
expect(within(region).getByText(/주거비/)).toBeVisible();
expect(within(region).getByText(/통신비/)).toBeVisible();
expect(within(region).getByText(/그룹 미지정.*식비/)).toBeVisible();

await user.click(within(region).getByRole("button", { name: "통계 그룹 추가" }));
await user.type(within(region).getByLabelText("그룹 이름"), "저축");
await user.click(within(region).getByLabelText("연금저축"));
await user.click(within(region).getByRole("button", { name: "그룹 저장" }));
expect(createStatisticsGroupAction).toHaveBeenCalled();
```

다른 그룹에 속한 분류를 체크하면 `저장하면 기존 그룹에서 이 그룹으로 이동해요.`가 보이고, 숨긴 분류에는 `숨김` 표시가 붙는지 검증한다.

- [ ] **Step 2: 구성원 읽기 전용과 스키마 부재 실패 테스트 작성**

일반 구성원 fixture에서는 그룹과 포함 분류는 보이지만 추가·수정·삭제·이동 버튼이 없는지 검증한다. `statisticsGroupsAvailable: false`이면 `Supabase 통계 그룹 설정을 먼저 적용해 주세요.` 안내만 보이고 편집 UI가 없는지 검증한다.

- [ ] **Step 3: 실패 확인**

```bash
npm test -- --run tests/unit/settings-ui.test.tsx
```

Expected: `StatisticsGroupManager`와 화면 영역이 없어 실패한다.

- [ ] **Step 4: 그룹 관리자 최소 구현**

`StatisticsGroupManagerActions`는 다음 계약을 사용한다.

```ts
export type StatisticsGroupManagerActions = {
  createAction: SettingsFormAction;
  updateAction: (groupId: string, state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  deleteAction: (groupId: string) => Promise<SettingsActionState>;
  moveAction: (groupId: string, direction: "up" | "down", type: TransactionType, orderedIds: string[]) => Promise<SettingsActionState>;
};
```

컴포넌트 내부 상태는 선택 유형과 `SettingsStatisticsGroup | "new" | null` 편집 대상을 가진다. 생성·수정 폼은 영역 안에 인라인 카드로 렌더링하고 이름, 여섯 색상 preset, 해당 유형 상세 분류 체크박스를 제공한다. 저장 실패 시 폼을 유지하고 성공 시 닫는다.

그룹 목록은 유형별 `sortOrder` 순으로 렌더링한다. 소유자에게만 위·아래, 수정, 삭제 버튼을 보이고 삭제는 `window.confirm()` 후 호출한다. 미지정 목록은 `statisticsGroupId === null`인 해당 유형 분류를 표시한다.

- [ ] **Step 5: 설정 화면과 페이지 연결**

`SettingsScreen`은 `statisticsGroupActions` prop을 받아 `CategoryManager` 다음에 manager를 렌더링한다. 설정 페이지는 Task 3의 네 서버 액션을 import해 객체로 전달한다. `statisticsGroupsAvailable`이 false인 경우에도 페이지 전체 오류로 바꾸지 않는다.

- [ ] **Step 6: UI 집중 테스트와 타입 검사 통과 확인**

```bash
npm test -- --run tests/unit/settings-ui.test.tsx
npm run typecheck
```

- [ ] **Step 7: 커밋**

```bash
git add src/features/settings/statistics-group-manager.tsx src/features/settings/settings-screen.tsx "src/app/(app)/settings/page.tsx" tests/unit/settings-ui.test.tsx
git commit -m "기능: 설정에 통계 그룹 관리 추가"
```

---

### Task 5: 그룹 통계 조회와 계층형 상세 화면

**Files:**
- Modify: `src/features/statistics/supabase-gateway.ts`
- Modify: `src/features/statistics/workflows.ts`
- Modify: `src/features/statistics/detail-screen.tsx`
- Test: `tests/unit/statistics-query.test.ts`
- Test: `tests/unit/statistics-ui.test.tsx`

**Interfaces:**
- Consumes: Task 1 `toStatisticsBreakdown()`, Task 2 그룹 통계 RPC
- Produces: `StatisticsDetailData.breakdown`
- Preserves: 기존 기간 합계, 수입·지출 전환, 원본 거래 무한 스크롤

- [ ] **Step 1: 새 RPC와 fallback 실패 테스트 작성**

Supabase mock이 `get_grouped_category_statistics`를 먼저 호출하는지 검증한다. 새 함수 부재 코드 `PGRST202` 또는 `42883`이면 `get_category_statistics`를 다시 호출하고 각 기존 행에 nullable 그룹 열을 채우는지 검증한다. 권한·네트워크 오류는 fallback하지 않고 `StatisticsQueryError`로 전달해야 한다.

```ts
expect(rpc).toHaveBeenNthCalledWith(1, "get_grouped_category_statistics", expectedArgs);
expect(rpc).toHaveBeenNthCalledWith(2, "get_category_statistics", expectedArgs);
```

- [ ] **Step 2: 계층형 UI 실패 테스트 작성**

`detailFixture.breakdown`에 그룹과 단독 분류를 넣고 다음을 검증한다.

```tsx
const groupButton = screen.getByRole("button", { name: /고정지출.*600,000원.*75%/ });
expect(groupButton).toHaveAttribute("aria-expanded", "false");
expect(screen.queryByText("주거비")).not.toBeInTheDocument();

await user.click(groupButton);
expect(groupButton).toHaveAttribute("aria-expanded", "true");
expect(screen.getByText("주거비")).toBeVisible();
expect(screen.getByText("통신비")).toBeVisible();
expect(screen.getByText("식비")).toBeVisible();
```

그룹이 없는 fixture에서는 기존 분류명·금액·비율과 진행 막대가 동일하게 보이는지 검증한다.

- [ ] **Step 3: 실패 확인**

```bash
npm test -- --run tests/unit/statistics-query.test.ts tests/unit/statistics-ui.test.tsx
```

- [ ] **Step 4: gateway와 workflow 구현**

`getCategoryRows()`는 새 RPC를 호출한다. 함수 부재일 때만 기존 RPC로 fallback하고 다음 mapper를 적용한다.

```ts
return legacyRows.map((row) => ({
  category_id: row.category_id,
  category_name: row.category_name,
  category_color: row.category_color,
  category_sort_order: row.sort_order,
  amount_total: row.amount_total,
  statistics_group_id: null,
  statistics_group_name: null,
  statistics_group_color: null,
  statistics_group_sort_order: null,
}));
```

`loadStatisticsDetail()`은 `categories: toCategorySummaries(...)` 대신 `breakdown: toStatisticsBreakdown(...)`을 반환한다.

- [ ] **Step 5: 상세 통계 UI 구현**

단독 분류는 현재 article과 진행 막대를 그대로 렌더링한다. 그룹은 `<button aria-expanded>`으로 합계 행을 렌더링하고, 펼친 경우 들여쓴 하위 목록을 표시한다. 그룹 진행 막대는 그룹 색상, 하위 진행 막대는 상세 분류 색상을 사용한다. 초기 상태는 모든 그룹이 접힌 상태이며 상태 key는 `groupId`다.

금액·비율 레이블은 현재 `Intl.NumberFormat`을 재사용한다. 키보드 사용자는 그룹 버튼을 Enter/Space로 펼칠 수 있어야 하고 진행 막대에는 그룹 또는 상세 분류 이름 기반의 접근성 레이블을 제공한다.

- [ ] **Step 6: 집중 테스트와 타입 검사 통과 확인**

```bash
npm test -- --run tests/unit/statistics-query.test.ts tests/unit/statistics-ui.test.tsx
npm run typecheck
```

- [ ] **Step 7: 커밋**

```bash
git add src/features/statistics tests/unit/statistics-query.test.ts tests/unit/statistics-ui.test.tsx
git commit -m "기능: 통계 그룹 합계와 상세 펼치기 추가"
```

---

### Task 6: 실제 사용자 흐름 E2E와 운영 문서

**Files:**
- Modify: `tests/e2e/settings.spec.ts`
- Modify: `tests/e2e/statistics.spec.ts`
- Modify: `README.md`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: 기존 `E2E_ALLOW_HOSTED_SUPABASE`, `E2E_SUPABASE_PROJECT_REF`, `private.project_settings.allow_destructive_e2e` 안전 장치
- Produces: PC·모바일 통계 그룹 사용자 흐름과 운영 적용 체크리스트

- [ ] **Step 1: 호스팅 E2E 시나리오 작성**

기존 안전 장치가 모두 충족된 개발 프로젝트에서만 다음 흐름을 실행한다.

1. 소유자 계정으로 지출 분류 `E2E 주거비`, `E2E 통신비`, `E2E 식비`와 거래를 만든다.
2. 설정에서 `E2E 고정지출` 그룹과 색상을 만들고 앞의 두 분류를 연결한다.
3. 통계 상세에서 그룹 합계가 두 거래 합계이고 식비가 단독 표시되는지 확인한다.
4. 그룹을 펼쳐 주거비·통신비 하위 금액을 확인한다.
5. 통신비를 다른 그룹으로 옮겨 첫 그룹과 두 번째 그룹 합계에 중복이 없는지 확인한다.
6. 일반 구성원 계정으로 그룹 통계를 볼 수 있지만 설정 변경 버튼은 없는지 확인한다.
7. 소유자로 그룹을 삭제하고 통계에서 주거비·통신비가 단독 분류로 돌아오는지 확인한다.
8. 만든 거래·분류·그룹·계정을 안전하게 정리하고 파괴적 E2E 표시를 다시 확인한다.

- [ ] **Step 2: 공개 E2E와 호스팅 안전 skip 확인**

```bash
npm run test:e2e -- --project=desktop-chromium --project=mobile-chromium tests/e2e/settings.spec.ts tests/e2e/statistics.spec.ts
```

Expected: 자격 증명이나 안전 표시가 없으면 데이터 변경 시나리오는 명시적으로 skip되고 공개 경로 검사는 통과한다.

- [ ] **Step 3: README와 배포 문서 완성**

README에 다음 사용자 규칙을 추가한다.

- 설정의 통계 그룹 관리에서 수입·지출 그룹을 따로 만든다.
- 상세 분류는 한 그룹에만 속하며 다른 그룹 선택 시 이동한다.
- 그룹 삭제는 거래와 상세 분류를 삭제하지 않는다.
- 가계부 입력은 계속 상세 분류만 사용한다.

`docs/supabase-setup.md`에는 개발·운영 009 마이그레이션 확인, 코드 배포, 소유자·구성원 smoke test 순서를 명확히 적는다. 전체 마이그레이션 순서를 001~009로 갱신한다.

- [ ] **Step 4: E2E·문서 커밋**

```bash
git add tests/e2e/settings.spec.ts tests/e2e/statistics.spec.ts README.md docs/supabase-setup.md
git commit -m "검증: 통계 그룹 사용자 흐름과 배포 안내 추가"
```

---

### Task 7: 전체 회귀 검증, 독립 리뷰, 배포 인계

**Files:**
- Modify only if review finds a defect: files already listed in Tasks 1-6

**Interfaces:**
- Consumes: complete statistics-groups implementation
- Produces: 배포 가능한 검증 결과와 Supabase 선적용 안내

- [ ] **Step 1: 전체 정적·단위 검증**

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
git diff --check
```

로컬 환경변수가 없으면 build 프로세스에만 스키마를 만족하는 비밀이 아닌 임시 URL·키를 주입하고 저장소 파일에는 기록하지 않는다. Expected: 모든 명령 exit 0, Vitest 실패 0, ESLint 오류 0, Next.js production build 성공.

- [ ] **Step 2: 데이터베이스 검증 상태 기록**

로컬 Supabase가 있으면 다음을 실행한다.

```bash
supabase test db --file tests/db/010_statistics_groups.test.sql
```

없으면 SQL Editor에 적용할 파일과 확인 쿼리가 문서에 포함됐는지 검토하고, DB 계약은 미실행이라고 최종 인계에 명시한다. 운영 Supabase에서 파괴적 E2E를 실행하지 않는다.

- [ ] **Step 3: 요구사항 독립 리뷰**

설계 문서의 성공 기준을 다음 체크리스트로 대조한다.

- 그룹 없음 → 기존 분류 표시
- 그룹 포함 분류 → 그룹 합계와 펼친 하위 분류
- 그룹 미지정 분류 → 단독 표시
- 수입·지출 분리와 한 분류 한 그룹
- 그룹 삭제 → 연결 해제만 수행
- 소유자 변경/구성원 조회
- 가계부 입력·원본 거래 무변경
- 스키마 미적용 fallback

발견된 결함마다 재현 실패 테스트를 먼저 추가하고 최소 수정 후 Step 1을 다시 실행한다.

- [ ] **Step 4: 최종 커밋**

수정이 있으면 관련 파일만 stage하고 다음 메시지로 커밋한다. 수정이 없으면 빈 커밋을 만들지 않는다.

```bash
git commit -m "수정: 통계 그룹 최종 검토 반영"
```

- [ ] **Step 5: 배포 인계**

최종 응답에는 다음을 포함한다.

- 구현 커밋 목록과 현재 브랜치
- 테스트 파일/테스트 수, 타입 검사, 린트, 빌드 결과
- pgTAP과 호스팅 E2E의 실행 또는 안전 skip 상태
- `202609110009_statistics_groups.sql`을 코드보다 먼저 적용해야 한다는 경고
- SQL Editor 확인 쿼리
- GitHub push 여부와 사용자가 수행할 다음 단계
