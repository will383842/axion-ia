/**
 * Indicateur 32 (grille du 1er novembre 2026) — l'analyse des risques cotée,
 * datée risque par risque, et exportée.
 *
 * Ce que ces tests tiennent :
 *   - cotation gravité 1-4 × probabilité 1-4 = criticité, « non coté » sinon ;
 *   - la date d'un risque est celle de SA saisie, posée par le serveur : un
 *     risque inchangé garde son objet d'origine (et son absence de date), un
 *     risque nouveau ou modifié reçoit la date du jour, la date envoyée par le
 *     navigateur est ignorée ;
 *   - les dix risques saisis le 30/09 (intitulé + mesure, ni cote ni date)
 *     traversent un enregistrement SANS être réécrits ;
 *   - la phrase du Mode auditeur : « N risques analysés, dont N cotés, mis à
 *     jour le … » ;
 *
 * L'export PDF (l'analyse, risque par risque, dans le registre de la revue et
 * donc dans le ZIP d'audit) est tenu par `registres/registres-pdf.spec.ts`.
 */

import { describe, it, expect } from "vitest";

import {
  criticite,
  horodaterRisques,
  libelleCriticite,
  niveauCriticite,
  normaliserRisques,
  phraseAnalyseRisques,
  resumerAnalyseRisques,
} from "./analyse-risques";
import { evaluerCouvertureOff32 } from "./plan-actions";

/** La forme des dix risques saisis le 30/09/2026 : intitulé + mesure, rien d'autre. */
const RISQUES_DU_30_09 = [
  { intitule: "Dépendance à un formateur unique", maitrise: "Vivier de sous-traitants" },
  { intitule: "Panne de la chaîne d'e-mails", maitrise: "Surveillance et relance manuelle" },
  {
    intitule: "Besoin d'adaptation déclaré tardivement",
    maitrise: "Question posée au positionnement",
  },
];

const SAISIE = new Date("2026-10-15T08:30:00.000Z");

describe("cotation", () => {
  it("criticité = gravité × probabilité, et son niveau", () => {
    expect(criticite({ gravite: 3, probabilite: 3 })).toBe(9);
    expect(niveauCriticite(2)).toBe("faible");
    expect(niveauCriticite(6)).toBe("modérée");
    expect(niveauCriticite(9)).toBe("élevée");
    expect(niveauCriticite(16)).toBe("critique");
    expect(libelleCriticite({ gravite: 4, probabilite: 3 })).toBe("12 (critique)");
  });

  it("une cote manquante ou hors 1-4 donne « non coté »", () => {
    expect(criticite({ gravite: 3, probabilite: null })).toBeNull();
    const [r] = normaliserRisques([{ intitule: "x", gravite: "élevée", probabilite: 7 }]);
    expect(r?.gravite).toBeNull();
    expect(r?.probabilite).toBeNull();
    expect(libelleCriticite(r!)).toBe("non coté");
  });

  it("une cote écrite en chaîne (« 3 ») est lue", () => {
    const [r] = normaliserRisques([{ intitule: "x", gravite: "3", probabilite: "2" }]);
    expect(criticite(r!)).toBe(6);
  });
});

describe("datation — la date réelle de la saisie, jamais celle de la revue", () => {
  it("les dix risques du 30/09 traversent un enregistrement SANS être réécrits", () => {
    // L'écran renvoie ce qu'il a lu (contenu inchangé, sans date) : le serveur
    // doit rendre les objets stockés, et ne leur attribuer AUCUNE date.
    const renvoyes = RISQUES_DU_30_09.map((r) => ({
      ...r,
      cause: "",
      gravite: null,
      probabilite: null,
      responsable: "",
      echeance: null,
    }));
    const ecrits = horodaterRisques(renvoyes, RISQUES_DU_30_09, SAISIE);
    expect(ecrits).toEqual(RISQUES_DU_30_09);
    for (let i = 0; i < ecrits.length; i++) {
      // Même objet : rien n'a été recopié, donc rien n'a pu être altéré.
      expect(ecrits[i]).toBe(RISQUES_DU_30_09[i]);
    }
  });

  it("un risque coté par le dirigeant reçoit la date du jour de la cotation", () => {
    const cote = { ...RISQUES_DU_30_09[0], gravite: 3, probabilite: 2, responsable: "W. Jullin" };
    const [ecrit, inchange] = horodaterRisques(
      [cote, RISQUES_DU_30_09[1]],
      RISQUES_DU_30_09,
      SAISIE,
    ) as Record<string, unknown>[];
    expect(ecrit).toMatchObject({ gravite: 3, probabilite: 2, misAJourLe: SAISIE.toISOString() });
    expect(inchange).toBe(RISQUES_DU_30_09[1]);
    expect(inchange).not.toHaveProperty("misAJourLe");
  });

  it("un risque déjà daté et inchangé garde SA date", () => {
    const stocke = {
      intitule: "x",
      maitrise: "y",
      gravite: 2,
      misAJourLe: "2026-10-03T09:00:00.000Z",
    };
    const [ecrit] = horodaterRisques(
      [{ intitule: "x", maitrise: "y", gravite: 2 }],
      [stocke],
      SAISIE,
    );
    expect(ecrit).toBe(stocke);
  });

  it("la date envoyée par le navigateur est ignorée", () => {
    const [ecrit] = horodaterRisques(
      [{ intitule: "nouveau", maitrise: "m", misAJourLe: "2026-08-03T00:00:00.000Z" }],
      [],
      SAISIE,
    ) as Record<string, unknown>[];
    expect(ecrit?.["misAJourLe"]).toBe(SAISIE.toISOString());
  });

  it("une ligne sans intitulé n'est pas un risque : elle n'est pas écrite", () => {
    expect(horodaterRisques([{ intitule: "  ", maitrise: "m" }, null, 3], [], SAISIE)).toEqual([]);
  });
});

describe("indicateur 32 — « N risques analysés, dont N cotés, mis à jour le … »", () => {
  it("les dix risques du 30/09 : analysés, aucun coté, non datés — et c'est dit", () => {
    const phrase = phraseAnalyseRisques(resumerAnalyseRisques(RISQUES_DU_30_09));
    expect(phrase).toBe(
      "3 risques analysés, dont 0 coté (gravité × probabilité), date de mise à jour non renseignée (risques saisis avant la datation par risque)",
    );
  });

  it("après cotation partielle : la date la plus récente, et le reste non daté", () => {
    const risques = [
      {
        ...RISQUES_DU_30_09[0],
        gravite: 3,
        probabilite: 2,
        misAJourLe: "2026-10-15T08:30:00.000Z",
      },
      {
        ...RISQUES_DU_30_09[1],
        gravite: 2,
        probabilite: 2,
        misAJourLe: "2026-10-20T08:30:00.000Z",
      },
      RISQUES_DU_30_09[2],
    ];
    expect(phraseAnalyseRisques(resumerAnalyseRisques(risques))).toBe(
      "3 risques analysés, dont 2 cotés (gravité × probabilité), mis à jour le 20/10/2026 (1 risque non daté)",
    );
  });

  it("la matrice le lit, et signale les risques non cotés sans faire rougir", () => {
    const revue = {
      annee: 2026,
      participants: ["Williams Jullin — Président"],
      decisions: [{ decision: "d" }],
      planActions: [{ action: "a", responsable: "W. Jullin", echeance: "2026-12-31" }],
      risques: RISQUES_DU_30_09,
    };
    const v = evaluerCouvertureOff32(revue, new Date("2026-11-15T09:00:00.000Z"), {
      exigeAnalyseRisques: true,
    });
    expect(v.couvert).toBe(true);
    expect(v.preuves.join(" ")).toContain("3 risques analysés, dont 0 coté");
    expect(v.preuves.join(" ")).toContain("3 risques sans cotation");
  });

  it("l'exigence suit l'option (la grille), pas seulement le calendrier", () => {
    const revue = {
      annee: 2026,
      participants: ["W. J."],
      decisions: ["d"],
      planActions: [{ action: "a", responsable: "W. J.", echeance: "2026-12-31" }],
      risques: [],
    };
    const avant = new Date("2026-10-15T09:00:00.000Z");
    expect(evaluerCouvertureOff32(revue, avant).couvert).toBe(true);
    expect(evaluerCouvertureOff32(revue, avant, { exigeAnalyseRisques: true }).couvert).toBe(false);
    const apres = new Date("2026-11-15T09:00:00.000Z");
    expect(evaluerCouvertureOff32(revue, apres, { exigeAnalyseRisques: false }).couvert).toBe(true);
  });
});
