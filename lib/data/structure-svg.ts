import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

/**
 * Read a pre-generated structure SVG from `/public` and return it as a
 * string for inline rendering.
 *
 * Inlining is required so that `currentColor` (used for bond strokes)
 * resolves against the host page's CSS cascade — when loaded via
 * `<img src>` the SVG renders in isolation and `currentColor` falls back
 * to black, making bonds invisible in dark mode. Shared by every surface
 * that renders a 2D structure (drug detail, compare) so the path-safety
 * guard can never drift between them.
 */
export const loadStructureSvg = cache(
  async (svgPath: string): Promise<string | null> => {
    if (!svgPath.startsWith("/structures/") || svgPath.includes("..")) {
      return null;
    }
    try {
      const filePath = path.join(
        process.cwd(),
        "public",
        svgPath.replace(/^\//, ""),
      );
      return await readFile(filePath, "utf8");
    } catch {
      return null;
    }
  },
);
