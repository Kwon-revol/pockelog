# PockeLog PWA Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PockeLog를 모바일 홈 화면과 PC에 설치할 수 있게 하고, 공개 정적 자산만 캐시하는 안전한 PWA 기반을 제공한다.

**Architecture:** Next.js App Router의 `manifest.ts`, Metadata API, 파일 기반 아이콘을 사용한다. 루트에 등록하는 경량 서비스 워커는 명시적으로 허용한 아이콘과 `/_next/static/` GET 응답만 Cache Storage에 저장하고, HTML·RSC·API·인증·사용자 데이터 요청은 가로채지 않는다.

**Tech Stack:** Next.js 16.3.3, React 19, TypeScript 5, Vitest, Playwright, Sharp(아이콘 생성 전용 개발 의존성)

**Spec:** `docs/superpowers/specs/2026-09-03-pwa-installation-design.md`

## Global Constraints

- 기준 커밋은 `e369d91`의 최신 `main`이며 구현은 현재 격리된 worktree 안에서만 수행한다.
- 앱 내부의 커스텀 설치 버튼·배너와 `beforeinstallprompt` 처리는 만들지 않는다.
- 사용자별 HTML, RSC, API, 인증, 가계부 데이터 응답을 Cache Storage에 저장하지 않는다.
- 오프라인 데이터 조회·편집, 푸시 알림, background sync는 구현하지 않는다.
- 커밋 작성자는 `kwon_revol <259511148+Kwon-revol@users.noreply.github.com>`를 사용하고 메시지는 한국어로 작성한다.
- 원격 저장소에는 push하지 않는다.

---

### Task 1: Manifest와 Next.js 메타데이터

**Files:**
- Create: `src/app/manifest.ts`
- Modify: `src/app/layout.tsx`
- Create: `tests/unit/pwa-metadata.test.ts`

**Interfaces:**
- Consumes: `PRODUCT_NAME`, `PRODUCT_DESCRIPTION` from `src/shared/config/product.ts`
- Produces: `manifest(): MetadataRoute.Manifest`, root `metadata: Metadata`, root `viewport: Viewport`

- [ ] **Step 1: manifest와 metadata 계약의 실패 테스트 작성**

```ts
import { describe, expect, it } from "vitest";

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
      { src: "/icons/pockelog-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pockelog-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pockelog-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/pockelog-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });

  it("publishes app and platform metadata without disabling zoom", () => {
    expect(metadata).toMatchObject({
      applicationName: "PockeLog",
      appleWebApp: { capable: true, title: "PockeLog", statusBarStyle: "default" },
      formatDetection: { telephone: false },
    });
    expect(viewport).toEqual({ themeColor: "#059669", colorScheme: "light" });
    expect(viewport).not.toHaveProperty("maximumScale");
    expect(viewport).not.toHaveProperty("userScalable");
  });
});
```

- [ ] **Step 2: 테스트가 기능 부재 때문에 실패하는지 확인**

Run: `npm test -- --run tests/unit/pwa-metadata.test.ts`

Expected: FAIL because `@/app/manifest` does not exist and the root metadata lacks PWA fields.

- [ ] **Step 3: 최소 manifest 구현**

```ts
import type { MetadataRoute } from "next";

import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/shared/config/product";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    start_url: "/ledger",
    scope: "/",
    display: "standalone",
    background_color: "#f8faf9",
    theme_color: "#059669",
    lang: "ko",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/pockelog-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pockelog-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pockelog-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/pockelog-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 4: 루트 metadata와 viewport 구현**

```ts
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  applicationName: PRODUCT_NAME,
  title: { default: PRODUCT_NAME, template: `%s | ${PRODUCT_NAME}` },
  description: PRODUCT_DESCRIPTION,
  appleWebApp: { capable: true, title: PRODUCT_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  colorScheme: "light",
};
```

- [ ] **Step 5: 단위 테스트 통과 확인**

Run: `npm test -- --run tests/unit/pwa-metadata.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 6: 변경 커밋**

```powershell
git add -- src/app/manifest.ts src/app/layout.tsx tests/unit/pwa-metadata.test.ts
git -c user.name=kwon_revol -c user.email=259511148+Kwon-revol@users.noreply.github.com commit -m "기능: PWA 매니페스트와 앱 메타데이터 추가"
```

### Task 2: 재현 가능한 모바일·PC 앱 아이콘

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/generate-pwa-icons.mjs`
- Create: `public/icons/pockelog-192.png`
- Create: `public/icons/pockelog-512.png`
- Create: `public/icons/pockelog-maskable-192.png`
- Create: `public/icons/pockelog-maskable-512.png`
- Create: `src/app/apple-icon.png`
- Modify: `src/app/favicon.ico`
- Create: `tests/unit/pwa-icons.test.ts`

**Interfaces:**
- Consumes: the exact icon paths declared by `manifest()`
- Produces: `npm run icons:generate` and PNG/ICO assets with deterministic dimensions

- [ ] **Step 1: 아이콘 파일 규격의 실패 테스트 작성**

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

function pngSize(buffer: Buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("PWA icon assets", () => {
  it.each([
    ["public/icons/pockelog-192.png", 192],
    ["public/icons/pockelog-512.png", 512],
    ["public/icons/pockelog-maskable-192.png", 192],
    ["public/icons/pockelog-maskable-512.png", 512],
    ["src/app/apple-icon.png", 180],
  ])("provides %s at %d pixels", async (path, size) => {
    expect(pngSize(await readFile(path))).toEqual({ width: size, height: size });
  });

  it("provides a branded ICO favicon", async () => {
    const favicon = await readFile("src/app/favicon.ico");
    expect([...favicon.subarray(0, 6)]).toEqual([0, 0, 1, 0, 1, 0]);
    expect(favicon.length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: 테스트가 누락된 PNG 때문에 실패하는지 확인**

Run: `npm test -- --run tests/unit/pwa-icons.test.ts`

Expected: FAIL with `ENOENT` for the first new icon.

- [ ] **Step 3: Sharp를 명시적인 개발 의존성으로 추가**

Run: `npm install --save-dev sharp@0.35.3`

Expected: `package.json` and `package-lock.json` declare Sharp without changing runtime application dependencies.

- [ ] **Step 4: emerald 장부 표식과 maskable 안전 영역을 생성하는 스크립트 작성**

`scripts/generate-pwa-icons.mjs`는 `sharp`로 동일한 SVG 표식을 일반·maskable PNG 크기에 렌더링하고, 32px PNG를 ICO 컨테이너에 넣어 `src/app/favicon.ico`를 덮어쓴다. 일반 아이콘은 둥근 모서리, maskable 아이콘은 full-bleed emerald 배경과 중앙 60% 안전 영역을 사용한다.

```js
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function iconSvg(size, maskable = false) {
  const radius = maskable ? 0 : Math.round(size * 0.18);
  const inset = maskable ? size * 0.2 : size * 0.12;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="#059669"/>
    <path d="M ${inset} ${size * 0.3} Q ${size * 0.5} ${size * 0.18} ${size - inset} ${size * 0.3} V ${size * 0.72} Q ${size * 0.5} ${size * 0.84} ${inset} ${size * 0.72} Z" fill="#fff"/>
    <path d="M ${size * 0.32} ${size * 0.55} L ${size * 0.43} ${size * 0.45} L ${size * 0.54} ${size * 0.53} L ${size * 0.7} ${size * 0.38}" fill="none" stroke="#064e3b" stroke-width="${size * 0.055}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`);
}

async function renderPng(path, size, maskable = false) {
  await sharp(iconSvg(size, maskable)).png().toFile(resolve(root, path));
}

function icoFromPng(png) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 32;
  header[7] = 32;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

await mkdir(resolve(root, "public/icons"), { recursive: true });
await Promise.all([
  renderPng("public/icons/pockelog-192.png", 192),
  renderPng("public/icons/pockelog-512.png", 512),
  renderPng("public/icons/pockelog-maskable-192.png", 192, true),
  renderPng("public/icons/pockelog-maskable-512.png", 512, true),
  renderPng("src/app/apple-icon.png", 180),
]);
const faviconPng = await sharp(iconSvg(32)).png().toBuffer();
await writeFile(resolve(root, "src/app/favicon.ico"), icoFromPng(faviconPng));
```

- [ ] **Step 5: 생성 명령을 package script로 등록하고 아이콘 생성**

`package.json`에 `"icons:generate": "node scripts/generate-pwa-icons.mjs"`를 추가한다.

Run: `npm run icons:generate`

Expected: all six icon files are generated without warnings.

- [ ] **Step 6: 아이콘 테스트 통과와 육안 확인**

Run: `npm test -- --run tests/unit/pwa-icons.test.ts`

Expected: all dimension and ICO checks PASS. Then inspect `public/icons/pockelog-512.png` and `public/icons/pockelog-maskable-512.png` to verify crisp edges, correct colors, and safe-zone placement.

- [ ] **Step 7: 변경 커밋**

```powershell
git add -- package.json package-lock.json scripts/generate-pwa-icons.mjs public/icons src/app/apple-icon.png src/app/favicon.ico tests/unit/pwa-icons.test.ts
git -c user.name=kwon_revol -c user.email=259511148+Kwon-revol@users.noreply.github.com commit -m "기능: 모바일과 PC용 PWA 아이콘 추가"
```

### Task 3: 안전한 서비스 워커 등록과 캐시 정책

**Files:**
- Create: `src/shared/pwa/service-worker-registration.tsx`
- Create: `public/sw.js`
- Modify: `src/app/layout.tsx`
- Modify: `next.config.ts`
- Modify: `src/proxy.ts`
- Create: `tests/unit/pwa-service-worker.test.tsx`

**Interfaces:**
- Consumes: `/sw.js`, the manifest icon paths, browser `ServiceWorkerContainer`
- Produces: `registerPockeLogServiceWorker(serviceWorker, environment): Promise<void>` and `<ServiceWorkerRegistration />`

- [ ] **Step 1: 등록·헤더·캐시 경계의 실패 테스트 작성**

```tsx
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import nextConfig from "../../next.config";
import { config as proxyConfig } from "@/proxy";
import { registerPockeLogServiceWorker } from "@/shared/pwa/service-worker-registration";

describe("PWA service worker", () => {
  it("registers once with root scope and bypasses the HTTP cache in production", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    await registerPockeLogServiceWorker({ register }, "production");
    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });

  it("does not register in development or unsupported browsers", async () => {
    const register = vi.fn();
    await registerPockeLogServiceWorker({ register }, "development");
    await registerPockeLogServiceWorker(undefined, "production");
    expect(register).not.toHaveBeenCalled();
  });

  it("serves the worker with secure no-store headers", async () => {
    const rules = await nextConfig.headers?.();
    expect(rules).toContainEqual({
      source: "/sw.js",
      headers: expect.arrayContaining([
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ]),
    });
  });

  it("keeps PWA infrastructure outside the auth proxy", () => {
    const matcher = proxyConfig.matcher[0];
    expect(matcher).toContain("sw\\.js");
    expect(matcher).toContain("manifest\\.webmanifest");
    expect(matcher).toContain("apple-icon");
  });

  it("only caches public immutable assets", async () => {
    const worker = await readFile("public/sw.js", "utf8");
    expect(worker).toContain('url.pathname.startsWith("/_next/static/")');
    expect(worker).toContain('PUBLIC_ICON_PATHS.has(url.pathname)');
    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain('request.method !== "GET"');
    expect(worker).not.toMatch(/cache\.put\([^)]*(?:api|ledger|statistics|tax-goals|settings|auth)/);
  });
});
```

- [ ] **Step 2: 테스트가 구현 부재 때문에 실패하는지 확인**

Run: `npm test -- --run tests/unit/pwa-service-worker.test.tsx`

Expected: FAIL because the registration module and `public/sw.js` do not exist.

- [ ] **Step 3: 점진적 향상 방식의 등록 모듈 구현**

```tsx
"use client";

import { useEffect } from "react";

type ServiceWorkerRegistrar = Pick<ServiceWorkerContainer, "register">;

export async function registerPockeLogServiceWorker(
  serviceWorker: ServiceWorkerRegistrar | undefined,
  environment = process.env.NODE_ENV,
) {
  if (environment !== "production" || !serviceWorker) return;

  try {
    await serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    console.warn("PockeLog 서비스 워커를 등록하지 못했습니다.");
  }
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const serviceWorker = "serviceWorker" in navigator ? navigator.serviceWorker : undefined;
    void registerPockeLogServiceWorker(serviceWorker);
  }, []);

  return null;
}
```

루트 `<body>` 마지막에 `<ServiceWorkerRegistration />`을 추가한다.

- [ ] **Step 4: allowlist 서비스 워커 구현**

`public/sw.js`는 `pockelog-static-v1` 캐시와 manifest 아이콘 precache 목록을 선언한다. `isCacheableRequest()`는 GET, same-origin, non-navigation 요청 중 `/_next/static/` 또는 공개 아이콘 경로만 true로 반환한다. install에서 아이콘을 precache하고, activate에서 이전 `pockelog-static-` 캐시를 삭제하며, fetch에서는 허용 요청에만 cache-first `respondWith()`를 적용한다.

```js
const CACHE_PREFIX = "pockelog-static-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const PUBLIC_ICON_PATHS = new Set([
  "/favicon.ico",
  "/apple-icon",
  "/icons/pockelog-192.png",
  "/icons/pockelog-512.png",
  "/icons/pockelog-maskable-192.png",
  "/icons/pockelog-maskable-512.png",
]);
const PRECACHE_URLS = [...PUBLIC_ICON_PATHS].filter((path) => path.startsWith("/icons/"));

function isCacheableRequest(request) {
  if (request.method !== "GET" || request.mode === "navigate" || request.destination === "document") {
    return false;
  }
  const url = new URL(request.url);
  return url.origin === self.location.origin
    && (url.pathname.startsWith("/_next/static/") || PUBLIC_ICON_PATHS.has(url.pathname));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!isCacheableRequest(event.request)) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
```

- [ ] **Step 5: 서비스 워커 헤더와 proxy 예외 구현**

`next.config.ts`의 `headers()`는 `/sw.js`에 설계된 네 헤더를 반환한다. `src/proxy.ts` matcher는 `_next`, 이미지 확장자와 함께 `favicon.ico`, `sw.js`, `manifest.webmanifest`, `icon`, `apple-icon`을 제외한다.

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/sw.js",
      headers: [
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }];
  },
};

export default nextConfig;
```

```ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico$|sw\\.js$|manifest\\.webmanifest$|icon$|apple-icon$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 6: 단위 테스트 통과와 회귀 테스트 확인**

Run: `npm test -- --run tests/unit/pwa-service-worker.test.tsx tests/unit/pwa-metadata.test.ts tests/unit/auth-routing.test.ts`

Expected: all selected tests PASS with no warnings.

- [ ] **Step 7: 변경 커밋**

```powershell
git add -- src/shared/pwa/service-worker-registration.tsx public/sw.js src/app/layout.tsx next.config.ts src/proxy.ts tests/unit/pwa-service-worker.test.tsx
git -c user.name=kwon_revol -c user.email=259511148+Kwon-revol@users.noreply.github.com commit -m "기능: 민감 데이터를 제외한 PWA 캐시 기반 추가"
```

### Task 4: 공개 설치 계약 E2E와 운영 문서

**Files:**
- Create: `tests/e2e/pwa.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: production-facing manifest, icon, metadata, and worker endpoints
- Produces: desktop/mobile browser-level PWA contract verification and deployment guidance

- [ ] **Step 1: 공개 설치 계약 E2E 작성**

```ts
import { expect, test } from "@playwright/test";

test("브라우저에 PWA 설치 기반을 제공한다", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#059669");
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ start_url: "/ledger", display: "standalone" });
  expect(manifest.icons).toHaveLength(4);

  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBe(true);
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(worker.headers()["content-type"]).toContain("application/javascript");
});
```

- [ ] **Step 2: E2E가 현재 개발 서버에서 통과하는지 확인**

Run: `npx playwright test tests/e2e/pwa.spec.ts`

Expected: PASS in both `desktop-chromium` and `mobile-chromium` projects. If a selector differs from Next.js actual metadata output, inspect the rendered head and tighten the assertion without weakening the product requirement.

- [ ] **Step 3: README에 설치·캐시 범위 추가**

`README.md`에 모바일/PC 설치 방법, HTTPS 운영 조건, 커스텀 설치 버튼이 없다는 점, 오프라인 캐시는 공개 아이콘과 Next 정적 번들만 대상으로 하고 로그인·가계부 데이터는 네트워크가 필요하다는 내용을 기록한다. 아이콘 재생성 명령 `npm run icons:generate`도 함께 기록한다.

````md
## 앱 설치(PWA)

운영 사이트를 HTTPS로 열면 Android와 PC의 Chromium 계열 브라우저에서 브라우저가
제공하는 설치 메뉴로 PockeLog를 설치할 수 있습니다. iPhone과 iPad에서는 Safari의
공유 메뉴에서 `홈 화면에 추가`를 선택합니다. 앱 내부에는 별도 설치 버튼을 두지 않습니다.

설치 앱은 standalone 창으로 `/ledger`에서 시작합니다. 공개 앱 아이콘과 Next.js의
버전이 붙은 정적 번들만 오프라인 캐시에 저장하며, 로그인·가계부·통계·설정·API 응답은
캐시하지 않으므로 인터넷 연결이 필요합니다.

아이콘 원본을 변경한 뒤 다음 명령으로 설치 아이콘을 다시 생성합니다.

```bash
npm run icons:generate
```
````

- [ ] **Step 4: 전체 검증**

Run in order:

```powershell
npm test -- --run
npm run typecheck
npm run lint
npm run build
npx playwright test tests/e2e/pwa.spec.ts
```

Expected: 0 failures. Hosted Supabase credentials가 필요한 기존 E2E는 실행하지 않으며 공개 PWA E2E만 양쪽 viewport에서 통과한다.

- [ ] **Step 5: 최종 변경 커밋**

```powershell
git add -- tests/e2e/pwa.spec.ts README.md
git -c user.name=kwon_revol -c user.email=259511148+Kwon-revol@users.noreply.github.com commit -m "검증: PWA 설치 계약과 운영 안내 추가"
```

- [ ] **Step 6: 커밋과 작업트리 상태 확인**

Run: `git status --short --branch; git log -5 --oneline --decorate`

Expected: no uncommitted files, detached HEAD remains expected for the managed worktree, and no push has occurred.
