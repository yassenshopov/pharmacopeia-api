import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Default favicon, generated at request time so the rendered glyph
 * tracks the same warm-amber + warm-ink palette as the rest of the
 * site. Next.js auto-injects this at `/icon` with the right
 * `<link rel="icon">` tag — no manual wiring needed.
 *
 * The ℞ glyph (Unicode U+211E) is the "prescription" symbol used as
 * the site's mark. Rendered at 32×32 because that's the canonical
 * favicon raster size; larger devices use `/icon.svg` (a static
 * vector) and `/apple-icon` for Apple-touch.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1916",
          color: "#e9a35a",
          fontSize: 24,
          fontWeight: 700,
          borderRadius: 6,
          fontFamily: "serif",
        }}
      >
        ℞
      </div>
    ),
    size,
  );
}
