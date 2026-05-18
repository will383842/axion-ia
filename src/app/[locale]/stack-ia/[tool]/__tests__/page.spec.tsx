/**
 * Sprint S+4-B City Domination 2026-05-18 — tests page détail outil
 * `/stack-ia/[tool]` (audit P1-17 `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/
 * 20-TYPE-9-STACK-IA.md`).
 *
 * Stratégie : on ne render PAS la page Server Component complète (next-intl
 * setRequestLocale + cookies async + i18n routing nécessitent un AppRouter
 * mock complet, hors scope unit). On teste à la place :
 *
 * 1. `generateStaticParams` : retourne bien 22 entries (11 outils × 2 locales).
 * 2. La logique `countDetailWords` exposée via `__testing`.
 * 3. La fabrication des JSON-LD Product + BreadcrumbList + FAQ Speakable
 *    via les lib factories (cohérence Schema.org).
 * 4. La résolution mesh `getComparableStackTools` (cohérent avec data tests).
 */

import { describe, it, expect, vi } from "vitest";

// Mock de next-intl/server pour éviter l'erreur "setRequestLocale must
// be called within a request scope" lors de l'import de la page.
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getLocale: vi.fn(async () => "fr"),
  getTranslations: vi.fn(async () => (_key: string) => "Accueil"),
  getRequestConfig: vi.fn(),
}));

// Mock next/navigation pour rendre `notFound` testable.
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

// Mock i18n navigation (Link) — résultat brut, on ne testera pas le DOM
// du composant ici, juste les helpers de la page.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

import { generateStaticParams, generateMetadata, __testing } from "../page";
import {
  STACK_TOOL_DETAILS,
  getStackToolByDetailSlug,
  getComparableStackTools,
} from "@/content/stack-ia-details";
import { STACK_TOOLS } from "@/content/stack-ia";
import { buildProductJsonLd, buildBreadcrumbJsonLd, buildFaqSpeakableJsonLd } from "@/lib/seo";

describe("/stack-ia/[tool] · generateStaticParams", () => {
  it("retourne 22 entries (11 outils × 2 locales)", async () => {
    const params = await generateStaticParams();
    expect(params.length).toBe(22);
    const slugs = new Set(params.map((p) => p.tool));
    expect(slugs.size).toBe(11);
    const locales = new Set(params.map((p) => p.locale));
    expect(locales.has("fr")).toBe(true);
    expect(locales.has("en")).toBe(true);
  });

  it("inclut tous les slugs de STACK_TOOL_DETAILS pour chaque locale", async () => {
    const params = await generateStaticParams();
    const detailSlugs = STACK_TOOL_DETAILS.map((d) => d.id);
    for (const locale of ["fr", "en"]) {
      for (const slug of detailSlugs) {
        expect(
          params.some((p) => p.locale === locale && p.tool === slug),
          `manque entry { locale: '${locale}', tool: '${slug}' }`,
        ).toBe(true);
      }
    }
  });
});

describe("/stack-ia/[tool] · countDetailWords (anti-doorway)", () => {
  it.each(["fr", "en"] as const)("compte > 200 mots pour chaque outil en %s", (loc) => {
    for (const detail of STACK_TOOL_DETAILS) {
      const tool = STACK_TOOLS.find((t) => t.id === detail.id)!;
      const wc = __testing.countDetailWords(tool, detail, loc);
      expect(
        wc,
        `outil ${detail.id} en ${loc} a seulement ${wc} mots (cible ≥ 200 pour rester indexable)`,
      ).toBeGreaterThanOrEqual(200);
    }
  });
});

describe("/stack-ia/[tool] · generateMetadata", () => {
  it("retourne {} pour une locale invalide", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "xx", tool: "claude" }),
    });
    expect(meta).toEqual({});
  });

  it("retourne {} pour un outil inconnu", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "fr", tool: "does-not-exist" }),
    });
    expect(meta).toEqual({});
  });

  it("retourne un title + description bilingue pour un outil connu", async () => {
    const metaFr = await generateMetadata({
      params: Promise.resolve({ locale: "fr", tool: "claude" }),
    });
    const metaEn = await generateMetadata({
      params: Promise.resolve({ locale: "en", tool: "claude" }),
    });
    expect(metaFr.title).toContain("Claude");
    expect(metaFr.title).toContain("Axion-IA");
    expect(metaEn.title).toContain("Claude");
    expect(metaEn.title).toContain("Axion-IA");
    expect(typeof metaFr.description).toBe("string");
    expect((metaFr.description as string).length).toBeLessThanOrEqual(160);
  });

  it("expose les alternates FR + EN dans canonical & languages", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "fr", tool: "cursor" }),
    });
    const alt = meta.alternates as { canonical?: string; languages?: Record<string, string> };
    expect(alt.canonical).toContain("/fr/stack-ia/cursor");
    expect(alt.languages?.fr).toContain("/fr/stack-ia/cursor");
  });
});

describe("/stack-ia/[tool] · JSON-LD Product (Schema.org)", () => {
  it("contient @type Product + brand + offers pour un outil connu", () => {
    const resolved = getStackToolByDetailSlug("claude")!;
    const jsonLd = buildProductJsonLd({
      locale: "fr",
      path: "/stack-ia/claude",
      name: resolved.tool.name,
      description: resolved.detail.fr.summary,
      brand: resolved.tool.vendor,
      category: "Penser & raisonner",
      offer: { availability: "InStock", url: resolved.tool.url },
    });
    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBe("Claude");
    expect(jsonLd.brand).toEqual({ "@type": "Brand", name: "Anthropic" });
    expect(jsonLd.offers).toBeDefined();
  });
});

describe("/stack-ia/[tool] · JSON-LD BreadcrumbList", () => {
  it("contient 3 items : Accueil → Stack IA → outil", () => {
    const jsonLd = buildBreadcrumbJsonLd({
      locale: "fr",
      items: [
        { name: "Accueil", href: "/" },
        { name: "Stack IA 2026", href: "/stack-ia" },
        { name: "Claude", href: "/stack-ia/claude" },
      ],
    });
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement.length).toBe(3);
    expect(jsonLd.itemListElement[2]?.name).toBe("Claude");
  });
});

describe("/stack-ia/[tool] · JSON-LD FAQ Speakable", () => {
  it("expose un cssSelector personnalisé pour les Q/R outil", () => {
    const jsonLd = buildFaqSpeakableJsonLd({
      items: [{ question: "Q?", answer: "A." }],
      speakableSelector: "[data-aeo='stack-tool-summary']",
    });
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd.speakable.cssSelector).toContain("[data-aeo='stack-tool-summary']");
    expect(jsonLd.mainEntity.length).toBe(1);
  });
});

describe("/stack-ia/[tool] · mesh comparables", () => {
  it("résout 2-3 outils existants par fiche détail", () => {
    for (const detail of STACK_TOOL_DETAILS) {
      const cmps = getComparableStackTools(detail);
      expect(cmps.length).toBeGreaterThanOrEqual(2);
      expect(cmps.length).toBeLessThanOrEqual(3);
      for (const cmp of cmps) {
        expect(cmp.tool.id).not.toBe(detail.id);
      }
    }
  });
});
