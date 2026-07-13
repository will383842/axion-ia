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
  planifierFacturationDevis,
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

describe("planifierFacturationDevis — acompte / solde / totalité", () => {
  // Devis site web : 10 000 € HT, taux implicites (normalisés en aval par activité).
  const DEVIS_LIGNES: LigneFacture[] = [
    { designation: "Site web augmenté", quantite: 1, prixUnitaireHtCents: 800_000 },
    { designation: "Intégration RAG", quantite: 1, prixUnitaireHtCents: 200_000 },
  ];

  it("acompte 30 % → ligne unique de 3 000 € HT, sans taux explicite (normalisation aval)", () => {
    const plan = planifierFacturationDevis({
      lignesDevis: DEVIS_LIGNES,
      facturesLiees: [],
      devisNumero: "AXI-DEV-2026-010",
      acomptePercent: 30,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.estAcompte).toBe(true);
    expect(plan.lignes).toHaveLength(1);
    expect(plan.lignes[0]?.prixUnitaireHtCents).toBe(300_000);
    expect(plan.lignes[0]?.designation).toContain("AXI-DEV-2026-010");
    expect(plan.lignes[0]?.tauxTvaPercent).toBeUndefined();
  });

  it("acompte sur devis à taux explicite uniforme → le taux est repris", () => {
    const plan = planifierFacturationDevis({
      lignesDevis: DEVIS_LIGNES.map((l) => ({ ...l, tauxTvaPercent: 20 })),
      facturesLiees: [],
      devisNumero: "AXI-DEV-2026-011",
      acomptePercent: 40,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.lignes[0]?.tauxTvaPercent).toBe(20);
    expect(plan.lignes[0]?.prixUnitaireHtCents).toBe(400_000);
  });

  it("acompte REFUSÉ sur devis multi-taux (taux ambigu)", () => {
    const plan = planifierFacturationDevis({
      lignesDevis: [
        { designation: "Formation", quantite: 1, prixUnitaireHtCents: 100_000 },
        { designation: "Conseil", quantite: 1, prixUnitaireHtCents: 50_000, tauxTvaPercent: 20 },
      ],
      facturesLiees: [],
      devisNumero: "AXI-DEV-2026-012",
      acomptePercent: 30,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.erreur).toContain("multi-taux");
  });

  it("acompte dépassant le restant à facturer → refusé", () => {
    const plan = planifierFacturationDevis({
      lignesDevis: DEVIS_LIGNES,
      facturesLiees: [
        { numero: "AXI-FACT-2026-050", montantHtCents: 800_000, tauxEffectifPercent: 20 },
      ],
      devisNumero: "AXI-DEV-2026-013",
      acomptePercent: 30,
    });
    expect(plan.ok).toBe(false);
  });

  it("totalité (aucun acompte préalable) → lignes du devis telles quelles", () => {
    const plan = planifierFacturationDevis({
      lignesDevis: DEVIS_LIGNES,
      facturesLiees: [],
      devisNumero: "AXI-DEV-2026-014",
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.estAcompte).toBe(false);
    expect(plan.lignes).toEqual(DEVIS_LIGNES);
  });

  it("solde après acompte → lignes du devis + déduction négative au taux FACTURÉ ; total = restant", () => {
    const plan = planifierFacturationDevis({
      lignesDevis: DEVIS_LIGNES.map((l) => ({ ...l, tauxTvaPercent: 20 })),
      facturesLiees: [
        { numero: "AXI-FACT-2026-051", montantHtCents: 300_000, tauxEffectifPercent: 20 },
      ],
      devisNumero: "AXI-DEV-2026-015",
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.lignes).toHaveLength(3);
    const deduction = plan.lignes[2];
    expect(deduction?.prixUnitaireHtCents).toBe(-300_000);
    expect(deduction?.tauxTvaPercent).toBe(20);
    expect(deduction?.designation).toContain("AXI-FACT-2026-051");
    // Bout en bout : la facture de solde porte 7 000 € HT / 8 400 € TTC.
    const totaux = computeTotauxFacture(plan.lignes, "assujetti", 20);
    expect(totaux.totalHtCents).toBe(700_000);
    expect(totaux.totalTtcCents).toBe(840_000);
  });

  it("devis entièrement facturé → solde refusé (passer par un avoir)", () => {
    const plan = planifierFacturationDevis({
      lignesDevis: DEVIS_LIGNES,
      facturesLiees: [
        { numero: "AXI-FACT-2026-052", montantHtCents: 1_000_000, tauxEffectifPercent: 20 },
      ],
      devisNumero: "AXI-DEV-2026-016",
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.erreur).toContain("entièrement facturé");
  });

  it("deux acomptes successifs possibles tant que Σ < total", () => {
    const plan = planifierFacturationDevis({
      lignesDevis: DEVIS_LIGNES,
      facturesLiees: [
        { numero: "AXI-FACT-2026-053", montantHtCents: 300_000, tauxEffectifPercent: 0 },
      ],
      devisNumero: "AXI-DEV-2026-017",
      acomptePercent: 30,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.lignes[0]?.prixUnitaireHtCents).toBe(300_000);
  });
});
