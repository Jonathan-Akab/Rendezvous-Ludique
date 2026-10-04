import type { NextConfig } from "next";

// next-intl reads its request config through the "next-intl/config" alias. We set the
// alias directly instead of using next-intl's plugin, which loads a native SWC binary
// that's only needed for its experimental message extraction.
const I18N_REQUEST = "./src/i18n/request.ts";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "pg", "@prisma/adapter-pg"],
  experimental: {
    // rulebook PDFs (30 MB max) are uploaded through server actions
    serverActions: { bodySizeLimit: "32mb" },
  },
  turbopack: {
    resolveAlias: { "next-intl/config": I18N_REQUEST },
  },
  webpack(config) {
    config.resolve.alias["next-intl/config"] = require("node:path").resolve(I18N_REQUEST);
    return config;
  },
};

export default nextConfig;
