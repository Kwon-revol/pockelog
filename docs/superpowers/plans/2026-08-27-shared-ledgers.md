# PockeLog 공동 장부 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 가입자를 앱 내부로 초대해 개인 장부와 공동 장부를 전환하며 함께 거래를 기록하고, 소유자·참여자 권한을 UI와 RLS에서 일치시키는 공동 장부 기능을 구현한다.

**Architecture:** 로그인 세션을 사용하는 일반 조회·변경과 `service_role`만 호출할 수 있는 초대 대상 식별 조회를 분리한다. 공동 장부 생성, 초대 응답, 제거, 나가기, 삭제는 PostgreSQL 함수에서 원자적으로 처리하고 Next.js 서버 액션은 입력 검증·오류 매핑·캐시 갱신만 담당한다. 공용 장부 컨텍스트가 현재 장부와 참여 장부 목록을 앱 셸, 가계부, 통계, 설정에 공급한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Supabase PostgreSQL/RLS, Zod 4, Vitest, Testing Library, pgTAP, Playwright

**Spec:** `docs/superpowers/specs/2026-08-27-shared-ledgers-design.md`

## Global Constraints

- 모든 수정은 `D:\myProject\pockelog\.worktrees\shared-ledgers` 안에서만 수행한다.
- 외부 초대 이메일, 미가입자 초대, 소유권 이전, 공개 참여 링크는 구현하지 않는다.
- 일반 데이터 요청은 로그인 사용자의 Supabase 세션과 RLS를 사용한다.
- `SUPABASE_SECRET_KEY`는 서버 전용 초대 대상 UUID 조회에만 사용하며 브라우저 번들·로그·오류 문구에 노출하지 않는다.
- 개인 장부는 삭제·초대·나가기 대상이 아니다.
- 초대는 7일 뒤 만료되며 만료된 초대는 수락할 수 없다.
- 소유자는 모든 공동 장부 거래를 관리하고 참여자는 자신이 만든 거래만 수정·휴지통 이동한다.
- 접근권한을 잃은 사용자의 현재 장부는 그 사용자의 개인 장부로 자동 복구한다.
- 공동 장부 삭제는 장부 이름을 정확히 다시 입력해야 하며 복구할 수 없다.
- 모바일과 PC에서 동일한 기능과 키보드 접근 가능한 컨트롤을 제공한다.

---

### Task 1: 공동 장부 입력 계약과 워크플로

**Files:**
- Create: `src/features/shared-ledgers/types.ts`
- Create: `src/features/shared-ledgers/schemas.ts`
- Create: `src/features/shared-ledgers/workflows.ts`
- Create: `tests/unit/shared-ledgers-domain.test.ts`
- Create: `tests/unit/shared-ledgers-workflows.test.ts`

**Interfaces:**
- Produces: `SharedLedgerSummary`, `LedgerInvitation`, `LedgerMember`, `SharedLedgerPageData`, `SharedLedgerActionState`, `SharedLedgerGateway`.
- Produces: `createSharedLedger`, `switchLedger`, `inviteLedgerMember`, `respondToInvitation`, `revokeInvitation`, `removeLedgerMember`, `leaveSharedLedger`, `deleteSharedLedger`.
- Consumes: 로그인 사용자 ID와 현재 장부 역할을 게이트웨이 컨텍스트로 받는다.

- [ ] **Step 1: 실패하는 입력 스키마 테스트 작성**

다음 계약을 `shared-ledgers-domain.test.ts`에 고정한다.

```ts
expect(sharedLedgerNameSchema.safeParse("  우리 집  ").data).toBe("우리 집");
expect(sharedLedgerNameSchema.safeParse(" ").success).toBe(false);
expect(invitationIdentifierSchema.safeParse("User_Name").data).toBe("user_name");
expect(invitationIdentifierSchema.safeParse("person@example.com").success).toBe(true);
expect(deleteSharedLedgerSchema.safeParse({ ledgerId: validId, confirmationName: "우리 집" }).success).toBe(true);
```

- [ ] **Step 2: 스키마 테스트 실패 확인**

Run: `npm test -- --run tests/unit/shared-ledgers-domain.test.ts`

Expected: `src/features/shared-ledgers/schemas.ts`가 없어 FAIL.

- [ ] **Step 3: 타입과 Zod 스키마 구현**

장부명은 trim 후 1~50자, 초대 식별자는 trim 후 이메일 또는 기존 로그인 아이디 규칙, 모든 ID는 UUID로 검증한다. `SharedLedgerActionState`는 기존 서버 액션과 같은 `idle|success|error`, `message`, `fieldErrors` 구조를 사용한다.

- [ ] **Step 4: 실패하는 워크플로 테스트 작성**

게이트웨이 스텁으로 아래 결과를 검증한다.

```ts
expect(await createSharedLedger({ name: "우리 집" }, ownerGateway)).toMatchObject({ status: "success" });
expect(await inviteLedgerMember({ ledgerId, identifier: "me" }, selfTargetGateway)).toMatchObject({ status: "error", message: expect.stringContaining("본인") });
expect(await respondToInvitation(invitationId, "accept", expiredGateway)).toMatchObject({ status: "error", message: expect.stringContaining("만료") });
expect(await leaveSharedLedger(personalLedgerId, memberGateway)).toMatchObject({ status: "error" });
```

로그아웃, 개인 장부 초대, 중복 초대, 이미 구성원, 권한 없음, 만료, 동시 처리 충돌, DB 오류도 각각 안전한 한국어 결과로 매핑한다.

- [ ] **Step 5: 최소 워크플로 구현 및 통과 확인**

Run: `npm test -- --run tests/unit/shared-ledgers-domain.test.ts tests/unit/shared-ledgers-workflows.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/features/shared-ledgers tests/unit/shared-ledgers-domain.test.ts tests/unit/shared-ledgers-workflows.test.ts
git commit -m "기능: 공동 장부 입력 검증과 변경 흐름 추가"
```

### Task 2: 초대·구성원 데이터베이스와 RLS 계약

**Files:**
- Create: `supabase/migrations/202608270005_shared_ledgers.sql`
- Create: `tests/db/006_shared_ledgers.test.sql`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Produces: `public.ledger_invitation_status`와 `public.ledger_invitations`.
- Produces: `create_shared_ledger(text)`, `resolve_invitation_target(text)`, `create_ledger_invitation(uuid,uuid)`, `respond_to_ledger_invitation(uuid,text)`, `revoke_ledger_invitation(uuid)`, `remove_ledger_member(uuid,uuid)`, `leave_shared_ledger(uuid)`, `delete_shared_ledger(uuid,text)`.
- Consumes: `is_ledger_member`, `is_ledger_owner`, `private.account_identifiers`, `private.handle_new_ledger`, 기존 거래 RLS.

- [ ] **Step 1: 실패하는 pgTAP 계약 작성**

`006_shared_ledgers.test.sql`은 두 사용자와 각 개인 장부를 만든 뒤 다음을 검증한다.

```sql
select lives_ok($$select public.create_shared_ledger('우리 집')$$, '공동 장부를 원자적으로 만든다');
select throws_ok($$select public.create_ledger_invitation(personal_id, user_b)$$, '42501', null, '개인 장부에는 초대할 수 없다');
select throws_ok($$select public.respond_to_ledger_invitation(expired_id, 'accept')$$, 'P0001', 'invitation expired', '만료 초대 수락을 거부한다');
```

본인·중복·기존 구성원 초대, 다른 사용자의 초대 조회·응답, 소유자가 아닌 사용자의 취소·제거, 소유자 나가기, 이름 불일치 삭제도 거부하고 실패 전후 행 수와 구성원 상태가 같음을 비교한다.

- [ ] **Step 2: DB 테스트가 새 객체 부재로 실패하는지 확인**

Run: `supabase test db tests/db/006_shared_ledgers.test.sql`

Expected: 새 enum·table·함수가 없어 FAIL. Supabase CLI/Docker가 없는 환경이면 실행 불가 사실을 기록하고 SQL 계약을 정적 검토한다.

- [ ] **Step 3: 초대 테이블, 인덱스, RLS 구현**

`pending` 부분 고유 인덱스와 다음 읽기 조건을 적용한다.

```sql
using (
  target_user_id = auth.uid()
  or public.is_ledger_owner(ledger_id)
)
```

직접 insert/update/delete 권한은 주지 않고 authenticated 역할에는 검증 함수 실행 권한만 부여한다. `resolve_invitation_target(text)`는 빈 `search_path`의 `security definer`로 만들고 `service_role`만 실행할 수 있게 한다.

- [ ] **Step 4: 원자적 함수와 기본 장부 복구 트리거 구현**

`create_shared_ledger`는 장부·소유자 구성원·15개 기본 분류·현재 장부 전환을 한 트랜잭션에서 처리한다. 초대 응답은 대상 행을 `for update`로 잠그고 만료와 현재 상태를 재검증한다. 구성원 삭제 후 트리거는 삭제 대상의 `default_ledger_id`가 해당 장부이면 그 사용자의 `kind='personal'` 장부로 변경한다.

- [ ] **Step 5: 거래 RLS 회귀 계약 확인**

공동 장부 구성원 A/B가 전체 활성 거래를 조회하되, B는 `created_by=B`인 거래만 수정하고 소유자 A는 두 사용자의 거래를 수정할 수 있음을 같은 pgTAP 파일에서 검증한다.

- [ ] **Step 6: SQL 계약 및 문서 확인**

Run: `supabase test db tests/db/006_shared_ledgers.test.sql`

Expected: PASS 또는 호스팅 SQL Editor 단회 적용과 아래 존재 확인 쿼리가 문서화됨.

```sql
select to_regclass('public.ledger_invitations') is not null;
select to_regprocedure('public.create_shared_ledger(text)') is not null;
```

- [ ] **Step 7: 커밋**

```bash
git add supabase/migrations/202608270005_shared_ledgers.sql tests/db/006_shared_ledgers.test.sql docs/supabase-setup.md
git commit -m "데이터베이스: 공동 장부 초대와 권한 추가"
```

### Task 3: 공용 장부 컨텍스트와 서버 변경 계층

**Files:**
- Create: `src/features/ledgers/types.ts`
- Create: `src/features/shared-ledgers/query-utils.ts`
- Create: `src/features/shared-ledgers/queries.ts`
- Create: `src/features/shared-ledgers/supabase-gateway.ts`
- Create: `src/features/shared-ledgers/actions.ts`
- Modify: `src/features/ledgers/queries.ts`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Create: `tests/unit/shared-ledgers-query.test.ts`

**Interfaces:**
- Produces: `AppLedgerContext = { userId, userName, currentLedger, ledgers, pendingInvitationCount }`.
- Produces: `getCurrentAppContext()`, `getSharedLedgerPageData()`, Task 1 워크플로에 연결되는 서버 액션 8개.
- Consumes: Task 2 RPC와 `createServerClient`, 초대 대상 조회에만 `createAdminClient`.

- [ ] **Step 1: 실패하는 컨텍스트·조회 매핑 테스트 작성**

```ts
expect(mapLedgerContext(profile, memberships, selectedId).currentLedger.id).toBe(selectedId);
expect(resolveFallbackLedger(memberships, inaccessibleId).kind).toBe("personal");
expect(mapInvitations(rows, now)[0].effectiveStatus).toBe("expired");
expect(mapMembers(rows)).toEqual(expect.arrayContaining([expect.objectContaining({ role: "owner" })]));
```

장부 목록은 개인 장부 우선, 그 뒤 공동 장부 이름 순으로 정렬하고 현재 접근 불가 ID는 개인 장부로 복구하도록 테스트한다.

- [ ] **Step 2: 조회 테스트 실패 확인**

Run: `npm test -- --run tests/unit/shared-ledgers-query.test.ts`

Expected: 새 타입과 변환 함수가 없어 FAIL.

- [ ] **Step 3: 공용 컨텍스트와 페이지 조회 구현**

앱 레이아웃은 기존 `ledgerName` 대신 `currentLedger`와 `ledgers` 전체를 받는다. `/settings` 조회는 현재 장부 역할, 구성원 표시 이름, 보낸 대기 초대, 받은 대기 초대를 병렬로 읽는다. 세션 없음은 `/login?next=%2Fsettings`로 이동한다.

- [ ] **Step 4: 게이트웨이와 서버 액션 구현**

초대 액션은 먼저 admin 클라이언트로 `resolve_invitation_target`만 호출한 뒤 로그인 세션 게이트웨이로 초대를 생성한다. 다른 변경에는 admin 클라이언트를 전달하지 않는다. 성공 시 `/`, `/ledger`, `/statistics`, `/settings`를 재검증하고 장부 접근을 잃는 성공은 `/ledger`로 이동한다.

- [ ] **Step 5: 조회·워크플로 회귀 통과 확인**

Run: `npm test -- --run tests/unit/shared-ledgers-query.test.ts tests/unit/shared-ledgers-workflows.test.ts tests/unit/settings-query.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/features/ledgers src/features/shared-ledgers src/app/'(app)'/layout.tsx src/app/'(app)'/settings/page.tsx tests/unit/shared-ledgers-query.test.ts
git commit -m "기능: 현재 장부 전환과 공동 장부 조회 연결"
```

### Task 4: 장부 선택기와 공동 사용자 관리 화면

**Files:**
- Create: `src/shared/ui/ledger-switcher.tsx`
- Create: `src/features/shared-ledgers/shared-ledger-manager.tsx`
- Create: `src/features/shared-ledgers/invitation-list.tsx`
- Create: `src/features/shared-ledgers/member-list.tsx`
- Modify: `src/shared/ui/app-shell.tsx`
- Modify: `src/features/settings/settings-screen.tsx`
- Modify: `tests/unit/app-shell.test.tsx`
- Create: `tests/unit/shared-ledgers-ui.test.tsx`

**Interfaces:**
- Consumes: `AppLedgerContext`, `SharedLedgerPageData`, Task 3 서버 액션.
- Produces: 모바일·PC 공용 장부 선택, 공동 장부 생성, 초대 응답, 구성원 관리, 나가기·삭제 UI.

- [ ] **Step 1: 실패하는 앱 셸 테스트 작성**

개인 장부와 공동 장부가 선택기에 모두 표시되고 선택된 장부에 `aria-current` 또는 선택 상태가 있으며 PC·모바일에서 장부 전환 액션이 호출되는지 검증한다.

- [ ] **Step 2: 실패하는 공동 장부 UI 테스트 작성**

```ts
expect(screen.getByRole("button", { name: "공동 장부 만들기" })).toBeVisible();
expect(screen.getByRole("button", { name: "초대 수락" })).toBeVisible();
expect(screen.getByText("소유자")).toBeVisible();
expect(screen.queryByRole("button", { name: "구성원 제거" })).not.toBeInTheDocument();
```

소유자·참여자·개인 장부 각각의 버튼 노출, 대기 중 중복 클릭 방지, 오류 시 모달·입력 유지, 삭제 이름 불일치, 만료 초대 비활성화를 검증한다.

- [ ] **Step 3: 장부 선택기 구현**

PC 사이드바와 모바일 상단은 동일한 `LedgerSwitcher`를 사용한다. 네이티브 `select` 또는 키보드 조작 가능한 메뉴를 사용하며 선택 요청 중 컨트롤을 비활성화하고 오류는 `role=alert`로 표시한다.

- [ ] **Step 4: 설정의 공동 장부 관리 영역 구현**

새 장부·초대는 모바일 하단 시트와 PC 중앙 모달로 같은 폼을 사용한다. 나가기·제거는 확인 대화상자를 사용하고 삭제는 복구 불가 경고와 장부 이름 입력을 요구한다. 개인 장부에서는 초대·나가기·삭제를 렌더링하지 않는다.

- [ ] **Step 5: UI 테스트 통과 확인**

Run: `npm test -- --run tests/unit/app-shell.test.tsx tests/unit/shared-ledgers-ui.test.tsx tests/unit/settings-ui.test.tsx`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/shared/ui src/features/settings/settings-screen.tsx src/features/shared-ledgers tests/unit/app-shell.test.tsx tests/unit/shared-ledgers-ui.test.tsx tests/unit/settings-ui.test.tsx
git commit -m "기능: 장부 선택기와 공동 사용자 관리 화면 구현"
```

### Task 5: 공동 장부 거래 입력자 표시

**Files:**
- Modify: `src/features/transactions/types.ts`
- Modify: `src/features/transactions/queries.ts`
- Modify: `src/features/transactions/query-utils.ts`
- Modify: `src/features/transactions/transaction-list.tsx`
- Modify: `src/features/transactions/transaction-card.tsx`
- Modify: `tests/unit/transactions-query.test.ts`
- Modify: `tests/unit/transactions-ui.test.tsx`

**Interfaces:**
- Extends: `TransactionListItem` with `createdBy: { id: string; displayName: string }`.
- Extends: ledger page data with `ledger.kind: "personal" | "shared"` and current role.
- Consumes: 기존 `profiles_select_shared_members` RLS와 Task 3 현재 장부 컨텍스트.

- [ ] **Step 1: 실패하는 거래 매핑 테스트 작성**

Supabase의 `profiles!transactions_created_by_fkey(id,display_name)` 결과를 `createdBy`로 매핑하고 작성자 프로필이 비정상적으로 없으면 `알 수 없는 사용자`로 안전하게 표시하도록 검증한다.

- [ ] **Step 2: 실패하는 거래 UI 테스트 작성**

공동 장부 거래 카드와 PC 행에는 `입력: 사용자명`이 표시되고 개인 장부에서는 같은 보조 문구가 생략되는지 검증한다. 참여자가 다른 사용자의 거래에 편집 버튼을 보지 못하고 소유자는 볼 수 있는지도 검증한다.

- [ ] **Step 3: 조회와 UI 구현**

거래 목록의 작성자 프로필을 한 쿼리에서 읽고, `canManage = isOwner || createdBy.id === currentUserId`를 서버 데이터에서 계산해 화면에 전달한다. UI 숨김은 편의 기능이며 실제 차단은 기존 거래 RLS가 담당한다.

- [ ] **Step 4: 거래 회귀 테스트 통과 확인**

Run: `npm test -- --run tests/unit/transactions-query.test.ts tests/unit/transactions-ui.test.tsx tests/unit/transactions-workflows.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/features/transactions tests/unit/transactions-query.test.ts tests/unit/transactions-ui.test.tsx
git commit -m "기능: 공동 장부 거래 입력자와 권한 표시 추가"
```

### Task 6: 공동 장부 E2E와 배포 검증

**Files:**
- Create: `tests/e2e/shared-ledgers.spec.ts`
- Modify: `tests/e2e/safety.ts`
- Modify: `README.md`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: Tasks 1~5 전체 기능과 `202608270005_shared_ledgers.sql`.
- Produces: 두 사용자 공동 장부 전체 흐름과 운영 적용 순서.

- [ ] **Step 1: 두 사용자 E2E 작성**

안전 플래그가 켜진 호스팅 개발 Supabase에서 A/B 계정을 만들고 아래 흐름을 PC·모바일에 실행한다.

```text
A 공동 장부 생성 → B 아이디 초대 → B 수락 → 양쪽 장부 선택
→ A/B 거래 입력 → 입력자 표시 → B의 A 거래 수정 거부
→ A의 전체 거래 관리 확인 → B 나가기 → B 개인 장부 복귀
```

테스트 종료 시 테스트 계정과 생성 데이터를 admin 클라이언트로 정리하되, 기존 `assertDestructiveE2ESafe` 검사를 통과한 경우에만 정리한다.

- [ ] **Step 2: 기본 안전 skip과 공개 E2E 확인**

Run: `npm run test:e2e -- tests/e2e/shared-ledgers.spec.ts tests/e2e/auth.spec.ts`

Expected: 안전 환경변수가 없으면 공동 장부 변경 시나리오는 의도된 skip, 공개 인증 화면은 PC·모바일 PASS.

- [ ] **Step 3: 마이그레이션·환경 문서 완성**

`202608270005_shared_ledgers.sql`을 코드 배포 전에 SQL Editor에서 실행하고 초대 테이블과 함수 존재를 확인하는 쿼리를 기록한다. `SUPABASE_SECRET_KEY`가 대상 조회 외 일반 요청에 쓰이지 않음을 명시한다.

- [ ] **Step 4: 전체 검증**

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

Expected: 단위 테스트, 타입 검사, 린트, 프로덕션 빌드 PASS. 공개 E2E PASS. 호스팅 변경 E2E는 안전 변수에 따라 PASS 또는 의도된 skip. Git 상태에는 계획된 변경만 존재한다.

- [ ] **Step 5: 독립 코드 리뷰 요청과 수정**

리뷰 범위는 `origin/main...HEAD`이며 초대 식별자 비공개성, `service_role` 사용 범위, RPC 원자성, RLS, 탈퇴·삭제 기본 장부 복구, 모바일·PC 접근성을 집중 확인한다. Critical/Important 지적은 회귀 테스트를 먼저 추가한 뒤 수정한다.

- [ ] **Step 6: 최종 커밋**

```bash
git add README.md docs/supabase-setup.md tests/e2e/shared-ledgers.spec.ts tests/e2e/safety.ts
git commit -m "검증: 공동 장부 통합 시나리오와 적용 문서 추가"
```

## 계획 자체 검토

- 설계의 생성, 전환, 초대, 수락·거절, 취소, 제거, 나가기, 삭제를 Task 1~4에 연결했다.
- 비공개 계정 식별자 조회와 일반 로그인 세션 변경을 Task 2~3에서 분리했다.
- 소유자·참여자 거래 권한과 입력자 표시를 DB 계약과 Task 5 UI 양쪽에서 검증한다.
- 접근권한 상실 후 개인 장부 복구를 DB 트리거, 컨텍스트 폴백, E2E에서 각각 확인한다.
- 외부 이메일, 미가입자 초대, 소유권 이전, 공개 참여 링크는 전 작업에서 제외한다.
- 모든 공개 타입, 함수 시그니처, 테스트 명령, 마이그레이션 순서와 한국어 커밋 경계를 명시했다.
