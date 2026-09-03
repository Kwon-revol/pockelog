import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "../../next.config";
import { config as proxyConfig } from "@/proxy";
import { registerPockeLogServiceWorker } from "@/shared/pwa/service-worker-registration";

describe("PWA service worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers once with root scope and bypasses the HTTP cache in production", async () => {
    const register = vi.fn().mockResolvedValue(undefined);

    await registerPockeLogServiceWorker({ register }, "production");

    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });

  it("does not register in development or unsupported browsers", async () => {
    const register = vi.fn();

    await registerPockeLogServiceWorker({ register }, "development");
    await registerPockeLogServiceWorker(undefined, "production");

    expect(register).not.toHaveBeenCalled();
  });

  it("keeps registration failures from blocking the application", async () => {
    const register = vi.fn().mockRejectedValue(new Error("private detail"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      registerPockeLogServiceWorker({ register }, "production"),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "PockeLog 서비스 워커를 등록하지 못했습니다.",
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("private detail"));
  });

  it("serves the worker with secure no-store headers", async () => {
    const rules = await nextConfig.headers?.();

    expect(rules).toContainEqual({
      source: "/sw.js",
      headers: expect.arrayContaining([
        {
          key: "Content-Type",
          value: "application/javascript; charset=utf-8",
        },
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self'",
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ]),
    });
  });

  it("keeps PWA infrastructure outside the auth proxy", () => {
    const matcher = proxyConfig.matcher[0];

    expect(matcher).toContain("favicon\\.ico");
    expect(matcher).toContain("sw\\.js");
    expect(matcher).toContain("manifest\\.webmanifest");
    expect(matcher).toContain("icon");
    expect(matcher).toContain("apple-icon");
  });

  it("only caches public immutable assets", async () => {
    const worker = await readFile("public/sw.js", "utf8");

    expect(worker).toContain('url.pathname.startsWith("/_next/static/")');
    expect(worker).toContain("PUBLIC_ICON_PATHS.has(url.pathname)");
    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain('request.destination === "document"');
    expect(worker).toContain('request.method !== "GET"');
    expect(worker).not.toMatch(
      /cache\.put\([^)]*(?:api|ledger|statistics|tax-goals|settings|auth)/,
    );
  });
});
