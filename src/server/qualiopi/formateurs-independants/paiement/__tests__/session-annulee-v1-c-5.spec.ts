// @vitest-environment node

/**
 * Vérification 1, défaut V1-C-5 — les journées d'une session ANNULÉE ne sont plus
 * comptées comme prévues, et les demi-journées déjà SIGNÉES sont payées.
 *
 * Exemple (E-C3) : lundi et mardi, 9 h – 17 h, 350 €/jour. Le lundi matin est signé,
 * puis la session est annulée. Avant : le mois restait « feuilles incomplètes » pour
 * toujours (3 demi-journées « manquantes ») et F35 réclamait des feuilles impossibles.
 * Après : le matin signé est payé, 1 × 175 € = 17 500 c HT, et rien n'est réclamé.
 *
 * Contre-calcul indépendant : montant d'une demi-journée = tarif journée ÷ 2, en
 * centimes entiers ; aucune fonction de calcul du code n'est réutilisée ici.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { feuillesManquantes } from "../feuilles-manquantes";
import { planifierPassage, type CandidatMission } from "../passage-mission";

const TARIF_JOURNEE_HT = 35_000;
const DEMI_JOURNEE_HT = TARIF_JOURNEE_HT / 2; // 17 500 c

const LUNDI = "2038-03-15";
const MARDI = "2038-03-16";
const BASCULE = "2037-01-01";

function candidat(over: Partial<CandidatMission> = {}): CandidatMission {
  return {
    trainerId: "t1",
    sessionId: "s1",
    premiereJournee: LUNDI,
    conditions: {
      tarifJourneeHtCents: TARIF_JOURNEE_HT,
      forfaitDeplacementParJourHtCents: null,
      regimeTva: "franchise_293b",
    },
    contresignatures: [{ jour: LUNDI, demiJournee: "matin" }],
    journeesPrevues: [
      { jour: LUNDI, heureDebut: "09:00", heureFin: "17:00" },
      { jour: MARDI, heureDebut: "09:00", heureFin: "17:00" },
    ],
    conditionFinanceurEnAttente: false,
    ...over,
  };
}

describe("V1-C-5 — session annulée : on paie ce qui est signé, on ne réclame plus le reste", () => {
  it("témoin : session NON annulée, le mois attend ses 3 demi-journées manquantes", () => {
    const p = planifierPassage([candidat()], BASCULE, undefined, "2038-03-20");
    expect(p.aEcrire).toEqual([]);
    expect(p.enAttente).toEqual([
      {
        trainerId: "t1",
        sessionId: "s1",
        mois: "2038-03",
        raison: "feuilles_incompletes",
        manquantes: 3,
      },
    ]);
  });

  it("session annulée : le matin signé est écrit, 17 500 c HT, une seule ligne d'animation", () => {
    const p = planifierPassage(
      [candidat({ sessionAnnulee: true })],
      BASCULE,
      undefined,
      "2038-03-20",
    );
    expect(p.enAttente).toEqual([]);
    expect(p.anomalies).toEqual([]);
    expect(p.aEcrire).toHaveLength(1);
    const m = p.aEcrire[0]!;
    expect(m.releve.mois).toBe("2038-03");
    expect(m.releve.totalHtCents).toBe(1 * DEMI_JOURNEE_HT);
    // Franchise 293 B : aucune TVA, TTC = HT.
    expect(m.releve.tvaCents).toBe(0);
    expect(m.releve.totalTtcCents).toBe(17_500);
    expect(m.releve.lignes.filter((l) => l.objet === "animation")).toEqual([
      expect.objectContaining({ demiJournees: 1, montantHtCents: 17_500 }),
    ]);
  });

  it("session annulée sans aucune signature : rien n'est écrit, rien n'est en attente", () => {
    const p = planifierPassage(
      [candidat({ sessionAnnulee: true, contresignatures: [] })],
      BASCULE,
      undefined,
      "2038-03-20",
    );
    expect(p).toEqual({ aEcrire: [], enAttente: [], anomalies: [] });
  });

  it("session annulée sur deux mois : un mois sans signature n'est plus « en attente »", () => {
    const p = planifierPassage(
      [
        candidat({
          sessionAnnulee: true,
          journeesPrevues: [
            { jour: "2038-03-30", heureDebut: "09:00", heureFin: "17:00" },
            { jour: "2038-04-02", heureDebut: "09:00", heureFin: "17:00" },
          ],
          premiereJournee: "2038-03-30",
          contresignatures: [{ jour: "2038-03-30", demiJournee: "journee" }],
        }),
      ],
      BASCULE,
      undefined,
      "2038-04-20",
    );
    expect(p.enAttente).toEqual([]);
    expect(p.aEcrire.map((m) => [m.releve.mois, m.releve.totalHtCents])).toEqual([
      ["2038-03", 2 * DEMI_JOURNEE_HT],
    ]);
  });

  it("session annulée : le bilan de fin de formation n'est plus attendu (aucun bilan n'aura lieu)", () => {
    const p = planifierPassage(
      [
        candidat({
          sessionAnnulee: true,
          bilanFinFormation: { termine: false, payerQuandMeme: false },
        }),
      ],
      BASCULE,
      undefined,
      "2038-03-20",
    );
    expect(p.enAttente).toEqual([]);
    expect(p.aEcrire.map((m) => m.releve.totalHtCents)).toEqual([17_500]);
  });

  it("F35 : aucune feuille manquante n'est réclamée pour les journées annulées", () => {
    expect(feuillesManquantes([candidat()], "2038-03-20")).toHaveLength(1);
    expect(feuillesManquantes([candidat({ sessionAnnulee: true })], "2038-03-20")).toEqual([]);
  });
});
