import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

// Headers de sécurité (CSP placeholder — raffinée Sprint 16 avec nonce dynamique)
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
  experimental: {
    // Next.js 16 — flags revisited in Sprint 1 after reading
    // node_modules/next/dist/docs/. The legacy `reactCompiler` flag was
    // promoted/relocated in Next 16 (TS2353 here). PPR / View Transitions /
    // useCache evaluated then.
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env["ANALYZE"] === "true",
});

export default bundleAnalyzer(nextConfig);
