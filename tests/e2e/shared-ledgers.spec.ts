import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

import { deleteE2EUsersByEmail, verifyHostedSupabaseE2ESafety } from "./safety";

const integrationEnabled =
  process.env.E2E_ALLOW_HOSTED_SUPABASE === "1"
  && Boolean(process.env.E2E_SUPABASE_PROJECT_REF)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  && Boolean(process.env.SUPABASE_SECRET_KEY);

const password = "Pockelog-test-2026!";

async function signUp(page: Page, values: { handle: string; name: string; email: string; phone: string }) {
  await page.goto("/signup");
  await page.getByLabel("아이디", { exact: true }).fill(values.handle);
  await page.getByLabel("사용자명", { exact: true }).fill(values.name);
  await page.getByLabel("이메일", { exact: true }).fill(values.email);
  await page.getByLabel("전화번호", { exact: true }).fill(values.phone);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/ledger$/);
}

async function selectVisibleLedger(page: Page, label: string) {
  const selector = page.locator('select[aria-label="현재 장부"]:visible');
  await selector.selectOption({ label });
  await expect(selector.locator("option:checked")).toHaveText(label);
}

async function addExpense(page: Page, testInfo: TestInfo, description: string) {
  const buttons = page.getByRole("button", { name: /내역 추가/ });
  await (testInfo.project.name === "mobile-chromium" ? buttons.last() : buttons.first()).click();
  const dialog = page.getByRole("dialog", { name: "내역 추가" });
  await dialog.getByLabel("내용").fill(description);
  await dialog.getByLabel("분류").selectOption({ label: "식비" });
  await dialog.getByLabel("금액").fill("10000");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("호스팅된 개발 Supabase 공동 장부", () => {
  test.skip(!integrationEnabled, "전용 개발 프로젝트 공동 장부 E2E 환경변수가 설정되지 않았습니다.");

  test("두 사용자가 초대받아 기록하고 참여자는 다른 사용자의 내역을 수정하지 못한다", async ({ browser }, testInfo) => {
    await verifyHostedSupabaseE2ESafety();
    const unique = `${Date.now()}${testInfo.workerIndex}`;
    const owner = { handle: `slo_${unique.slice(-12)}`, name: "공동 소유자", email: `sl_owner_${unique}@example.com`, phone: "010-7000-1000" };
    const member = { handle: `slm_${unique.slice(-12)}`, name: "공동 참여자", email: `sl_member_${unique}@example.com`, phone: "010-7000-2000" };
    const ledgerName = `우리 장부 ${unique.slice(-5)}`;
    const mobile = testInfo.project.name === "mobile-chromium";
    const contextOptions = {
      baseURL: "http://127.0.0.1:3000",
      viewport: mobile ? { width: 393, height: 851 } : { width: 1280, height: 720 },
      isMobile: mobile,
      hasTouch: mobile,
    };
    const ownerContext: BrowserContext = await browser.newContext(contextOptions);
    const memberContext: BrowserContext = await browser.newContext(contextOptions);
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();

    try {
      await signUp(ownerPage, owner);
      await signUp(memberPage, member);

      await ownerPage.goto("/settings");
      await ownerPage.getByLabel("새 장부 이름").fill(ledgerName);
      await ownerPage.getByRole("button", { name: "공동 장부 만들기" }).click();
      await expect(ownerPage.getByRole("status")).toContainText("공동 장부를 만들었어요");
      await ownerPage.reload();
      await expect(ownerPage.getByRole("heading", { name: `${ledgerName} 구성원` })).toBeVisible();

      await ownerPage.getByLabel("초대할 아이디 또는 이메일").fill(member.handle);
      await ownerPage.getByRole("button", { name: "초대하기" }).click();
      await expect(ownerPage.getByRole("status")).toContainText("초대를 보냈어요");

      await memberPage.goto("/settings");
      await expect(memberPage.getByRole("button", { name: `${ledgerName} 초대 수락` })).toBeVisible();
      await memberPage.getByRole("button", { name: `${ledgerName} 초대 수락` }).click();
      await expect(memberPage.getByRole("status")).toContainText("초대를 수락했어요");
      await memberPage.reload();

      await selectVisibleLedger(ownerPage, `공동 · ${ledgerName}`);
      await selectVisibleLedger(memberPage, `공동 · ${ledgerName}`);
      await ownerPage.goto("/ledger");
      await memberPage.goto("/ledger");
      await addExpense(ownerPage, testInfo, "소유자 장보기");
      await addExpense(memberPage, testInfo, "참여자 장보기");
      await ownerPage.reload();
      await memberPage.reload();

      await expect(ownerPage.getByText("공동 소유자 작성").first()).toBeVisible();
      await expect(ownerPage.getByText("공동 참여자 작성").first()).toBeVisible();
      await expect(memberPage.getByText("공동 소유자 작성").first()).toBeVisible();
      await expect(memberPage.getByRole("button", { name: /소유자 장보기/ })).toHaveCount(0);

      await memberPage.goto("/settings");
      memberPage.once("dialog", (dialog) => dialog.accept());
      await memberPage.getByRole("button", { name: "이 장부 나가기" }).click();
      await expect(memberPage).toHaveURL(/\/ledger$/);
      await expect(memberPage.locator('select[aria-label="현재 장부"]:visible')).toHaveValue(/.+/);
      await expect(memberPage.locator('select[aria-label="현재 장부"]:visible option:checked')).toContainText("개인 ·");
    } finally {
      await ownerContext.close();
      await memberContext.close();
      await deleteE2EUsersByEmail([owner.email, member.email]);
    }
  });
});
