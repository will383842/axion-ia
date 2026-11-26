import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

// Verdict C (900eb08f) : l'échéance de 30 jours affichée dans la console part du PAIEMENT
// INTÉGRAL de la commande (`paiementIntegralLe`), comme l'autofacture, son PDF et l'alerte
// « à virer » — une seule source, jamais le `paidAt` de la seule facture clé.

const ACOMPTE = new Date("2026-10-01T10:00:00Z");
const SOLDE = new Date("2026-11-02T10:00:00Z");

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../paiement-integral", () => ({
  paiementIntegralLe: vi.fn(async () => SOLDE),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      findMany: vi.fn(async () => [
        {
          id: "c1",
          apporteurId: "a1",
          apporteur: { prenom: "A", nom: "B" },
          presentation: { denomination: "Acme" },
          factureId: "F1",
          parrainage: false,
          activite: "audit",
          palier: null,
          factureHtCents: 200_000,
          montantCents: 60_000,
          statut: "due",
          releveMois: null,
          autofactureNumero: "AXI-APP-2026-0001",
          avoirNumero: null,
          autofactureAttenteMotif: null,
          autofactureAttenteDepuis: null,
          litigeDepuis: null,
          litigeMotif: null,
          prestationRealiseeAt: null,
          prestationRealiseePar: null,
          verseeAt: null,
          creeAt: ACOMPTE,
          autofactureEmiseAt: SOLDE,
          majAt: SOLDE,
        },
      ]),
    },
    // La facture clé est l'ACOMPTE, payé le 01/10 : ce n'est pas le paiement intégral.
    factureFormation: {
      findMany: vi.fn(async () => [{ id: "F1", numero: "F-1", paidAt: ACOMPTE }]),
    },
  },
}));

import { lireCommissions } from "../commissions";
import { paiementIntegralLe } from "../paiement-integral";

describe("console des commissions : échéance depuis le paiement intégral", () => {
  it("une ligne facturée porte la date de `paiementIntegralLe`, pas le paidAt de sa facture", async () => {
    const [c] = await lireCommissions("due");
    expect(paiementIntegralLe).toHaveBeenCalledWith(["F1"]);
    expect(c!.paiementIntegralAt).toEqual(SOLDE);
  });

  it("la page passe `paiementIntegralAt` (et non `encaisseeAt`) à l'échéance", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]/apporteurs/commissions/page.tsx"),
      "utf8",
    );
    expect(page).toContain("paiementIntegral={c.paiementIntegralAt}");
    expect(page).not.toContain("paiementIntegral={c.encaisseeAt}");
  });
});
