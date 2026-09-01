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

import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/**
 * Pages statiques volontairement HORS de l'audit public, avec leur raison.
 *
 * Ce ne sont pas des oublis : ces écrans exigent une session et répondent 307 à
 * un visiteur. Les auditer avec `page.goto` mesurerait la page de refus sous un
 * faux nom — le piège que `portail-garde-acces.spec.ts` documente déjà, et qui a
 * valu à `/fr/portail/mon-espace` d'être retirée de la liste.
 *
 * ── Réservation directe (2026-09-01) ────────────────────────────────────────
 *
 * `/appel/reserver` et `/appel/confirme` sortent de l'audit pour une raison
 * VOISINE mais distincte : elles n'existent pas sans leur contexte.
 *
 * — `/appel/reserver` exige un paramètre `?debut=<créneau ISO>` valide, futur et
 *   dans l'horizon. Sans lui, elle redirige vers `/appel` — l'auditer nu
 *   mesurerait donc `/appel` sous un autre nom, exactement le faux nom que ce
 *   fichier existe pour empêcher.
 * — `/appel/confirme` exige l'identifiant d'un rendez-vous réel, ou le drapeau
 *   d'incertitude. Sans l'un des deux, elle rend un 404 délibéré : une page de
 *   confirmation vide serait indexable et trompeuse.
 *
 * Les deux portent d'ailleurs `robots: { index: false }` : elles ne sont pas des
 * pages publiques au sens de cet audit, mais des étapes d'un parcours.
 *
 * ⚠️ Si un jour l'une d'elles devient consultable sans contexte, il faudra la
 * RÉINTÉGRER ici — une sortie d'audit qui survit à sa cause est un trou.
 *
 * ── Annuler et reporter (2026-09-01) ────────────────────────────────────────
 *
 * `/appel/annuler` et `/appel/reporter` exigent un jeton SIGNÉ, porté par le
 * lien de l'e-mail. Sans lui, elles rendent un 404 délibéré : une page
 * d'annulation atteignable sans jeton serait une porte ouverte sur le
 * rendez-vous de n'importe qui — c'est précisément ce que la signature existe
 * pour empêcher.
 *
 * Les auditer à nu ne mesurerait donc pas la page, mais son refus. Et fournir
 * un jeton valide à l'audit reviendrait à publier un lien d'annulation dans un
 * fichier de configuration, ce qui n'a pas de sens.
 *
 * Elles portent `robots: { index: false }` pour la même raison.
 */
const HORS_AUDIT = [
  "/portail/mon-espace",
  "/espace-formateur",
  "/appel/reserver",
  "/appel/confirme",
  "/appel/annuler",
  "/appel/reporter",
];

/** Chemins des pages statiques rendues sous `[locale]` (segments dynamiques exclus). */
function pagesStatiques(): string[] {
  const trouvees: string[] = [];
  const parcourir = (dossier: string, segments: string[]): void => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      if (!entree.isDirectory()) continue;
      // Un segment dynamique n'a pas d'URL fixe : on ne peut pas l'auditer ainsi.
      if (entree.name.startsWith("[")) continue;
      // Les groupes de route `(admin)` ne produisent pas de segment d'URL.
      const suite = entree.name.startsWith("(") ? segments : [...segments, entree.name];
      parcourir(join(dossier, entree.name), suite);
    }
    if (existsSync(join(dossier, "page.tsx"))) {
      trouvees.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
    }
  };
  parcourir(APP_LOCALE, []);
  return trouvees;
}

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

  it("aucune page publique statique n'échappe à l'audit", () => {
    // 🔴 2026-08-21 — LE CLIQUET NE REGARDAIT QUE DANS UN SENS.
    //
    // Il vérifiait que chaque entrée de la liste correspond à une route ; il ne
    // vérifiait pas que chaque route figure dans la liste. Mesuré : **onze**
    // pages statiques y manquaient, dont SIX qui répondent 200 en production —
    // `/fr/catalogue`, `/fr/diagnostic`, `/fr/livres`, `/fr/memo-isere`,
    // `/fr/simulateur`, `/fr/vivier-opposition`. Aucune n'avait jamais été
    // auditée, et l'une d'elles portait un défaut d'accessibilité réel.
    //
    // 🔑 Une liste de couverture se garde dans les DEUX sens. Sans quoi elle
    // mesure ce qu'on a pensé à y mettre, et le rapport dit « 117 routes »
    // comme s'il disait « toutes ».
    const manquantes = pagesStatiques().filter((chemin) => {
      const attendue = chemin === "/" ? "/fr" : `/fr${chemin}`;
      return !routes.includes(attendue) && !HORS_AUDIT.some((h) => chemin.startsWith(h));
    });
    expect(
      manquantes,
      "pages publiques absentes de `routes-publiques.json` — soit les ajouter, " +
        "soit les inscrire dans HORS_AUDIT avec la raison",
    ).toEqual([]);
  });

  it("la liste n'est pas vide et reste du bon ordre de grandeur", () => {
    // Un `[]` accidentel rendrait la suite E2E verte en ne mesurant rien —
    // exactement le défaut que cette session a passé la journée à réparer.
    expect(routes.length).toBeGreaterThan(100);
  });
});
