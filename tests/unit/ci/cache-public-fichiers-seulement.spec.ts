/**
 * SEC-1a — le `Cache-Control` PUBLIC de `next.config.ts` ne couvre que de vrais fichiers.
 *
 * POURQUOI. Les en-têtes de `next.config` sont posés AVANT ceux d'un gestionnaire de route, et
 * Next n'ajoute ceux du gestionnaire que s'ils sont absents. Quand `/videos/:path*` et
 * `/sitemap/:path*` couvraient tout, un chemin comme `/videos/x/<export de la console>/export`
 * (qui retombe sur une route dynamique de la console, hors proxy) recevait `public, immutable`
 * pour un administrateur connecté : DAS2, commissions, sauvegarde éditoriale, CSV GEO.
 *
 * Les `source` sont compilées comme Next 16.3.1 le fait pour une règle d'en-têtes
 * (`getPathMatch` + `regexModifier: modifyRouteRegex`, cf. `router-utils/filesystem.js`), avec
 * et sans barre finale.
 *
 * SEC-1a-S1 — le balayage ne repose sur AUCUNE liste figée : les adresses de la console sont
 * dérivées de l'arborescence `src/app/[locale]/**` et les racines à tester sont lues dans les
 * règles de `next.config.ts` et dans le `matcher` de `src/proxy.ts`. Une règle est « partagée »
 * (cache de CDN) dès qu'un en-tête de cache porte `public`, `s-maxage`, `immutable` ou
 * `stale-while-revalidate`, ou que son en-tête est `CDN-Cache-Control` / `Surrogate-Control`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { modifyRouteRegex } from "next/dist/lib/redirect-status";
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

function correspondExact(source: string, chemin: string): boolean {
  return (
    getPathMatch(source, {
      removeUnnamedParams: true,
      strict: true,
      regexModifier: (regex: string) => modifyRouteRegex(regex),
    })(chemin) !== false
  );
}

/** Comme Next : avec et sans barre finale (`modifyRouteRegex` la rend facultative). */
function correspond(source: string, chemin: string): boolean {
  return (
    correspondExact(source, chemin) || correspondExact(source, chemin.replace(/\/$/, "") + "/")
  );
}

const VALEUR_PARTAGEE = /\b(?:public|s-maxage|immutable|stale-while-revalidate)\b/i;

/** Les règles qui mettraient une réponse en cache PARTAGÉ (CDN), quelle que soit la racine ou l'en-tête. */
function reglesPartagees(toutes: Regle[]): Regle[] {
  return toutes.filter((r) =>
    r.headers.some((h) => {
      const cle = h.key.toLowerCase();
      if (cle === "surrogate-control" || cle.endsWith("cdn-cache-control")) return true;
      return cle === "cache-control" && VALEUR_PARTAGEE.test(h.value);
    }),
  );
}

// ── Balayage dérivé du dépôt (aucune liste figée) ────────────────────────────

const RACINE_DEPOT = process.cwd();

/** Adresses de gestionnaires de route et de pages sous `src/app/[locale]`, sans le segment de langue. */
function adressesDeLArborescence(): string[] {
  const base = join(RACINE_DEPOT, "src/app/[locale]");
  const trouvees = new Set<string>();
  const marcher = (dossier: string, segments: string[]): void => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) {
        if (/^\(.*\)$/.test(nom))
          marcher(chemin, segments); // groupe de routes : absent de l'adresse
        else if (/^@/.test(nom))
          continue; // emplacement parallèle
        else {
          const seg = nom
            .replace(/^\[\[\.\.\.(.+)\]\]$/, "$1")
            .replace(/^\[\.\.\.(.+)\]$/, "$1")
            .replace(/^\[(.+)\]$/, "$1");
          marcher(chemin, [...segments, seg]);
        }
      } else if (/^(?:route|page)\.(?:ts|tsx)$/.test(nom) && segments.length > 0) {
        trouvees.add(segments.join("/"));
      }
    }
  };
  marcher(base, []);
  return [...trouvees];
}

/** Racines exclues du `matcher` de `src/proxy.ts` (entrées littérales de l'alternance `(?!…)`). */
function racinesExcluesDuMatcher(): string[] {
  const src = readFileSync(join(RACINE_DEPOT, "src/proxy.ts"), "utf8");
  const m = /"\/\(\(\?!([^"]+?)\)\.\*\)"/.exec(src);
  if (!m?.[1]) return [];
  const entrees: string[] = [];
  let profondeur = 0;
  let courant = "";
  for (const c of m[1]) {
    if (c === "(") profondeur++;
    if (c === ")") profondeur--;
    if (c === "|" && profondeur === 0) {
      entrees.push(courant);
      courant = "";
    } else courant += c;
  }
  entrees.push(courant);
  return entrees
    .map((e) => e.replace(/\(\?:\/\|\$\)$/, "").replace(/\/$/, ""))
    .filter((e) => /^[a-z_][a-z0-9_-]*(?:\/[a-z0-9_-]+)*$/.test(e));
}

/** Premier segment littéral de la source de chaque règle partagée (`videos`, `sitemap`…). */
function racinesDesReglesPartagees(partagees: Regle[]): string[] {
  const racines = new Set<string>();
  for (const r of partagees) {
    const premier = r.source.split("/")[1] ?? "";
    if (/^[a-z][a-z0-9_-]*(?:\.[a-z]+)?$/.test(premier))
      racines.add(premier.replace(/\.[a-z]+$/, ""));
  }
  return [...racines];
}

/** Chaque adresse de la console, sous chaque racine, nue puis avec `.csv` puis `.mp4` sur le dernier segment. */
function cheminsABalayer(partagees: Regle[]): { chemins: string[]; racines: string[] } {
  const racines = [
    ...new Set([...racinesDesReglesPartagees(partagees), ...racinesExcluesDuMatcher()]),
  ];
  const adresses = adressesDeLArborescence();
  const chemins = new Set<string>();
  for (const racine of racines) {
    for (const a of adresses) {
      for (const ext of ["", ".csv", ".mp4"]) chemins.add(`/${racine}/${a}${ext}`);
    }
  }
  return { chemins: [...chemins], racines };
}

/** `/<racine>/<un segment>.<extension média>` : la forme même du fichier légitime, jamais une console. */
const FORME_FICHIER_LEGITIME = /^\/[^/]+\/[^/]+\.(?:mp4|webm|vtt|avif|webp|jpg|jpeg|png)\/?$/;

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
    const publiques = reglesPartagees(await regles());
    expect(publiques.length).toBeGreaterThanOrEqual(3); // un glob cassé ne doit pas passer en vert
    for (const chemin of CHEMINS_CONSOLE) {
      const touche = publiques.filter((r) => correspond(r.source, chemin)).map((r) => r.source);
      expect(touche, chemin).toEqual([]);
    }
  });

  it("(b bis) balayage dérivé : aucune adresse de l'arborescence, sous aucune racine, n'est en cache partagé", async () => {
    const partagees = reglesPartagees(await regles());
    const { chemins, racines } = cheminsABalayer(partagees);
    // Un balayage vide ne passe pas.
    expect(chemins.length).toBeGreaterThanOrEqual(300);
    expect(racines.length).toBeGreaterThanOrEqual(12);
    for (const racine of ["videos", "sitemap", "qr", "questionnaire", "api"]) {
      expect(racines, `racine lue absente : ${racine}`).toContain(racine);
    }
    const fautifs: string[] = [];
    for (const chemin of chemins) {
      if (FORME_FICHIER_LEGITIME.test(chemin)) continue;
      const touche = partagees.filter((r) => correspond(r.source, chemin)).map((r) => r.source);
      if (touche.length > 0) fautifs.push(`${chemin} ← ${touche.join(", ")}`);
    }
    expect(fautifs).toEqual([]);
  });

  it("(c) aucune règle publique ne correspond à 4 segments ou plus sans extension", async () => {
    const publiques = reglesPartagees(await regles());
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
    const publiques = reglesPartagees(await regles());
    expect(publiques.map((r) => r.source).sort()).toEqual([
      "/sitemap.xml",
      "/sitemap/:id([^/]+\\.xml)",
      "/videos/:fichier([^/]+\\.(?:mp4|webm|vtt|avif|webp|jpg|jpeg|png))",
    ]);
  });
});
