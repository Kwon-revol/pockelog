import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { verifyHostedSupabaseE2ESafety } from "./safety";

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
});
