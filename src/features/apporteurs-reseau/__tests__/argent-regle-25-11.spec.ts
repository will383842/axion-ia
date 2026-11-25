import { describe, expect, it } from "vitest";

import { echeancePaiement } from "../autofacture-donnees";
import { calculerCommission } from "../regles";
import { commandesSoldees, type FactureDeCommande } from "../commandes";

// Règle du dirigeant (25/11) : commission calculée UNE SEULE FOIS sur le net HT arrêté à la
// signature du devis ; due au paiement intégral ; 30 jours à compter de ce paiement.

const f = (id: string, over: Partial<FactureDeCommande> = {}): FactureDeCommande => ({
  id,
  devisId: "D1",
  statut: "payee",
  avoirDeId: null,
  montantHtCents: 500_000,
  emiseAt: new Date("2026-11-01T10:00:00Z"),
  ...over,
});
const avoir = (id: string, de: string, cents: number): FactureDeCommande =>
  f(id, { avoirDeId: de, montantHtCents: -cents, statut: "emise" });

describe("base de la commission = net HT à la signature", () => {
  it("avoir après signature : la base reste le total du devis", () => {
    const [c] = commandesSoldees(
      [
        f("A", { montantHtCents: 500_000 }),
        f("B", { montantHtCents: 500_000 }),
        avoir("AV", "B", 200_000),
      ],
      new Map([["D1", 1_000_000]]),
    );
    expect(c!.baseSignatureCents).toBe(1_000_000);
    expect(c!.totalHtCents).toBe(800_000); // affichage seulement
  });

  it("sans devis : HT des factures à l'émission, avoirs non déduits", () => {
    const [c] = commandesSoldees([f("A", { devisId: null }), avoir("AV", "A", 100_000)]);
    expect(c!.baseSignatureCents).toBe(500_000);
  });

  it("devis modifié après signature : la base suit le total arrêté, pas la facturation", () => {
    const [c] = commandesSoldees([f("A"), f("B")], new Map([["D1", 1_000_000]]));
    expect(c!.baseSignatureCents).toBe(1_000_000);
  });

  it("acompte payé, solde non payé ou non facturé : aucune commande soldée", () => {
    expect(
      commandesSoldees([f("A"), f("B", { statut: "emise" })], new Map([["D1", 1_000_000]])),
    ).toEqual([]);
    expect(commandesSoldees([f("A")], new Map([["D1", 1_000_000]]))).toEqual([]);
  });
});

describe("délai de 30 jours depuis le paiement intégral", () => {
  const paiement = new Date("2026-11-02T10:00:00Z");
  const emission = new Date("2026-11-22T10:00:00Z"); // autofacture retardée de 20 jours (SIRET)

  it("échéance = paiement + 30 jours, pas émission + 30", () => {
    expect(echeancePaiement(emission, paiement).toISOString()).toBe("2026-12-02T12:00:00.000Z");
    expect(echeancePaiement(emission).toISOString()).toBe("2026-12-22T12:00:00.000Z");
  });

  it("paiement postérieur à l'émission (donnée incohérente) : on garde l'émission", () => {
    expect(echeancePaiement(paiement, emission).toISOString()).toBe("2026-12-02T12:00:00.000Z");
  });
});

describe("avoir total : même résultat avant ou après le passage (décision pilote 25/11)", () => {
  it("facture sans devis annulée par avoir puis refaite : UNE seule commande soldée, 4 500 € → 675 €", () => {
    const cs = commandesSoldees([
      f("F1", { devisId: null, montantHtCents: 450_000 }),
      avoir("AV1", "F1", 450_000),
      f("F2", {
        devisId: null,
        montantHtCents: 450_000,
        emiseAt: new Date("2026-11-05T10:00:00Z"),
      }),
    ]);
    expect(cs).toHaveLength(1);
    expect(cs[0]!.factureCleId).toBe("F2");
    const calc = calculerCommission({
      activite: "implementation",
      factureHtCents: cs[0]!.baseApresAvoirsCents,
    });
    expect(calc).toMatchObject({ statut: "calculee", montantCents: 67_500 });
  });

  it("avoir partiel avant le passage : la base suit l'argent gardé (10 000 € − 2 000 €)", () => {
    const [c] = commandesSoldees(
      [f("A", { montantHtCents: 1_000_000 }), avoir("AV", "A", 200_000)],
      new Map([["D1", 1_000_000]]),
    );
    expect(c!.baseSignatureCents).toBe(1_000_000);
    expect(c!.baseApresAvoirsCents).toBe(800_000);
  });

  it("avoir total avant le passage : aucune commande", () => {
    expect(commandesSoldees([f("A"), avoir("AV", "A", 500_000)])).toEqual([]);
  });
});

describe("grille : coaching 0 €, arrondi au centime le plus proche", () => {
  it("coaching un_a_un : aucune commission", () => {
    expect(calculerCommission({ activite: "un_a_un", factureHtCents: 300_000 })).toEqual({
      statut: "aucune",
    });
  });
  it("333,33 € à 15 % → 50,00 € (et non 49,99 €)", () => {
    expect(
      calculerCommission({ activite: "implementation", factureHtCents: 33_333 }),
    ).toMatchObject({
      montantCents: 5_000,
    });
  });
});

describe("tour 2 : base jamais déduite deux fois", () => {
  it("avoir total puis facture refaite SOUS LE MÊME DEVIS : 4 500 € → base 4 500 € (675 €)", () => {
    const [c] = commandesSoldees(
      [
        f("F1", { montantHtCents: 450_000 }),
        avoir("AV1", "F1", 450_000),
        f("F2", { montantHtCents: 450_000, emiseAt: new Date("2026-11-05T10:00:00Z") }),
      ],
      new Map([["D1", 450_000]]),
    );
    expect(c!.baseApresAvoirsCents).toBe(450_000);
  });
  it("facturé 11 000 € sur un devis de 10 000 €, avoir de 1 000 € : base 10 000 €", () => {
    const [c] = commandesSoldees(
      [f("A", { montantHtCents: 1_100_000 }), avoir("AV", "A", 100_000)],
      new Map([["D1", 1_000_000]]),
    );
    expect(c!.baseApresAvoirsCents).toBe(1_000_000);
  });
});
