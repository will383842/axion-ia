/**
 * Garantie Journée IA → avoir → commission d'apporteur. L'avoir émis par la décision « remboursement »
 * est un avoir `avoirDeId` HT négatif ; on le passe à la SOURCE UNIQUE de la reprise
 * (`etatDeLaCommande` + `cibleEtatFinal`, avoir-client.ts) : total = 0 €, partiel = prorata au centime
 * le plus proche (décision de Will).
 */
import { describe, expect, it } from "vitest";

import { cibleEtatFinal } from "@/features/apporteurs-reseau/avoir-client";
import { etatDeLaCommande, type FactureDeCommande } from "@/features/apporteurs-reseau/commandes";
import { PALIER_JOURNEE_IA } from "@/features/apporteurs-reseau/regles";
import { htPourTtcAvoir } from "../facture-libre-pur";

const FACTURE: FactureDeCommande = {
  id: "f1",
  devisId: "d1",
  statut: "payee",
  avoirDeId: null,
  montantHtCents: 149_000,
  emiseAt: new Date("2026-12-01T10:00:00Z"),
};
const LIGNE = {
  activite: "formation",
  palier: PALIER_JOURNEE_IA,
  prixPublicHtCents: 149_000,
  montantCents: 50_000,
};

/** Commission restante après un remboursement de `ttcCents`, via le HT de l'avoir réellement émis. */
function commissionApresRemboursement(ttcCents: number): number | null {
  const conv = htPourTtcAvoir(ttcCents, "assujetti", 20, 20);
  if (!conv.ok) throw new Error(conv.message);
  const avoir: FactureDeCommande = {
    ...FACTURE,
    id: "a1",
    avoirDeId: "f1",
    montantHtCents: -conv.htCents,
  };
  const etat = etatDeLaCommande([FACTURE], [avoir], 149_000);
  return cibleEtatFinal(LIGNE, etat.netCibleCents, etat.baseCents);
}

describe("remboursement de garantie → commission de la Journée IA", () => {
  it("avoir TOTAL (1 788,00 € TTC) → commission 0 €", () => {
    expect(commissionApresRemboursement(178_800)).toBe(0);
  });
  it("avoir PARTIEL 600,00 € TTC (500 € HT) → prorata sur 990 € HT conservés = 332,21 €", () => {
    expect(commissionApresRemboursement(60_000)).toBe(Math.round((50_000 * 99_000) / 149_000));
    expect(commissionApresRemboursement(60_000)).toBe(33_221);
  });
  it("avoir PARTIEL 1 000,00 € TTC (833,33 € HT) → 220,36 €, arrondi au centime le plus proche", () => {
    expect(commissionApresRemboursement(100_000)).toBe(Math.round((50_000 * 65_667) / 149_000));
    expect(commissionApresRemboursement(100_000)).toBe(22_036);
  });
  it("sans avoir (remboursement hors site) la commission resterait due : c'est le défaut corrigé", () => {
    const etat = etatDeLaCommande([FACTURE], [], 149_000);
    expect(cibleEtatFinal(LIGNE, etat.netCibleCents, etat.baseCents)).toBe(50_000);
  });
});
