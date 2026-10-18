// @vitest-environment node

/**
 * Qualiopi ind. 21 — les seuils et délais du suivi qualité sont des RÉGLAGES
 * (`/qualiopi/config`, clés `suivi_qualite_*`), comme ceux de l'ind. 27 :
 *   · défauts inchangés, exposés au registre avec la même valeur ;
 *   · une valeur réglée change le verdict des règles ;
 *   · absente, illisible, hors bornes, incohérente ou base en panne : le défaut.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ config: new Map<string, unknown>(), panne: false }));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async (k: string) => {
    if (h.panne) throw new Error("base injoignable");
    const { QUALIOPI_CONFIG_REGISTRY } = await import("@/server/qualiopi/config/registry");
    return h.config.has(k)
      ? h.config.get(k)
      : QUALIOPI_CONFIG_REGISTRY[k as keyof typeof QUALIOPI_CONFIG_REGISTRY].default;
  }),
}));

import { QUALIOPI_CONFIG_REGISTRY } from "@/server/qualiopi/config/registry";

import {
  BORNES_SUIVI_QUALITE,
  GRILLES_SUIVI_QUALITE,
  REGLAGES_SUIVI_QUALITE as D,
  reglagesSuiviQualite,
} from "../reglages";
import { CLES_SUIVI_QUALITE, lireReglagesSuiviQualite } from "../reglages-lecture";
import {
  cvDeclarePerime,
  etatEvaluationMission,
  manquesSuiviQualite,
  MANQUES_SUIVI_QUALITE,
  niveauSatisfaction,
  validerGrille,
  type FaitsSuiviQualite,
} from "../regles";

const MAINTENANT = new Date("2026-11-20T10:00:00Z");

beforeEach(() => {
  h.config.clear();
  h.panne = false;
});

describe("défauts et registre", () => {
  it("les défauts n'ont pas bougé (à valider par Will)", () => {
    expect(D).toEqual({
      observationMoyenneMin: 3.5,
      reevaluationMoyenneMin: 3.5,
      evaluationMoyenneMin: 3.5,
      observationAlerteJours: 0,
      evaluationRelanceJours: 3,
      evaluationAlerteJours: 7,
      satisfactionEntretienSous: 4,
      satisfactionSuspensionSous: 3,
      reevaluationMois: 12,
      reevaluationRappelJours: 30,
      reevaluationGraceAllumageJours: 30,
      cvDeclareMaxMois: 24,
      texteMinCaracteres: 10,
    });
  });

  it("chaque réglage a sa clé au registre, avec le défaut pour valeur et dans ses bornes", () => {
    for (const [nom, cle] of Object.entries(CLES_SUIVI_QUALITE) as Array<
      [keyof typeof D, keyof typeof QUALIOPI_CONFIG_REGISTRY]
    >) {
      expect(QUALIOPI_CONFIG_REGISTRY[cle].default, cle).toBe(D[nom]);
      const [min, max] = BORNES_SUIVI_QUALITE[nom];
      expect(D[nom] >= min && D[nom] <= max, nom).toBe(true);
    }
    expect(Object.keys(CLES_SUIVI_QUALITE).sort()).toEqual(Object.keys(D).sort());
  });
});

describe("reglagesSuiviQualite — bornes", () => {
  const tout = (over: Record<string, unknown>) => reglagesSuiviQualite({ ...D, ...over });

  it("illisible, hors bornes ou hors pas : le défaut de ce réglage", () => {
    expect(tout({ observationMoyenneMin: "x" })).toEqual(D);
    expect(tout({ observationMoyenneMin: 6 })).toEqual(D);
    expect(tout({ observationMoyenneMin: 3.333 })).toEqual(D);
    expect(tout({ reevaluationMois: 1.5 })).toEqual(D);
    expect(tout({ cvDeclareMaxMois: 0 })).toEqual(D);
    expect(tout({ texteMinCaracteres: Number.NaN })).toEqual(D);
    expect(reglagesSuiviQualite({} as never)).toEqual(D);
  });

  it("dans les bornes : la valeur réglée", () => {
    expect(tout({ observationMoyenneMin: 3.75, cvDeclareMaxMois: 18 })).toEqual({
      ...D,
      observationMoyenneMin: 3.75,
      cvDeclareMaxMois: 18,
    });
  });

  it("paire incohérente (relance après l'alerte, suspension au-dessus de l'entretien) : la paire revient aux défauts", () => {
    expect(tout({ evaluationRelanceJours: 10, evaluationAlerteJours: 5 })).toEqual(D);
    expect(tout({ evaluationAlerteJours: 2 })).toEqual(D);
    expect(tout({ satisfactionSuspensionSous: 4.5 })).toEqual(D);
    expect(tout({ satisfactionSuspensionSous: 2, satisfactionEntretienSous: 3 })).toEqual({
      ...D,
      satisfactionSuspensionSous: 2,
      satisfactionEntretienSous: 3,
    });
  });
});

describe("lireReglagesSuiviQualite", () => {
  it("absents : les défauts ; réglés : les valeurs réglées", async () => {
    expect(await lireReglagesSuiviQualite()).toEqual(D);
    h.config.set("suivi_qualite_satisfaction_suspension_sous", 2.5);
    h.config.set("suivi_qualite_reevaluation_mois", 6);
    expect(await lireReglagesSuiviQualite()).toEqual({
      ...D,
      satisfactionSuspensionSous: 2.5,
      reevaluationMois: 6,
    });
  });

  it("illisible : le défaut de CE réglage ; base en panne : tous les défauts", async () => {
    h.config.set("suivi_qualite_observation_moyenne_min", "trois");
    h.config.set("suivi_qualite_texte_min_caracteres", 20);
    expect(await lireReglagesSuiviQualite()).toEqual({ ...D, texteMinCaracteres: 20 });
    h.panne = true;
    expect(await lireReglagesSuiviQualite()).toEqual(D);
  });
});

describe("une valeur réglée change le verdict", () => {
  const notes = (n: number) =>
    Object.fromEntries(GRILLES_SUIVI_QUALITE.observation.criteres.map((c) => [c.code, n]));
  const saisie = {
    notes: notes(4),
    conclusion: "Observation menée sur la journée.",
    date: new Date("2026-11-19T10:00:00Z"),
    observateur: "Responsable qualité",
    maintenant: MAINTENANT,
  };

  it("observation à 4 : favorable au défaut, défavorable au seuil réglé à 4,5", () => {
    expect(validerGrille("observation", saisie)).toMatchObject({ ok: true, favorable: true });
    expect(
      validerGrille("observation", saisie, { ...D, observationMoyenneMin: 4.5 }),
    ).toMatchObject({ ok: true, favorable: false });
  });

  it("conclusion de 12 caractères : acceptée au défaut (10), refusée au réglage à 20", () => {
    const s = { ...saisie, conclusion: "Douze carac." };
    expect(validerGrille("observation", s).ok).toBe(true);
    expect(validerGrille("observation", s, { ...D, texteMinCaracteres: 20 })).toEqual({
      ok: false,
      erreur: "conclusion_trop_courte",
    });
  });

  it("satisfaction 2,5 : suspension au défaut, entretien avec une suspension réglée sous 2", () => {
    expect(niveauSatisfaction(2.5)).toBe("suspension");
    expect(niveauSatisfaction(2.5, { ...D, satisfactionSuspensionSous: 2 })).toBe("entretien");
  });

  it("grille après mission à J+2 : rien au défaut, relance réglée à J+1", () => {
    const now = new Date("2026-11-08T10:00:00Z");
    expect(etatEvaluationMission("2026-11-06", false, now)).toBeNull();
    expect(
      etatEvaluationMission("2026-11-06", false, now, { ...D, evaluationRelanceJours: 1 }),
    ).toBe("relance");
  });

  it("CV de 20 mois : à jour au défaut, périmé au réglage à 18 mois", () => {
    const cv = new Date("2025-03-01T00:00:00Z");
    expect(cvDeclarePerime(cv, MAINTENANT)).toBe(false);
    expect(cvDeclarePerime(cv, MAINTENANT, { ...D, cvDeclareMaxMois: 18 })).toBe(true);
  });

  it("garde de mission : la réévaluation réglée à 6 mois est échue, pas celle de 12", () => {
    const f: FaitsSuiviQualite = {
      externe: true,
      allumeLe: "2026-01-01",
      missions: [],
      observations: [],
      evaluations: [],
      decisions: [],
      dateDecisionHabilitation: new Date("2026-03-01T10:00:00Z"),
      reevaluations: [],
    };
    expect(manquesSuiviQualite(f, undefined, MAINTENANT)).toEqual([]);
    expect(manquesSuiviQualite(f, undefined, MAINTENANT, { ...D, reevaluationMois: 6 })).toEqual([
      MANQUES_SUIVI_QUALITE.reevaluation,
    ]);
  });
});
