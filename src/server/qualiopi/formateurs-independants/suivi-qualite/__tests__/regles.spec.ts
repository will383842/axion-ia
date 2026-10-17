/**
 * Suivi de la qualité pédagogique des intervenants externes (Qualiopi ind. 21) —
 * les règles PURES : grilles, observation de la 1re mission, évaluation après mission,
 * satisfaction, réévaluation annuelle, CV déclaré, et ce que la garde de mission refuse.
 */

import { describe, expect, it } from "vitest";

import { GRILLES_SUIVI_QUALITE, REGLAGES_SUIVI_QUALITE } from "../reglages";
import {
  MANQUES_SUIVI_QUALITE,
  cvDeclarePerime,
  echeanceReevaluation,
  etatEvaluationMission,
  etatObservation,
  etatReevaluation,
  manquesSuiviQualite,
  missionsAReprendre,
  missionsSuivies,
  niveauSatisfaction,
  satisfactionDeLaMission,
  validerGrille,
  type FaitsSuiviQualite,
  type MissionLue,
} from "../regles";

const R = REGLAGES_SUIVI_QUALITE;
const MAINTENANT = new Date("2026-11-20T10:00:00Z");
const ALLUME = "2026-11-01";

const notes = (type: keyof typeof GRILLES_SUIVI_QUALITE, n: number) =>
  Object.fromEntries(GRILLES_SUIVI_QUALITE[type].criteres.map((c) => [c.code, n]));

const mission = (p: Partial<MissionLue> & { sessionId: string }): MissionLue => ({
  debut: "2026-11-05",
  fin: "2026-11-06",
  annulee: false,
  satisfaction: null,
  ...p,
});

const faits = (p: Partial<FaitsSuiviQualite> = {}): FaitsSuiviQualite => ({
  externe: true,
  allumeLe: ALLUME,
  missions: [],
  observations: [],
  evaluations: [],
  decisions: [],
  dateDecisionHabilitation: null,
  reevaluations: [],
  ...p,
});

describe("validerGrille — ajout seul, jamais vierge", () => {
  it("une grille vierge est refusée", () => {
    expect(
      validerGrille("observation", {
        notes: {},
        conclusion: "",
        date: MAINTENANT,
        observateur: "",
        maintenant: MAINTENANT,
      }),
    ).toEqual({ ok: false, erreur: "vierge" });
  });

  it("un critère sans note est refusé", () => {
    const n = notes("observation", 4);
    delete n.preparation;
    expect(
      validerGrille("observation", {
        notes: n,
        conclusion: "Séance solide, groupe impliqué.",
        date: MAINTENANT,
        observateur: "Will",
        maintenant: MAINTENANT,
      }),
    ).toEqual({ ok: false, erreur: "critere_manquant" });
  });

  it("une note hors de 1 à 5 (ou décimale) est refusée", () => {
    for (const v of [0, 6, 3.5, Number.NaN]) {
      expect(
        validerGrille("evaluation_mission", {
          notes: { ...notes("evaluation_mission", 4), deroule: v },
          conclusion: "Mission conforme au programme.",
          date: MAINTENANT,
          maintenant: MAINTENANT,
        }),
      ).toEqual({ ok: false, erreur: "note_invalide" });
    }
  });

  it("l'observation exige l'observateur, et toute grille une conclusion écrite", () => {
    expect(
      validerGrille("observation", {
        notes: notes("observation", 4),
        conclusion: "Séance solide, groupe impliqué.",
        date: MAINTENANT,
        observateur: "  ",
        maintenant: MAINTENANT,
      }),
    ).toEqual({ ok: false, erreur: "observateur_manquant" });
    expect(
      validerGrille("reevaluation", {
        notes: notes("reevaluation", 4),
        conclusion: "ok",
        date: MAINTENANT,
        maintenant: MAINTENANT,
      }),
    ).toEqual({ ok: false, erreur: "conclusion_trop_courte" });
  });

  it("une date dans le futur est refusée", () => {
    expect(
      validerGrille("evaluation_mission", {
        notes: notes("evaluation_mission", 4),
        conclusion: "Mission conforme au programme.",
        date: new Date("2026-12-01T00:00:00Z"),
        maintenant: MAINTENANT,
      }),
    ).toEqual({ ok: false, erreur: "date_invalide" });
  });

  it("une satisfaction saisie hors de 1 à 5 est refusée", () => {
    expect(
      validerGrille("evaluation_mission", {
        notes: notes("evaluation_mission", 4),
        conclusion: "Mission conforme au programme.",
        date: MAINTENANT,
        satisfaction: 7,
        maintenant: MAINTENANT,
      }),
    ).toEqual({ ok: false, erreur: "satisfaction_invalide" });
  });

  it("une grille complète rend sa moyenne en centièmes, sa version et ses critères figés", () => {
    const n = notes("observation", 4);
    n.preparation = 3;
    const v = validerGrille("observation", {
      notes: n,
      conclusion: "Séance solide, groupe impliqué.",
      date: MAINTENANT,
      observateur: "Will",
      maintenant: MAINTENANT,
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.moyenneCentiemes).toBe(383);
    expect(v.version).toBe(GRILLES_SUIVI_QUALITE.observation.version);
    expect(v.criteres).toHaveLength(GRILLES_SUIVI_QUALITE.observation.criteres.length);
    expect(v.criteres[0]).toEqual({
      code: "preparation",
      libelle: GRILLES_SUIVI_QUALITE.observation.criteres[0].libelle,
      note: 3,
    });
    expect(v.favorable).toBe(true);
  });

  it("l'observation n'est favorable qu'à partir du seuil réglé", () => {
    const sous = validerGrille("observation", {
      notes: { ...notes("observation", 3), preparation: 4, expertise: 3 },
      conclusion: "Séance à reprendre sur l'animation.",
      date: MAINTENANT,
      observateur: "Will",
      maintenant: MAINTENANT,
    });
    // (4 + 3 × 5) / 6 = 3,17 < 3,5
    expect(sous.ok && sous.favorable).toBe(false);
  });
});

describe("observation de la 1re mission", () => {
  it("éteint (aucune date d'allumage) : rien n'est exigé", () => {
    const f = faits({ allumeLe: null, missions: [mission({ sessionId: "s1" })] });
    expect(etatObservation(f, MAINTENANT).alerte).toBeNull();
    expect(manquesSuiviQualite(f, { sessionId: "s2" }, MAINTENANT)).toEqual([]);
  });

  it("une mission antérieure à l'allumage ne compte pas (jamais rétroactif)", () => {
    const f = faits({
      missions: [mission({ sessionId: "s0", debut: "2026-10-01", fin: "2026-10-02" })],
    });
    expect(etatObservation(f, MAINTENANT).premiere).toBeNull();
    expect(manquesSuiviQualite(f, { sessionId: "s2" }, MAINTENANT)).toEqual([]);
  });

  it("1re mission finie sans observation : alerte, et la 2e mission est refusée", () => {
    const f = faits({ missions: [mission({ sessionId: "s1" })] });
    const e = etatObservation(f, MAINTENANT);
    expect(e.premiere?.sessionId).toBe("s1");
    expect(e.alerte).toBe("manquante");
    expect(manquesSuiviQualite(f, { sessionId: "s2" }, MAINTENANT)).toContain(
      MANQUES_SUIVI_QUALITE.observation,
    );
  });

  it("la 1re mission elle-même n'est jamais refusée par sa propre observation", () => {
    const f = faits({ missions: [mission({ sessionId: "s1", fin: "2026-12-01" })] });
    expect(manquesSuiviQualite(f, { sessionId: "s1" }, MAINTENANT)).toEqual([]);
  });

  it("1re mission à venir : pas d'alerte, mais une 2e mission attend l'observation", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1", debut: "2026-12-01", fin: "2026-12-02" })],
    });
    expect(etatObservation(f, MAINTENANT).alerte).toBeNull();
    expect(manquesSuiviQualite(f, { sessionId: "s2" }, MAINTENANT)).toContain(
      MANQUES_SUIVI_QUALITE.observation,
    );
  });

  it("une mission annulée n'est pas une 1re mission", () => {
    const f = faits({ missions: [mission({ sessionId: "s1", annulee: true })] });
    expect(etatObservation(f, MAINTENANT).premiere).toBeNull();
  });

  it("observation favorable (≥ seuil) : habilitation confirmée, plus de refus", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1" })],
      observations: [{ sessionId: "s1", favorable: true, creeLe: MAINTENANT }],
    });
    expect(etatObservation(f, MAINTENANT)).toMatchObject({ confirmee: true, alerte: null });
    expect(manquesSuiviQualite(f, { sessionId: "s2" }, MAINTENANT)).toEqual([]);
  });

  it("observation défavorable : alerte « insuffisante » et refus maintenu", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1" })],
      observations: [{ sessionId: "s1", favorable: false, creeLe: MAINTENANT }],
    });
    expect(etatObservation(f, MAINTENANT).alerte).toBe("insuffisante");
    expect(manquesSuiviQualite(f, { sessionId: "s2" }, MAINTENANT)).toContain(
      MANQUES_SUIVI_QUALITE.observationInsuffisante,
    );
  });

  it("la DERNIÈRE observation saisie fait foi (une nouvelle grille s'ajoute)", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1" })],
      observations: [
        { sessionId: "s1", favorable: false, creeLe: new Date("2026-11-10T00:00:00Z") },
        { sessionId: "s1", favorable: true, creeLe: new Date("2026-11-15T00:00:00Z") },
      ],
    });
    expect(etatObservation(f, MAINTENANT).confirmee).toBe(true);
  });

  it("un salarié ou un dirigeant n'est jamais concerné", () => {
    const f = faits({ externe: false, missions: [mission({ sessionId: "s1" })] });
    expect(etatObservation(f, MAINTENANT).alerte).toBeNull();
    expect(manquesSuiviQualite(f, { sessionId: "s2" }, MAINTENANT)).toEqual([]);
  });
});

describe("évaluation après chaque mission", () => {
  it("rien avant J+3, relance de J+3 à J+6, alerte à partir de J+7", () => {
    const fin = "2026-11-10";
    const a = (iso: string) => etatEvaluationMission(fin, false, new Date(iso));
    expect(a("2026-11-12T10:00:00Z")).toBeNull();
    expect(a("2026-11-13T10:00:00Z")).toBe("relance");
    expect(a("2026-11-16T10:00:00Z")).toBe("relance");
    expect(a("2026-11-17T10:00:00Z")).toBe("alerte");
  });

  it("une grille saisie éteint relance et alerte", () => {
    expect(etatEvaluationMission("2026-11-01", true, MAINTENANT)).toBeNull();
  });

  it("les délais viennent des réglages", () => {
    expect(R.evaluationRelanceJours).toBe(3);
    expect(R.evaluationAlerteJours).toBe(7);
  });
});

describe("satisfaction des stagiaires", () => {
  it("la donnée existante (questionnaires) prime sur la saisie", () => {
    expect(satisfactionDeLaMission([5, 4, 3], 1)).toBe(4);
    expect(satisfactionDeLaMission([], 2)).toBe(2);
    expect(satisfactionDeLaMission([], null)).toBeNull();
  });

  it("< 4 : entretien à prévoir ; < 3 : suspension ; sinon rien", () => {
    expect(niveauSatisfaction(4)).toBe("ok");
    expect(niveauSatisfaction(3.9)).toBe("entretien");
    expect(niveauSatisfaction(3)).toBe("entretien");
    expect(niveauSatisfaction(2.99)).toBe("suspension");
    expect(niveauSatisfaction(null)).toBe("ok");
  });

  it("satisfaction < 3 : les NOUVELLES missions sont suspendues jusqu'à une décision motivée", () => {
    const m = mission({ sessionId: "s1", satisfaction: 2.5 });
    const obs = [{ sessionId: "s1", favorable: true, creeLe: MAINTENANT }];
    const suspendu = faits({ missions: [m], observations: obs });
    expect(manquesSuiviQualite(suspendu, { sessionId: "s2" }, MAINTENANT)).toContain(
      MANQUES_SUIVI_QUALITE.suspension,
    );
    const leve = faits({
      missions: [m],
      observations: obs,
      decisions: [{ sessionId: "s1", type: "levee_suspension", creeLe: MAINTENANT }],
    });
    expect(manquesSuiviQualite(leve, { sessionId: "s2" }, MAINTENANT)).toEqual([]);
  });

  it("un simple entretien ne lève pas une suspension", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1", satisfaction: 2 })],
      observations: [{ sessionId: "s1", favorable: true, creeLe: MAINTENANT }],
      decisions: [{ sessionId: "s1", type: "entretien", creeLe: MAINTENANT }],
    });
    expect(manquesSuiviQualite(f, { sessionId: "s2" }, MAINTENANT)).toContain(
      MANQUES_SUIVI_QUALITE.suspension,
    );
  });
});

describe("suspension : décisions de Will du 17/10/2026", () => {
  const obs = [{ sessionId: "s1", favorable: true, creeLe: MAINTENANT }];
  const suspendu = (f: FaitsSuiviQualite) =>
    manquesSuiviQualite(f, { sessionId: "s2" }, MAINTENANT).includes(
      MANQUES_SUIVI_QUALITE.suspension,
    );

  it("note 2,5 puis corrigée à 4,5 : la suspension est maintenue", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1", satisfaction: 4.5, satisfactionMin: 2.5 })],
      observations: obs,
    });
    expect(suspendu(f)).toBe(true);
    expect(missionsAReprendre(f).suspension).toHaveLength(1);
  });

  it("puis levee_suspension : levée, quelles que soient les notes", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1", satisfaction: 4.5, satisfactionMin: 2.5 })],
      observations: obs,
      decisions: [{ sessionId: "s1", type: "levee_suspension", creeLe: MAINTENANT }],
    });
    expect(suspendu(f)).toBe(false);
  });

  it("questionnaires sous le seuil puis remontés : maintenue", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1", satisfaction: 4, satisfactionMin: 2.4 })],
      observations: obs,
    });
    expect(suspendu(f)).toBe(true);
  });

  it("mission notée 2,5 puis annulée : la suspension est maintenue", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1", annulee: true, satisfaction: 2.5 })],
      observations: obs,
    });
    expect(suspendu(f)).toBe(true);
  });

  it("mission annulée : pas 1re mission, pas de relance de grille, pas d'entretien", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1", annulee: true, satisfaction: 3.5 })],
    });
    expect(etatObservation(f, MAINTENANT).premiere).toBeNull();
    expect(missionsSuivies(f)).toEqual([]);
    expect(missionsAReprendre(f).entretien).toEqual([]);
    expect(suspendu(f)).toBe(false);
  });

  it("annulée avec levee_suspension : levée", () => {
    const f = faits({
      missions: [mission({ sessionId: "s1", annulee: true, satisfaction: 2.5 })],
      decisions: [{ sessionId: "s1", type: "levee_suspension", creeLe: MAINTENANT }],
    });
    expect(suspendu(f)).toBe(false);
  });
});

describe("réévaluation annuelle", () => {
  it("échéance = décision + 12 mois, jamais avant allumage + délai de grâce", () => {
    expect(echeanceReevaluation(new Date("2026-03-15T00:00:00Z"), "2026-01-01")).toBe("2027-03-15");
    // Habilité il y a deux ans : reporté à l'allumage + 30 jours, pas bloqué le jour même.
    expect(echeanceReevaluation(new Date("2024-06-01T00:00:00Z"), "2026-11-01")).toBe("2026-12-01");
  });

  it("rappel à J-30, échue à l'échéance ; une réévaluation saisie repart pour 12 mois", () => {
    const base = faits({ dateDecisionHabilitation: new Date("2025-12-10T00:00:00Z") });
    // échéance 2026-12-10 → J-30 = 2026-11-10
    expect(etatReevaluation(base, MAINTENANT)).toMatchObject({
      echeance: "2026-12-10",
      etat: "rappel",
    });
    expect(etatReevaluation(base, new Date("2026-12-10T08:00:00Z")).etat).toBe("echue");
    expect(
      manquesSuiviQualite(base, { sessionId: "s2" }, new Date("2026-12-10T08:00:00Z")),
    ).toContain(MANQUES_SUIVI_QUALITE.reevaluation);
    const refaite = faits({
      dateDecisionHabilitation: new Date("2025-12-10T00:00:00Z"),
      reevaluations: [{ creeLe: new Date("2026-11-18T00:00:00Z"), favorable: true }],
    });
    expect(etatReevaluation(refaite, new Date("2026-12-10T08:00:00Z"))).toMatchObject({
      echeance: "2027-11-18",
      etat: "a_jour",
    });
  });

  it("une réévaluation défavorable ne repousse pas l'échéance", () => {
    const f = faits({
      dateDecisionHabilitation: new Date("2025-12-10T00:00:00Z"),
      reevaluations: [{ creeLe: new Date("2026-11-18T00:00:00Z"), favorable: false }],
    });
    expect(etatReevaluation(f, new Date("2026-12-10T08:00:00Z")).etat).toBe("echue");
  });

  it("sans décision d'habilitation lisible : rien à réévaluer (les autres gardes jouent)", () => {
    expect(etatReevaluation(faits(), MAINTENANT).etat).toBe("sans_objet");
  });
});

describe("CV déclaré de plus de 24 mois (#1551)", () => {
  it("au-delà de 24 mois : périmé ; dans les 24 mois ou non déclaré : non", () => {
    expect(cvDeclarePerime(new Date("2024-10-01T00:00:00Z"), MAINTENANT)).toBe(true);
    expect(cvDeclarePerime(new Date("2025-01-01T00:00:00Z"), MAINTENANT)).toBe(false);
    expect(cvDeclarePerime(null, MAINTENANT)).toBe(false);
  });
});
