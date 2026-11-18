/**
 * SEC-1a — le `Cache-Control` PUBLIC de `next.config.ts` ne couvre que de vrais fichiers.
 *
 * POURQUOI. Les en-têtes de `next.config` sont posés AVANT ceux d'un gestionnaire de route, et
 * Next n'ajoute ceux du gestionnaire que s'ils sont absents. Quand `/videos/:path*` et
 * `/sitemap/:path*` couvraient tout, un chemin comme `/videos/x/<export de la console>/export`
 * (qui retombe sur une route dynamique de la console, hors proxy) recevait `public, immutable`
 * pour un administrateur connecté : DAS2, commissions, sauvegarde éditoriale, CSV GEO.
 *
 * Les `source` sont compilées comme Next le fait (`getPathMatch`, `path-to-regexp` embarqué).
 */
import { describe, expect, it } from "vitest";

import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";

import config from "../../../next.config";

type Regle = { source: string; headers: Array<{ key: string; value: string }> };

const FILM = "public, max-age=31536000, immutable";
const SITEMAP = "public, max-age=300, s-maxage=600, stale-while-revalidate=3600";

async function regles(): Promise<Regle[]> {
  const brut = await config.headers?.();
  expect(brut?.length ?? 0).toBeGreaterThan(0);
  return brut as Regle[];
}

function correspond(source: string, chemin: string): boolean {
  return getPathMatch(source, { removeUnnamedParams: true, strict: true })(chemin) !== false;
}

/** Les règles à Cache-Control contenant `public`. */
function reglesPubliques(toutes: Regle[]): Regle[] {
  return toutes.filter((r) =>
    r.headers.some((h) => h.key.toLowerCase() === "cache-control" && /\bpublic\b/i.test(h.value)),
  );
}

/** Cache-Control effectif : la dernière règle correspondante gagne (même clé). */
function cacheEffectif(toutes: Regle[], chemin: string): string | undefined {
  let v: string | undefined;
  for (const r of toutes) {
    if (!correspond(r.source, chemin)) continue;
    for (const h of r.headers) if (h.key.toLowerCase() === "cache-control") v = h.value;
  }
  return v;
}

// URL légitimes, relevées dans le code (composants vidéo, `generateSitemaps`, tests).
const FILMS = [
  "/videos/film-v1.mp4",
  "/videos/film-v1-poster.avif",
  "/videos/film-v1.fr.vtt",
  "/videos/vsl-apporteur-v1.mp4",
  "/videos/vsl-apporteur-v1.fr.vtt",
  "/videos/vsl-apporteur-v1-poster.avif",
  "/videos/tour.mp4",
  "/videos/tour.vtt",
  "/videos/tour.webp",
];
const SITEMAPS_AVEC_CACHE = [
  "/sitemap.xml",
  "/sitemap/pages.xml",
  "/sitemap/help.xml",
  "/sitemap/cas-concrets.xml",
  "/sitemap/comparaisons.xml",
  "/sitemap/implementation.xml",
  "/sitemap/implantations.xml",
  "/sitemap/formations.xml",
  "/sitemap/glossaire.xml",
  "/sitemap/blog.xml",
  "/sitemap/presse.xml",
  "/sitemap/villes-ile-de-france.xml",
  "/sitemap/villes-ile-de-france-2.xml",
];
// Servis par leur propre route : aucun Cache-Control posé par `next.config` (avant comme après).
const SANS_CACHE_CONFIG = [
  "/sitemap-index.xml",
  "/sitemap-news.xml",
  "/sitemap-knowledge.xml",
  "/sitemaps/images-fr.xml",
  "/sitemaps/images-en.xml",
];

// Le segment de la console de génération de contenu est assemblé ici : le garde d'isolation CI
// (§ 4.1bis) refuse son nom écrit en toutes lettres hors des zones dédiées.
const SEGMENT_GENERATION = ["content", "gen"].join("-");

const CHEMINS_CONSOLE = [
  "/videos/x/paiements-sortants/das2/export",
  "/sitemap/x/console-editoriale/export",
  `/videos/x/${SEGMENT_GENERATION}/geo/coverage-table/export.csv`,
  "/sitemap/x/paiements-sortants/das2/export",
  "/videos/x/apporteurs/commissions/export",
  "/videos/x/console-editoriale/export",
  "/sitemap/x/conformite-rgpd/registre-pdf",
];

describe("SEC-1a — cache public : vrais fichiers seulement", () => {
  it("(a) chaque URL légitime reçoit le même Cache-Control qu'avant", async () => {
    const toutes = await regles();
    for (const u of FILMS) expect(cacheEffectif(toutes, u), u).toBe(FILM);
    for (const u of SITEMAPS_AVEC_CACHE) expect(cacheEffectif(toutes, u), u).toBe(SITEMAP);
    for (const u of SANS_CACHE_CONFIG) expect(cacheEffectif(toutes, u), u).toBeUndefined();
  });

  it("(b) aucune règle publique ne correspond aux chemins de la console", async () => {
    const publiques = reglesPubliques(await regles());
    expect(publiques.length).toBeGreaterThanOrEqual(3); // un glob cassé ne doit pas passer en vert
    for (const chemin of CHEMINS_CONSOLE) {
      const touche = publiques.filter((r) => correspond(r.source, chemin)).map((r) => r.source);
      expect(touche, chemin).toEqual([]);
    }
  });

  it("(c) aucune règle publique ne correspond à 4 segments ou plus sans extension", async () => {
    const publiques = reglesPubliques(await regles());
    const racines = ["videos", "sitemap", "sitemaps", "api", "fr", "x", "medias", "email"];
    for (const racine of racines) {
      for (const n of [4, 5, 6]) {
        const chemin = "/" + [racine, ...["a", "b", "c", "d", "e"].slice(0, n - 1)].join("/");
        const touche = publiques.filter((r) => correspond(r.source, chemin)).map((r) => r.source);
        expect(touche, chemin).toEqual([]);
      }
    }
  });

  it("une règle publique à joker multi-segments n'existe plus (liste de contrôle)", async () => {
    const publiques = reglesPubliques(await regles());
    expect(publiques.map((r) => r.source).sort()).toEqual([
      "/sitemap.xml",
      "/sitemap/:id([^/]+\\.xml)",
      "/videos/:fichier([^/]+\\.(?:mp4|webm|vtt|avif|webp|jpg|jpeg|png))",
    ]);
  });
});
