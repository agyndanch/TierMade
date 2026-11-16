import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page in TierMade is per-user and dynamic, so the classic rendering
  // model is used instead of Cache Components.
  cacheComponents: false,
  // Dev only: let the app hydrate when opened as 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // PGlite ships WASM + data files that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
