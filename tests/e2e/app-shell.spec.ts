import { expect, test } from "@playwright/test";

const integrationEnabled =
  process.env.E2E_ALLOW_HOSTED_SUPABASE === "1" &&
  Boolean(process.env.E2E_SUPABASE_PROJECT_REF) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
  Boolean(process.env.SUPABASE_SECRET_KEY);

test.describe("로그인 후 반응형 앱 셸", () => {
  test.skip(!integrationEnabled, "전용 개발 프로젝트 E2E 환경변수가 설정되지 않았습니다.");

  test("화면 크기에 맞는 주 메뉴를 표시한다", async ({ page }, testInfo) => {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const expectedHost = `${process.env.E2E_SUPABASE_PROJECT_REF}.supabase.co`;
    if (url.hostname !== expectedHost) throw new Error("E2E Supabase project mismatch");

    const unique = `${Date.now()}${testInfo.workerIndex}`;
    const password = "Pockelog-test-2026!";
    await page.goto("/signup");
    await page.getByLabel("아이디", { exact: true }).fill(`shell_${unique}`);
    await page.getByLabel("사용자명", { exact: true }).fill("화면 테스트");
    await page.getByLabel("이메일", { exact: true }).fill(`shell_${unique}@example.com`);
    await page.getByLabel("전화번호", { exact: true }).fill("010-9876-5432");
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
    await page.getByRole("button", { name: "가입하기" }).click();
    await expect(page).toHaveURL(/\/ledger$/);

    const desktopNavigation = page.getByRole("navigation", { name: "주 메뉴", exact: true });
    const mobileNavigation = page.getByRole("navigation", { name: "모바일 주 메뉴" });
    if (testInfo.project.name === "mobile-chromium") {
      await expect(mobileNavigation).toBeVisible();
      await expect(desktopNavigation).toBeHidden();
    } else {
      await expect(desktopNavigation).toBeVisible();
      await expect(mobileNavigation).toBeHidden();
    }
  });
});
