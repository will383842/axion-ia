/**
 * CLIQUET — toute route de `routes-publiques.json` doit exister dans le dépôt.
 *
 * 🔴 2026-08-21 — la liste contenait `/fr/sections`, qui ne correspondait à
 * AUCUNE route : ni entrée `pathnames`, ni fichier `page.tsx`. Elle rendait 404
 * jusqu'en production. Personne ne l'a vue parce que le gate Playwright qui la
 * lit portait `continue-on-error: true` — la seule mesure capable de la
 * dénoncer ne pouvait pas rougir.
 *
 * 🔑 Une liste écrite à la main dérive TOUJOURS du code qu'elle prétend
 * décrire. Ce qui la tient, ce n'est pas la relecture : c'est un test qui la
 * confronte à la source. Celui-ci tourne dans Gate A, en quelques
 * millisecondes, sans serveur — donc avant même que Playwright ait une chance
 * de se tromper.
 */

import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";

const RACINE = process.cwd();
const FICHIER = join(RACINE, "tests", "e2e", "qualiopi", "_harness", "routes-publiques.json");
const routes = JSON.parse(readFileSync(FICHIER, "utf8")) as string[];

/** Chemins FR déclarés dans `pathnames` (valeur string = fr == en). */
const declaresFr: string[] = Object.values(
  routing.pathnames as Record<string, string | { fr: string; en: string }>,
).map((v) => (typeof v === "string" ? v : v.fr));

/** `/equipe/[slug]` accepte `/equipe/williams`. */
function correspondAUnMotif(chemin: string, motif: string): boolean {
  const c = chemin.split("/");
  const m = motif.split("/");
  if (c.length !== m.length) return false;
  return m.every((seg, i) => seg.startsWith("[") || seg === c[i]);
}

/** Un fichier de page couvre-t-il ce chemin ? Segments dynamiques exclus. */
function fichierDePageExiste(base: string, chemin: string): boolean {
  const dossier = chemin === "/" ? base : join(base, ...chemin.split("/").filter(Boolean));
  return ["page.tsx", "page.ts", "page.jsx", "page.mdx"].some((f) => existsSync(join(dossier, f)));
}

const APP = join(RACINE, "src", "app");
const APP_LOCALE = join(APP, "[locale]");

function resolue(route: string): boolean {
  // Route NON localisée (`/maintenance` est la seule à ce jour) : elle vit
  // directement sous `src/app/`, hors du segment `[locale]`.
  if (!route.startsWith("/fr")) return fichierDePageExiste(APP, route);

  const chemin = route.slice(3) === "" ? "/" : route.slice(3);
  if (declaresFr.includes(chemin)) return true;
  if (declaresFr.some((m) => m.includes("[") && correspondAUnMotif(chemin, m))) return true;
  return fichierDePageExiste(APP_LOCALE, chemin);
}

describe("routes-publiques.json ne décrit que des routes qui existent", () => {
  it("chaque entrée se résout en une route du dépôt", () => {
    const introuvables = routes.filter((r) => !resolue(r));
    expect(
      introuvables,
      "routes listées par le harnais mais absentes du dépôt (pathnames ET fichiers) — " +
        "elles rendront 404 et rougiront le gate E2E sans qu'aucun défaut ne soit en cause",
    ).toEqual([]);
  });

  it("aucun doublon", () => {
    const vus = new Set<string>();
    const doublons = routes.filter((r) => (vus.has(r) ? true : (vus.add(r), false)));
    expect(doublons).toEqual([]);
  });

  it("la liste n'est pas vide et reste du bon ordre de grandeur", () => {
    // Un `[]` accidentel rendrait la suite E2E verte en ne mesurant rien —
    // exactement le défaut que cette session a passé la journée à réparer.
    expect(routes.length).toBeGreaterThan(100);
  });
});
