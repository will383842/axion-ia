// @vitest-environment node

/**
 * Qualiopi ind. 21 — les règles des grilles d'évaluation des compétences pédagogiques.
 *
 * Les seuils viennent TOUS de `REGLAGES_EVALUATION` : ce test les lit, il ne les recopie
 * pas. Un seuil changé demain garde ce test juste.
 */

import { describe, expect, it } from "vitest";

import {
  BLOCS_MISE_EN_SITUATION,
  CRITERES_ENTRETIEN,
  VERSION_CONFIGURATION_EVALUATION,
} from "../configuration";
import { REGLAGES_EVALUATION as R } from "../reglages";
import {
  MANQUES_EVALUATION,
  decisionEnVigueur,
  etatEvaluation,
  manquesEvaluationActivation,
  seuilsEntretien,
  seuilsMiseEnSituation,
  validerDecision,
  validerFormationMethode,
  validerNotes,
  type LigneEvaluationLue,
} from "../regles";

const toutes = (codes: ReadonlyArray<{ code: string }>, n: number) =>
  Object.fromEntries(codes.map((c) => [c.code, n]));

const BON_ENTRETIEN = toutes(CRITERES_ENTRETIEN, 5);
const BONNE_MES = toutes(BLOCS_MISE_EN_SITUATION, 5);

let seq = 0;
function ligne(p: Partial<LigneEvaluationLue> & Pick<LigneEvaluationLue, "nature">): LigneEvaluationLue {
  seq += 1;
  return {
    id: `l${seq}`,
    formationId: null,
    notes: null,
    decision: null,
    motif: null,
    dateSuivie: null,
    version: VERSION_CONFIGURATION_EVALUATION,
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, seq)),
    ...p,
  };
}

const MAINTENANT = new Date("2026-10-17T10:00:00Z");

describe("validerNotes — grille vierge ou incomplète refusée", () => {
  it("refuse une grille vierge", () => {
    expect(validerNotes("entretien", {}).ok).toBe(false);
    expect(validerNotes("mise_en_situation", null).ok).toBe(false);
  });
  it("refuse un critère manquant, hors bornes, non entier ou inconnu", () => {
    const [premier, ...reste] = CRITERES_ENTRETIEN;
    expect(validerNotes("entretien", toutes(reste, 4)).ok).toBe(false);
    expect(validerNotes("entretien", { ...BON_ENTRETIEN, [premier!.code]: 0 }).ok).toBe(false);
    expect(validerNotes("entretien", { ...BON_ENTRETIEN, [premier!.code]: 6 }).ok).toBe(false);
    expect(validerNotes("entretien", { ...BON_ENTRETIEN, [premier!.code]: 3.5 }).ok).toBe(false);
    expect(validerNotes("entretien", { ...BON_ENTRETIEN, intrus: 3 }).ok).toBe(false);
  });
  it("accepte une grille complète, notée de 1 à 5", () => {
    expect(validerNotes("entretien", BON_ENTRETIEN)).toEqual({ ok: true, notes: BON_ENTRETIEN });
    expect(validerNotes("mise_en_situation", BONNE_MES).ok).toBe(true);
  });
});

describe("seuils (lus dans les réglages)", () => {
  it("entretien : moyenne au seuil et aucun critère sous le minimum = atteint", () => {
    const codes = CRITERES_ENTRETIEN.map((c) => c.code);
    // Moyenne exactement au seuil, chaque critère au minimum ou au-dessus.
    const notes = Object.fromEntries(codes.map((c) => [c, 4]));
    expect(seuilsEntretien(notes).atteint).toBe(R.entretienMoyenneMin <= 4);
  });
  it("entretien : un critère sous le minimum refuse même avec une bonne moyenne", () => {
    const codes = CRITERES_ENTRETIEN.map((c) => c.code);
    const notes = { ...BON_ENTRETIEN, [codes[0]!]: R.entretienNoteCritereMin - 1 };
    const s = seuilsEntretien(notes);
    expect(s.atteint).toBe(false);
    expect(s.criteresSousMinimum).toEqual([codes[0]]);
  });
  it("entretien : moyenne sous le seuil refuse", () => {
    const notes = toutes(CRITERES_ENTRETIEN, Math.max(R.entretienNoteCritereMin, 1));
    const s = seuilsEntretien(notes);
    expect(s.moyenne).toBeLessThan(R.entretienMoyenneMin);
    expect(s.atteint).toBe(false);
  });
  it("mise en situation : chaque bloc au minimum", () => {
    expect(seuilsMiseEnSituation(toutes(BLOCS_MISE_EN_SITUATION, R.miseEnSituationNoteBlocMin)).atteint).toBe(true);
    const s = seuilsMiseEnSituation({ ...BONNE_MES, B3: R.miseEnSituationNoteBlocMin - 1 });
    expect(s.atteint).toBe(false);
    expect(s.blocsSousMinimum).toEqual(["B3"]);
  });
  it("une grille illisible n'atteint jamais les seuils", () => {
    expect(seuilsEntretien({ a: 5 }).atteint).toBe(false);
    expect(seuilsMiseEnSituation(null).atteint).toBe(false);
  });
});

describe("validerDecision — la décision reste humaine, mais « habilité » est gardé", () => {
  const entretien = ligne({ nature: "entretien", notes: BON_ENTRETIEN });
  const mes = ligne({ nature: "mise_en_situation", notes: BONNE_MES });
  const mauvaiseMes = ligne({ nature: "mise_en_situation", notes: { ...BONNE_MES, B1: 1 } });

  it("motif obligatoire, quelle que soit la décision", () => {
    for (const decision of ["habilite", "avec_reserve", "non_habilite", "second_essai"] as const) {
      const r = validerDecision({ decision, motif: "   ", lignes: [entretien, mes] });
      expect(r.ok).toBe(false);
    }
  });
  it("décision inconnue refusée", () => {
    expect(validerDecision({ decision: "peut-etre", motif: "x", lignes: [entretien, mes] }).ok).toBe(false);
  });
  it("« habilité » refusé sans entretien ni mise en situation", () => {
    expect(validerDecision({ decision: "habilite", motif: "ok", lignes: [] }).ok).toBe(false);
    expect(validerDecision({ decision: "habilite", motif: "ok", lignes: [entretien] }).ok).toBe(false);
  });
  it("« habilité » refusé quand la DERNIÈRE mise en situation n'atteint pas les seuils", () => {
    const r = validerDecision({ decision: "habilite", motif: "ok", lignes: [entretien, mes, mauvaiseMes] });
    expect(r.ok).toBe(false);
  });
  it("« habilité » accepté quand les seuils sont atteints, et il cite les grilles", () => {
    const r = validerDecision({ decision: "habilite", motif: "Très bon", lignes: [entretien, mes] });
    expect(r).toMatchObject({ ok: true, entretienId: entretien.id, miseEnSituationId: mes.id });
  });
  it("« 2e essai » et « non habilité » restent possibles sous les seuils", () => {
    expect(validerDecision({ decision: "second_essai", motif: "B1 à revoir", lignes: [entretien, mauvaiseMes] }).ok).toBe(true);
    expect(validerDecision({ decision: "non_habilite", motif: "Pas prêt", lignes: [entretien] }).ok).toBe(true);
  });
  it("« avec réserve » exige les deux grilles, pas les seuils", () => {
    expect(validerDecision({ decision: "avec_reserve", motif: "B1 faible", lignes: [entretien] }).ok).toBe(false);
    expect(validerDecision({ decision: "avec_reserve", motif: "B1 faible", lignes: [entretien, mauvaiseMes] }).ok).toBe(true);
  });
  it("aucune décision sans entretien versé", () => {
    expect(validerDecision({ decision: "non_habilite", motif: "x", lignes: [] }).ok).toBe(false);
  });
});

describe("validerFormationMethode", () => {
  it("date obligatoire, lisible, pas dans le futur", () => {
    expect(validerFormationMethode("", MAINTENANT).ok).toBe(false);
    expect(validerFormationMethode("2026-13-40", MAINTENANT).ok).toBe(false);
    expect(validerFormationMethode("2026-10-18", MAINTENANT).ok).toBe(false);
    expect(validerFormationMethode("2026-10-17", MAINTENANT).ok).toBe(true);
  });
});

describe("état et décision en vigueur", () => {
  it("la DERNIÈRE décision d'une formation décide", () => {
    const lignes = [
      ligne({ nature: "decision_habilitation", formationId: "f1", decision: "habilite", motif: "a" }),
      ligne({ nature: "decision_habilitation", formationId: "f1", decision: "non_habilite", motif: "b" }),
      ligne({ nature: "decision_habilitation", formationId: "f2", decision: "avec_reserve", motif: "c" }),
    ];
    expect(decisionEnVigueur(lignes, "f1")).toBe(false);
    expect(decisionEnVigueur(lignes, "f2")).toBe(true);
    expect(decisionEnVigueur(lignes, "f3")).toBe(false);
    expect(etatEvaluation(lignes).formationsHabilitees).toEqual(["f2"]);
  });
});

describe("manquesEvaluationActivation — tout est exigé", () => {
  const complet = [
    ligne({ nature: "entretien", notes: BON_ENTRETIEN }),
    ligne({ nature: "mise_en_situation", notes: BONNE_MES }),
    ligne({ nature: "decision_habilitation", formationId: "f1", decision: "habilite", motif: "ok" }),
    ligne({ nature: "formation_methode", dateSuivie: new Date("2026-10-01T00:00:00Z") }),
  ];
  it("un dossier complet ne manque de rien", () => {
    expect(manquesEvaluationActivation(complet)).toEqual([]);
  });
  it("absent (non lu) = tout manque, garde fermée", () => {
    expect(manquesEvaluationActivation(undefined)).toEqual([
      MANQUES_EVALUATION.entretien,
      MANQUES_EVALUATION.miseEnSituation,
      MANQUES_EVALUATION.decision,
      MANQUES_EVALUATION.formationMethode,
    ]);
  });
  it("chaque manque est dit", () => {
    for (const [i, attendu] of [
      MANQUES_EVALUATION.entretien,
      MANQUES_EVALUATION.miseEnSituation,
      MANQUES_EVALUATION.decision,
      MANQUES_EVALUATION.formationMethode,
    ].entries()) {
      const sans = complet.filter((_, j) => j !== i);
      expect(manquesEvaluationActivation(sans)).toContain(attendu);
    }
  });
  it("une décision « non habilité » ou « 2e essai » ne suffit pas", () => {
    const l = [
      ...complet.slice(0, 2),
      ligne({ nature: "decision_habilitation", formationId: "f1", decision: "second_essai", motif: "x" }),
      complet[3]!,
    ];
    expect(manquesEvaluationActivation(l)).toEqual([MANQUES_EVALUATION.decision]);
  });
});
