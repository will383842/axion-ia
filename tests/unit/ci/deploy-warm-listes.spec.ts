/**
 * Job `warm` de `deploy-coolify.yml` — verrou sur les listes d'URLs.
 *
 * POURQUOI CE FICHIER EXISTE. L'audit GEO/AEO end-to-end du 2026-08-14 a vu
 * **huit agents indépendants** remonter la même chose (GEO-023) : des pages qui
 * lisent la base — la home et sa note agrégée, `/fr/mentions-legales` et son
 * identité légale — étaient resservies AMPUTÉES après chaque atterrissage, parce
 * qu'elles ne figuraient dans aucune des listes de ce job. Le défaut n'était pas
 * dans le code de ces pages : il était dans le CÂBLAGE du post-déploiement.
 *
 * La classe de bug la plus vicieuse ici n'est pas « oublier une page » — c'est
 * « l'ajouter dans UNE des deux listes ». Revalider sans purger laisse Cloudflare
 * servir la version amputée pour `s-maxage=3600` ; purger sans revalider fait
 * re-cacher l'origine encore stub. Les deux listes doivent donc décrire le MÊME
 * ensemble, et c'est exactement ce que ce fichier interdit d'oublier.
 *
 * ⚠️ RÈGLE DE RÉDACTION : les assertions s'ancrent sur la SYNTAXE des affectations
 * shell (`PATHS='[…]'`, `FILES='[…]'`), jamais sur une chaîne nue qui pourrait
 * tomber sur un commentaire du workflow qui EXPLIQUE le correctif.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Vitest s'exécute depuis la racine du dépôt (`pnpm test`). On évite
// `import.meta.dirname` : la transformation SSR de Vitest ne le garantit pas.
const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(path.join(RACINE, ...relatif.split("/")), "utf8");
}

const WORKFLOW = lire(".github/workflows/deploy-coolify.yml");

const ORIGINE = "https://axion-ia.com";

/** Extrait une affectation shell `NOM='[ … ]'` et la parse en tableau JSON. */
function listeJson(nom: string): string[] {
  const trouve = new RegExp(`\\b${nom}='(\\[[^']*\\])'`).exec(WORKFLOW);
  expect(
    trouve,
    `Affectation ${nom}='[…]' introuvable dans deploy-coolify.yml — la liste a été renommée ou reformatée. Ce verrou doit être mis à jour EN MÊME TEMPS, pas contourné.`,
  ).not.toBeNull();
  const capture = trouve?.[1];
  if (capture === undefined) {
    throw new Error(`Affectation ${nom}='[…]' introuvable dans deploy-coolify.yml`);
  }
  const valeur: unknown = JSON.parse(capture);
  expect(Array.isArray(valeur)).toBe(true);
  return valeur as string[];
}

describe("deploy-coolify.yml — job warm : revalidation ISR et purge CF ciblée", () => {
  it("décrit le même ensemble d'URLs dans PATHS (revalidate) et FILES (purge CF)", () => {
    const chemins = listeJson("PATHS");
    const fichiers = listeJson("FILES");

    // `FILES` est une liste d'URLs absolues : Cloudflare purge par URL, pas par
    // chemin. On la ramène au même référentiel que `PATHS` avant de comparer.
    for (const url of fichiers) {
      expect(url.startsWith(`${ORIGINE}/`), `URL de purge CF hors origine canonique : ${url}`).toBe(
        true,
      );
    }
    const fichiersEnChemins = fichiers.map((url) => url.slice(ORIGINE.length));

    expect([...fichiersEnChemins].sort()).toEqual([...chemins].sort());
  });

  it("n'a pas de doublon dans l'une ou l'autre liste", () => {
    for (const nom of ["PATHS", "FILES"] as const) {
      const liste = listeJson(nom);
      expect(new Set(liste).size, `Doublon dans ${nom}`).toBe(liste.length);
    }
  });

  it("reste sous le plafond Cloudflare Free de 30 URLs par appel de purge", () => {
    // Dépasser le plafond ne fait pas échouer le job (il est best-effort) : il
    // fait échouer la PURGE, silencieusement. C'est précisément le genre de
    // régression que personne ne voit passer.
    expect(listeJson("FILES").length).toBeLessThanOrEqual(30);
  });

  it("couvre les pages dont le rendu dépend de la base ou de l'env runtime", () => {
    const chemins = new Set(listeJson("PATHS"));

    // Index DB-dependent (liste historique).
    for (const p of [
      "/fr/actualites",
      "/fr/connaissances",
      "/fr/ressources",
      "/fr/galerie",
      "/fr/diagnostic",
    ]) {
      expect(chemins.has(p), `${p} doit rester dans la revalidation post-deploy`).toBe(true);
    }

    // Ajouts de l'audit GEO/AEO E2E (GEO-023, GEO-146) : la home porte la note
    // agrégée et le mur d'avis ; `/fr/mentions-legales` porte l'identité légale
    // que Google et les LLM recoupent avec SIRENE pour la fusion d'entité.
    for (const p of [
      "/fr",
      "/fr/blog",
      "/fr/memo-isere",
      "/fr/mentions-legales",
      "/fr/conditions-generales",
      "/fr/sites-web-augmentes",
      "/fr/audit",
      "/fr/formations",
      "/fr/implementation",
    ]) {
      expect(chemins.has(p), `${p} doit être revalidée après chaque déploiement`).toBe(true);
    }
  });

  it("chauffe en priorité les pages stratégiques, `/fr/sites-web-augmentes` comprise", () => {
    const trouve = /\bSTRATEGIC="([^"]*)"/.exec(WORKFLOW);
    expect(trouve, 'Affectation STRATEGIC="…" introuvable').not.toBeNull();
    const capture = trouve?.[1];
    if (capture === undefined) {
      throw new Error('Affectation STRATEGIC="…" introuvable dans deploy-coolify.yml');
    }
    const strategiques = new Set(capture.split(/\s+/).filter(Boolean));

    for (const p of ["/fr", "/fr/audit", "/fr/formations", "/fr/sites-web-augmentes"]) {
      expect(strategiques.has(p), `${p} doit figurer dans la chauffe prioritaire`).toBe(true);
    }
  });

  it("ne purge jamais toute la zone depuis le job de chauffe", () => {
    // `purge_everything` appartient au job `deploy`. L'employer ici viderait le
    // cache que le sweep vient de remplir — do-not-touch documenté par H4.
    const jobWarm = WORKFLOW.slice(WORKFLOW.indexOf("\n  warm:"));
    expect(jobWarm).not.toContain('"purge_everything"');
  });
});
