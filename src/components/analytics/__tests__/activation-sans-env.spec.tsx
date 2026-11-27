import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToString } from "react-dom/server";

// Les 4 composants analytics lisent `process.env.NEXT_PUBLIC_*` (littéraux inlinés
// par Next) et non `@/env` (zod). Même activation qu'avant : variable absente OU
// vide (ancien `emptyStringAsUndefined`) = rien ; consentement requis.
let consentement: "accepted" | "refused" | "unknown" = "accepted";
let chemin: string | null = "/fr/appel";
vi.mock("next/navigation", () => ({ usePathname: () => chemin }));
vi.mock("next/script", () => ({
  default: (p: {
    id?: string;
    src?: string;
    "data-domain"?: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) => (
    <script
      data-testid={p.id ?? "plausible"}
      data-src={p.src}
      data-domain={p["data-domain"]}
      dangerouslySetInnerHTML={p.dangerouslySetInnerHTML}
    />
  ),
}));
vi.mock("../CookieConsent", () => ({ useAnalyticsConsent: () => consentement }));

const VARS = [
  "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
  "NEXT_PUBLIC_PLAUSIBLE_API_URL",
  "NEXT_PUBLIC_META_PIXEL_ID",
  "NEXT_PUBLIC_CLARITY_PROJECT_ID",
  "NEXT_PUBLIC_LINKEDIN_PARTNER_ID",
] as const;

beforeEach(() => {
  for (const v of VARS) vi.stubEnv(v, undefined as unknown as string);
  consentement = "accepted";
  chemin = "/fr/appel";
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Plausible", () => {
  it("rien sans domaine, ni avec une chaîne vide", async () => {
    const { Plausible } = await import("../Plausible");
    expect(renderToString(<Plausible />)).toBe("");
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "");
    expect(renderToString(<Plausible />)).toBe("");
  });
  it("charge le script avec l'hôte par défaut, ou l'hôte configuré", async () => {
    const { Plausible } = await import("../Plausible");
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "axion-ia.com");
    expect(renderToString(<Plausible />)).toContain(
      "https://plausible.axion-ia.com/js/script.file-downloads.outbound-links.tagged-events.js",
    );
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_API_URL", "https://stats.example.org");
    expect(renderToString(<Plausible />)).toContain("https://stats.example.org/js/script");
  });
  it("hôte par défaut quand NEXT_PUBLIC_PLAUSIBLE_API_URL est une chaîne vide", async () => {
    const { Plausible } = await import("../Plausible");
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "axion-ia.com");
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_API_URL", "");
    expect(renderToString(<Plausible />)).toContain("https://plausible.axion-ia.com/js/script");
  });
});

describe("MetaPixel", () => {
  // /fr/appel n'est pas une route du tunnel Facebook : on se place sur une route qui l'est.
  beforeEach(() => {
    chemin = "/fr/apporteur-affaires";
  });
  it("charge le script meta-pixel avec consentement accepté", async () => {
    const { MetaPixel } = await import("../MetaPixel");
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123456");
    const html = renderToString(<MetaPixel />);
    expect(html).toContain("meta-pixel");
    expect(html).toContain("fbq('init','123456')");
  });
  it("rien sans identifiant (absent ou vide)", async () => {
    const { MetaPixel } = await import("../MetaPixel");
    expect(renderToString(<MetaPixel />)).toBe("");
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "");
    expect(renderToString(<MetaPixel />)).toBe("");
  });
  it("rien sans consentement, même configuré", async () => {
    const { MetaPixel } = await import("../MetaPixel");
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123456");
    consentement = "refused";
    expect(renderToString(<MetaPixel />)).toBe("");
    consentement = "unknown";
    expect(renderToString(<MetaPixel />)).toBe("");
  });
});

describe("Clarity", () => {
  it("rien sans identifiant (absent ou vide)", async () => {
    const { Clarity } = await import("../Clarity");
    expect(renderToString(<Clarity />)).toBe("");
    vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", "");
    expect(renderToString(<Clarity />)).toBe("");
  });
});

describe("LinkedInInsight", () => {
  it("rien sans identifiant partenaire (absent ou vide)", async () => {
    const { LinkedInInsight } = await import("../LinkedInInsight");
    expect(renderToString(<LinkedInInsight />)).toBe("");
    vi.stubEnv("NEXT_PUBLIC_LINKEDIN_PARTNER_ID", "");
    expect(renderToString(<LinkedInInsight />)).toBe("");
  });
  it("charge le script LinkedIn avec l'identifiant, consentement accepté", async () => {
    const { LinkedInInsight } = await import("../LinkedInInsight");
    vi.stubEnv("NEXT_PUBLIC_LINKEDIN_PARTNER_ID", "123456");
    const html = renderToString(<LinkedInInsight />);
    expect(html).toContain("linkedin-insight");
    expect(html).toContain("123456");
  });
  it("rien sans consentement, même configuré", async () => {
    const { LinkedInInsight } = await import("../LinkedInInsight");
    vi.stubEnv("NEXT_PUBLIC_LINKEDIN_PARTNER_ID", "123456");
    consentement = "refused";
    expect(renderToString(<LinkedInInsight />)).toBe("");
  });
});
