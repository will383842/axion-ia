/**
 * Garde anti-régression : bailout CSR via `useSearchParams()` (2026-06-15).
 *
 * Contexte — un Client Component qui appelle `useSearchParams()` SANS `<Suspense>`
 * fait basculer toute la PAGE hôte (si pré-rendue statiquement) en rendu client
 * (digest Next `BAILOUT_TO_CLIENT_SIDE_RENDERING`) : le HTML serveur sort vide
 * (0 `<h1>`, contenu uniquement dans le payload RSC `__next_f`) → invisible aux
 * crawlers sans JS (bots IA/AEO/GEO + 1re vague d'indexation Google). C'est le
 * bug qui a vidé /presse, /contact et /audit/demande (cf. PR fix bailout).
 *
 * Ce test échoue dès qu'un NOUVEAU fichier utilise `useSearchParams()` sans être
 * documenté ici avec sa protection. Trois protections valides existent :
 *   - "suspense"        : le hook est enveloppé d'un `<Suspense>` dans le fichier.
 *   - "ssr-false"       : le composant n'est rendu que via un import dynamique
 *                         `ssr:false` (jamais rendu côté serveur → pas de bailout).
 *   - "dynamic-noindex" : la page hôte est `force-dynamic` (pas de prerender
 *                         statique) ET noindex (hors périmètre SEO).
 *   - "admin"           : composant d'admin (routes noindex, hors crawl SEO).
 *
 * Ajouter une entrée ici = acte conscient : vérifier que la nouvelle page n'est
 * pas vidée côté serveur (`curl -A Googlebot <url> | grep -c BAILOUT...`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

type Protection = "suspense" | "ssr-false" | "dynamic-noindex" | "admin";

/** Consommateurs connus de `useSearchParams()` + leur protection anti-bailout. */
const ALLOWLIST: Record<string, Protection> = {
  "components/forms/UnifiedContactForm.tsx": "suspense",
  "app/[locale]/cas-concrets/CaseStudiesFilteredGrid.tsx": "suspense",
  "app/[locale]/mes-donnees/export/GdprExportClient.tsx": "dynamic-noindex",
  "components/admin/site-explorer/SiteExplorerFilters.tsx": "admin",
  // Page merci du tunnel Facebook : l'ile lit `?c=` pour l'evenement Lead du
  // pixel ; montee sous <Suspense> dans app/[locale]/apporteur-affaires/merci/page.tsx.
  "components/recrutement/MerciLeadMeta.tsx": "suspense",
};

function listSourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .map((f) => f.replace(/\\/g, "/"))
    .filter(
      (f) =>
        /\.(tsx?|jsx?)$/.test(f) &&
        !f.includes("__tests__/") &&
        !f.endsWith(".test.ts") &&
        !f.endsWith(".test.tsx") &&
        !f.endsWith(".spec.ts") &&
        !f.endsWith(".spec.tsx"),
    );
}

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

describe("garde anti-bailout CSR — useSearchParams()", () => {
  const consumers = listSourceFiles().filter((rel) => /\buseSearchParams\s*\(/.test(read(rel)));

  it("aucun consommateur de useSearchParams hors allowlist (sinon : risque page vide côté serveur)", () => {
    const found = [...consumers].sort();
    const allowed = Object.keys(ALLOWLIST).sort();
    expect(found).toEqual(allowed);
  });

  it("les consommateurs 'suspense' enveloppent bien le hook dans un <Suspense>", () => {
    for (const [rel, protection] of Object.entries(ALLOWLIST)) {
      if (protection !== "suspense") continue;
      expect(read(rel), `${rel} doit contenir un <Suspense>`).toMatch(/Suspense/);
    }
  });

  it("la page /mes-donnees/export reste force-dynamic (sa seule protection)", () => {
    expect(read("app/[locale]/mes-donnees/export/page.tsx")).toMatch(
      /dynamic\s*=\s*["']force-dynamic["']/,
    );
  });
});
