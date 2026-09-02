# Account Profile Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설정 화면에서 로그인 사용자가 본인의 사용자명·전화번호를 수정하고 현재 비밀번호 확인 후 새 비밀번호로 변경할 수 있게 한다.

**Architecture:** 장부 설정과 계정 설정을 분리하기 위해 `src/features/profile` 모듈을 추가한다. 사용자명·전화번호는 `security invoker` RPC 한 번으로 원자적으로 갱신하고, 비밀번호는 현재 세션 이메일과 현재 비밀번호를 Supabase Auth로 재검증한 뒤 변경·전역 로그아웃한다. 설정 페이지는 장부 역할과 무관하게 로그인 사용자의 프로필 카드를 항상 렌더링한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase Auth/Postgres RLS, Vitest, Testing Library, pgTAP, Playwright

**Spec:** `docs/superpowers/specs/2026-09-02-account-profile-settings-design.md`

## Global Constraints

- 사용자는 본인의 `profiles`와 `user_private_profiles` 행만 수정한다.
- 공동 장부 소유자와 일반 구성원 모두 다른 사용자의 프로필을 수정할 수 없다.
- 가입 이메일은 읽기 전용이며 이메일·로그인 아이디 변경은 구현하지 않는다.
- 사용자명은 trim 후 1~30자다.
- 전화번호 입력은 숫자와 하이픈만 허용하고 저장 값은 숫자만 남긴다.
- 새 비밀번호는 8자 이상이고 확인 값과 일치해야 한다.
- 비밀번호 변경 전 현재 비밀번호를 다시 검증한다.
- 비밀번호 변경 성공 후 모든 기기 세션을 종료하며 별도의 전체 로그아웃 버튼은 추가하지 않는다.
- 비밀번호, 인증 토큰, 전체 이메일, 전화번호를 오류 메시지나 로그에 기록하지 않는다.
- 이메일 변경, 회원 탈퇴, 프로필 이미지는 범위에서 제외한다.
- Docker와 운영 Supabase 파괴 테스트를 사용하지 않는다.

---

## File Structure

- `src/features/profile/types.ts`: 프로필 데이터·입력·게이트웨이 계약
- `src/features/profile/schemas.ts`: 프로필 및 비밀번호 폼 검증
- `src/features/profile/workflows.ts`: 게이트웨이 결과를 사용자 상태로 변환
- `src/features/profile/queries.ts`: 현재 세션 사용자의 프로필 조회
- `src/features/profile/supabase-gateway.ts`: 프로필 RPC와 Supabase Auth 변경 구현
- `src/features/profile/actions.ts`: 서버 액션, 캐시 재검증, 로그인 이동
- `src/features/profile/profile-form.tsx`: 사용자명·전화번호·읽기 전용 이메일 UI
- `src/features/profile/password-change-form.tsx`: 현재·새 비밀번호 변경 UI
- `supabase/migrations/202609020008_account_profile_settings.sql`: 원자적 본인 프로필 수정 RPC
- `tests/db/009_account_profile_settings.test.sql`: RPC 권한·원자성 계약

---

### Task 1: 프로필 도메인 계약과 입력 검증

**Files:**
- Create: `src/features/profile/types.ts`
- Create: `src/features/profile/schemas.ts`
- Create: `src/features/profile/workflows.ts`
- Create: `tests/unit/profile-domain.test.ts`
- Create: `tests/unit/profile-workflows.test.ts`

**Interfaces:**
- Consumes: `normalizePhone(raw: string): string` from `src/shared/domain/phone.ts`.
- Produces: `ProfilePageData`, `ProfileInput`, `PasswordChangeInput`, `ProfileActionState`, `ProfileFormAction`, `ProfileGateway`, `updateOwnProfile`, `changeOwnPassword`, `formDataToProfileInput`, `formDataToPasswordChangeInput`.

- [ ] **Step 1: 입력 검증 실패 테스트 작성**

`tests/unit/profile-domain.test.ts`에 아래 동작을 고정한다.

```ts
import { describe, expect, it } from "vitest";
import {
  profileFormSchema,
  passwordChangeFormSchema,
} from "@/features/profile/schemas";

describe("profile schemas", () => {
  it("normalizes display name and phone", () => {
    expect(profileFormSchema.parse({
      displayName: "  사용자 이름  ",
      phone: "010-1234-5678",
    })).toEqual({ displayName: "사용자 이름", phone: "01012345678" });
  });

  it.each([
    { displayName: "", phone: "01012345678" },
    { displayName: "a".repeat(31), phone: "01012345678" },
    { displayName: "사용자", phone: "010 1234 5678" },
    { displayName: "사용자", phone: "" },
  ])("rejects invalid profile input %#", (input) => {
    expect(profileFormSchema.safeParse(input).success).toBe(false);
  });

  it("requires the current password and matching replacement passwords", () => {
    expect(passwordChangeFormSchema.safeParse({
      currentPassword: "",
      newPassword: "new-password1!",
      confirmPassword: "new-password1!",
    }).success).toBe(false);
    expect(passwordChangeFormSchema.safeParse({
      currentPassword: "old-password1!",
      newPassword: "new-password1!",
      confirmPassword: "different-password!",
    }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 도메인 테스트가 모듈 부재로 실패하는지 확인**

Run: `npm test -- --run tests/unit/profile-domain.test.ts`

Expected: FAIL because `@/features/profile/schemas` does not exist.

- [ ] **Step 3: 타입과 스키마 최소 구현**

`src/features/profile/types.ts`에 다음 계약을 정의한다.

```ts
export type ProfilePageData = {
  displayName: string;
  email: string;
  phone: string;
};

export type ProfileInput = { displayName: string; phone: string };
export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type ProfileActionState = {
  status: "idle" | "success" | "error" | "unauthenticated";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type ProfileFormAction = (
  state: ProfileActionState,
  formData: FormData,
) => Promise<ProfileActionState>;

export type ProfileMutationResult =
  | "updated"
  | "unauthenticated"
  | "error";

export type PasswordMutationResult =
  | "changed"
  | "invalid-current-password"
  | "unauthenticated"
  | "error";

export interface ProfileGateway {
  updateProfile(input: ProfileInput): Promise<ProfileMutationResult>;
  changePassword(input: PasswordChangeInput): Promise<PasswordMutationResult>;
}

export const initialProfileActionState: ProfileActionState = { status: "idle" };
```

`src/features/profile/schemas.ts`는 `z.string().trim()`과 기존 `normalizePhone`을 사용한다. 전화번호는 transform 전에 `/^[0-9-]+$/`로 검증한다. `formDataToProfileInput`과 `formDataToPasswordChangeInput`은 `FormData`의 문자열만 읽는다.

- [ ] **Step 4: 워크플로 실패 테스트 작성**

`tests/unit/profile-workflows.test.ts`에 성공, 세션 만료, 잘못된 현재 비밀번호, 공급자 오류 매핑을 작성한다.

```ts
it("does not call password update after current-password rejection", async () => {
  const gateway: ProfileGateway = {
    updateProfile: async () => "updated",
    changePassword: async () => "invalid-current-password",
  };
  await expect(changeOwnPassword(input, gateway)).resolves.toEqual({
    status: "error",
    message: "현재 비밀번호를 확인해 주세요.",
  });
});
```

- [ ] **Step 5: 워크플로 최소 구현 후 집중 테스트 통과**

`updateOwnProfile`은 `updated`를 성공 메시지로, `unauthenticated`를 `{ status: "unauthenticated" }`로, 나머지를 안전한 재시도 메시지로 변환한다. `changeOwnPassword`는 `invalid-current-password`에만 현재 비밀번호 안내를 사용하고 내부 오류를 노출하지 않는다. 서버 액션은 `unauthenticated` 상태를 반환하지 않고 즉시 로그인 화면으로 이동시키므로 클라이언트에는 세션 오류 문구가 남지 않는다.

Run: `npm test -- --run tests/unit/profile-domain.test.ts tests/unit/profile-workflows.test.ts`

Expected: PASS.

- [ ] **Step 6: Task 1 커밋**

```bash
git add src/features/profile/types.ts src/features/profile/schemas.ts src/features/profile/workflows.ts tests/unit/profile-domain.test.ts tests/unit/profile-workflows.test.ts
git commit -m "기능: 프로필 설정 도메인 계약 추가"
```

---

### Task 2: 본인 프로필 원자적 수정 RPC

**Files:**
- Create: `supabase/migrations/202609020008_account_profile_settings.sql`
- Create: `tests/db/009_account_profile_settings.test.sql`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: `public.profiles`, `public.user_private_profiles`, `auth.uid()` and existing column-level grants.
- Produces: `public.update_my_profile(text,text) returns text` with result `updated`.

- [ ] **Step 1: pgTAP 계약 작성**

`tests/db/009_account_profile_settings.test.sql`은 트랜잭션 안에서 사용자 A와 B를 만들고 `select plan(16);`으로 다음을 단언한다.

```sql
select has_function(
  'public',
  'update_my_profile',
  array['text', 'text'],
  '본인 프로필 수정 함수가 존재한다'
);
select function_returns(
  'public', 'update_my_profile', array['text', 'text'], 'text'
);
select function_privs_are(
  'public', 'update_my_profile', array['text', 'text'], 'anon', array[]::text[]
);
select function_privs_are(
  'public', 'update_my_profile', array['text', 'text'], 'authenticated', array['EXECUTE']
);
```

사용자 A로 `update_my_profile(' 새 이름 ', '01012345678')`를 호출해 두 테이블이 함께 변경되는지 확인한다. 사용자 B 호출 뒤 A의 값이 유지되고 B의 값만 변경되는지 확인한다. 비로그인 호출, 빈 이름, 31자 이름, 문자가 포함된 전화번호는 실패해야 한다. `pg_proc.prosecdef=false`, `proconfig`에 빈 `search_path`가 있는지 확인하고 rollback한다.

- [ ] **Step 2: 마이그레이션 부재 RED 확인**

전용 `TEST_DATABASE_URL`이 있으면 001~008 마이그레이션 적용 후 실행한다.

Run: `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/db/009_account_profile_settings.test.sql`

Expected: FAIL because `public.update_my_profile(text,text)` is absent.

전용 DB가 없으면 함수 파일이 없는 상태에서 정적 계약 검사가 실패하는 출력을 기록하며 Docker를 만들지 않는다.

- [ ] **Step 3: RPC 마이그레이션 구현**

`supabase/migrations/202609020008_account_profile_settings.sql`에 다음 함수를 구현한다.

```sql
create or replace function public.update_my_profile(
  new_display_name text,
  new_phone_normalized text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_name text := btrim(new_display_name);
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if char_length(normalized_name) not between 1 and 30 then
    raise exception 'invalid display name' using errcode = '22023';
  end if;
  if new_phone_normalized !~ '^[0-9]+$' then
    raise exception 'invalid phone' using errcode = '22023';
  end if;

  update public.profiles
  set display_name = normalized_name
  where id = auth.uid();
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'profile missing' using errcode = '42501';
  end if;

  update public.user_private_profiles
  set phone_normalized = new_phone_normalized
  where user_id = auth.uid();
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'private profile missing' using errcode = '42501';
  end if;

  return 'updated';
end;
$$;

revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;
```

- [ ] **Step 4: DB 계약 GREEN 확인 및 문서 추가**

Run the pgTAP command when `TEST_DATABASE_URL` exists. Without it, run the count-aware static contract that verifies signature, invoker mode, empty search path, `auth.uid()`, both fully qualified updates, grants, and 16 pgTAP assertions.

`docs/supabase-setup.md`에 migration 008 실행 순서와 다음 확인 쿼리를 추가한다.

```sql
select
  to_regprocedure('public.update_my_profile(text,text)') is not null
    as update_my_profile_exists;
```

- [ ] **Step 5: Task 2 커밋**

```bash
git add supabase/migrations/202609020008_account_profile_settings.sql tests/db/009_account_profile_settings.test.sql docs/supabase-setup.md
git commit -m "기능: 본인 프로필 수정 데이터베이스 함수 추가"
```

---

### Task 3: 프로필 조회·변경 서버 계층

**Files:**
- Create: `src/features/profile/queries.ts`
- Create: `src/features/profile/supabase-gateway.ts`
- Create: `src/features/profile/actions.ts`
- Create: `tests/unit/profile-query.test.ts`
- Create: `tests/unit/profile-gateway.test.ts`
- Create: `tests/unit/profile-actions.test.ts`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `tests/unit/auth-recovery-ui.test.tsx`

**Interfaces:**
- Consumes: Task 1 `ProfileGateway` contracts and Task 2 `update_my_profile` RPC.
- Produces: `getProfilePageData(): Promise<ProfilePageData | null>`, `createSupabaseProfileGateway()`, `updateProfileAction`, `changePasswordAction`.

- [ ] **Step 1: 프로필 조회 실패 테스트 작성**

`tests/unit/profile-query.test.ts`는 가짜 Supabase 클라이언트로 다음을 검증한다.

- 세션 없음은 `null`.
- `profiles.display_name`, `user_private_profiles.phone_normalized`, `auth.users.email`을 매핑.
- 이메일 없음, 프로필 쿼리 오류, 프로필 행 없음은 `ProfileQueryError`.
- 다른 사용자 ID를 쿼리에 사용하지 않고 현재 `user.id`만 사용.

Run: `npm test -- --run tests/unit/profile-query.test.ts`

Expected: FAIL because `queries.ts` is absent.

- [ ] **Step 2: 프로필 조회 구현**

`getProfilePageData`는 `createServerClient()`, `auth.getUser()`를 호출한 뒤 두 프로필 테이블을 `user.id`로 병렬 조회한다. 반환 값은 다음 형태다.

```ts
return {
  displayName: profile.display_name,
  email: user.email,
  phone: privateProfile.phone_normalized,
};
```

- [ ] **Step 3: 게이트웨이 RED 테스트 작성**

`tests/unit/profile-gateway.test.ts`는 다음 경계를 고정한다.

- `update_my_profile`에 `new_display_name`, `new_phone_normalized` 전달.
- RPC `updated` 외 결과와 오류는 `error`.
- 세션 없음은 `unauthenticated`.
- 현재 비밀번호 검증 실패 시 `updateUser` 미호출.
- 검증 사용자 ID가 기존 세션 ID와 다르면 `invalid-current-password`.
- 성공 시 `updateUser({ password: newPassword })` 후 `signOut({ scope: "global" })`.
- 전역 로그아웃 오류 시 `signOut({ scope: "local" })`로 현재 기기 쿠키 제거 시도.

- [ ] **Step 4: Supabase 게이트웨이 구현**

비밀번호 변경 순서는 아래처럼 고정한다.

```ts
const { data: current, error: currentError } = await supabase.auth.getUser();
if (currentError || !current.user?.email) return "unauthenticated";

const verified = await supabase.auth.signInWithPassword({
  email: current.user.email,
  password: input.currentPassword,
});
if (verified.error || verified.data.user?.id !== current.user.id) {
  return "invalid-current-password";
}

const changed = await supabase.auth.updateUser({ password: input.newPassword });
if (changed.error) return "error";

const globalLogout = await supabase.auth.signOut({ scope: "global" });
if (globalLogout.error) await supabase.auth.signOut({ scope: "local" });
return "changed";
```

게이트웨이 생성·Auth 호출 예외는 내부 메시지를 버리고 `error`로 반환한다.

- [ ] **Step 5: 서버 액션 RED 테스트 작성**

`tests/unit/profile-actions.test.ts`는 스키마 오류, 프로필 성공 시 네 경로 재검증, 세션 만료 로그인 이동, 비밀번호 성공 로그인 이동을 검증한다.

```ts
expect(revalidatePath).toHaveBeenCalledWith("/settings");
expect(revalidatePath).toHaveBeenCalledWith("/ledger");
expect(revalidatePath).toHaveBeenCalledWith("/statistics");
expect(revalidatePath).toHaveBeenCalledWith("/settings/trash");
expect(redirect).toHaveBeenCalledWith("/login?passwordChanged=1");
```

- [ ] **Step 6: 액션과 로그인 완료 안내 구현**

`updateProfileAction`과 `changePasswordAction`은 워크플로 결과가 `unauthenticated`이면 `redirect("/login?next=%2Fsettings")`하고, 게이트웨이 생성 예외는 안전한 액션 상태로 변환한다. `changePasswordAction` 성공 시 redirect한다. 로그인 페이지는 기존 `passwordReset` 안내를 유지하면서 `passwordChanged=1`일 때 다음 문구를 `LoginForm.notice`로 전달한다.

```text
비밀번호가 변경됐습니다. 새 비밀번호로 다시 로그인해 주세요.
```

- [ ] **Step 7: 집중 테스트와 Task 3 커밋**

Run: `npm test -- --run tests/unit/profile-query.test.ts tests/unit/profile-gateway.test.ts tests/unit/profile-actions.test.ts tests/unit/auth-recovery-ui.test.tsx`

Expected: PASS.

```bash
git add src/features/profile/queries.ts src/features/profile/supabase-gateway.ts src/features/profile/actions.ts tests/unit/profile-query.test.ts tests/unit/profile-gateway.test.ts tests/unit/profile-actions.test.ts 'src/app/(auth)/login/page.tsx' tests/unit/auth-recovery-ui.test.tsx
git commit -m "기능: 프로필과 비밀번호 변경 서버 계층 추가"
```

---

### Task 4: 설정 화면 프로필·비밀번호 UI

**Files:**
- Create: `src/features/profile/profile-form.tsx`
- Create: `src/features/profile/password-change-form.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/features/settings/settings-screen.tsx`
- Modify: `tests/unit/settings-ui.test.tsx`
- Create: `tests/unit/profile-ui.test.tsx`

**Interfaces:**
- Consumes: Task 3 `ProfilePageData`, `updateProfileAction`, `changePasswordAction`, `getProfilePageData`.
- Produces: 설정 상단 `내 프로필` 카드와 독립 `비밀번호 변경` 카드.

- [ ] **Step 1: UI RED 테스트 작성**

`tests/unit/profile-ui.test.tsx`에 다음을 Testing Library로 검증한다.

- 사용자명과 전화번호는 초기값 표시.
- 가입 이메일은 읽기 전용이며 폼 제출 이름이 없음.
- 프로필 저장 성공·필드 오류·대기 상태.
- 비밀번호 세 필드는 `current-password`, `new-password`, `new-password` 자동완성 사용.
- 비밀번호 변경 안내에 모든 기기 로그아웃 명시.
- 비밀번호 폼 오류가 프로필 폼 값을 지우지 않음.
- 별도 `모든 기기에서 로그아웃` 버튼 없음.

`tests/unit/settings-ui.test.tsx`에는 `data.isOwner=false`에서도 `내 프로필` 카드와 저장 버튼이 보이는 테스트를 추가한다.

Run: `npm test -- --run tests/unit/profile-ui.test.tsx tests/unit/settings-ui.test.tsx`

Expected: FAIL because the profile components and props are absent.

- [ ] **Step 2: 프로필 폼 구현**

`ProfileForm`은 `useActionState`를 사용하고 다음 접근 가능한 필드를 렌더링한다.

```tsx
<FormField label="사용자명" name="displayName" defaultValue={data.displayName} />
<FormField label="전화번호" name="phone" defaultValue={formatPhone(data.phone)} />
<input aria-label="가입 이메일" value={data.email} readOnly />
<SubmitButton>프로필 저장</SubmitButton>
```

이메일 input에는 `name`을 두지 않는다. 전화번호 표시 함수는 11자리 휴대전화만 `010-1234-5678` 형태로 표시하고 다른 숫자열은 저장 값을 그대로 표시한다.

폼 내부의 `useFormStatus` 자식 컴포넌트가 `<fieldset disabled={pending}>`을 렌더링해 저장 중 프로필 입력 전체를 잠근다. `SubmitButton`의 기존 대기 표시와 중복 상태를 새로 만들지 않는다.

- [ ] **Step 3: 비밀번호 폼 구현**

`PasswordChangeForm`은 프로필 폼과 별도 `useActionState`를 사용한다. 현재 비밀번호, 새 비밀번호, 확인 필드에 `required`, 새 비밀번호 두 필드에 `minLength={8}`을 설정한다. 이 폼도 내부 `useFormStatus` fieldset으로 제출 중 입력 전체를 잠근다. 성공은 redirect이므로 화면에는 오류 상태만 표시한다.

- [ ] **Step 4: 설정 페이지 연결**

`SettingsPage`는 `getSettingsPageData`, `getSharedLedgerPageData`, `getProfilePageData`를 `Promise.all`로 조회한다. 프로필이 `null`이면 `/login?next=%2Fsettings`로 이동하고 `ProfileQueryError`는 기존 설정 오류 카드로 안전하게 처리한다.

`SettingsScreen` props에 다음을 추가한다.

```ts
profileData: ProfilePageData;
updateProfileAction: ProfileFormAction;
changePasswordAction: ProfileFormAction;
```

`ProfileForm`과 `PasswordChangeForm`은 `data.isOwner` 조건 밖, 페이지 제목 바로 아래에 렌더링한다.

- [ ] **Step 5: UI 집중 테스트 통과와 Task 4 커밋**

Run: `npm test -- --run tests/unit/profile-ui.test.tsx tests/unit/settings-ui.test.tsx`

Expected: PASS on mobile-independent semantic queries.

```bash
git add src/features/profile/profile-form.tsx src/features/profile/password-change-form.tsx 'src/app/(app)/settings/page.tsx' src/features/settings/settings-screen.tsx tests/unit/settings-ui.test.tsx tests/unit/profile-ui.test.tsx
git commit -m "기능: 설정에 내 프로필과 비밀번호 변경 추가"
```

---

### Task 5: 호스팅 통합 시나리오와 배포 문서

**Files:**
- Modify: `tests/e2e/settings.spec.ts`
- Modify: `README.md`
- Modify: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: Tasks 1–4 전체 사용자 흐름.
- Produces: PC·모바일 프로필/비밀번호 E2E와 운영 적용 체크리스트.

- [ ] **Step 1: 안전 가드가 적용된 E2E 흐름 추가**

기존 `verifyHostedSupabaseE2ESafety()` 호출 뒤 고유 계정을 만들고 다음 순서를 실행한다.

```ts
await page.goto("/settings");
await expect(page.getByLabel("가입 이메일")).toHaveValue(email);
await page.getByLabel("사용자명").fill("변경 사용자");
await page.getByLabel("전화번호").fill("010-9876-5432");
await page.getByRole("button", { name: "프로필 저장" }).click();
await expect(page.getByRole("status")).toContainText("프로필을 변경했습니다");
await page.reload();
await expect(page.getByLabel("사용자명")).toHaveValue("변경 사용자");
```

공동 장부 일반 구성원 계정으로 장부를 선택한 뒤 같은 방식으로 본인 사용자명을 변경하고 소유자 이름은 유지되는지 확인한다. 잘못된 현재 비밀번호는 오류를 표시하고, 올바른 현재 비밀번호는 `/login?passwordChanged=1`로 이동한다. 이전 비밀번호 로그인 실패, 새 비밀번호 로그인 성공을 확인한다.

- [ ] **Step 2: E2E 등록과 안전 skip 확인**

Run: `npm run test:e2e -- --project=desktop-chromium --project=mobile-chromium tests/e2e/settings.spec.ts`

Expected without hosted credentials: tests are registered and destructive cases skip through the existing safety guard. With dedicated development credentials and migration 008: both projects PASS.

- [ ] **Step 3: README와 Supabase 문서 마무리**

README에 설정의 본인 프로필 수정과 비밀번호 변경 후 전체 로그아웃을 기록한다. `docs/supabase-setup.md`에는 migration 008 실행 전 백업 확인, 함수 존재·권한 확인, 앱 배포, 본인/타인 권한 수동 검증, 비밀번호 재로그인 검증 순서를 기록한다.

- [ ] **Step 4: Task 5 커밋**

```bash
git add tests/e2e/settings.spec.ts README.md docs/supabase-setup.md
git commit -m "검증: 프로필 설정 통합 시나리오와 배포 문서 추가"
```

---

### Task 6: 전체 검증과 독립 리뷰

**Files:**
- Review: `supabase/migrations/202609020008_account_profile_settings.sql`
- Review: `src/features/profile/**`
- Review: `src/app/(app)/settings/page.tsx`
- Review: `src/features/settings/settings-screen.tsx`
- Review: `tests/db/009_account_profile_settings.test.sql`

**Interfaces:**
- Consumes: Tasks 1–5 전체 결과.
- Produces: 병합 가능한 검증 결과와 배포 인계.

- [ ] **Step 1: 전체 정적·단위 검증**

Run each command and record its exit code.

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
git diff --check
```

빌드에는 실제 값을 출력하지 않고 네 환경변수를 현재 프로세스에만 안전한 placeholder로 주입한다. Expected: all exit 0.

- [ ] **Step 2: DB 계약 실행 또는 제한 기록**

전용 테스트 DB가 있으면 migration 001~008 적용 후 pgTAP 001~009를 순서대로 실행한다. 전용 DB가 없으면 migration 008과 test 009를 정적 검토하고 실제 pgTAP 실행이 남았음을 완료 보고에 명시한다. 운영 DB에서는 자동 파괴 테스트를 실행하지 않는다.

- [ ] **Step 3: 전체 변경 독립 리뷰**

설계 커밋 다음부터 HEAD까지 검토하며 다음을 집중 확인한다.

- 다른 사용자 프로필 수정 우회
- 공동 장부 역할과 개인 프로필 권한 혼동
- 프로필 두 테이블의 부분 갱신
- 현재 비밀번호 미검증 또는 새 비밀번호 로그 노출
- 비밀번호 변경 후 남은 세션
- 읽기 전용 이메일의 폼 제출 포함
- 모바일·PC 폼 접근성
- 세션 만료 시 현재 설정 경로 복귀

Critical/Important 지적은 먼저 실패하는 회귀 테스트를 추가한 뒤 수정한다.

- [ ] **Step 4: 수정 후 전체 검증 재실행**

Step 1의 다섯 명령을 최종 HEAD에서 다시 실행하고 모든 출력을 읽는다.

- [ ] **Step 5: 배포 인계**

사용자에게 migration 008을 Supabase SQL Editor에서 먼저 실행하게 안내한다. 함수 존재와 권한 확인 뒤 사용자가 선택한 Git 전략으로 `main` 직접 푸시 또는 PR을 수행한다. Vercel 배포 후 본인 프로필 수정, 타인 프로필 불가, 비밀번호 변경 후 새 비밀번호 재로그인을 확인한다.
