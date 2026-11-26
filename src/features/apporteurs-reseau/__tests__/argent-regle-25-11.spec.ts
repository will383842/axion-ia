import { describe, expect, it } from "vitest";

import { echeancePaiement } from "../autofacture-donnees";
import { calculerCommission } from "../regles";
import {
  commandeRenduePourLaLigne,
  commandesSoldees,
  etatDeLaCommande,
  ligneNeutralisee,
  netDeLaCommande,
  type FactureDeCommande,
} from "../commandes";

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

  it("devis MODIFIÉ après signature : ce module ne fige rien, la base suit le total RELU", () => {
    // Vérité (verdict B) : la base est le `montantTotalHtCents` lu au passage. Elle est stable
    // parce qu'un devis envoyé ne se modifie plus (devis-classique-modifier.spec.ts, « refuse un
    // devis qui n'est plus brouillon ») — pas parce que ce module la fige.
    const factures = [f("A", { montantHtCents: 600_000 }), f("B", { montantHtCents: 600_000 })];
    const [signe] = commandesSoldees(factures, new Map([["D1", 1_000_000]]));
    expect(signe!.baseSignatureCents).toBe(1_000_000);
    // Le même devis, relu après une modification de son total (1 200 €) :
    const [modifie] = commandesSoldees(factures, new Map([["D1", 1_200_000]]));
    expect(modifie!.baseSignatureCents).toBe(1_200_000);
    expect(modifie!.baseApresAvoirsCents).toBe(1_200_000);
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

describe("tour 4 : facture refaite sous le même devis, jamais deux commissions (600 € et non 1 200 €)", () => {
  // Devis 2 000 € (audit, 30 % = 600 €) : A payée, commission c1. Avoir total sur A, B refaite.
  const A = f("A", { montantHtCents: 200_000 });
  const AV = avoir("AV", "A", 200_000);
  const B = (statut: string) =>
    f("B", {
      montantHtCents: 200_000,
      statut,
      emiseAt: new Date("2026-11-05T10:00:00Z"),
    });

  it("B pas encore payée : le net vu par la reprise est 0 → c1 annulée ou reprise", () => {
    // Même calcul que `avoir-client.ts` : seules les factures payées comptent.
    const lu = [A, B("emise")];
    const { netCents } = netDeLaCommande(
      lu.filter((m) => m.statut === "payee"),
      [AV],
    );
    expect(netCents).toBe(0);
  });

  it("B payée : une seule commande soldée, base 2 000 € ; c1 due ou versée sans reprise la bloque", () => {
    const [c] = commandesSoldees([A, AV, B("payee")], new Map([["D1", 200_000]]));
    expect(c!.baseApresAvoirsCents).toBe(200_000);
    expect(ligneNeutralisee({ statut: "due", montantCents: 60_000 }, 0)).toBe(false);
    expect(ligneNeutralisee({ statut: "versee", montantCents: 60_000 }, 0)).toBe(false);
    expect(ligneNeutralisee({ statut: "versee", montantCents: 60_000 }, 30_000)).toBe(false);
  });

  it("une ligne annulée, retenue ou versée puis intégralement reprise est neutralisée", () => {
    expect(ligneNeutralisee({ statut: "annulee", montantCents: 60_000 }, 0)).toBe(true);
    expect(ligneNeutralisee({ statut: "retenue", montantCents: 60_000 }, 0)).toBe(true);
    expect(ligneNeutralisee({ statut: "versee", montantCents: 60_000 }, 60_000)).toBe(true);
  });
});

describe("verdict A (900eb08f) : état final de la commande, indépendant de l'ordre des passages", () => {
  // Devis 2 000 € HT. Quel que soit le chemin, l'état final payé de 2 000 € donne la base 2 000 €.
  const D = 200_000;
  const tard = new Date("2026-11-20T10:00:00Z");
  const cas: Array<[string, FactureDeCommande[], FactureDeCommande[]]> = [
    [
      "S45 : avoir total sur le solde, solde refait",
      [f("AC", { montantHtCents: 60_000 }), f("SO", { montantHtCents: 140_000 })],
      [avoir("AV", "SO", 140_000), f("SR", { montantHtCents: 140_000, emiseAt: tard })],
    ],
    [
      "S63 : facture unique, avoir partiel 500, complément 500",
      [f("F1", { montantHtCents: 200_000 })],
      [avoir("AV", "F1", 50_000), f("CP", { montantHtCents: 50_000, emiseAt: tard })],
    ],
    [
      "S65 : avoir total sur l'acompte, acompte refait",
      [f("AC", { montantHtCents: 60_000 }), f("SO", { montantHtCents: 140_000 })],
      [avoir("AV", "AC", 60_000), f("AR", { montantHtCents: 60_000, emiseAt: tard })],
    ],
  ];
  it.each(cas)("%s → net cible 2 000 € vu d'un coup ou après coup", (_n, avant, apres) => {
    const tout = [...avant, ...apres];
    const membres = tout.filter((x) => x.avoirDeId === null);
    const avoirs = tout.filter((x) => x.avoirDeId !== null);
    const e = etatDeLaCommande(membres, avoirs, D);
    expect(e).toMatchObject({ baseCents: D, netCibleCents: D, enAttente: false });
    const [c] = commandesSoldees(tout, new Map([["D1", D]]));
    expect(c!.baseApresAvoirsCents).toBe(e.netCibleCents);
  });

  it("refaite ÉMISE mais impayée : en attente (rien ne part), net cible = le payé seul", () => {
    const e = etatDeLaCommande(
      [
        f("AC", { montantHtCents: 60_000 }),
        f("SO", { montantHtCents: 140_000 }),
        f("SR", { montantHtCents: 140_000, statut: "emise" }),
      ],
      [avoir("AV", "SO", 140_000)],
      D,
    );
    expect(e).toMatchObject({ enAttente: true, netPayeCents: 60_000, netCibleCents: 60_000 });
  });

  it("acompte + solde normaux (sans avoir) : solde impayé mais payé ≥ base → jamais « en attente »", () => {
    const e = etatDeLaCommande(
      [f("A", { montantHtCents: 200_000 }), f("X", { montantHtCents: 10_000, statut: "emise" })],
      [],
      D,
    );
    expect(e.enAttente).toBe(false);
  });
});

describe("verdict F (900eb08f) : avoir total rattaché à une AUTRE facture du devis", () => {
  it("ligne sur le solde, avoir total de 2 000 € sur l'acompte : la commande est rendue", () => {
    const cree = new Date("2026-11-02T00:00:00Z");
    expect(
      commandeRenduePourLaLigne(
        [
          f("AC", { montantHtCents: 60_000 }),
          f("SO", { montantHtCents: 140_000 }),
          f("SR", { montantHtCents: 200_000, emiseAt: new Date("2026-11-10T00:00:00Z") }),
        ],
        [avoir("AV", "AC", 200_000)],
        cree,
      ),
    ).toBe(true);
  });
  it("avoir partiel : pas rendue (la ligne continue de bloquer)", () => {
    expect(
      commandeRenduePourLaLigne(
        [f("AC", { montantHtCents: 60_000 }), f("SO", { montantHtCents: 140_000 })],
        [avoir("AV", "SO", 140_000)],
        new Date("2026-11-02T00:00:00Z"),
      ),
    ).toBe(false);
  });
});
