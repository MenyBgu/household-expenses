import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "הוצאות הבית",
    short_name: "הוצאות הבית",
    description: "ניהול פשוט וברור של הוצאות משק הבית",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#2955d9",
    orientation: "portrait-primary",
    lang: "he",
    dir: "rtl",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
