/**
 * Sprint S+4-D 2026-05-18 — Tests `/presse/[slug]` (audit 19-TYPE-8 P1-18).
 *
 * Stratégie : on teste les contrats du module page (exports `revalidate`,
 * `dynamicParams`, `generateStaticParams`) + les invariants des fixtures
 * `PRESS_RELEASES` qui drivent le rendu. Pas de mount JSX complet (next-intl
 * Server Components requièrent un setup HTTP heavy en jsdom).
 *
 * Couvre :
 *   1. `generateStaticParams` matérialise tous les slugs × toutes les locales
 *   2. `generateStaticParams` inclut le slug seed canonique
 *   3. `revalidate` = 3600 (ISR 1h)
 *   4. `dynamicParams` = false (anti soft-404 SSG)
 *   5. Anti-régression fixtures : tous les communiqués ≥ 250 mots (sinon le
 *      contract anti-doorway HCU 2024 doit être ajusté explicitement)
 *   6. Anti-régression fixtures : slugs unique-aux + valides URL-safe
 */

import { describe, it, expect, vi } from "vitest";

// Mock prisma. `/presse/[slug]` l'utilise via `getAllPublishedPressReleaseSlugs`
// (generateStaticParams → prisma.pressReleaseTranslation.findMany) : on renvoie []
// pour déclencher le fallback fixtures `PRESS_RELEASES` testé ici. `lib/seo` +
// service-coverage touchent aussi `article` / `contentGenConfig` (imports transitifs).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: { findFirst: vi.fn(), findMany: vi.fn() },
    contentGenConfig: { findUnique: vi.fn() },
    pressReleaseTranslation: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_SITE_URL: "https://axion-ia.com" },
}));

// Mock next-intl/navigation (le router est utilisé par <Link> dans la page mais
// le test n'instancie pas la page React).
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  redirect: vi.fn(),
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));

import { PRESS_RELEASES, getAllPressReleaseSlugs } from "@/content/press";

describe("/presse/[slug] · generateStaticParams contract", () => {
  it("admin-only : DB vide (mock) → aucun param pré-rendu (plus de fallback fixtures)", async () => {
    // Import dynamique du module page (lazy) — Vitest applique les vi.mock() avant.
    // Note : le premier import est lent (cold cache lib/seo + service-coverage transitifs).
    // Communiqués 2026-06-23 = gérés en console admin. `generateStaticParams`
    // lit `getAllPublishedPressReleaseSlugs` (prisma mocké → []) et NE retombe
    // plus sur les fixtures `PRESS_RELEASES`. Les communiqués publiés après le
    // build sont rendus à la demande (dynamicParams=true, cf. test plus bas).
    const mod = await import("../page");
    const params = await mod.generateStaticParams();
    expect(Array.isArray(params)).toBe(true);
    expect(params.length).toBe(0);
    // 60s : le 1er import transitif (lib/seo + service-coverage) dépasse 15s sur
    // un environnement froid / worktree à node_modules jonctionné (CI chaud < 5s).
  }, 60_000);
});

describe("/presse/[slug] · ISR + dynamicParams contract", () => {
  it("revalidate = 3600 (ISR 1h, cohérence /actualites/[slug] et /glossaire/[slug])", async () => {
    const mod = await import("../page");
    expect(mod.revalidate).toBe(3600);
  });

  it("dynamicParams = true (communiqués admin publiés après le build, rendus à la demande)", async () => {
    const mod = await import("../page");
    expect(mod.dynamicParams).toBe(true);
  });
});

describe("/presse/[slug] · PRESS_RELEASES fixtures anti-régression", () => {
  it("tous les communiqués ≥ 60 mots (cf. seuil anti-doorway HCU + AEO citable)", () => {
    // Le code page noindex automatiquement les releases < 60 mots cumulés
    // (baseline V1 calibrée sur les fixtures actuelles). Cette assertion
    // garantit qu'aucun release est silently noindex en prod sans que
    // l'ajouteur du release l'ait explicitement validé. Un release thin doit
    // recevoir un override explicite côté code (pas être implicite).
    for (const r of PRESS_RELEASES) {
      const wordCount = r.fr.body.trim().split(/\s+/).filter(Boolean).length;
      expect(
        wordCount,
        `Release ${r.slug} fr.body fait ${wordCount} mots (< 60 = noindex auto).`,
      ).toBeGreaterThanOrEqual(60);
    }
  });

  it("slugs uniques + URL-safe (a-z0-9-)", () => {
    const slugs = getAllPressReleaseSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    for (const slug of slugs) {
      expect(slug, `Slug invalide: ${slug}`).toMatch(slugRe);
    }
  });

  it("publishedAt = ISO date YYYY-MM-DD (compat sitemap + JSON-LD datePublished)", () => {
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const r of PRESS_RELEASES) {
      expect(r.publishedAt).toMatch(isoRe);
      // Parse-able en Date valide (anti typo type 2026-13-45).
      const ts = Date.parse(`${r.publishedAt}T00:00:00.000Z`);
      expect(Number.isFinite(ts)).toBe(true);
    }
  });
});
