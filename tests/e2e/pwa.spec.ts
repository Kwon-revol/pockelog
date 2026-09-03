import { expect, test } from "@playwright/test";

test("브라우저에 PWA 설치 기반을 제공한다", async ({ page, request }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    /manifest\.webmanifest/,
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#059669",
  );
  await expect(
    page.locator('meta[name="mobile-web-app-capable"]'),
  ).toHaveAttribute("content", "yes");
  await expect(
    page.locator('meta[name="apple-mobile-web-app-title"]'),
  ).toHaveAttribute("content", "PockeLog");
  await expect(
    page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
  ).toHaveAttribute("content", "default");

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    start_url: "/ledger",
    display: "standalone",
  });
  expect(manifest.icons).toHaveLength(4);

  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBe(true);
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(worker.headers()["content-type"]).toContain(
    "application/javascript",
  );
});
