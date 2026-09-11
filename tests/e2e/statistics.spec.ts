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

async function createExpenseCategory(page: Page, name: string) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "분류 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "지출 분류 추가" });
  await dialog.getByLabel("분류 이름").fill(name);
  await dialog.getByRole("button", { name: "분류 추가" }).click();
  await expect(dialog).toBeHidden();
}

async function saveExpenseGroup(page: Page, name: string, categoryNames: string[]) {
  await page.goto("/settings");
  const manager = page.getByRole("region", { name: "통계 그룹 관리" });
  await manager.getByRole("button", { name: "통계 그룹 추가" }).click();
  await manager.getByLabel("그룹 이름").fill(name);
  await manager.getByRole("button", { name: "#3B82F6 색상 선택" }).click();
  for (const categoryName of categoryNames) {
    await manager.getByLabel(categoryName, { exact: true }).check();
  }
  await manager.getByRole("button", { name: "그룹 저장" }).click();
  await expect(manager.getByRole("status")).toContainText("통계 그룹을 추가했어요");
}

async function addExpense(
  page: Page,
  testInfo: TestInfo,
  description: string,
  category: string,
  amount: string,
) {
  await page.goto("/ledger");
  const dialog = await openAddPanel(page, testInfo);
  await dialog.getByLabel("내용").fill(description);
  await dialog.getByLabel("분류").selectOption({ label: category });
  await dialog.getByLabel("금액").fill(amount);
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
}

async function openCurrentExpenseDetail(page: Page) {
  await page.goto("/statistics");
  await page.getByRole("region", { name: "정산 기간별 통계" }).getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "분류별 지출" })).toBeVisible();
  return page.getByRole("region", { name: "분류별 지출 비율" });
}

test.describe("호스팅된 개발 Supabase 통계", () => {
  test.skip(!integrationEnabled, "전용 개발 프로젝트 통계 E2E 환경변수가 설정되지 않았습니다.");

  test("정산 기간 합계에서 분류 상세와 원본 거래를 확인한다", async ({ page }, testInfo) => {
    await verifyHostedSupabaseE2ESafety();
    const unique = `${Date.now()}${testInfo.workerIndex}`;
    const password = "Pockelog-test-2026!";

    await page.goto("/signup");
    await page.getByLabel("아이디", { exact: true }).fill(`st_${unique}`);
    await page.getByLabel("사용자명", { exact: true }).fill("통계 테스트");
    await page.getByLabel("이메일", { exact: true }).fill(`statistics_${unique}@example.com`);
    await page.getByLabel("전화번호", { exact: true }).fill("010-4444-5555");
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
    await page.getByRole("button", { name: "가입하기" }).click();
    await expect(page).toHaveURL(/\/ledger$/);

    let dialog = await openAddPanel(page, testInfo);
    await dialog.getByLabel("내용").fill("통계 점심");
    await dialog.getByLabel("분류").selectOption({ label: "식비" });
    await dialog.getByLabel("금액").fill("46500");
    await dialog.getByRole("button", { name: "저장" }).click();
    await expect(dialog).toBeHidden();

    dialog = await openAddPanel(page, testInfo);
    await dialog.getByRole("radio", { name: "수입" }).check();
    await dialog.getByLabel("내용").fill("통계 부수입");
    await dialog.getByLabel("분류").selectOption({ label: "부수입" });
    await dialog.getByLabel("금액").fill("100000");
    await dialog.getByRole("button", { name: "저장" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/statistics");
    await expect(page.getByText("수입 100,000원")).toBeVisible();
    await expect(page.getByText("지출 46,500원")).toBeVisible();
    await page.getByRole("region", { name: "정산 기간별 통계" }).getByRole("link").first().click();

    await expect(page.getByRole("heading", { name: "분류별 지출" })).toBeVisible();
    await expect(page.getByRole("region", { name: "분류별 지출 비율" }).getByText("식비")).toBeVisible();
    await expect(page.getByText("통계 점심").first()).toBeVisible();

    await page.getByRole("link", { name: "수입" }).click();
    await expect(page.getByRole("heading", { name: "분류별 수입" })).toBeVisible();
    await expect(page.getByText("통계 부수입").first()).toBeVisible();
  });

  test("통계 그룹 합계, 이동, 삭제 뒤 상세 분류 표시를 확인한다", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await verifyHostedSupabaseE2ESafety();
    const unique = `${Date.now()}${testInfo.workerIndex}`;
    const email = `statistics_groups_${unique}@example.com`;
    const user = {
      handle: `sg_${unique}`,
      name: "통계 그룹 테스트",
      email,
      phone: "010-8181-9191",
    };

    try {
      await page.goto("/signup");
      await page.getByLabel("아이디", { exact: true }).fill(user.handle);
      await page.getByLabel("사용자명", { exact: true }).fill(user.name);
      await page.getByLabel("이메일", { exact: true }).fill(user.email);
      await page.getByLabel("전화번호", { exact: true }).fill(user.phone);
      await page.getByLabel("비밀번호", { exact: true }).fill("Pockelog-test-2026!");
      await page.getByLabel("비밀번호 확인", { exact: true }).fill("Pockelog-test-2026!");
      await page.getByRole("button", { name: "가입하기" }).click();
      await expect(page).toHaveURL(/\/ledger$/);

      await createExpenseCategory(page, "E2E 주거비");
      await createExpenseCategory(page, "E2E 통신비");
      await createExpenseCategory(page, "E2E 식비");
      await addExpense(page, testInfo, "E2E 주거비 거래", "E2E 주거비", "100000");
      await addExpense(page, testInfo, "E2E 통신비 거래", "E2E 통신비", "50000");
      await addExpense(page, testInfo, "E2E 식비 거래", "E2E 식비", "30000");

      await saveExpenseGroup(page, "E2E 고정지출", ["E2E 주거비", "E2E 통신비"]);
      let breakdown = await openCurrentExpenseDetail(page);
      const fixedExpense = breakdown.getByRole("button", { name: /E2E 고정지출.*150,000원/ });
      await expect(fixedExpense).toHaveAttribute("aria-expanded", "false");
      await expect(breakdown.getByText("E2E 식비", { exact: true })).toBeVisible();
      await expect(breakdown.getByText("30,000원", { exact: true })).toBeVisible();
      await fixedExpense.click();
      await expect(fixedExpense).toHaveAttribute("aria-expanded", "true");
      await expect(breakdown.getByText("E2E 주거비", { exact: true })).toBeVisible();
      await expect(breakdown.getByText("E2E 통신비", { exact: true })).toBeVisible();
      await expect(breakdown.getByText("100,000원", { exact: true })).toBeVisible();
      await expect(breakdown.getByText("50,000원", { exact: true })).toBeVisible();

      await saveExpenseGroup(page, "E2E 변동지출", ["E2E 통신비"]);
      breakdown = await openCurrentExpenseDetail(page);
      await expect(breakdown.getByRole("button", { name: /E2E 고정지출.*100,000원/ })).toBeVisible();
      await expect(breakdown.getByRole("button", { name: /E2E 변동지출.*50,000원/ })).toBeVisible();
      await expect(page.getByText("총 180,000원")).toBeVisible();

      await page.goto("/settings");
      page.once("dialog", (confirmation) => confirmation.accept());
      await page.getByRole("button", { name: "E2E 고정지출 삭제" }).click();
      await expect(page.getByRole("status")).toContainText("통계 그룹을 삭제했어요");
      page.once("dialog", (confirmation) => confirmation.accept());
      await page.getByRole("button", { name: "E2E 변동지출 삭제" }).click();
      await expect(page.getByRole("status")).toContainText("통계 그룹을 삭제했어요");

      breakdown = await openCurrentExpenseDetail(page);
      await expect(breakdown.getByRole("button", { name: /E2E 고정지출/ })).toHaveCount(0);
      await expect(breakdown.getByRole("button", { name: /E2E 변동지출/ })).toHaveCount(0);
      await expect(breakdown.getByText("E2E 주거비", { exact: true })).toBeVisible();
      await expect(breakdown.getByText("E2E 통신비", { exact: true })).toBeVisible();
      await expect(breakdown.getByText("E2E 식비", { exact: true })).toBeVisible();
    } finally {
      await deleteE2EUsersByEmail([email]);
    }
  });
});
