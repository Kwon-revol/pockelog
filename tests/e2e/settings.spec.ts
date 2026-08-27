import { expect, test } from "@playwright/test";

import { verifyHostedSupabaseE2ESafety } from "./safety";

const integrationEnabled =
  process.env.E2E_ALLOW_HOSTED_SUPABASE === "1"
  && Boolean(process.env.E2E_SUPABASE_PROJECT_REF)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  && Boolean(process.env.SUPABASE_SECRET_KEY);

test.describe("호스팅된 개발 Supabase 설정", () => {
  test.skip(!integrationEnabled, "전용 개발 프로젝트 설정 E2E 환경변수가 설정되지 않았습니다.");

  test("정산 기준일과 분류를 변경해 가계부에 반영한다", async ({ page }, testInfo) => {
    await verifyHostedSupabaseE2ESafety();
    const unique = `${Date.now()}${testInfo.workerIndex}`;
    const password = "Pockelog-test-2026!";
    const categoryName = `반려동물 ${unique.slice(-5)}`;
    const changedName = `동물병원 ${unique.slice(-5)}`;

    await page.goto("/signup");
    await page.getByLabel("아이디", { exact: true }).fill(`se_${unique}`);
    await page.getByLabel("사용자명", { exact: true }).fill("설정 테스트");
    await page.getByLabel("이메일", { exact: true }).fill(`settings_${unique}@example.com`);
    await page.getByLabel("전화번호", { exact: true }).fill("010-5656-7878");
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
    await page.getByRole("button", { name: "가입하기" }).click();
    await expect(page).toHaveURL(/\/ledger$/);

    await page.goto("/settings");
    await page.getByLabel("장부 이름").fill("우리 집 생활비");
    await page.getByLabel("정산 시작일").selectOption("10");
    await page.getByRole("button", { name: "장부 설정 저장" }).click();
    await expect(page.getByRole("status")).toContainText("장부 설정을 저장했어요");
    await page.reload();
    await expect(page.getByLabel("장부 이름")).toHaveValue("우리 집 생활비");
    await expect(page.getByLabel("정산 시작일")).toHaveValue("10");

    await page.getByRole("button", { name: "분류 추가" }).click();
    let dialog = page.getByRole("dialog", { name: "지출 분류 추가" });
    await dialog.getByLabel("분류 이름").fill(categoryName);
    await dialog.getByRole("button", { name: "#8B5CF6 색상 선택" }).click();
    await dialog.getByRole("button", { name: "분류 추가" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(categoryName)).toBeVisible();

    await page.getByRole("button", { name: `${categoryName} 위로 이동` }).click();
    await expect(page.getByRole("status")).toContainText("분류 순서를 바꿨어요");
    await page.getByRole("button", { name: `${categoryName} 수정` }).click();
    dialog = page.getByRole("dialog", { name: `${categoryName} 분류 수정` });
    await dialog.getByLabel("분류 이름").fill(changedName);
    await dialog.getByRole("button", { name: "분류 저장" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(changedName)).toBeVisible();

    page.once("dialog", (confirmation) => confirmation.accept());
    await page.getByRole("button", { name: `${changedName} 숨기기` }).click();
    await expect(page.getByRole("status")).toContainText("분류를 숨겼어요");
    await page.getByText(/숨긴 분류 1개/).click();
    await page.getByRole("button", { name: `${changedName} 다시 표시` }).click();
    await expect(page.getByRole("status")).toContainText("분류를 다시 표시했어요");

    await page.goto("/ledger");
    await expect(page.getByLabel("시작일")).toHaveValue(/-10$/);
    await page.getByRole("button", { name: /내역 추가/ }).first().click();
    await expect(page.getByRole("dialog", { name: "내역 추가" }).getByRole("option", { name: changedName })).toBeVisible();

    await page.goto("/statistics");
    await expect(page.getByRole("region", { name: "정산 기간별 통계" }).getByRole("link").first()).toContainText("10일");
  });
});
