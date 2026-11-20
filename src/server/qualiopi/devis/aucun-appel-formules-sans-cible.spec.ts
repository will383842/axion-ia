/**
 * Garde : l'interrupteur « Devis à formules » ne s'interroge plus SANS cible. Un appel nu
 * (`formulesActives()` ou `lireContextePdfDevis()`) coupait les formules en mode « essai » même
 * pour une fiche d'essai. Le typecheck l'interdit déjà ; ce test couvre aussi un `as never`.
 * Garde-fou file d'attente : `src/server/queue/**` n'importe aucun module de ce lot.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "src");

function fichiers(dir: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "node_modules" || nom === "__tests__") continue;
      fichiers(chemin, sortie);
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.|spec-util/.test(nom)) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

describe("aucun appel de l'interrupteur des formules sans cible", () => {
  const sources = fichiers(RACINE).map((f) => ({ f, t: readFileSync(f, "utf8") }));

  it("zéro `formulesActives()` ni `lireContextePdfDevis()` sans argument", () => {
    const fautifs = sources
      .filter(({ t }) => /\bformulesActives\(\s*\)|\blireContextePdfDevis\(\s*\)/.test(t))
      .map(({ f }) => f.replace(RACINE, "src"));
    expect(fautifs).toEqual([]);
  });

  it("la file d'attente (worker) n'importe aucun module du lot", () => {
    const MODULES =
      /interrupteur-formules|donnees-pdf-devis|devis-formules|piece-signature|lien-a-l-envoi|confirmation-commande|proposer-plans/;
    const fautifs = sources
      .filter(({ f }) => f.includes(`${join("server", "queue")}`))
      .filter(
        ({ t }) =>
          /^\s*(import|export)[^;]*from\s+["'][^"']*["']/m.test(t) &&
          t.split("\n").some((l) => /\bfrom\s+["']/.test(l) && MODULES.test(l)),
      )
      .map(({ f }) => f.replace(RACINE, "src"));
    expect(fautifs).toEqual([]);
  });
});
