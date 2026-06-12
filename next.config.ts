import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the
  // Docker image (see Dockerfile) can run the app without the full
  // node_modules tree. Ignored by Vercel, which builds its own output.
  output: "standalone",
};

export default nextConfig;
