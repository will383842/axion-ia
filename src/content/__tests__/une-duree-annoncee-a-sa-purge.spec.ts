// @vitest-environment node

/**
 * Verrou — ce que la notice ANNONCE de la conservation des rendez-vous
 * enregistrés est ce que le code FAIT (chantier visio, PR 8 ; B1).
 *
 * ## Historique
 *
 * Jusqu'au 2026-10-07, la notice annonçait six durées (son 30 jours,
 * transcription 12 mois, dossier 3 ou 5 ans, versions 90 jours, preuve
 * d'accord 5 ans après le dossier), et ce test vérifiait que chacune avait sa
 * purge planifiée par `retention-purge-worker.ts`.
 *
 * ## Depuis le 2026-10-07
 *
 * Will : « coupe tous les effacements ». Le worker n'appelle plus aucune purge
 * du dossier visio (`executerPurgeVisio` est retiré). La notice ne promet donc
 * plus de suppression automatique pour la transcription, le compte rendu, les
 * informations tirées de l'échange ni la preuve d'accord.
 *
 * ⚠️ Seul le SON garde sa durée (30 jours au plus) : il est effacé par l'étape
 * `purger_audio` du CIRCUIT visio — pas par ce worker —, et cette étape n'est
 * pas touchée. Le préavis aux clients dérive toujours cette durée de la
 * constante.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONSERVATION_VISIO, sectionRendezVousDecouverte } from "../visio-annonce-textes";

const WORKER = "src/server/queue/workers/retention-purge-worker.ts";

const lire = (f: string): string => readFileSync(join(process.cwd(), f), "utf8");

function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const PURGES_RETIREES = [
  "executerPurgeVisio",
  "purgerSegmentsAnciens",
  "purgerDossiersVisioEchus",
  "purgerVersionsComptesRendus",
  "viderFaitsRejetes",
  "purgerPreuvesAccordEchues",
  "seuilsDuJour",
] as const;

describe("la conservation annoncée des rendez-vous enregistrés est celle du code", () => {
  const fr = sectionRendezVousDecouverte("fr", true);
  const en = sectionRendezVousDecouverte("en", true);

  it("🔴 la notice (texte de la bascule) ne promet plus de suppression du dossier", () => {
    expect(fr).toContain(
      "la transcription, le compte rendu, les informations tirées de l'échange et la preuve de votre accord (date, version du texte annoncé) sont conservés pour garder la trace de nos échanges ; ils ne sont pas supprimés automatiquement",
    );
    expect(fr).not.toMatch(/transcription, \d+ mois/);
    expect(fr).not.toMatch(/versions remplacées ou rejetées d'un compte rendu, \d+ jours/);
    expect(fr).not.toMatch(/\d+ ans après la fin de la conservation/);
    expect(en).toContain("they are not deleted automatically");
    expect(en).not.toMatch(/transcript, \d+ months/);
  });

  for (const fonction of PURGES_RETIREES) {
    it(`🛑 « ${fonction} » n'est plus appelée par le worker`, () => {
      expect(sansCommentaires(lire(WORKER))).not.toMatch(new RegExp(`\\b${fonction}\\s*\\(`));
    });
  }

  it("le son garde sa durée annoncée, celle de la constante du circuit", () => {
    const jours = Number(/son, au plus tard (\d+) jours/.exec(fr)?.[1]);
    expect(jours).toBe(CONSERVATION_VISIO.audioJoursMax);
  });

  it("🔴 le préavis annonce la durée du son DÉRIVÉE de la constante, pas une copie", () => {
    const preavis = lire("src/lib/email/templates/preavis-sous-traitants.tsx");
    expect(preavis).toMatch(
      /export const CONSERVATION_SON_MAX_JOURS: number = CONSERVATION_VISIO\.audioJoursMax;/,
    );
  });
});
