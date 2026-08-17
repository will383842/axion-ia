/**
 * Tests NÉGATIFS du moment de proposition d'un questionnaire.
 *
 * Le cas qui a motivé ce module est REPRODUIT tel quel (§ « le cas réel du
 * 16/08 ») : une stagiaire, la nuit précédant sa formation, à qui le portail
 * proposait de noter à chaud une formation qu'elle n'avait pas suivie.
 */

import { describe, it, expect } from "vitest";
import {
  questionnaireEstDu,
  motifNonPropose,
  DELAI_SATISFACTION_FROID_JOURS,
  type MomentQuestionnaire,
} from "./questionnaire-moment";

const DEBUT = new Date("2026-08-16T07:00:00Z");
const FIN = new Date("2026-08-16T15:00:00Z");

function q(over: Partial<MomentQuestionnaire> = {}): MomentQuestionnaire {
  return {
    type: "positionnement",
    reponduAt: null,
    sessionDateDebut: DEBUT,
    sessionDateFin: FIN,
    sessionStatut: "planifiee",
    ...over,
  };
}

describe("le cas réel du 16/08 — la veille de la formation", () => {
  const veille = new Date("2026-08-15T23:00:00Z");

  it("🔴 la satisfaction À CHAUD n'est PAS proposée avant la formation", () => {
    // « Votre retour à chaud, pendant que la formation est encore fraîche » —
    // proposé pour une formation qui n'a pas commencé.
    expect(questionnaireEstDu(q({ type: "satisfaction_chaud" }), veille)).toBe(false);
  });

  it("🔴 la satisfaction À FROID n'est PAS proposée avant la formation", () => {
    // « Quelques semaines après : ce que la formation vous a réellement apporté,
    // avec du recul » — proposé le même soir.
    expect(questionnaireEstDu(q({ type: "satisfaction_froid" }), veille)).toBe(false);
  });

  it("le POSITIONNEMENT, lui, est bien proposé — c'est son moment", () => {
    expect(questionnaireEstDu(q({ type: "positionnement" }), veille)).toBe(true);
  });
});

describe("chaque type à son moment", () => {
  it("la satisfaction à chaud s'ouvre à la FIN de la session, pas au début", () => {
    const pendant = new Date("2026-08-16T10:00:00Z");
    expect(questionnaireEstDu(q({ type: "satisfaction_chaud" }), pendant)).toBe(false);
    expect(questionnaireEstDu(q({ type: "satisfaction_chaud" }), FIN)).toBe(true);
  });

  it("la satisfaction à froid s'ouvre à J+30, pas avant", () => {
    const j29 = new Date(FIN.getTime() + 29 * 86400000);
    const j30 = new Date(FIN.getTime() + DELAI_SATISFACTION_FROID_JOURS * 86400000);
    expect(questionnaireEstDu(q({ type: "satisfaction_froid" }), j29)).toBe(false);
    expect(questionnaireEstDu(q({ type: "satisfaction_froid" }), j30)).toBe(true);
  });

  it("le positionnement se ferme à la fin de la session — il ne positionne plus rien après", () => {
    const apres = new Date(FIN.getTime() + 60_000);
    expect(questionnaireEstDu(q({ type: "positionnement" }), apres)).toBe(false);
  });

  it("le positionnement reste rattrapable PENDANT la séance", () => {
    // Usage réel et légitime : « nous le remplirons ensemble à l'ouverture ».
    const ouverture = new Date("2026-08-16T09:00:00Z");
    expect(questionnaireEstDu(q({ type: "positionnement" }), ouverture)).toBe(true);
  });
});

describe("invariants", () => {
  it("un questionnaire déjà rempli n'est jamais reproposé", () => {
    const apres = new Date(FIN.getTime() + 86400000);
    for (const type of ["positionnement", "satisfaction_chaud", "satisfaction_froid"] as const) {
      expect(questionnaireEstDu(q({ type, reponduAt: new Date() }), apres)).toBe(false);
    }
  });

  it.each(["annulee", "reportee"])("une session « %s » ne propose plus rien", (statut) => {
    const apres = new Date(FIN.getTime() + 40 * 86400000);
    for (const type of ["positionnement", "satisfaction_chaud", "satisfaction_froid"] as const) {
      expect(questionnaireEstDu(q({ type, sessionStatut: statut }), apres)).toBe(false);
    }
  });

  it("🔴 SANS date de session, on AFFICHE — un trou de données ne doit pas masquer une action", () => {
    // Masquer « faute de savoir » produirait un questionnaire jamais rempli que
    // personne ne verrait manquer.
    const orphelin = q({
      type: "satisfaction_chaud",
      sessionDateDebut: null,
      sessionDateFin: null,
    });
    expect(questionnaireEstDu(orphelin, new Date("2020-01-01T00:00:00Z"))).toBe(true);
  });

  it("la date de fin absente retombe sur la date de début", () => {
    const sansFin = q({ type: "satisfaction_chaud", sessionDateFin: null });
    expect(questionnaireEstDu(sansFin, new Date("2026-08-16T06:00:00Z"))).toBe(false);
    expect(questionnaireEstDu(sansFin, new Date("2026-08-16T08:00:00Z"))).toBe(true);
  });
});

describe("motifNonPropose — l'organisme garde la vue complète", () => {
  it("explique POURQUOI un questionnaire n'est pas encore proposé", () => {
    const veille = new Date("2026-08-15T23:00:00Z");
    expect(motifNonPropose(q({ type: "satisfaction_chaud" }), veille)).toContain(
      "fin de la session",
    );
    expect(motifNonPropose(q({ type: "satisfaction_froid" }), veille)).toContain("J+30");
  });

  it("ne dit rien quand le questionnaire EST proposé", () => {
    const veille = new Date("2026-08-15T23:00:00Z");
    expect(motifNonPropose(q({ type: "positionnement" }), veille)).toBeNull();
  });
});
