import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

import { deleteE2EUsersByEmail, verifyHostedSupabaseE2ESafety } from "./safety";

const integrationEnabled =
  process.env.E2E_ALLOW_HOSTED_SUPABASE === "1"
  && Boolean(process.env.E2E_SUPABASE_PROJECT_REF)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  && Boolean(process.env.SUPABASE_SECRET_KEY);

const initialPassword = "Pockelog-test-2026!";
const changedPassword = "Pockelog-updated-2026!";

type E2EUser = {
  handle: string;
  name: string;
  email: string;
  phone: string;
};

async function signUp(page: Page, user: E2EUser) {
  await page.goto("/signup");
  await page.getByLabel("아이디", { exact: true }).fill(user.handle);
  await page.getByLabel("사용자명", { exact: true }).fill(user.name);
  await page.getByLabel("이메일", { exact: true }).fill(user.email);
  await page.getByLabel("전화번호", { exact: true }).fill(user.phone);
  await page.getByLabel("비밀번호", { exact: true }).fill(initialPassword);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(initialPassword);
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/ledger$/);
}

async function login(page: Page, identifier: string, password: string) {
  await page.getByLabel("아이디 또는 이메일").fill(identifier);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

async function selectVisibleLedger(page: Page, label: string) {
  const selector = page.locator('select[aria-label="현재 장부"]:visible');
  await selector.selectOption({ label });
  await expect(selector.locator("option:checked")).toHaveText(label);
}

function uniqueFor(testInfo: TestInfo) {
  const project = testInfo.project.name === "mobile-chromium" ? "m" : "d";
  return `${project}${Date.now()}${testInfo.workerIndex}`;
}

test.describe("호스팅된 개발 Supabase 설정", () => {
  test.skip(!integrationEnabled, "전용 개발 프로젝트 설정 E2E 환경변수가 설정되지 않았습니다.");

  test("본인 프로필을 저장하고 비밀번호 변경 뒤 새 비밀번호로 다시 로그인한다", async ({ page }, testInfo) => {
    await verifyHostedSupabaseE2ESafety();
    const unique = uniqueFor(testInfo);
    const user = {
      handle: `sp_${unique}`,
      name: "프로필 테스트",
      email: `settings_profile_${unique}@example.com`,
      phone: "010-1212-3434",
    };

    try {
      await signUp(page, user);

      await page.goto("/settings");
      await expect(page.getByLabel("가입 이메일")).toHaveValue(user.email);
      await page.getByLabel("사용자명").fill("변경 사용자");
      await page.getByLabel("전화번호").fill("010-9876-5432");
      await page.getByRole("button", { name: "프로필 저장" }).click();
      await expect(page.getByRole("status")).toContainText("프로필을 저장했어요");
      await page.reload();
      await expect(page.getByLabel("사용자명")).toHaveValue("변경 사용자");
      await expect(page.getByLabel("전화번호")).toHaveValue("010-9876-5432");

      await page.getByLabel("현재 비밀번호").fill("Pockelog-incorrect-2026!");
      await page.getByLabel("새 비밀번호").fill(changedPassword);
      await page.getByLabel("새 비밀번호 확인").fill(changedPassword);
      await page.getByRole("button", { name: "비밀번호 변경" }).click();
      await expect(page.getByRole("alert")).toContainText("현재 비밀번호를 확인해 주세요");

      await page.getByLabel("현재 비밀번호").fill(initialPassword);
      await page.getByRole("button", { name: "비밀번호 변경" }).click();
      await expect(page).toHaveURL(/\/login\?passwordChanged=1$/);
      await expect(page.getByRole("status")).toContainText("새 비밀번호로 다시 로그인해 주세요");

      await login(page, user.handle, initialPassword);
      await expect(page.getByRole("alert")).toContainText("아이디 또는 이메일과 비밀번호를 확인해 주세요");
      await login(page, user.handle, changedPassword);
      await expect(page).toHaveURL(/\/ledger$/);
    } finally {
      await deleteE2EUsersByEmail([user.email]);
    }
  });

  test("공동 장부 참여자는 장부 선택 후 자신의 프로필만 변경한다", async ({ browser }, testInfo) => {
    await verifyHostedSupabaseE2ESafety();
    const unique = uniqueFor(testInfo);
    const owner = {
      handle: `spo_${unique}`,
      name: "프로필 소유자",
      email: `settings_owner_${unique}@example.com`,
      phone: "010-4545-6767",
    };
    const member = {
      handle: `spm_${unique}`,
      name: "프로필 참여자",
      email: `settings_member_${unique}@example.com`,
      phone: "010-7878-9090",
    };
    const ledgerName = `프로필 공동 장부 ${unique.slice(-5)}`;
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
      await ownerPage.getByLabel("초대할 아이디 또는 이메일").fill(member.handle);
      await ownerPage.getByRole("button", { name: "초대하기" }).click();
      await expect(ownerPage.getByRole("status")).toContainText("초대를 보냈어요");

      await memberPage.goto("/settings");
      await memberPage.getByRole("button", { name: `${ledgerName} 초대 수락` }).click();
      await expect(memberPage.getByRole("status")).toContainText("초대를 수락했어요");
      await memberPage.reload();
      await selectVisibleLedger(memberPage, `공동 · ${ledgerName}`);
      await memberPage.goto("/settings");
      await expect(memberPage.getByLabel("사용자명")).toHaveValue(member.name);
      await memberPage.getByLabel("사용자명").fill("변경 참여자");
      await memberPage.getByRole("button", { name: "프로필 저장" }).click();
      await expect(memberPage.getByRole("status")).toContainText("프로필을 저장했어요");
      await memberPage.reload();
      await expect(memberPage.getByLabel("사용자명")).toHaveValue("변경 참여자");

      await selectVisibleLedger(ownerPage, `공동 · ${ledgerName}`);
      await ownerPage.goto("/settings");
      await ownerPage.reload();
      await expect(ownerPage.getByText(owner.name, { exact: true })).toBeVisible();
      await expect(ownerPage.getByText("변경 참여자", { exact: true })).toBeVisible();
    } finally {
      await ownerContext.close();
      await memberContext.close();
      await deleteE2EUsersByEmail([owner.email, member.email]);
    }
  });

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
