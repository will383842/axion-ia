/**
 * Piège de `R = DEFAUTS` : un paramètre par défaut fait COMPILER l'appel qui oublie les
 * réglages et applique les défauts en silence. Ce fichier prouve qu'un réglage modifié
 * donne le MÊME verdict à la garde, à l'alerte, à la console et au service, et qu'aucun
 * appel de production n'omet `R`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REGLAGES_SUIVI_QUALITE as D, type ReglagesSuiviQualite } from "../reglages";
import {
  MANQUES_SUIVI_QUALITE,
  etatObservation,
  etatReevaluation,
  manquesSuiviQualite,
  missionsAReprendre,
  validerGrille,
  type FaitsSuiviQualite,
  type MissionLue,
} from "../regles";

const MAINTENANT = new Date("2026-11-20T10:00:00Z");
const mission = (p: Partial<MissionLue> & { sessionId: string }): MissionLue => ({
  debut: "2026-11-05",
  fin: "2026-11-06",
  annulee: false,
  satisfaction: null,
  ...p,
});
const faits = (p: Partial<FaitsSuiviQualite> = {}): FaitsSuiviQualite => ({
  externe: true,
  allumeLe: "2026-11-01",
  missions: [],
  observations: [],
  evaluations: [],
  decisions: [],
  dateDecisionHabilitation: null,
  reevaluations: [],
  ...p,
});
const reglage = (o: Partial<ReglagesSuiviQualite>): ReglagesSuiviQualite => ({ ...D, ...o });
const obs = [{ sessionId: "s1", favorable: true, creeLe: MAINTENANT }];

describe("un réglage modifié change le verdict partout", () => {
  const f = faits({
    missions: [mission({ sessionId: "s1", satisfaction: 2.5 })],
    observations: obs,
  });
  const suspendu = (R: ReglagesSuiviQualite) =>
    manquesSuiviQualite(f, { sessionId: "s2" }, MAINTENANT, R).includes(
      MANQUES_SUIVI_QUALITE.suspension,
    );

  it("satisfaction 2,5 : suspendue au défaut (3), plus suspendue si le seuil est réglé à 2", () => {
    const R = reglage({ satisfactionSuspensionSous: 2 });
    expect(suspendu(D)).toBe(true);
    expect(missionsAReprendre(f, D).suspension).toHaveLength(1);
    // garde de mission, reprise à décider (console, service, alerte) : même verdict.
    expect(suspendu(R)).toBe(false);
    expect(missionsAReprendre(f, R).suspension).toHaveLength(0);
    expect(missionsAReprendre(f, R).entretien).toHaveLength(1);
  });

  it("la note corrigée (plancher) se juge aussi avec le réglage", () => {
    const corrigee = faits({
      missions: [mission({ sessionId: "s1", satisfaction: 4.5, satisfactionMin: 2.5 })],
      observations: obs,
    });
    expect(missionsAReprendre(corrigee, D).suspension).toHaveLength(1);
    expect(
      missionsAReprendre(corrigee, reglage({ satisfactionSuspensionSous: 2 })).suspension,
    ).toHaveLength(0);
  });
});

describe("verdicts réglés (bonus)", () => {
  it("reevaluation_moyenne_min : moyenne 4 favorable au défaut, défavorable à 4,5", () => {
    const saisie = {
      notes: { competences: 4, resultats: 4, veille: 4, engagements: 4 },
      conclusion: "Année solide, engagements tenus.",
      date: MAINTENANT,
      maintenant: MAINTENANT,
    };
    const v = (R: ReglagesSuiviQualite) => {
      const r = validerGrille("reevaluation", saisie, R);
      return r.ok && r.favorable;
    };
    expect(v(D)).toBe(true);
    expect(v(reglage({ reevaluationMoyenneMin: 4.5 }))).toBe(false);
  });

  it("observation_alerte_jours : alerte « manquante » décalée par le réglage", () => {
    const f = faits({ missions: [mission({ sessionId: "s1" })] });
    expect(etatObservation(f, MAINTENANT, D).alerte).toBe("manquante");
    expect(
      etatObservation(f, MAINTENANT, reglage({ observationAlerteJours: 30 })).alerte,
    ).toBeNull();
  });

  it("rappel_jours et grace_allumage_jours : l'état de la réévaluation suit les réglages", () => {
    const f = faits({
      allumeLe: "2026-11-01",
      dateDecisionHabilitation: new Date("2025-12-01T00:00:00Z"),
    });
    const at = (R: ReglagesSuiviQualite) => etatReevaluation(f, MAINTENANT, R).etat;
    // échéance 2026-12-01 : à 11 jours, le rappel (30 j) est dû ; réglé à 5 j, il ne l'est pas.
    expect(at(D)).not.toBe(at(reglage({ reevaluationRappelJours: 5 })));
    // échéance reportée par la grâce à l'allumage : 2026-11-01 + 0 j = 2026-11-01 déjà échue.
    expect(at(reglage({ reevaluationGraceAllumageJours: 0, reevaluationMois: 1 }))).not.toBe(
      at(reglage({ reevaluationGraceAllumageJours: 180, reevaluationMois: 1 })),
    );
  });
});

describe("aucun appel de production sans R", () => {
  const dossier = join(__dirname, "..");
  const sources = readdirSync(dossier)
    .filter((n) => n.endsWith(".ts") && n !== "regles.ts")
    .map((n) => [n, readFileSync(join(dossier, n), "utf8")] as const);
  const alertes = readFileSync(
    join(dossier, "../../alertes/regle-suivi-qualite-formateurs.ts"),
    "utf8",
  );

  /** Arguments d'un appel, parenthèses équilibrées. */
  const arguments_ = (src: string, ouverture: number): string => {
    let profondeur = 0;
    for (let i = ouverture; i < src.length; i++) {
      if (src[i] === "(") profondeur++;
      if (src[i] === ")" && --profondeur === 0) return src.slice(ouverture + 1, i);
    }
    return "";
  };

  it("niveauSatisfaction( et missionsAReprendre( reçoivent les réglages (console, service, alertes)", () => {
    let appels = 0;
    for (const [nom, src] of [...sources, ["alertes", alertes] as const]) {
      for (const m of src.matchAll(/\b(?:niveauSatisfaction|missionsAReprendre)\(/g)) {
        const avant = src.slice(Math.max(0, m.index - 10), m.index);
        if (/function\s*$|import\s*\{[^}]*$/.test(avant)) continue;
        appels++;
        expect(arguments_(src, m.index + m[0].length - 1), `${nom}: ${m[0]}`).toMatch(
          /,\s*(R|reglages)\s*$/,
        );
      }
    }
    expect(appels).toBeGreaterThanOrEqual(5); // console : plus de missionsAReprendre (annulées via missionsSuspensives)
  });
});
