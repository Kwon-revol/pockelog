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
    ],
  };
}
