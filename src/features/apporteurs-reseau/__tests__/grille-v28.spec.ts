import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

// Lot « grille » : le CALCUL suit l'annexe 1 du contrat 2.8 (texte validé le 25/11/2026).
//   A1.1 Journée IA : 500 € × prix HT payé ÷ 1 490 € (art. 4.1 bis), jamais plus de 500 € par journée ;
//   A1.3 accompagnement individuel (coaching « one to one ») : aucune commission ;
//   A1.4 audit vendu seul : 30 % ; A1.5 automatisations, intégrations, développements : 15 % ;
//   A1.6 conférence : aucune commission ; art. 4.3 : un acompte ne déclenche rien.

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));

import { commissionPourPrixConserve } from "../ajustement";
import { echeancePaiement } from "../autofacture-donnees";
import { cibleApresAvoir, cibleEtatFinal } from "../avoir-client";
import {
  commandesSoldees,
  factureEstUnAcompte,
  journeeIaDeLaCommande,
  type FactureDeCommande,
} from "../commandes";
import * as regles from "../regles";
import {
  calculerCommission,
  FORFAIT_JOURNEE_IA_CENTS,
  PALIER_JOURNEE_IA,
  PRIX_REFERENCE_JOURNEE_IA_CENTS,
  TAUX_BPS,
} from "../regles";

const montant = (r: ReturnType<typeof calculerCommission>) =>
  r.statut === "calculee" ? r.montantCents : null;

describe("A1.1 — Journée IA : 500 € au prorata du prix payé (prix de référence 1 490 € HT)", () => {
  it("les constantes sont celles de l'annexe 1", () => {
    expect(FORFAIT_JOURNEE_IA_CENTS).toBe(50_000);
    expect(PRIX_REFERENCE_JOURNEE_IA_CENTS).toBe(149_000);
  });
  it.each([
    [149_000, 50_000],
    [134_100, 45_000],
    [119_200, 40_000],
    [200_000, 50_000],
    [100_000, 33_557], // 500 × 1 000 ÷ 1 490 = 335,57 € (centime le plus proche)
  ])("payée %i centimes HT → %i centimes", (ht, attendu) => {
    const r = calculerCommission({ activite: "journee_ia", factureHtCents: ht });
    expect(r).toEqual({
      statut: "calculee",
      montantCents: attendu,
      palier: PALIER_JOURNEE_IA,
      prixPublicCents: 149_000,
    });
  });
  it("deux journées : plafond de 1 000 €, prix public de 2 980 €", () => {
    const r = calculerCommission({ activite: "journee_ia", factureHtCents: 400_000, quantite: 2 });
    expect(r).toMatchObject({ montantCents: 100_000, prixPublicCents: 298_000 });
    expect(
      montant(calculerCommission({ activite: "journee_ia", factureHtCents: 298_000, quantite: 2 })),
    ).toBe(100_000);
  });
});

describe("A1.6 — conférence : aucune commission ; A1.3 — coaching : aucune", () => {
  it("conférence, sous son activité ou par le palier d'une formation", () => {
    expect(calculerCommission({ activite: "conference", factureHtCents: 300_000 })).toEqual({
      statut: "aucune",
    });
    expect(
      calculerCommission({ activite: "formation", palier: "conference", factureHtCents: 300_000 }),
    ).toEqual({ statut: "aucune" });
  });
  it("le forfait de conférence n'existe plus dans le moteur", () => {
    expect("FORFAIT_CONFERENCE_CENTS" in regles).toBe(false);
    for (const f of ["regles.ts", "avoir-client.ts", "ajustement.ts", "grille-reference.ts"]) {
      const src = readFileSync(join(__dirname, "..", f), "utf8");
      expect(src, f).not.toMatch(/FORFAIT_CONFERENCE_CENTS/);
    }
  });
  it("coaching un_a_un : aucune (le taux affiché reste celui de la grille signée)", () => {
    expect(calculerCommission({ activite: "un_a_un", factureHtCents: 300_000 })).toEqual({
      statut: "aucune",
    });
    expect(TAUX_BPS.un_a_un).toBe(3000);
  });
});

describe("A1.4 / A1.5 — audit 30 %, automatisations et développement web 15 %", () => {
  it("audit vendu seul : 30 %", () => {
    expect(montant(calculerCommission({ activite: "audit", factureHtCents: 290_000 }))).toBe(
      87_000,
    );
  });
  it("intégration : 15 %", () => {
    expect(
      montant(calculerCommission({ activite: "implementation", factureHtCents: 600_000 })),
    ).toBe(90_000);
  });
  it("développement web (site_web) : 15 %, comme toute vente en une fois de A1.5", () => {
    expect(montant(calculerCommission({ activite: "site_web", factureHtCents: 400_000 }))).toBe(
      60_000,
    );
    expect(TAUX_BPS.site_web).toBe(1500);
  });
});

const f = (id: string, over: Partial<FactureDeCommande> = {}): FactureDeCommande => ({
  id,
  devisId: "D1",
  statut: "payee",
  avoirDeId: null,
  montantHtCents: 300_000,
  emiseAt: new Date("2026-11-01T10:00:00Z"),
  ...over,
});

describe("art. 4.3 — acompte gardé, avec ou sans devis : 0 €", () => {
  it("reconnaît une facture d'acompte à ses lignes (jamais la déduction d'un solde)", () => {
    expect(
      factureEstUnAcompte([
        { designation: "Acompte de 30 % — devis D-2026-001", quantite: 1, prixUnitaireHtCents: 1 },
      ]),
    ).toBe(true);
    expect(
      factureEstUnAcompte([
        { designation: "Audit ciblé", quantite: 1, prixUnitaireHtCents: 1_000_000 },
        {
          designation: "Acompte déjà facturé — facture AXI-1",
          quantite: 1,
          prixUnitaireHtCents: -300_000,
        },
      ]),
    ).toBe(false);
    expect(factureEstUnAcompte(null)).toBe(false);
    expect(factureEstUnAcompte("n'importe quoi")).toBe(false);
  });
  it("SANS devis rattaché : un acompte payé seul ne solde rien (aujourd'hui 15 % de 3 000 €)", () => {
    expect(commandesSoldees([f("A", { devisId: null, estAcompte: true })])).toEqual([]);
  });
  it("devis disparu (total inconnu) : un acompte ne solde pas non plus", () => {
    expect(commandesSoldees([f("A", { estAcompte: true })])).toEqual([]);
  });
  it("AVEC devis : acompte gardé, solde annulé par avoir total → rien", () => {
    expect(
      commandesSoldees(
        [
          f("A", { estAcompte: true }),
          f("S", { montantHtCents: 700_000, statut: "emise" }),
          f("AV", { avoirDeId: "S", montantHtCents: -700_000, statut: "emise" }),
        ],
        new Map([["D1", 1_000_000]]),
      ),
    ).toEqual([]);
    expect(
      commandesSoldees(
        [f("A", { estAcompte: true }), f("S", { montantHtCents: 700_000, statut: "annulee" })],
        new Map([["D1", 1_000_000]]),
      ),
    ).toEqual([]);
  });
  it("acompte + solde payés sous le devis : la commande est soldée (inchangé)", () => {
    const [c] = commandesSoldees(
      [f("A", { estAcompte: true }), f("S", { montantHtCents: 700_000 })],
      new Map([["D1", 1_000_000]]),
    );
    expect(c!.baseApresAvoirsCents).toBe(1_000_000);
  });
  it("une facture sans devis qui n'est pas un acompte reste sa propre commande", () => {
    expect(commandesSoldees([f("A", { devisId: null })])).toHaveLength(1);
  });
});

describe("Journée IA : reconnue par `devis.journee_ia`, jamais devinée", () => {
  const ligne = (designation: string, prix = 149_000, quantite = 1) => ({
    designation,
    quantite,
    prixUnitaireHtCents: prix,
  });
  it("devis marqué : reconnue, une journée par défaut", () => {
    expect(journeeIaDeLaCommande({ devisJourneeIa: true, lignes: [] })).toEqual({
      reconnue: true,
      quantite: 1,
    });
  });
  it("devis marqué : le nombre de journées vient des lignes « Journée IA »", () => {
    expect(
      journeeIaDeLaCommande({
        devisJourneeIa: true,
        lignes: [[ligne("Journée IA — équipe commerciale", 149_000, 2)]],
      }),
    ).toEqual({ reconnue: true, quantite: 2 });
  });
  it("devis NON marqué mais ligne « Journée IA » facturée : suspecte (alerte, rien de deviné)", () => {
    expect(
      journeeIaDeLaCommande({ devisJourneeIa: false, lignes: [[ligne("Journée IA")]] }),
    ).toEqual({ suspecte: true });
    expect(
      journeeIaDeLaCommande({ devisJourneeIa: false, lignes: [[ligne("JOURNEE D'IA sur site")]] }),
    ).toEqual({ suspecte: true });
  });
  it("colonne illisible (null) et ligne « Journée IA » : suspecte aussi", () => {
    expect(
      journeeIaDeLaCommande({ devisJourneeIa: null, lignes: [[ligne("Journée IA")]] }),
    ).toEqual({ suspecte: true });
  });
  it("la DÉDUCTION de la Journée IA (montant négatif, art. 4.1 ter) ne rend rien suspect", () => {
    expect(
      journeeIaDeLaCommande({
        devisJourneeIa: false,
        lignes: [[ligne("Automatisation", 600_000), ligne("Déduction de la Journée IA", -149_000)]],
      }),
    ).toBeNull();
  });
  it("aucune mention : null", () => {
    expect(
      journeeIaDeLaCommande({ devisJourneeIa: false, lignes: [[ligne("Audit ciblé")]] }),
    ).toBeNull();
  });
});

describe("avoir sur une Journée IA et sur les anciennes lignes hors grille", () => {
  const journee = {
    activite: "journee_ia",
    palier: PALIER_JOURNEE_IA,
    prixPublicHtCents: 149_000,
    factureHtCents: 149_000,
    montantCents: 50_000,
  };
  it("Journée IA remboursée à moitié : 250 € (formule de 4.1 bis)", () => {
    expect(commissionPourPrixConserve(journee, 74_500, 50_000)).toBe(25_000);
    expect(cibleEtatFinal(journee, 74_500, 149_000)).toBe(25_000);
  });
  it("Journée IA remboursée en totalité : 0", () => {
    expect(cibleEtatFinal(journee, 0, 149_000)).toBe(0);
  });
  it("ancienne ligne de conférence ou de coaching non versée : le moteur rend 0 (annulation)", () => {
    const conf = {
      activite: "conference",
      palier: "conference",
      prixPublicHtCents: null,
      factureHtCents: 200_000,
    };
    expect(commissionPourPrixConserve(conf, 100_000, 50_000)).toBe(0);
    expect(
      commissionPourPrixConserve(
        { activite: "un_a_un", palier: null, prixPublicHtCents: null },
        100_000,
        60_000,
      ),
    ).toBe(0);
  });
  it("ancienne ligne de conférence DÉJÀ facturée : un avoir partiel la réduit au prorata (jamais tout)", () => {
    const conf = {
      activite: "conference",
      palier: "conference",
      prixPublicHtCents: null,
      factureHtCents: 200_000,
      montantCents: 50_000,
    };
    expect(cibleEtatFinal(conf, 100_000, 200_000)).toBe(25_000);
    expect(cibleApresAvoir(conf, 100_000)).toBe(25_000);
    expect(cibleApresAvoir({ ...conf, montantCents: 5_000 }, 100_000, conf)).toBe(2_500);
  });
  it("ancienne ligne de coaching facturée (30 %) : prorata, arrondi au centime le plus proche", () => {
    const c = {
      activite: "un_a_un",
      palier: null,
      prixPublicHtCents: null,
      factureHtCents: 100_001,
      montantCents: 30_000,
    };
    expect(cibleEtatFinal(c, 33_333, 100_001)).toBe(Math.round((30_000 * 33_333) / 100_001));
  });
});

describe("échéance : jamais antérieure à l'émission de l'autofacture", () => {
  it("paiement intégral le 1/10, autofacture émise le 15/11 : échéance au 15/11, pas au 31/10", () => {
    const e = echeancePaiement(new Date("2026-11-15T09:00:00Z"), new Date("2026-10-01T09:00:00Z"));
    expect(e.toISOString()).toBe("2026-11-15T12:00:00.000Z");
  });
  it("cas normal inchangé : paiement + 30 jours", () => {
    expect(
      echeancePaiement(
        new Date("2026-11-22T10:00:00Z"),
        new Date("2026-11-02T10:00:00Z"),
      ).toISOString(),
    ).toBe("2026-12-02T12:00:00.000Z");
  });
});
