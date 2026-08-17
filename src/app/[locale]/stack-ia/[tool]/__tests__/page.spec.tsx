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
import { STATIC_LOCALES } from "@/i18n/routing";
import { buildProductJsonLd, buildBreadcrumbJsonLd, buildFaqSpeakableJsonLd } from "@/lib/seo";
import type { Metadata } from "next";

/**
 * Rend le texte du titre, quelle que soit la forme renvoyée par Next.
 *
 * `Metadata["title"]` est une union : une string nue (le `title.template` du
 * layout racine y appose « · Axion-IA »), ou `{ absolute }` quand la page
 * court-circuite ce template parce que son titre porte DÉJÀ la marque.
 * Assertion directe sur `meta.title` = test qui dépend de la forme, pas du
 * contenu : `toContain` sur un objet ne teste RIEN et passe au vert.
 */
function texteDuTitre(meta: Metadata): string {
  const t = meta.title;
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && "absolute" in t) return String(t.absolute ?? "");
  return "";
}

describe("/stack-ia/[tool] · generateStaticParams", () => {
  // EN désactivé (2026-05-16) → pré-rendu FR seul (STATIC_LOCALES). Le test suit
  // le flag : 11 outils × len(STATIC_LOCALES). Réactivation EN → re-prérend les 2.
  it("retourne 11 outils × STATIC_LOCALES (FR seul tant qu'EN désactivé)", async () => {
    const params = await generateStaticParams();
    expect(params.length).toBe(11 * STATIC_LOCALES.length);
    const slugs = new Set(params.map((p) => p.tool));
    expect(slugs.size).toBe(11);
    const locales = new Set(params.map((p) => p.locale));
    expect(locales.has("fr")).toBe(true);
    expect(locales.has("en")).toBe(STATIC_LOCALES.includes("en"));
  });

  it("inclut tous les slugs de STACK_TOOL_DETAILS pour chaque locale pré-rendue", async () => {
    const params = await generateStaticParams();
    const detailSlugs = STACK_TOOL_DETAILS.map((d) => d.id);
    for (const locale of STATIC_LOCALES) {
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
    expect(texteDuTitre(metaFr)).toContain("Claude");
    expect(texteDuTitre(metaFr)).toContain("Axion-IA");
    expect(texteDuTitre(metaEn)).toContain("Claude");
    expect(texteDuTitre(metaEn)).toContain("Axion-IA");
    expect(typeof metaFr.description).toBe("string");
    expect((metaFr.description as string).length).toBeLessThanOrEqual(160);
  });

  // GEO-057 (audit GEO/AEO 2026-08-14) — cette route est l'une des trois
  // familles où la marque sortait DEUX fois en SERP : son titre source est
  // « … · cabinet Axion-IA », le bypass du `title.template` ne testait que le
  // suffixe exact ` · Axion-IA`, donc le template du layout racine en ajoutait
  // un second → « … · cabinet Axion-IA · Axion-IA ».
  //
  // C'est la correction qui a fait rougir l'assertion ci-dessus : le titre sort
  // désormais en `{ absolute }`, et `toContain` sur un objet ne teste rien. Le
  // helper le résout, et ce test-ci verrouille le fond, pas la forme.
  it("🔴 n'écrit JAMAIS la marque deux fois dans le titre", async () => {
    for (const locale of ["fr", "en"] as const) {
      const meta = await generateMetadata({ params: Promise.resolve({ locale, tool: "claude" }) });
      const titre = texteDuTitre(meta);
      const occurrences = titre.split("Axion-IA").length - 1;
      expect(
        occurrences,
        `titre ${locale} = « ${titre} » — la marque doit apparaître exactement une fois`,
      ).toBe(1);
    }
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
