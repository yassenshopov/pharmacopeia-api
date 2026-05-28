import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

/**
 * Dynamic Open Graph card. Accepts `?title=` and `?subtitle=`. Uses
 * inline SVG and a system font stack so the route is self-contained
 * and renders identically on edge and node runtimes.
 *
 * Layout: warm parchment background, amber accent strip on the left,
 * large Outfit-flavoured heading, "pharmacopeia" wordmark with the
 * ℞ mark in the corner.
 */

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

const BACKGROUND = "#fbf5e9";
const FOREGROUND = "#1f1a13";
const AMBER = "#c08032";
const MUTED = "#7a6a55";
const BORDER = "rgba(31, 26, 19, 0.12)";

const FONT_STACK =
  '"Outfit", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") ?? "pharmacopeia").slice(0, 120);
  const subtitle = (searchParams.get("subtitle") ?? "").slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          background: BACKGROUND,
          color: FOREGROUND,
          fontFamily: FONT_STACK,
        }}
      >
        {/* Amber accent strip */}
        <div
          style={{
            width: 24,
            height: "100%",
            background: AMBER,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 80px",
            flex: 1,
          }}
        >
          {/* Top row: Rx mark + wordmark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 12,
                background: "rgba(192, 128, 50, 0.14)",
                border: `1px solid ${AMBER}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: AMBER,
                fontSize: 42,
                fontWeight: 600,
              }}
            >
              ℞
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              pharmacopeia
            </div>
            <div
              style={{
                marginLeft: "auto",
                fontSize: 18,
                color: MUTED,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              v0 · preview
            </div>
          </div>

          {/* Headline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              marginTop: 40,
            }}
          >
            <div
              style={{
                fontSize: 88,
                lineHeight: 1.04,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                maxWidth: 980,
                color: FOREGROUND,
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  fontSize: 32,
                  color: MUTED,
                  letterSpacing: "-0.01em",
                  maxWidth: 980,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>

          {/* Footer row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${BORDER}`,
              paddingTop: 24,
              fontSize: 22,
              color: MUTED,
            }}
          >
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <span style={{ color: FOREGROUND, fontWeight: 500 }}>
                An open API for medications
              </span>
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: AMBER,
              }}
            >
              pharmacopeia.dev
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: {
        "Cache-Control": `public, immutable, no-transform, s-maxage=${ONE_YEAR}`,
      },
    },
  );
}
