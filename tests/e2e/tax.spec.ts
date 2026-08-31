import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

import { deleteE2EUsersByEmail, verifyHostedSupabaseE2ESafety } from "./safety";

const integrationEnabled =
  process.env.E2E_ALLOW_HOSTED_SUPABASE === "1"
  && Boolean(process.env.E2E_SUPABASE_PROJECT_REF)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  && Boolean(process.env.SUPABASE_SECRET_KEY);

const password = "Pockelog-test-2026!";
const occurredOn = "2026-08-31";

type TestUser = {
  handle: string;
  name: string;
  email: string;
  phone: string;
};

function browserContextOptions(testInfo: TestInfo) {
  const mobile = testInfo.project.name === "mobile-chromium";
  return {
    baseURL: "http://127.0.0.1:3000",
    viewport: mobile ? { width: 393, height: 851 } : { width: 1280, height: 720 },
    isMobile: mobile,
    hasTouch: mobile,
  };
}

async function signUp(page: Page, user: TestUser) {
  await page.goto("/signup");
  await page.getByLabel("아이디", { exact: true }).fill(user.handle);
  await page.getByLabel("사용자명", { exact: true }).fill(user.name);
  await page.getByLabel("이메일", { exact: true }).fill(user.email);
  await page.getByLabel("전화번호", { exact: true }).fill(user.phone);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/ledger$/);
}

async function expectResponsiveShell(page: Page, testInfo: TestInfo) {
  const mobile = testInfo.project.name === "mobile-chromium";
  expect(page.viewportSize()?.width).toBe(mobile ? 393 : 1280);
  await expect(page.getByRole("navigation", { name: mobile ? "모바일 주 메뉴" : "주 메뉴" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: mobile ? "주 메뉴" : "모바일 주 메뉴" })).toBeHidden();
}

async function expectResponsiveTransactionPanel(page: Page, dialog: ReturnType<Page["getByRole"]>, testInfo: TestInfo) {
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(Math.abs(box.x + box.width - viewport.width)).toBeLessThanOrEqual(1);
  if (testInfo.project.name === "mobile-chromium") {
    expect(Math.abs(box.width - viewport.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(1);
  } else {
    expect(box.width).toBeGreaterThanOrEqual(470);
    expect(box.width).toBeLessThanOrEqual(490);
    expect(box.height).toBe(viewport.height);
  }
}

async function addContributionFromTaxPreset(
  page: Page,
  testInfo: TestInfo,
  preset: "pension_savings" | "irp",
  categoryLabel: "연금저축" | "IRP",
  description: string,
  amount: string,
) {
  await page.goto("/tax-goals");
  await page.getByRole("link", { name: `${categoryLabel} 추가` }).click();
  await expect(page).toHaveURL(new RegExp(`/ledger\\?new=${preset}$`));

  const dialog = page.getByRole("dialog", { name: "내역 추가" });
  await expect(dialog).toBeVisible();
  await expectResponsiveTransactionPanel(page, dialog, testInfo);
  await expect(dialog.getByLabel("분류").locator("option:checked")).toHaveText(categoryLabel);
  await dialog.getByLabel("사용 날짜").fill(occurredOn);
  await dialog.getByLabel("내용").fill(description);
  await dialog.getByLabel("금액").fill(amount);
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
}

async function expectTaxAmounts(
  page: Page,
  values: {
    pension: string;
    irp: string;
    combined: string;
    incomeTax: string;
    localIncomeTax: string;
    totalBenefit: string;
  },
) {
  await page.goto("/tax-goals");
  const payments = page.getByRole("region", { name: "2026년 연금 납입 현황" });
  await expect(payments.locator("article").filter({ hasText: "연금저축 납입액" })).toContainText(values.pension);
  await expect(payments.locator("article").filter({ hasText: "IRP 납입액" })).toContainText(values.irp);
  await expect(payments.locator("article").filter({ hasText: "전체 납입액" })).toContainText(values.combined);

  const result = page.getByRole("region", { name: "예상 절세 결과" });
  await expect(result.locator("article").filter({ hasText: "소득세 세액공제 예상액" })).toContainText(values.incomeTax);
  await expect(result.locator("article").filter({ hasText: "지방소득세 감소 예상액" })).toContainText(values.localIncomeTax);
  await expect(result.locator("article").filter({ hasText: "총 예상 절세액" })).toContainText(values.totalBenefit);
}

async function selectVisibleLedger(page: Page, label: string) {
  const selector = page.locator('select[aria-label="현재 장부"]:visible');
  await selector.selectOption({ label });
  await expect(selector.locator("option:checked")).toHaveText(label);
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function findUserId(admin: SupabaseClient, email: string) {
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Unable to list E2E users: ${error.message}`);
    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user.id;
    if (data.users.length < perPage) break;
  }
  throw new Error(`Unable to find E2E user: ${email}`);
}

async function restoreTransaction(admin: SupabaseClient, userId: string, description: string) {
  const { data: transaction, error: findError } = await admin
    .from("transactions")
    .select("id")
    .eq("created_by", userId)
    .eq("description", description)
    .not("deleted_at", "is", null)
    .single();
  if (findError) throw new Error(`Unable to find trashed E2E transaction: ${findError.message}`);

  const { error: restoreError } = await admin
    .from("transactions")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", transaction.id);
  if (restoreError) throw new Error(`Unable to restore E2E transaction: ${restoreError.message}`);
}

async function insertExtraContributions(email: string, userId: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Unable to authenticate E2E user: ${signInError.message}`);

  const { data: ledger, error: ledgerError } = await client
    .from("ledgers")
    .select("id")
    .eq("owner_id", userId)
    .eq("kind", "personal")
    .single();
  if (ledgerError) throw new Error(`Unable to find personal ledger: ${ledgerError.message}`);

  const { data: category, error: categoryError } = await client
    .from("categories")
    .select("id")
    .eq("ledger_id", ledger.id)
    .eq("system_code", "pension_savings")
    .single();
  if (categoryError) throw new Error(`Unable to find pension category: ${categoryError.message}`);

  const rows = Array.from({ length: 50 }, (_, index) => ({
    ledger_id: ledger.id,
    type: "expense",
    occurred_on: occurredOn,
    description: `자동 연금 납입 ${String(index + 1).padStart(2, "0")}`,
    amount: 1,
    category_id: category.id,
    created_by: userId,
    idempotency_key: crypto.randomUUID(),
  }));
  const { error: insertError } = await client.from("transactions").insert(rows);
  if (insertError) throw new Error(`Unable to insert E2E contributions: ${insertError.message}`);
  await client.auth.signOut();
}

test.describe("호스팅된 개발 Supabase 연금 세액공제", () => {
  test.skip(!integrationEnabled, "전용 개발 프로젝트 세금 E2E 환경변수가 설정되지 않았습니다.");

  test("PC와 모바일에서 가계부 연금 지출의 세금 반영 전체 흐름을 검증한다", async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    await verifyHostedSupabaseE2ESafety();
    const unique = `${Date.now()}${testInfo.workerIndex}`;
    const suffix = unique.slice(-12);
    const owner: TestUser = {
      handle: `txa_${suffix}`,
      name: "세금 사용자 A",
      email: `tax_owner_${unique}@example.com`,
      phone: "010-8600-1000",
    };
    const member: TestUser = {
      handle: `txb_${suffix}`,
      name: "세금 사용자 B",
      email: `tax_member_${unique}@example.com`,
      phone: "010-8600-2000",
    };
    const ledgerName = `세금 공동 장부 ${unique.slice(-5)}`;
    const ownerContext: BrowserContext = await browser.newContext(browserContextOptions(testInfo));
    const memberContext: BrowserContext = await browser.newContext(browserContextOptions(testInfo));
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();
    const admin = createAdminClient();

    try {
      await signUp(ownerPage, owner);
      await signUp(memberPage, member);
      await expectResponsiveShell(ownerPage, testInfo);

      await ownerPage.goto("/tax-goals");
      await ownerPage.getByLabel("총급여").fill("55000000");
      await ownerPage.getByRole("button", { name: "총급여 저장" }).click();
      await expect(ownerPage.getByRole("status")).toContainText("총급여를 저장했어요");

      await addContributionFromTaxPreset(ownerPage, testInfo, "pension_savings", "연금저축", "E2E 연금저축", "6000000");
      await addContributionFromTaxPreset(ownerPage, testInfo, "irp", "IRP", "E2E IRP", "3000000");
      await expectTaxAmounts(ownerPage, {
        pension: "6,000,000원",
        irp: "3,000,000원",
        combined: "9,000,000원",
        incomeTax: "1,350,000원",
        localIncomeTax: "135,000원",
        totalBenefit: "1,485,000원",
      });

      const contributionSection = ownerPage.getByRole("region", { name: "연금 납입 내역" });
      const desktopHeader = contributionSection.locator('div[aria-hidden="true"]').first();
      if (testInfo.project.name === "mobile-chromium") await expect(desktopHeader).toBeHidden();
      else await expect(desktopHeader).toBeVisible();

      await ownerPage.goto(`/ledger?start=${occurredOn}&end=${occurredOn}`);
      await expect(ownerPage.getByTestId("expense-total")).toContainText("9,000,000원");
      await ownerPage.goto("/statistics");
      await expect(ownerPage.getByText("지출 9,000,000원")).toBeVisible();

      await ownerPage.goto("/tax-goals");
      await ownerPage.getByRole("button", { name: "E2E IRP 편집" }).click();
      await expect(ownerPage).toHaveURL(/\/ledger\?edit=/);
      let dialog = ownerPage.getByRole("dialog", { name: "내역 수정" });
      await expectResponsiveTransactionPanel(ownerPage, dialog, testInfo);
      await dialog.getByLabel("금액").fill("2000000");
      await dialog.getByRole("button", { name: "수정 저장" }).click();
      await expect(dialog).toBeHidden();
      await expectTaxAmounts(ownerPage, {
        pension: "6,000,000원",
        irp: "2,000,000원",
        combined: "8,000,000원",
        incomeTax: "1,200,000원",
        localIncomeTax: "120,000원",
        totalBenefit: "1,320,000원",
      });

      await ownerPage.getByRole("button", { name: "E2E IRP 편집" }).click();
      dialog = ownerPage.getByRole("dialog", { name: "내역 수정" });
      ownerPage.once("dialog", (confirmation) => confirmation.accept());
      await dialog.getByRole("button", { name: "삭제" }).click();
      await expect(dialog).toBeHidden();
      await expectTaxAmounts(ownerPage, {
        pension: "6,000,000원",
        irp: "0원",
        combined: "6,000,000원",
        incomeTax: "900,000원",
        localIncomeTax: "90,000원",
        totalBenefit: "990,000원",
      });

      const ownerId = await findUserId(admin, owner.email);
      await verifyHostedSupabaseE2ESafety();
      await restoreTransaction(admin, ownerId, "E2E IRP");
      await expectTaxAmounts(ownerPage, {
        pension: "6,000,000원",
        irp: "2,000,000원",
        combined: "8,000,000원",
        incomeTax: "1,200,000원",
        localIncomeTax: "120,000원",
        totalBenefit: "1,320,000원",
      });

      await ownerPage.goto("/settings");
      await ownerPage.getByLabel("새 장부 이름").fill(ledgerName);
      await ownerPage.getByRole("button", { name: "공동 장부 만들기" }).click();
      await expect(ownerPage.getByRole("status")).toContainText("공동 장부를 만들었어요");
      await ownerPage.reload();
      await ownerPage.getByLabel("초대할 아이디 또는 이메일").fill(member.handle);
      await ownerPage.getByRole("button", { name: "초대하기" }).click();
      await expect(ownerPage.getByRole("status")).toContainText("초대를 보냈어요");

      await memberPage.goto("/settings");
      await memberPage.getByRole("button", { name: `${ledgerName} 초대 수락` }).click();
      await expect(memberPage.getByRole("status")).toContainText("초대를 수락했어요");
      await memberPage.reload();
      await selectVisibleLedger(memberPage, `공동 · ${ledgerName}`);
      await addContributionFromTaxPreset(memberPage, testInfo, "irp", "IRP", "사용자 B 공동 IRP", "1000000");

      await expectTaxAmounts(ownerPage, {
        pension: "6,000,000원",
        irp: "2,000,000원",
        combined: "8,000,000원",
        incomeTax: "1,200,000원",
        localIncomeTax: "120,000원",
        totalBenefit: "1,320,000원",
      });
      await expect(ownerPage.getByText("사용자 B 공동 IRP")).toHaveCount(0);

      await verifyHostedSupabaseE2ESafety();
      await insertExtraContributions(owner.email, ownerId);
      await ownerPage.goto("/tax-goals");
      const contributions = ownerPage.getByRole("region", { name: "연금 납입 내역" });
      await expect(contributions.locator("li")).toHaveCount(50);
      const sentinel = contributions.locator('div[aria-hidden="true"].h-2');
      await expect(sentinel).toHaveCount(1);
      await sentinel.scrollIntoViewIfNeeded();
      await expect(contributions.locator("li")).toHaveCount(52, { timeout: 15_000 });
      await expect(ownerPage.getByText("모든 납입 내역을 확인했어요")).toHaveCount(0);
    } finally {
      await ownerContext.close();
      await memberContext.close();
      await deleteE2EUsersByEmail([owner.email, member.email]);
    }
  });
});
