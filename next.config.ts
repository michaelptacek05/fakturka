import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // PDFKit čte metriky standardních fontů přes `__dirname`. Turbopack by mu je
  // při bundlování zapekl jako `/ROOT/node_modules/...`, což v kontejneru
  // neexistuje — jako externí balíček si data najde ve standalone node_modules.
  serverExternalPackages: ["pdfkit"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
