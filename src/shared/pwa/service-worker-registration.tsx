"use client";

import { useEffect } from "react";

type ServiceWorkerRegistrar = {
  register(
    scriptURL: string | URL,
    options?: RegistrationOptions,
  ): Promise<unknown>;
};

export async function registerPockeLogServiceWorker(
  serviceWorker: ServiceWorkerRegistrar | undefined,
  environment = process.env.NODE_ENV,
) {
  if (environment !== "production" || !serviceWorker) return;

  try {
    await serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    console.warn("PockeLog 서비스 워커를 등록하지 못했습니다.");
  }
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const serviceWorker = "serviceWorker" in navigator
      ? navigator.serviceWorker
      : undefined;

    void registerPockeLogServiceWorker(serviceWorker);
  }, []);

  return null;
}
