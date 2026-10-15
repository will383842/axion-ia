/**
 * Vérification 2, équipe A (argent) — le CUMUL du seuil URSSAF de 5 000 € HT, sans écran.
 *
 * La règle (lot G1, décision du 12/10) : le cumul des honoraires HT FACTURÉS du formateur
 * (validés, facture reçue, payés — la mission en cours de paiement comprise), avoirs
 * déduits UNE fois, compte aussi la mission EN JEU à la proposition ; seuil 5 000 €,
 * approche 4 000 €, bornes incluses — les mêmes nombres que les apporteurs, dont la règle
 * ne doit pas bouger.
 *
 * Chaque attendu est recalculé ici à la main (centimes entiers), jamais relu dans le code.
 */

import { describe, expect, it } from "vitest";

import { etatVigilance } from "@/features/apporteurs-reseau/regles";
import { APPROCHE_VIGILANCE_CENTS, SEUIL_VIGILANCE_CENTS } from "@/lib/vigilance";
import {
  cumulDesReleves,
  phaseVigilanceFormateur,
  vigilanceExigible,
  vigilanceExigiblePourMission,
} from "@/server/qualiopi/formateurs-independants/vigilance-seuil";

describe("V2-A — cumul des honoraires : chaque somme une fois", () => {
  it("seuls les relevés facturés comptent (valide, facture reçue, payé)", () => {
    expect(
      cumulDesReleves([
        { statut: "brouillon", totalHtCents: 10_000 },
        { statut: "a_valider", totalHtCents: 20_000 },
        { statut: "annule", totalHtCents: 40_000 },
        { statut: "valide", totalHtCents: 1_000 },
        { statut: "facture_recue", totalHtCents: 2_000 },
        { statut: "paye", totalHtCents: 4_000 },
      ]),
    ).toBe(7_000);
  });

  it("avoir TOTAL d'une pièce non payée : ni la pièce (annulée) ni l'avoir — jamais déduit deux fois", () => {
    // Pièce de 700 € annulée par son avoir (−700 €), puis réémise à 650 € et facturée.
    expect(
      cumulDesReleves([
        { statut: "annule", totalHtCents: 70_000 },
        { statut: "valide", totalHtCents: -70_000, avoirDe: { statut: "annule" } },
        { statut: "facture_recue", totalHtCents: 65_000 },
      ]),
    ).toBe(65_000);
  });

  it("avoir PARTIEL d'une pièce payée, puis trop-perçu imputé sur le relevé suivant : 1 200 €", () => {
    // 700 € payés, 200 € de trop (avoir partiel), puis un relevé de 700 € qui impute les
    // 200 € (il porte 500 €). Honoraires réels : 700 − 200 + 700 = 1 200 €.
    expect(
      cumulDesReleves([
        { statut: "paye", totalHtCents: 70_000 },
        { statut: "valide", totalHtCents: -20_000, avoirDe: { statut: "paye" } },
        {
          statut: "facture_recue",
          totalHtCents: 50_000,
          imputations: [{ montantHtCents: -20_000 }],
        },
      ]),
    ).toBe(120_000);
  });

  it("un avoir partiel OUBLIÉ n'existe pas : il est déduit dès qu'il est validé", () => {
    expect(
      cumulDesReleves([
        { statut: "paye", totalHtCents: 500_000 },
        { statut: "valide", totalHtCents: -1, avoirDe: { statut: "paye" } },
      ]),
    ).toBe(499_999);
  });
});

describe("V2-A — le seuil compte la mission en cours", () => {
  it("4 400 € facturés + une mission de 700 € : l'attestation est exigée AVANT la mission", () => {
    expect(vigilanceExigible(440_000)).toBe(false);
    expect(vigilanceExigiblePourMission(440_000, 70_000)).toBe(true);
  });

  it("bornes incluses : 4 999,99 € non ; 5 000,00 € oui ; approche à 4 000,00 €", () => {
    expect(vigilanceExigiblePourMission(430_000, 69_999)).toBe(false);
    expect(vigilanceExigiblePourMission(430_000, 70_000)).toBe(true);
    expect(phaseVigilanceFormateur(399_999)).toBe("sous_le_seuil");
    expect(phaseVigilanceFormateur(400_000)).toBe("approche");
    expect(phaseVigilanceFormateur(500_000)).toBe("seuil_atteint");
  });

  it("garde fermée : un cumul ou une mission illisible exige l'attestation ; un négatif ne baisse rien", () => {
    expect(vigilanceExigible(null)).toBe(true);
    expect(vigilanceExigible(Number.NaN)).toBe(true);
    expect(vigilanceExigiblePourMission(100_000, null)).toBe(true);
    expect(vigilanceExigiblePourMission(499_000, -900_000)).toBe(false);
    expect(vigilanceExigiblePourMission(500_000, -900_000)).toBe(true);
  });
});

describe("V2-A — apporteurs inchangés", () => {
  it("les mêmes nombres : 5 000 € et 4 000 €", () => {
    expect(SEUIL_VIGILANCE_CENTS).toBe(500_000);
    expect(APPROCHE_VIGILANCE_CENTS).toBe(400_000);
  });

  it("la règle des apporteurs rend ce qu'elle rendait (demander à l'approche, attendre au seuil)", () => {
    expect(
      etatVigilance({ cumulCents: 300_000, nouvelleCents: 99_999, piecesValides: false }),
    ).toEqual({
      demander: false,
      attendre: false,
    });
    expect(
      etatVigilance({ cumulCents: 300_000, nouvelleCents: 100_000, piecesValides: false }),
    ).toEqual({
      demander: true,
      attendre: false,
    });
    expect(
      etatVigilance({ cumulCents: 450_000, nouvelleCents: 50_000, piecesValides: false }),
    ).toEqual({
      demander: true,
      attendre: true,
    });
    expect(
      etatVigilance({ cumulCents: 900_000, nouvelleCents: 50_000, piecesValides: true }),
    ).toEqual({
      demander: false,
      attendre: false,
    });
  });
});
