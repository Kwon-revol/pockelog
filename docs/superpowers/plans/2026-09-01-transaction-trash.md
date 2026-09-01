# PockeLog 거래 휴지통 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 장부의 소유자가 삭제 거래를 무한 스크롤로 조회하고 안전하게 복원하거나 영구 삭제하는 설정 하위 화면을 만든다.

**Architecture:** 기존 활성 거래 RLS를 넓히지 않고 소유권을 내부 검증하는 세 개의 제한된 PostgreSQL RPC로 휴지통 경계를 만든다. Next.js 서버 계층은 현재 장부 결정, RPC 오류 매핑, 커서 페이지 구성과 캐시 무효화를 담당하고 클라이언트는 반응형 목록과 항목별 요청 상태만 관리한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/PostgreSQL RLS/RPC, Zod, Vitest, Testing Library, pgTAP, Playwright

**Spec:** `docs/superpowers/specs/2026-09-01-transaction-trash-design.md`

## Global Constraints

- CSV 내보내기, 일괄 복원·삭제, 자동 보관 기간, 삭제 취소 토스트는 구현하지 않는다.
- 개인·공동 장부 모두 장부 소유자만 휴지통을 조회·복원·영구 삭제할 수 있다.
- 화면 페이지 크기는 50건이고 내부 조회만 다음 페이지 확인용 1건을 추가한다.
- 모든 권한 판단은 `auth.uid()`와 DB의 실제 소유권으로 수행하며 클라이언트 사용자 ID를 신뢰하지 않는다.
- 자동 영구 삭제는 없으며 영구 삭제에는 복구 불가 경고와 사용자 확인이 필요하다.
- 새 SQL은 Supabase SQL Editor에서 재실행해도 같은 함수·권한 상태를 유지해야 한다.
- Docker와 로컬 Supabase 실행은 요구하지 않는다.
- 모든 구현은 실패 테스트를 먼저 확인하고 최소 구현 후 전체 회귀 검증을 수행한다.

---

## File Structure

- `src/features/trash/types.ts`: 휴지통 항목, 페이지, 액션, 게이트웨이 계약
- `src/features/trash/cursor.ts`: `(deletedAt,id)` 커서 인코딩·검증
- `src/features/trash/schemas.ts`: 거래 ID와 API 커서 입력 검증
- `src/features/trash/workflows.ts`: 복원·영구 삭제 결과를 사용자 상태로 매핑
- `src/features/trash/supabase-gateway.ts`: 변경 RPC 호출과 오류 분류
- `src/features/trash/queries.ts`: 인증·현재 장부 결정과 삭제 거래 페이지 매핑
- `src/features/trash/actions.ts`: 서버 액션과 관련 경로 재검증
- `src/features/trash/use-trash-pages.ts`: 무한 스크롤과 성공 항목 제거
- `src/features/trash/trash-screen.tsx`: 모바일 카드·PC 표와 확인·오류 UI
- `src/app/(app)/settings/trash/page.tsx`: 소유자 전용 초기 화면
- `src/app/api/trash/route.ts`: 다음 커서 페이지 JSON API
- `src/features/settings/settings-screen.tsx`: 소유자 전용 데이터 관리 링크
- `supabase/migrations/202609010007_transaction_trash.sql`: 조회·복원·영구 삭제 RPC와 권한
- `tests/db/008_transaction_trash.test.sql`: SQL·RLS·권한 계약
- `tests/unit/trash-*.test.ts(x)`: 도메인, 게이트웨이, 조회, 액션, API, UI 회귀
- `tests/e2e/ledger.spec.ts`: 호스팅 개발 DB의 삭제→복원→영구 삭제 흐름
- `README.md`, `docs/supabase-setup.md`: 적용 순서와 검증 SQL

---

### Task 1: 휴지통 계약과 커서

**Files:**
- Create: `src/features/trash/types.ts`
- Create: `src/features/trash/cursor.ts`
- Create: `src/features/trash/schemas.ts`
- Create: `tests/unit/trash-domain.test.ts`

**Interfaces:**
- Produces: `TrashItem`, `TrashPage`, `TrashActionState`, `TrashMutationResult`, `encodeTrashCursor`, `decodeTrashCursor`, `trashTransactionIdSchema`, `trashPageParamsSchema`
- Consumes: 기존 `TransactionType`과 UUID·날짜 문자열

- [ ] **Step 1: 커서와 입력 계약의 실패 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import { decodeTrashCursor, encodeTrashCursor } from "@/features/trash/cursor";
import { trashPageParamsSchema, trashTransactionIdSchema } from "@/features/trash/schemas";

describe("trash domain", () => {
  it("round-trips a deleted-at and UUID cursor", () => {
    const cursor = { deletedAt: "2026-09-01T01:02:03.000Z", id: "11111111-1111-4111-8111-111111111111" };
    expect(decodeTrashCursor(encodeTrashCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursors and transaction ids", () => {
    expect(decodeTrashCursor("not-base64")).toBeNull();
    expect(trashTransactionIdSchema.safeParse("not-an-id").success).toBe(false);
    expect(trashPageParamsSchema.safeParse({ cursor: "not-base64" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트가 필요한 모듈 부재로 실패하는지 확인**

Run: `npm test -- --run tests/unit/trash-domain.test.ts`

Expected: FAIL because `@/features/trash/cursor` and `schemas` do not exist.

- [ ] **Step 3: 타입과 최소 커서 구현 작성**

```ts
// src/features/trash/types.ts
import type { TransactionType } from "@/features/transactions/types";

export type TrashItem = {
  id: string;
  type: TransactionType;
  occurredOn: string;
  description: string;
  amount: number;
  memo: string;
  category: { name: string; color: string };
  createdBy: { id: string; name: string };
  deletedAt: string;
};

export type TrashPage = { items: TrashItem[]; nextCursor: string | null };
export type TrashMutationResult = "restored" | "deleted" | "missing" | "forbidden" | "error";
export type TrashActionState = { status: "success" | "error"; message: string };
```

```ts
// src/features/trash/cursor.ts
import { z } from "zod";

const cursorSchema = z.object({
  deletedAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});
export type TrashCursor = z.infer<typeof cursorSchema>;

export function encodeTrashCursor(cursor: TrashCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeTrashCursor(value: string): TrashCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const result = cursorSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
```

`trashPageParamsSchema`는 `cursor`가 없으면 허용하고 값이 있으면 `decodeTrashCursor`가 `null`이 아닌지 `refine`한다. `trashTransactionIdSchema`는 `z.string().uuid()`를 사용한다.

- [ ] **Step 4: 계약 테스트와 타입 검사 실행**

Run: `npm test -- --run tests/unit/trash-domain.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: 계약 커밋**

```bash
git add src/features/trash/types.ts src/features/trash/cursor.ts src/features/trash/schemas.ts tests/unit/trash-domain.test.ts
git commit -m "기능: 휴지통 데이터 계약 추가"
```

---

### Task 2: 소유자 전용 데이터베이스 RPC

**Files:**
- Create: `supabase/migrations/202609010007_transaction_trash.sql`
- Create: `tests/db/008_transaction_trash.test.sql`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Produces: `get_deleted_transactions(uuid,timestamptz,uuid,integer)`, `restore_deleted_transaction(uuid)`, `permanently_delete_transaction(uuid)`
- Consumes: 기존 `transactions`, `ledgers`, `categories`, `profiles`, `get_transaction_summary`

- [ ] **Step 1: pgTAP 실패 계약 작성**

`tests/db/008_transaction_trash.test.sql`은 트랜잭션 안에서 소유자 A, 일반 구성원 B, 외부 사용자 C와 삭제 거래를 만든 뒤 최소 다음 24개 단언을 포함한다.

```sql
select plan(24);
select has_function('public', 'get_deleted_transactions', array['uuid','timestamp with time zone','uuid','integer']);
select has_function('public', 'restore_deleted_transaction', array['uuid']);
select has_function('public', 'permanently_delete_transaction', array['uuid']);
select function_privs_are('public', 'restore_deleted_transaction', array['uuid'], 'authenticated', array['EXECUTE']);
select throws_ok(
  $$select * from public.get_deleted_transactions('82000000-0000-4000-8000-000000000001', null, null, 50)$$,
  '42501', 'ledger owner required', '일반 구성원은 휴지통을 조회할 수 없다'
);
```

소유자 역할에서는 삭제 거래만 삭제 최신순으로 보이는지, 활성 거래가 제외되는지, 51번째 sentinel 행이 반환되는지 확인한다. 복원 전후 `deleted_at/deleted_by`, 일반 거래 조회 수, `get_transaction_summary` 합계를 비교한다. 비활성 분류 거래 복원, 반복 복원 `missing`, 영구 삭제 후 행 부재, 다른 장부 ID에 대한 공통 `missing`, anon/PUBLIC 실행 권한 부재를 단언하고 `finish()` 후 rollback한다.

- [ ] **Step 2: 마이그레이션 부재로 계약이 실패하는지 확인**

Run on a disposable Supabase test database: `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/db/008_transaction_trash.test.sql`

Expected: FAIL because the three RPC functions do not exist.

- [ ] **Step 3: 조회 RPC 구현**

```sql
create or replace function public.get_deleted_transactions(
  target_ledger_id uuid,
  cursor_deleted_at timestamptz default null,
  cursor_id uuid default null,
  page_size integer default 50
)
returns table (
  id uuid, type public.transaction_type, occurred_on date, description text,
  amount bigint, memo text, category_name text, category_color text,
  created_by uuid, creator_name text, deleted_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.ledgers as ledger
    where ledger.id = target_ledger_id and ledger.owner_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'ledger owner required';
  end if;

  return query
  select transaction_row.id, transaction_row.type, transaction_row.occurred_on,
    transaction_row.description, transaction_row.amount,
    coalesce(transaction_row.memo, ''), category.name, category.color,
    transaction_row.created_by, coalesce(profile.display_name, '알 수 없는 사용자'),
    transaction_row.deleted_at
  from public.transactions as transaction_row
  join public.categories as category on category.id = transaction_row.category_id
  left join public.profiles as profile on profile.id = transaction_row.created_by
  where transaction_row.ledger_id = target_ledger_id
    and transaction_row.deleted_at is not null
    and (
      cursor_deleted_at is null
      or (transaction_row.deleted_at, transaction_row.id) < (cursor_deleted_at, cursor_id)
    )
  order by transaction_row.deleted_at desc, transaction_row.id desc
  limit least(greatest(page_size, 1), 50) + 1;
end;
$$;
```

- [ ] **Step 4: 복원·영구 삭제 RPC와 권한 구현**

두 변경 함수는 `security definer`, 빈 `search_path`, `auth.uid()` 확인을 사용한다. 대상 잠금 쿼리는 다른 장부의 행 존재 여부를 노출하지 않도록 소유 장부 조인을 포함한다.

```sql
select transaction_row.id into owned_transaction_id
from public.transactions as transaction_row
join public.ledgers as ledger on ledger.id = transaction_row.ledger_id
where transaction_row.id = target_transaction_id
  and transaction_row.deleted_at is not null
  and ledger.owner_id = auth.uid()
for update of transaction_row;
if owned_transaction_id is null then return 'missing'; end if;
```

복원은 `deleted_at = null, deleted_by = null`, 영구 삭제는 `delete from public.transactions where id = owned_transaction_id`를 수행한다. 세 함수 모두 `PUBLIC`, `anon`, `authenticated`에서 먼저 revoke하고 마지막에 `authenticated`만 grant한다. 테이블 `delete` grant는 추가하지 않는다.

- [ ] **Step 5: SQL 계약 통과 확인과 적용 문서 갱신**

Run: migration 적용 후 `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/db/008_transaction_trash.test.sql`

Expected: `1..24`, 모든 단언 `ok`.

`docs/supabase-setup.md`에 007 적용 순서와 `to_regprocedure`, `has_function_privilege`, 테이블 RLS 확인 쿼리를 추가한다.

- [ ] **Step 6: DB 커밋**

```bash
git add supabase/migrations/202609010007_transaction_trash.sql tests/db/008_transaction_trash.test.sql docs/supabase-setup.md
git commit -m "기능: 거래 휴지통 데이터베이스 함수 추가"
```

---

### Task 3: 조회·변경 서버 계층과 페이지 API

**Files:**
- Create: `src/features/trash/workflows.ts`
- Create: `src/features/trash/supabase-gateway.ts`
- Create: `src/features/trash/queries.ts`
- Create: `src/features/trash/actions.ts`
- Create: `src/app/api/trash/route.ts`
- Create: `tests/unit/trash-workflows.test.ts`
- Create: `tests/unit/trash-gateway.test.ts`
- Create: `tests/unit/trash-query.test.ts`
- Create: `tests/unit/trash-actions.test.ts`
- Create: `tests/unit/trash-route.test.ts`

**Interfaces:**
- Consumes: Task 1 types·schemas·cursor와 Task 2 RPC
- Produces: `getTrashPageForCurrentUser(cursor?)`, `restoreDeletedTransactionAction(id)`, `permanentlyDeleteTransactionAction(id)`, `GET /api/trash?cursor=...`

- [ ] **Step 1: 워크플로·게이트웨이 실패 테스트 작성**

```ts
it("maps restored and missing without exposing another ledger", async () => {
  expect(await restoreDeletedTransaction(id, gateway("restored"))).toEqual({
    status: "success", message: "내역을 복원했어요.",
  });
  expect(await restoreDeletedTransaction(id, gateway("missing"))).toEqual({
    status: "error", message: "이 내역을 변경할 수 없습니다.",
  });
});
```

게이트웨이 테스트는 RPC `restore_deleted_transaction`, `permanently_delete_transaction`의 정확한 인자 `{ target_transaction_id: id }`, `42501 → forbidden`, 그 외 오류 → `error`를 검사한다.

- [ ] **Step 2: 조회·액션·API 실패 테스트 작성**

조회 fixture는 RPC 51행을 제공하고 결과가 50행과 51번째가 아닌 50번째 항목 기반 `nextCursor`로 변환되는지 검사한다. 인증 없음은 `TrashAuthenticationError`, `42501`은 `TrashAuthorizationError`, `42883`/`PGRST202`는 `TrashUnavailableError`, 나머지는 `TrashQueryError`가 되어야 한다.

액션 테스트는 잘못된 UUID에서 게이트웨이를 호출하지 않고, 성공 시 아래 네 경로를 재검증하는지 검사한다.

```ts
expect(revalidatePath).toHaveBeenCalledWith("/settings/trash");
expect(revalidatePath).toHaveBeenCalledWith("/ledger");
expect(revalidatePath).toHaveBeenCalledWith("/statistics");
expect(revalidatePath).toHaveBeenCalledWith("/tax-goals");
```

API 테스트는 잘못된 커서 400, 세션 없음 401, 소유권 없음 403, 스키마 미적용 503, 성공 200을 검사한다.

- [ ] **Step 3: 실패 확인**

Run: `npm test -- --run tests/unit/trash-workflows.test.ts tests/unit/trash-gateway.test.ts tests/unit/trash-query.test.ts tests/unit/trash-actions.test.ts tests/unit/trash-route.test.ts`

Expected: FAIL because server modules and API route do not exist.

- [ ] **Step 4: 워크플로와 Supabase 게이트웨이 최소 구현**

```ts
export type TrashMutationGateway = {
  restore(id: string): Promise<TrashMutationResult>;
  permanentlyDelete(id: string): Promise<TrashMutationResult>;
};

export async function restoreDeletedTransaction(id: string, gateway: TrashMutationGateway) {
  const result = await gateway.restore(id);
  if (result === "restored") return { status: "success", message: "내역을 복원했어요." } as const;
  return { status: "error", message: result === "error" ? "복원하지 못했습니다. 다시 시도해 주세요." : "이 내역을 변경할 수 없습니다." } as const;
}
```

영구 삭제 성공 문구는 `내역을 영구 삭제했어요.`, 일반 실패 문구는 `영구 삭제하지 못했습니다. 다시 시도해 주세요.`를 사용한다.

- [ ] **Step 5: 조회와 커서 페이지 구현**

`getTrashPageForCurrentUser(cursor?: string)`는 `createServerClient()`로 사용자와 `user_private_profiles.default_ledger_id`를 읽고, Task 2 조회 RPC에 `page_size: 50`과 해석된 커서를 전달한다. 51행이면 앞 50행만 매핑하고 50번째 표시 항목의 `{deletedAt,id}`를 다음 커서로 만든다. 50행 이하면 `nextCursor=null`이다.

- [ ] **Step 6: 서버 액션과 API route 구현**

서버 액션은 `trashTransactionIdSchema.safeParse(id)` 후 워크플로를 호출한다. 성공한 경우에만 네 소비 경로를 재검증한다. API route는 `trashPageParamsSchema`와 예외 클래스를 HTTP 상태로 매핑하고 내부 DB 메시지를 응답에 포함하지 않는다.

- [ ] **Step 7: 서버 계층 테스트와 타입 검사 통과 확인**

Run: `npm test -- --run tests/unit/trash-workflows.test.ts tests/unit/trash-gateway.test.ts tests/unit/trash-query.test.ts tests/unit/trash-actions.test.ts tests/unit/trash-route.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 8: 서버 계층 커밋**

```bash
git add src/features/trash src/app/api/trash tests/unit/trash-*.test.ts
git commit -m "기능: 휴지통 조회와 변경 서버 계층 추가"
```

---

### Task 4: 소유자 전용 휴지통 화면과 설정 진입점

**Files:**
- Create: `src/features/trash/use-trash-pages.ts`
- Create: `src/features/trash/trash-screen.tsx`
- Create: `src/app/(app)/settings/trash/page.tsx`
- Modify: `src/features/settings/settings-screen.tsx`
- Create: `tests/unit/trash-ui.test.tsx`
- Modify: `tests/unit/settings-ui.test.tsx`

**Interfaces:**
- Consumes: Task 3 초기 `TrashPage`, API, 복원·영구 삭제 액션
- Produces: `/settings/trash` 반응형 화면과 설정의 소유자 전용 링크

- [ ] **Step 1: 설정 진입점과 화면 실패 테스트 작성**

```tsx
it("shows trash data management only to the owner", () => {
  renderScreen();
  expect(screen.getByRole("link", { name: "휴지통 보기" })).toHaveAttribute("href", "/settings/trash");
  cleanup();
  renderScreen({ data: { ...data, isOwner: false } });
  expect(screen.queryByRole("link", { name: "휴지통 보기" })).not.toBeInTheDocument();
});
```

휴지통 UI fixture로 모바일 카드·PC 표 공통 텍스트, 빈 상태, 복원 성공 제거, 영구 삭제 확인 취소, 성공 제거, 실패 유지·오류, 처리 중 두 버튼 잠금, 일반 구성원의 금지 안내를 검사한다.

- [ ] **Step 2: 무한 스크롤 실패 테스트 작성**

가짜 `IntersectionObserver`와 지연 Promise를 사용해 sentinel 진입 두 번에도 같은 커서 요청이 한 번만 발생하는지, 성공 페이지가 ID 중복 없이 추가되는지, `nextCursor=null` 이후 요청하지 않는지, 완료 문구가 없는지 검사한다.

- [ ] **Step 3: UI 테스트 실패 확인**

Run: `npm test -- --run tests/unit/trash-ui.test.tsx tests/unit/settings-ui.test.tsx`

Expected: FAIL because the screen, hook, route page, and settings link do not exist.

- [ ] **Step 4: 무한 스크롤 훅 구현**

`useTrashPages(initialPage, loadPage=fetchTrashPage)`는 `items`, `nextCursor`, `loading`, `loadError`, `pendingIds`를 관리한다. `requestNextPage`, `removeItem`, `setItemPending`을 반환하고 세션 만료 401에서는 `/login?next=%2Fsettings%2Ftrash`로 이동한다. 403은 설정으로 돌아갈 수 있는 권한 오류로 표시하며 기존 목록을 노출하지 않는다.

- [ ] **Step 5: 반응형 휴지통 화면 구현**

`TrashScreen` props는 아래 계약을 사용한다.

```ts
type TrashScreenProps = {
  ledgerName: string;
  initialPage: TrashPage;
  restoreAction: (id: string) => Promise<TrashActionState>;
  permanentlyDeleteAction: (id: string) => Promise<TrashActionState>;
  loadPage?: (cursor: string) => Promise<TrashPage>;
};
```

`md:hidden` 카드와 `hidden md:table` 표가 같은 `items`를 사용한다. 복원 확인 문구는 `이 내역을 복원할까요?`, 영구 삭제 확인 문구는 `이 내역은 복구할 수 없습니다. 영구 삭제할까요?`로 고정한다. 성공 시 `removeItem`, 실패 시 항목별 `role="alert"`를 표시한다.

- [ ] **Step 6: 서버 페이지와 설정 카드 구현**

서버 페이지는 `getTrashPageForCurrentUser()`를 호출한다. 인증 오류는 `/login?next=%2Fsettings%2Ftrash`, 권한 오류는 소유자 전용 안내와 `/settings` 링크, 스키마 미적용은 `휴지통 준비가 아직 끝나지 않았어요` 안내를 표시한다. 설정 `데이터 관리` 카드는 `data.isOwner`일 때만 렌더링한다.

- [ ] **Step 7: UI 테스트와 접근성 검사 통과 확인**

Run: `npm test -- --run tests/unit/trash-ui.test.tsx tests/unit/settings-ui.test.tsx && npm run lint && npm run typecheck`

Expected: PASS with no React hook or accessibility lint errors.

- [ ] **Step 8: UI 커밋**

```bash
git add src/features/trash/use-trash-pages.ts src/features/trash/trash-screen.tsx 'src/app/(app)/settings/trash/page.tsx' src/features/settings/settings-screen.tsx tests/unit/trash-ui.test.tsx tests/unit/settings-ui.test.tsx
git commit -m "기능: 설정에 거래 휴지통 화면 추가"
```

---

### Task 5: 호스팅 통합 시나리오와 배포 문서

**Files:**
- Modify: `tests/e2e/ledger.spec.ts`
- Modify: `README.md`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: Task 2 DB 함수와 Task 4 사용자 화면
- Produces: 모바일·PC 삭제→복원→영구 삭제 회귀와 운영 적용 절차

- [ ] **Step 1: 호스팅 E2E 시나리오 추가**

기존 `E2E_ALLOW_HOSTED_SUPABASE`, 프로젝트 ref, DB 안전 표시 조건 안에서 다음 순서로 검증한다.

```ts
await openTransaction(page, testInfo, "휴지통 검증");
page.once("dialog", (dialog) => dialog.accept());
await page.getByRole("button", { name: "삭제" }).click();
await page.goto("/settings/trash");
await expect(page.getByText("휴지통 검증").first()).toBeVisible();
page.once("dialog", (dialog) => dialog.accept());
await page.getByRole("button", { name: "복원" }).first().click();
await page.goto("/ledger");
await expect(page.getByText("휴지통 검증").first()).toBeVisible();
```

같은 거래를 다시 휴지통으로 보내고 영구 삭제 확인 후 휴지통과 가계부 양쪽에서 사라지는지 검사한다. 기존 E2E 계정 정리 절차를 그대로 사용한다.

- [ ] **Step 2: 공개 화면 E2E와 호스팅 조건 확인**

Run without destructive env: `npm run test:e2e -- --project=desktop-chromium tests/e2e/auth.spec.ts`

Expected: 공개 로그인·회원가입 테스트 PASS, 호스팅 변경 테스트는 명시적으로 SKIP.

Run only on the dedicated hosted development project after migration 007 and safety marker verification: `npm run test:e2e -- --project=desktop-chromium --project=mobile-chromium tests/e2e/ledger.spec.ts`

Expected: both projects PASS.

- [ ] **Step 3: README와 적용 문서 완성**

README 마이그레이션 목록에 `202609010007_transaction_trash.sql`을 추가한다. `docs/supabase-setup.md`에는 SQL Editor 적용, 함수 존재·권한 확인, 소유자/일반 구성원 수동 확인, Vercel 재배포 순서를 기록한다. CSV 기능은 제공하지 않는다고 명시한다.

- [ ] **Step 4: 문서·E2E 커밋**

```bash
git add tests/e2e/ledger.spec.ts README.md docs/supabase-setup.md
git commit -m "검증: 휴지통 통합 시나리오와 배포 문서 추가"
```

---

### Task 6: 전체 검증과 리뷰

**Files:**
- Review: `supabase/migrations/202609010007_transaction_trash.sql`
- Review: `src/features/trash/**`
- Review: `src/app/(app)/settings/trash/page.tsx`
- Review: `src/app/api/trash/route.ts`
- Review: `tests/db/008_transaction_trash.test.sql`

**Interfaces:**
- Consumes: Tasks 1–5 전체 결과
- Produces: 병합 가능한 검증 결과와 운영 적용 체크리스트

- [ ] **Step 1: 전체 정적·단위 검증**

Run:

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: 모든 명령 exit 0. 빌드 명령에는 실제 값을 출력하지 않고 필요한 네 환경변수를 현재 프로세스에만 주입한다.

- [ ] **Step 2: DB 계약 검증 또는 명시적 제한 기록**

전용 테스트 DB가 있으면 001~008 pgTAP을 순서대로 실행해 모두 통과해야 한다. 이 환경처럼 Docker와 전용 DB 연결이 없으면 SQL 계약 파일, 함수 권한, 완전 수식 객체, 빈 `search_path`, 소유권 필터를 정적 검토하고 실제 실행이 남았음을 완료 보고에 명시한다. 운영 DB에서 자동 파괴 테스트를 실행하지 않는다.

- [ ] **Step 3: 독립 코드 리뷰**

리뷰 범위는 설계 커밋 다음 커밋부터 HEAD까지다. 소유권 우회, 다른 장부 거래 존재 유출, `security definer` 권한, 복원 후 집계, 영구 삭제 확인, 커서 중복·누락, 모바일·PC 접근성을 집중 검토한다. Critical/Important 지적은 회귀 테스트를 먼저 추가한 뒤 수정한다.

- [ ] **Step 4: 수정 후 전체 검증 재실행**

Run the Step 1 command set again and read every exit code before completion claims.

- [ ] **Step 5: 최종 커밋**

리뷰 수정이 있으면 관련 파일만 묶어 다음 형식으로 커밋한다.

```bash
git add supabase/migrations/202609010007_transaction_trash.sql tests/db/008_transaction_trash.test.sql src/features/trash 'src/app/(app)/settings/trash/page.tsx' src/app/api/trash tests/unit/trash-*.test.ts tests/unit/trash-ui.test.tsx
git commit -m "수정: 휴지통 권한과 상태 처리 보강"
```

- [ ] **Step 6: 배포 인계**

사용자에게 migration 007을 Supabase SQL Editor에서 먼저 실행하게 안내한다. 확인 결과가 모두 `true`인 뒤 사용자가 요청한 Git 전략에 따라 `main` 직접 푸시 또는 PR을 수행하고 Vercel 배포 완료 후 소유자·일반 구성원 접근을 확인한다.
