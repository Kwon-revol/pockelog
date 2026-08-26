import { expect, test } from "@playwright/test";

import { verifyHostedSupabaseE2ESafety } from "./safety";

const requiredIntegrationEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "E2E_SUPABASE_PROJECT_REF",
] as const;

const integrationEnabled =
  process.env.E2E_ALLOW_HOSTED_SUPABASE === "1" &&
  requiredIntegrationEnv.every((key) => Boolean(process.env[key]));

test("로그인과 회원가입 공개 화면을 열 수 있다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "다시 만나서 반가워요" })).toBeVisible();
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "내 장부 만들기" })).toBeVisible();
});

test.describe("호스팅된 개발 Supabase 인증", () => {
  test.skip(!integrationEnabled, "전용 개발 프로젝트 E2E 환경변수가 설정되지 않았습니다.");

  test("가입하고 아이디와 이메일로 다시 로그인한다", async ({ page }, testInfo) => {
    await verifyHostedSupabaseE2ESafety();
    const unique = `${Date.now()}${testInfo.workerIndex}`;
    const loginId = `e2e_${unique}`;
    const email = `${loginId}@example.com`;
    const password = "Pockelog-test-2026!";

    await page.goto("/signup");
    await page.getByLabel("아이디", { exact: true }).fill(loginId);
    await page.getByLabel("사용자명", { exact: true }).fill("E2E 사용자");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("전화번호", { exact: true }).fill("010-1234-5678");
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
    await page.getByRole("button", { name: "가입하기" }).click();
    await expect(page).toHaveURL(/\/ledger$/);

    await page.goto("/settings");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.getByLabel("아이디 또는 이메일").fill(loginId);
    await page.getByLabel("비밀번호").fill(password);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/ledger$/);

    await page.goto("/settings");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.getByLabel("아이디 또는 이메일").fill(email);
    await page.getByLabel("비밀번호").fill(password);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/ledger$/);
  });
});
