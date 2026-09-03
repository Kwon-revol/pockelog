import type { Metadata, Viewport } from "next";

import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/shared/config/product";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: PRODUCT_NAME,
  title: {
    default: PRODUCT_NAME,
    template: `%s | ${PRODUCT_NAME}`,
  },
  description: PRODUCT_DESCRIPTION,
  appleWebApp: {
    capable: true,
    title: PRODUCT_NAME,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
