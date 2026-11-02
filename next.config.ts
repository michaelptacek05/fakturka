import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Omezuje rámce, pluginy a změnu základní URL. Skripty Next.js tento
        // základní profil neomezuje; plná script-src vyžaduje nonce/hash.
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      ],
    }];
  },
  // PDFKit čte metriky standardních fontů přes `__dirname`. Turbopack by mu je
  // při bundlování zapekl jako `/ROOT/node_modules/...`, což v kontejneru
  // neexistuje — jako externí balíček si data najde ve standalone node_modules.
  serverExternalPackages: ["pdfkit"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
