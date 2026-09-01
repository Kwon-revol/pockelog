import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { deleteE2EUsersByEmail, verifyHostedSupabaseE2ESafety } from "./safety";

const integrationEnabled =
  process.env.E2E_ALLOW_HOSTED_SUPABASE === "1"
  && Boolean(process.env.E2E_SUPABASE_PROJECT_REF)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  && Boolean(process.env.SUPABASE_SECRET_KEY);

async function openAddPanel(page: Page, testInfo: TestInfo) {
  const buttons = page.getByRole("button", { name: /내역 추가/ });
  await (testInfo.project.name === "mobile-chromium" ? buttons.last() : buttons.first()).click();
  return page.getByRole("dialog", { name: "내역 추가" });
}

function visibleLedgerDescription(page: Page, testInfo: TestInfo, description: string | RegExp) {
  const transactions = page.getByRole("region", { name: "거래 내역" });
  return testInfo.project.name === "mobile-chromium"
    ? transactions.locator(".lg\\:hidden").getByText(description, { exact: typeof description === "string" })
    : transactions.getByRole("table").getByText(description, { exact: typeof description === "string" });
}

function visibleTrashDescription(page: Page, testInfo: TestInfo, description: string) {
  return testInfo.project.name === "mobile-chromium"
    ? page.getByRole("region", { name: "휴지통 내역" }).getByText(description, { exact: true })
    : page.getByRole("table", { name: "휴지통 내역" }).getByText(description, { exact: true });
}

async function openTransaction(page: Page, testInfo: TestInfo, description: string) {
  await visibleLedgerDescription(page, testInfo, description).click();
  return page.getByRole("dialog", { name: "내역 수정" });
}

const e2eEmailsByTestId = new Map<string, string>();

test.afterEach(async ({}, testInfo) => {
  const email = e2eEmailsByTestId.get(testInfo.testId);
  if (!email) return;

  try {
    await deleteE2EUsersByEmail([email]);
  } finally {
    e2eEmailsByTestId.delete(testInfo.testId);
  }
});

test.describe("호스팅된 개발 Supabase 거래 가계부", () => {
  test.skip(!integrationEnabled, "전용 개발 프로젝트 거래 E2E 환경변수가 설정되지 않았습니다.");

  test("지출과 수입을 추가하고 수정한 뒤 휴지통을 복원하고 영구 삭제한다", async ({ page }, testInfo) => {
    await verifyHostedSupabaseE2ESafety();
    const unique = `${Date.now()}${testInfo.workerIndex}`;
    const password = "Pockelog-test-2026!";

    await page.goto("/signup");
    await page.getByLabel("아이디", { exact: true }).fill(`lg_${unique}`);
    await page.getByLabel("사용자명", { exact: true }).fill("거래 테스트");
    const email = `ledger_${unique}@example.com`;
    e2eEmailsByTestId.set(testInfo.testId, email);
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("전화번호", { exact: true }).fill("010-2222-3333");
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
    await page.getByRole("button", { name: "가입하기" }).click();
    await expect(page).toHaveURL(/\/ledger$/);

    let dialog = await openAddPanel(page, testInfo);
    await dialog.getByLabel("내용").fill("점심");
    await dialog.getByLabel("분류").selectOption({ label: "식비" });
    await dialog.getByLabel("금액").fill("46500");
    await dialog.getByRole("button", { name: "저장" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("expense-total")).toContainText("46,500원");

    dialog = await openAddPanel(page, testInfo);
    await dialog.getByRole("radio", { name: "수입" }).check();
    await dialog.getByLabel("내용").fill("부수입");
    await dialog.getByLabel("분류").selectOption({ label: "부수입" });
    await dialog.getByLabel("금액").fill("100000");
    await dialog.getByRole("button", { name: "저장" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("income-total")).toContainText("100,000원");
    await expect(page.getByTestId("balance-total")).toContainText("53,500원");

    dialog = await openTransaction(page, testInfo, "점심");
    await dialog.getByLabel("내용").fill("팀 점심");
    await dialog.getByRole("button", { name: "수정 저장" }).click();
    await expect(dialog).toBeHidden();
    await expect(visibleLedgerDescription(page, testInfo, "팀 점심")).toBeVisible();

    dialog = await openTransaction(page, testInfo, "팀 점심");
    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog.getByRole("button", { name: "삭제" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("expense-total")).toContainText("0원");

    dialog = await openAddPanel(page, testInfo);
    await dialog.getByLabel("내용").fill("휴지통 검증");
    await dialog.getByLabel("분류").selectOption({ label: "식비" });
    await dialog.getByLabel("금액").fill("100");
    await dialog.getByRole("button", { name: "저장" }).click();
    await expect(dialog).toBeHidden();
    await expect(visibleLedgerDescription(page, testInfo, "휴지통 검증")).toBeVisible();

    dialog = await openTransaction(page, testInfo, "휴지통 검증");
    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog.getByRole("button", { name: "삭제" }).click();
    await expect(dialog).toBeHidden();
    await page.goto("/settings/trash");
    await expect(visibleTrashDescription(page, testInfo, "휴지통 검증")).toBeVisible();

    page.once("dialog", (confirmation) => confirmation.accept());
    await page.getByRole("button", { name: "휴지통 검증 복원" }).click();
    await expect(visibleTrashDescription(page, testInfo, "휴지통 검증")).toHaveCount(0);
    await page.goto("/ledger");
    await expect(visibleLedgerDescription(page, testInfo, "휴지통 검증")).toBeVisible();

    dialog = await openTransaction(page, testInfo, "휴지통 검증");
    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog.getByRole("button", { name: "삭제" }).click();
    await expect(dialog).toBeHidden();
    await page.goto("/settings/trash");
    await expect(visibleTrashDescription(page, testInfo, "휴지통 검증")).toBeVisible();

    page.once("dialog", (confirmation) => confirmation.accept());
    await page.getByRole("button", { name: "휴지통 검증 영구 삭제" }).click();
    await expect(visibleTrashDescription(page, testInfo, "휴지통 검증")).toHaveCount(0);
    await page.goto("/ledger");
    await expect(visibleLedgerDescription(page, testInfo, "휴지통 검증")).toHaveCount(0);

    if (testInfo.project.name === "desktop-chromium") {
      for (let index = 1; index <= 51; index += 1) {
        dialog = await openAddPanel(page, testInfo);
        await dialog.getByLabel("내용").fill(`자동 내역 ${index}`);
        await dialog.getByLabel("분류").selectOption({ label: "식비" });
        await dialog.getByLabel("금액").fill("1");
        await dialog.getByRole("button", { name: "저장" }).click();
        await expect(dialog).toBeHidden();
      }

      const generatedItems = visibleLedgerDescription(page, testInfo, /^자동 내역 \d+$/);
      await expect(generatedItems).toHaveCount(50);
      await page.getByTestId("transaction-sentinel").scrollIntoViewIfNeeded();
      await expect(generatedItems).toHaveCount(51, { timeout: 15_000 });
      await expect(page.getByText("모든 내역을 확인했어요")).toHaveCount(0);
    }
  });
});
