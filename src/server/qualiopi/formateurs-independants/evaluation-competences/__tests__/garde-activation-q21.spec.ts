// @vitest-environment node

/**
 * Qualiopi ind. 21 — la garde d'ACTIVATION exige l'évaluation des compétences, la
 * formation à la méthode, et les pièces (CV < 24 mois, SIRET actif, NDA à 11 chiffres),
 * sous la règle provisoire comme sous la règle complète.
 */

import { describe, expect, it } from "vitest";

import type { DocumentConformite } from "@/server/qualiopi/trainers/conformite";

import type { ControleLu } from "../../garde-activation-complete";
import {
  BLOCS_MISE_EN_SITUATION,
  CRITERES_ENTRETIEN,
  VERSION_CONFIGURATION_EVALUATION,
} from "../configuration";
import {
  MANQUES_Q21,
  manquesActivationQ21,
  type FaitsActivationQ21,
} from "../garde-activation-q21";
import { MANQUES_EVALUATION, type LigneEvaluationLue } from "../regles";

const MAINTENANT = new Date("2026-10-17T10:00:00Z");
const JOUR = 86_400_000;
const ilYa = (j: number) => new Date(MAINTENANT.getTime() - j * JOUR);

const notes = (codes: ReadonlyArray<{ code: string }>) =>
  Object.fromEntries(codes.map((c) => [c.code, 5]));

function ligne(
  p: Partial<LigneEvaluationLue> & Pick<LigneEvaluationLue, "nature" | "id">,
): LigneEvaluationLue {
  return {
    formationId: null,
    notes: null,
    decision: null,
    motif: null,
    dateSuivie: null,
    version: VERSION_CONFIGURATION_EVALUATION,
    createdAt: ilYa(10),
    ...p,
  };
}

const EVALUATIONS: LigneEvaluationLue[] = [
  ligne({ id: "e", nature: "entretien", notes: notes(CRITERES_ENTRETIEN) }),
  ligne({ id: "m", nature: "mise_en_situation", notes: notes(BLOCS_MISE_EN_SITUATION) }),
  ligne({
    id: "d",
    nature: "decision_habilitation",
    formationId: "f1",
    decision: "habilite",
    motif: "ok",
  }),
  ligne({ id: "fm", nature: "formation_methode", dateSuivie: ilYa(9) }),
];

const CV: DocumentConformite = {
  type: "cv",
  statutValidation: "valide",
  fichierUrl: "https://stockage.example/cv.pdf",
  dateEmission: ilYa(300),
  dateExpiration: null,
};

const CONTROLE: ControleLu = {
  verdict: "vert",
  source: "registre",
  verifieAt: ilYa(3),
  createdAt: ilYa(3),
  siret: "12345678901234",
};

function complet(extra: Partial<FaitsActivationQ21> = {}): FaitsActivationQ21 {
  return {
    evaluations: EVALUATIONS,
    siret: "123 456 789 01234",
    nda: "84 69 1234569",
    controles: [CONTROLE],
    pieces: [CV],
    ...extra,
  };
}

describe("manquesActivationQ21", () => {
  it("un dossier complet ne manque de rien, sous les deux règles", () => {
    expect(manquesActivationQ21(complet(), "provisoire", MAINTENANT)).toEqual([]);
    expect(manquesActivationQ21(complet(), "complete", MAINTENANT)).toEqual([]);
  });

  it("rien de lu : tout manque (garde fermée)", () => {
    expect(manquesActivationQ21({}, "provisoire", MAINTENANT)).toEqual([
      MANQUES_EVALUATION.entretien,
      MANQUES_EVALUATION.miseEnSituation,
      MANQUES_EVALUATION.decision,
      MANQUES_EVALUATION.formationMethode,
      MANQUES_Q21.cv,
      MANQUES_Q21.siret,
      MANQUES_Q21.nda,
    ]);
  });

  it("sans grilles ni formation à la méthode : refus, sous les deux règles", () => {
    for (const regle of ["provisoire", "complete"] as const) {
      expect(manquesActivationQ21(complet({ evaluations: [] }), regle, MAINTENANT)).toEqual([
        MANQUES_EVALUATION.entretien,
        MANQUES_EVALUATION.miseEnSituation,
        MANQUES_EVALUATION.decision,
        MANQUES_EVALUATION.formationMethode,
      ]);
    }
  });

  it("NDA « en cours » ou « pas encore de numéro » : refus, sous les deux règles", () => {
    for (const regle of ["provisoire", "complete"] as const) {
      expect(manquesActivationQ21(complet({ nda: "en cours" }), regle, MAINTENANT)).toEqual([
        MANQUES_Q21.ndaEnCours,
      ]);
      expect(
        manquesActivationQ21(complet({ nda: "Pas encore de numéro" }), regle, MAINTENANT),
      ).toEqual([MANQUES_Q21.ndaInvalide]);
      expect(manquesActivationQ21(complet({ nda: "  " }), regle, MAINTENANT)).toEqual([
        MANQUES_Q21.nda,
      ]);
    }
  });

  it("CV de plus de 24 mois, ou sans date : refus (règle provisoire)", () => {
    const vieux = { ...CV, dateEmission: ilYa(25 * 31) };
    expect(manquesActivationQ21(complet({ pieces: [vieux] }), "provisoire", MAINTENANT)).toEqual([
      MANQUES_Q21.cv,
    ]);
    const sansDate = { ...CV, dateEmission: null };
    expect(manquesActivationQ21(complet({ pieces: [sansDate] }), "provisoire", MAINTENANT)).toEqual(
      [MANQUES_Q21.cv],
    );
  });

  it("SIRET non actif : contrôle rouge, trop vieux, ou sur un autre SIRET (règle provisoire)", () => {
    for (const controles of [
      [{ ...CONTROLE, verdict: "rouge" as const }],
      [{ ...CONTROLE, verifieAt: ilYa(40), createdAt: ilYa(40) }],
      [{ ...CONTROLE, siret: "99999999999999" }],
      [],
    ]) {
      expect(manquesActivationQ21(complet({ controles }), "provisoire", MAINTENANT)).toEqual([
        MANQUES_Q21.siret,
      ]);
    }
  });

  it("la règle complète ne redit pas le CV ni le SIRET (elle les juge déjà)", () => {
    expect(
      manquesActivationQ21(complet({ pieces: [], controles: [] }), "complete", MAINTENANT),
    ).toEqual([]);
  });
});
