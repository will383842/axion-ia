/**
 * Tests facture-libre — fonctions PURES (règle TVA par activité, lignes
 * d'avoir, statut d'encaissement). Le flux DB/PDF est couvert par le pattern
 * facturation-service (mêmes briques : numérotation retry, computeTotauxFacture,
 * generateDocument) — ici on verrouille la LOGIQUE MÉTIER propre au Hub.
 */

import { describe, it, expect } from "vitest";
import {
  normaliserLignesPourActivite,
  construireLignesAvoir,
  calculerStatutEncaissement,
  ACTIVITES_EXONERABLES,
} from "./facture-libre-pur";
import { computeTotauxFacture } from "@/server/qualiopi/legal/tva";
import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";

const LIGNES: LigneFacture[] = [
  { designation: "Audit flash", quantite: 1, prixUnitaireHtCents: 119_000 },
  { designation: "Atelier restitution", quantite: 2, prixUnitaireHtCents: 45_000 },
];

describe("normaliserLignesPourActivite", () => {
  it("régime assujetti → lignes inchangées (le taux standard s'applique au niveau facture)", () => {
    expect(normaliserLignesPourActivite(LIGNES, "audit", "assujetti", 20)).toEqual(LIGNES);
  });

  it("franchise 293 B → lignes inchangées (franchise = entité entière, 0 TVA)", () => {
    expect(normaliserLignesPourActivite(LIGNES, "site_web", "franchise_293b", 20)).toEqual(LIGNES);
  });

  it("exonération 261 + formation/un_a_un → lignes inchangées (dans le champ)", () => {
    for (const activite of ACTIVITES_EXONERABLES) {
      expect(normaliserLignesPourActivite(LIGNES, activite, "exoneration_261", 20)).toEqual(LIGNES);
    }
  });

  it("exonération 261 + activité HORS champ → taux standard forcé sur les lignes sans taux", () => {
    const result = normaliserLignesPourActivite(LIGNES, "audit", "exoneration_261", 20);
    expect(result.every((l) => l.tauxTvaPercent === 20)).toBe(true);
  });

  it("exonération 261 + activité hors champ → un taux explicite par ligne est respecté", () => {
    const mixte: LigneFacture[] = [
      { designation: "Conseil", quantite: 1, prixUnitaireHtCents: 100_000, tauxTvaPercent: 10 },
      { designation: "Dev", quantite: 1, prixUnitaireHtCents: 50_000 },
    ];
    const result = normaliserLignesPourActivite(mixte, "implementation", "exoneration_261", 20);
    expect(result[0]?.tauxTvaPercent).toBe(10);
    expect(result[1]?.tauxTvaPercent).toBe(20);
  });

  it("bout en bout : audit sous exonération 261 → la facture PORTE de la TVA", () => {
    const lignes = normaliserLignesPourActivite(LIGNES, "audit", "exoneration_261", 20);
    const totaux = computeTotauxFacture(lignes, "exoneration_261", 20);
    // 119000 + 2×45000 = 209000 HT → 41800 de TVA à 20 %.
    expect(totaux.totalHtCents).toBe(209_000);
    expect(totaux.totalTvaCents).toBe(41_800);
    expect(totaux.totalTtcCents).toBe(250_800);
  });
});

describe("construireLignesAvoir", () => {
  it("avoir total → négation intégrale, désignations préfixées, taux conservés", () => {
    const origine: LigneFacture[] = [
      {
        designation: "Site vitrine",
        quantite: 1,
        prixUnitaireHtCents: 500_000,
        tauxTvaPercent: 20,
      },
    ];
    const avoir = construireLignesAvoir(origine, undefined, "erreur");
    expect(avoir).toEqual([
      {
        designation: "Avoir — Site vitrine",
        quantite: 1,
        prixUnitaireHtCents: -500_000,
        tauxTvaPercent: 20,
      },
    ]);
  });

  it("avoir partiel → ligne unique négative au montant demandé, motif dans la désignation", () => {
    const avoir = construireLignesAvoir(LIGNES, 30_000, "remise commerciale", 20);
    expect(avoir).toHaveLength(1);
    expect(avoir[0]?.prixUnitaireHtCents).toBe(-30_000);
    expect(avoir[0]?.designation).toContain("remise commerciale");
    expect(avoir[0]?.tauxTvaPercent).toBe(20);
  });

  it("avoir partiel : un montant négatif fourni est normalisé (toujours négatif en sortie)", () => {
    const avoir = construireLignesAvoir(LIGNES, -30_000 as number, "trop-perçu");
    expect(avoir[0]?.prixUnitaireHtCents).toBe(-30_000);
  });

  it("bout en bout : totaux d'un avoir total = négatifs exacts de l'origine", () => {
    const lignes = LIGNES.map((l) => ({ ...l, tauxTvaPercent: 20 }));
    const totauxOrigine = computeTotauxFacture(lignes, "assujetti", 20);
    const totauxAvoir = computeTotauxFacture(
      construireLignesAvoir(lignes, undefined, "annulation"),
      "assujetti",
      20,
    );
    expect(totauxAvoir.totalHtCents).toBe(-totauxOrigine.totalHtCents);
    expect(totauxAvoir.totalTvaCents).toBe(-totauxOrigine.totalTvaCents);
    expect(totauxAvoir.totalTtcCents).toBe(-totauxOrigine.totalTtcCents);
  });
});

describe("calculerStatutEncaissement", () => {
  it("rien encaissé → emise", () => {
    expect(calculerStatutEncaissement(100_000, 0)).toBe("emise");
  });
  it("encaissement partiel → partiellement_payee", () => {
    expect(calculerStatutEncaissement(100_000, 40_000)).toBe("partiellement_payee");
  });
  it("encaissement exact → payee", () => {
    expect(calculerStatutEncaissement(100_000, 100_000)).toBe("payee");
  });
  it("trop-perçu → payee (le remboursement se gère par avoir/refund, pas par statut)", () => {
    expect(calculerStatutEncaissement(100_000, 120_000)).toBe("payee");
  });
});
