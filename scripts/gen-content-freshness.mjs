#!/usr/bin/env node
// Génère `src/generated/content-freshness.ts` — date de dernière modification
// RÉELLE (dernier commit git) de chaque famille de contenu, pour alimenter les
// `<lastmod>` des sub-sitemaps.
//
// POURQUOI (audit indexation GSC 2026-07-31) :
//   Les `<lastmod>` statiques étaient figés sur DEUX constantes codées en dur
//   (`EDITORIAL_BASELINE` 2026-06-08, `VILLES_EDITORIAL` 2026-05-26), à bumper
//   « à la main lors d'une refonte ». Personne ne les a jamais bumpées : mesuré
//   le 2026-07-31, 141 commits avaient touché `src/content/` depuis le 8 juin et
//   125 le contenu villes depuis le 26 mai (dernier : 2026-07-28). Les sitemaps
//   annonçaient donc « rien n'a changé depuis mai/juin » sur du contenu modifié
//   trois jours plus tôt → Google ne re-crawle pas ce qui a réellement bougé
//   (part « actualisation » du crawl tombée à 28,55 %).
//
//   Le correctif ne consiste PAS à remettre `BUILD_TIME` (le date-gaming que
//   l'audit fraîcheur du 2026-06-08 avait justement supprimé : une date qui
//   avance à chaque deploy sans changement de contenu fait déclasser le signal
//   `lastmod` de tout le domaine). Il consiste à dire la VÉRITÉ : la date du
//   dernier commit qui a touché les sources de CETTE famille. Une famille
//   inchangée garde une date ancienne — c'est honnête et c'est le but.
//
// GRANULARITÉ : une date PAR FAMILLE, jamais une date globale. Une date globale
// sur-estimerait les familles non modifiées (date-gaming dans l'autre sens).
//
// EXÉCUTION : dans GitHub Actions AVANT `docker build` (le `.git` est exclu du
// contexte Docker via `.dockerignore`, le script ne peut donc pas tourner dans
// l'image). Zéro dépendance : node + git uniquement.
//
// FAIL-SOFT : si git est indisponible ou qu'un chemin n'a aucun commit, la
// famille est OMISE du manifeste → `sitemap.ts` retombe sur sa constante figée
// (comportement d'avant ce script, aucune régression possible).

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "generated", "content-freshness.ts");

/**
 * Famille de sub-sitemap → chemins sources qui produisent son contenu.
 * Les clés DOIVENT correspondre à celles lues par `src/app/sitemap.ts`.
 *
 * ⚠️ Ajouter une famille ici sans l'utiliser côté sitemap est sans effet ;
 * l'inverse (famille lue mais absente ici) retombe sur la constante figée.
 */
const FAMILIES = {
  // Pages villes + hubs régions (VILLES_EDITORIAL historique).
  villes: [
    "src/content/villes",
    "src/content/regions.ts",
    "src/components/sections/VilleServicePageTemplate.tsx",
  ],
  // Familles éditoriales statiques (EDITORIAL_BASELINE historique), une date
  // par famille pour ne pas sur-déclarer celles qui n'ont pas bougé.
  formations: ["src/content/formations"],
  secteurs: ["src/content/sectors.ts", "src/content/sectors"],
  glossaire: ["src/content/glossary-extension.ts"],
  faq: ["src/content/faq-categories.ts", "src/lib/knowledge/readers.ts"],
  help: ["src/content/transversal.ts"],
  "cas-concrets": ["src/content/case-studies.ts", "src/content/case-studies"],
  comparaisons: ["src/content/comparaisons.ts", "src/content/comparaisons"],
  "stack-ia-tools": ["src/content/stack-ia-details.ts", "src/content/stack-ia-details"],
  implementation: ["src/content/automatisations.ts"],
  // Filet : routes statiques du site (hub /pages) — surface la plus large.
  pages: ["src/content", "src/app/[locale]"],
};

function lastCommitIso(paths) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", ...paths], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!out) return null;
    const d = new Date(out);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    // git absent (image Docker, tarball) ou chemin sans historique → fail-soft.
    return null;
  }
}

/**
 * GARDE-FOU CLONE SUPERFICIEL — sans elle, ce script serait NUISIBLE.
 *
 * `actions/checkout` clone en `fetch-depth: 1` par défaut : un seul commit dans
 * l'historique. `git log -1 -- <chemin>` renverrait alors la date du commit de
 * TÊTE pour TOUTES les familles, y compris celles inchangées depuis des mois →
 * toutes les pages se déclareraient modifiées à chaque deploy, soit très
 * exactement le date-gaming `BUILD_TIME` que ce mécanisme remplace.
 *
 * On refuse donc d'émettre quoi que ce soit dans ce cas : manifeste vide →
 * `sitemap.ts` retombe sur ses constantes figées. Mieux vaut un signal vieux
 * qu'un signal faux.
 */
function isShallowRepo() {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() === "true"
    );
  } catch {
    return true; // git indisponible → on ne prend aucun risque.
  }
}

const shallow = isShallowRepo();
if (shallow) {
  console.warn(
    "[content-freshness] clone SUPERFICIEL détecté (fetch-depth: 1 ?) — " +
      "manifeste laissé VIDE pour ne pas déclarer une fausse fraîcheur. " +
      "Poser `fetch-depth: 0` sur le checkout pour activer le mécanisme.",
  );
}

const entries = [];
for (const [family, paths] of shallow ? [] : Object.entries(FAMILIES)) {
  const iso = lastCommitIso(paths);
  if (iso) entries.push([family, iso]);
  console.log(`[content-freshness] ${family.padEnd(16)} ${iso ?? "(omis — pas de commit)"}`);
}

const body = entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");

const file = `// ⚠️ FICHIER GÉNÉRÉ — ne pas éditer à la main.
// Source : \`scripts/gen-content-freshness.mjs\` (exécuté en CI avant \`docker build\`).
// Date du dernier commit git ayant touché les sources de chaque famille de
// contenu → alimente les \`<lastmod>\` des sub-sitemaps (audit indexation
// 2026-07-31). Une famille absente d'ici retombe sur la constante figée
// correspondante dans \`src/app/sitemap.ts\` (fail-soft, aucune régression).
//
// La version COMMITÉE de ce fichier sert au typecheck et au dev local ; la CI
// la régénère avant chaque build (elle n'est jamais recommitée).

export const CONTENT_FRESHNESS: Readonly<Record<string, string>> = {
${body}
};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, file, "utf8");
console.log(`[content-freshness] écrit : ${OUT} (${entries.length} familles)`);
