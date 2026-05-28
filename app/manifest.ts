import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/site";

/**
 * Standalone PWA manifest. `theme_color` controls the system UI tint
 * when the app runs installed; we point it at the warm-ink dark surface
 * to match the apothecary palette (most installed PWAs are read in dark
 * mode anyway). `background_color` is the splash-screen color and
 * stays parchment so a freshly-installed light-mode launch doesn't
 * flash an unexpected dark frame.
 *
 * Kept in sync with the `viewport.themeColor` entries in `app/layout.tsx`
 * and the `--background` tokens in `app/globals.css`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#fbf5e9",
    theme_color: "#1c1916",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        // Routed by `app/apple-icon.tsx` (Next generates 180×180 PNG).
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
