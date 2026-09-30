/**
 * Une dictée a une suite et une relance (PR 7, B11).
 *
 * Le compte rendu d'une dictée ALIMENTE le suivi du rendez-vous : issue « a eu
 * lieu », une suite et une date PROPOSÉES (auteur nul), que Will valide dans
 * « Après l'appel ». La date est celle de la prochaine étape dictée si elle
 * est datée et future, sinon +5 jours ouvrés (`RELANCE_PAR_DEFAUT_JOURS_OUVRES`).
 *
 * La relance par défaut suit la MÊME règle que « Après l'appel »
 * (`suiteParDefaut`, jour de PARIS) : une dictée faite à 0 h 30 heure de Paris
 * (22 h 30 UTC la veille) compte depuis le jour de Paris.
 *
 * Mutation qui rougit : compter les jours calendaires au lieu des jours ouvrés,
 * ignorer la prochaine étape datée, ou recopier la règle en partant du jour UTC.
 * Contre-témoin : une étape datée dans le passé n'est pas retenue.
 */

import { describe, expect, it } from "vitest";

import { RELANCE_PAR_DEFAUT_JOURS_OUVRES } from "@/features/dossier-client/seuils";
import { suiteParDefaut } from "@/features/dossier-client/suite-proposee";
import { suiteProposeeApresDictee } from "../dictee";

// Vendredi 9 octobre 2026.
const VENDREDI = new Date("2026-10-09T15:00:00Z");

describe("une dictée a une suite et une relance", () => {
  it("sans étape datée : relance à +5 jours ouvrés (le vendredi suivant)", () => {
    const s = suiteProposeeApresDictee({ faits: [], dateRencontre: VENDREDI });
    expect(RELANCE_PAR_DEFAUT_JOURS_OUVRES).toBe(5);
    expect(s).toMatchObject({ issue: "eu_lieu", suite: "relance" });
    expect(s.suiteLe.toISOString().slice(0, 10)).toBe("2026-10-16");
  });

  it("la prochaine étape datée et future fixe la relance", () => {
    const le = new Date("2026-10-13T00:00:00Z");
    const s = suiteProposeeApresDictee({
      faits: [{ type: "prochaine_etape", dateCible: le }],
      dateRencontre: VENDREDI,
    });
    expect(s.suiteLe).toEqual(le);
  });

  it("une offre envisagée sans étape datée : suite « devis »", () => {
    const s = suiteProposeeApresDictee({
      faits: [{ type: "offre_envisagee", dateCible: null }],
      dateRencontre: VENDREDI,
    });
    expect(s.suite).toBe("devis");
  });

  it("contre-témoin : une étape datée dans le passé n'est pas retenue", () => {
    const s = suiteProposeeApresDictee({
      faits: [{ type: "prochaine_etape", dateCible: new Date("2026-10-01T00:00:00Z") }],
      dateRencontre: VENDREDI,
    });
    expect(s.suiteLe.toISOString().slice(0, 10)).toBe("2026-10-16");
  });

  it("après 22 h UTC (heure d'été) : le jour compté est celui de Paris, comme « Après l'appel »", () => {
    // Jeudi 8 octobre 22 h 30 UTC = vendredi 9 octobre 0 h 30 à Paris.
    const tard = new Date("2026-10-08T22:30:00Z");
    const s = suiteProposeeApresDictee({ faits: [], dateRencontre: tard });
    expect(s.suiteLe.toISOString().slice(0, 10)).toBe(suiteParDefaut(tard).suiteLe);
    expect(s.suiteLe.toISOString().slice(0, 10)).toBe("2026-10-16");
  });
});
