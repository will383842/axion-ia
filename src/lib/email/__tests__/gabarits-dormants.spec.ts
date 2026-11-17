/**
 * Garde de source : aucun code ne rebranche un gabarit en sommeil sans que la liste
 * `gabarits-dormants.ts` soit révisée (L6e).
 *
 * Ce qui compte comme une citation : le nom du gabarit dans le CODE (chaîne,
 * identifiant), hors commentaires. Un commentaire qui explique pourquoi un gabarit
 * dort n'émet rien (ex. `server/email/verdict-envoi.ts`).
 * Exemptés : les gabarits (`lib/email/templates/`), l'aperçu (`server/email/apercu/`),
 * `queue/types.ts`, `email/outbox-policy.ts`, les tests, et la liste elle-même.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { GABARITS_DORMANTS, NOMS_GABARITS_DORMANTS } from "../gabarits-dormants";

const RACINE = process.cwd();
const SRC = join(RACINE, "src");

const EXEMPTES_PREFIXES = ["src/lib/email/templates/", "src/server/email/apercu/"];
const EXEMPTES_FICHIERS = new Set([
  "src/server/queue/types.ts",
  "src/server/email/outbox-policy.ts",
  "src/lib/email/gabarits-dormants.ts",
]);

// Retire les commentaires de bloc et de ligne (sans toucher au « :// » d'une adresse).
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\w"'`\\])\/\/.*$/gm, "$1");
}

/** Noms dormants cités dans le code de `source` (commentaires exclus). */
export function nomsDormantsCites(source: string, noms: readonly string[]): string[] {
  const code = sansCommentaires(source);
  return noms.filter((n) => code.includes(n));
}

function fichiersSource(dossier: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "__tests__" || entree === "node_modules") continue;
      sortie.push(...fichiersSource(chemin));
    } else if (/\.(ts|tsx)$/.test(entree) && !/\.(spec|test)\.tsx?$/.test(entree)) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

function exempte(chemin: string): boolean {
  return EXEMPTES_FICHIERS.has(chemin) || EXEMPTES_PREFIXES.some((p) => chemin.startsWith(p));
}

describe("gabarits en sommeil (L6e)", () => {
  it("la liste porte les six gabarits de la fiche, chacun avec un motif", () => {
    expect([...NOMS_GABARITS_DORMANTS].sort()).toEqual(
      [
        "cancellation-confirmed-by-user",
        "force-majeure-notice",
        "payment-failed",
        "payment-link",
        "payment-receipt",
        "rgpd-effacement-confirme",
      ].sort(),
    );
    for (const g of GABARITS_DORMANTS) expect(g.motif.length).toBeGreaterThan(20);
  });

  it("chaque nom de la liste est encore inscrit dans types.ts (sinon la liste est périmée)", () => {
    const types = readFileSync(join(SRC, "server/queue/types.ts"), "utf8");
    for (const nom of NOMS_GABARITS_DORMANTS) expect(types).toContain(`"${nom}"`);
  });

  it("aucun fichier de code hors gabarits, aperçu, types.ts, outbox-policy.ts ne cite un gabarit en sommeil", () => {
    const fautifs: string[] = [];
    for (const f of fichiersSource(SRC)) {
      const rel = relative(RACINE, f).split(sep).join("/");
      if (exempte(rel)) continue;
      const cites = nomsDormantsCites(readFileSync(f, "utf8"), NOMS_GABARITS_DORMANTS);
      if (cites.length > 0) fautifs.push(`${rel} cite ${cites.join(", ")}`);
    }
    expect(
      fautifs,
      "Un gabarit en sommeil est cité par du code : lever son sommeil dans gabarits-dormants.ts, avec une décision.",
    ).toEqual([]);
  });

  it("test du test : une citation inventée est vue, un commentaire ne l'est pas", () => {
    const noms = ["gabarit-invente-dormant"];
    expect(
      nomsDormantsCites('await enqueueEmail("gabarit-invente-dormant", a, "fr", {});', noms),
    ).toEqual(noms);
    expect(nomsDormantsCites("const X = 'gabarit-invente-dormant';", noms)).toEqual(noms);
    expect(nomsDormantsCites("// gabarit-invente-dormant dort\nconst a = 1;", noms)).toEqual([]);
    expect(nomsDormantsCites("/* gabarit-invente-dormant */ const a = 1;", noms)).toEqual([]);
    expect(nomsDormantsCites("const a = 1; // gabarit-invente-dormant", noms)).toEqual([]);
  });
});
