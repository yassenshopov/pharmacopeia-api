import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Apple Touch icon, 180×180 PNG. Used by iOS when a user adds the
 * site to their home screen. The Apple HIG asks for a square,
 * non-transparent icon — iOS applies its own rounded mask.
 *
 * Composition: amber ℞ glyph on a warm-ink square, sized so the
 * glyph stays inside the Apple rounded-rect safe area.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 140,
          fontWeight: 700,
          fontFamily: "serif",
        }}
      >
        ℞
      </div>
    ),
    size,
  );
}
