// @vitest-environment node
//
// Environnement `node` : lecture de fichiers du dépôt.

/**
 * Verrou — la conservation des réservations d'appel (`calendly_events`) dit la
 * MÊME chose dans la notice publique et dans le worker de purge.
 *
 * ## Historique
 *
 * Du 2026-08-31 au 2026-10-07, la notice annonçait « Demandes commerciales :
 * 3 ans » et le worker supprimait les réservations à 36 mois — ce test
 * vérifiait que les deux valeurs restaient égales.
 *
 * ## Depuis le 2026-10-07
 *
 * Will : « coupe tous les effacements ». Le worker ne supprime plus les
 * réservations d'appel, et la notice ne promet plus de durée : les demandes
 * commerciales sont conservées, sans suppression automatique, et leur
 * effacement se demande. Les deux moitiés restent COUPLÉES : rétablir une
 * purge sans changer la notice rougit, et inversement.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(join(RACINE, relatif), "utf8");
}

function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const WORKER = "src/server/queue/workers/retention-purge-worker.ts";
const NOTICE = "src/content/legal.ts";

describe("la conservation des réservations d'appel suit la notice publiée", () => {
  it("🔴 la notice ne promet plus de durée pour les demandes commerciales", () => {
    const notice = lire(NOTICE);
    expect(notice).not.toMatch(/Demandes commerciales\s*:\s*\d+\s*ans?/);
    expect(notice).not.toMatch(/Commercial requests:\s*\d+\s*years?/);
    expect(notice).toContain(
      "Demandes commerciales : conservées pour garder la trace de nos échanges ; elles ne sont pas supprimées automatiquement",
    );
    expect(notice).toContain(
      "Commercial requests: kept to preserve a record of our exchanges; they are not deleted automatically",
    );
  });

  it("🔴 le worker ne supprime plus les réservations d'appel", () => {
    const code = sansCommentaires(lire(WORKER));
    expect(code).toContain("executerPurgeRetention");
    expect(code).not.toMatch(/calendlyEvent\s*\.\s*delete/);
    expect(code).not.toContain("RETENTION_CALENDLY_MONTHS");
  });

  it("⚠️ la décision « prospection sans limite » n'est pas touchée", () => {
    const code = sansCommentaires(lire(WORKER));
    for (const modele of [
      "prospectionCompany",
      "prospectionPerson",
      "prospectionHealthPractitioner",
    ]) {
      expect(code, `${modele} ne doit PAS être purgé — ordre de Will du 2026-08-20`).not.toMatch(
        new RegExp(`${modele}\\s*\\.\\s*delete`),
      );
    }
  });
});
