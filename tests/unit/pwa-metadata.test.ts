import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

import { metadata, viewport } from "@/app/layout";
import manifest from "@/app/manifest";

describe("PWA metadata", () => {
  it("describes an installable standalone app that starts at the ledger", () => {
    expect(manifest()).toMatchObject({
      id: "/",
      name: "PockeLog",
      short_name: "PockeLog",
      start_url: "/ledger",
      scope: "/",
      display: "standalone",
      background_color: "#f8faf9",
      theme_color: "#059669",
      lang: "ko",
    });
  });

  it("declares ordinary and maskable icons for mobile and desktop", () => {
    expect(manifest().icons).toEqual([
      {
        src: "/icons/pockelog-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pockelog-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pockelog-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/pockelog-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ]);
  });

  it("publishes app and platform metadata without disabling zoom", () => {
    expect(metadata).toMatchObject({
      applicationName: "PockeLog",
      appleWebApp: {
        capable: true,
        title: "PockeLog",
        statusBarStyle: "default",
      },
      formatDetection: { telephone: false },
    });
    expect(viewport).toEqual({
      themeColor: "#059669",
      colorScheme: "light",
    });
    expect(viewport).not.toHaveProperty("maximumScale");
    expect(viewport).not.toHaveProperty("userScalable");
  });

  it("keeps form controls at 16px to prevent focus zoom on mobile Safari", async () => {
    const css = await readFile("src/app/globals.css", "utf8");

    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toMatch(/input,\s*select,\s*textarea\s*{[\s\S]*?font-size:\s*16px\s*!important;/);
  });
});
