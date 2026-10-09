import { describe, expect, it } from "vitest";

// Contrat 2.7, art. 4.0, 4.7 et 5.1 : l'autofacture porte comme date de la prestation le JOUR
// D'ACQUISITION de la commission, le plus tardif du jour de l'encaissement intégral et du jour de
// la réalisation. Les échéances (émission + 30 j, objectif émission + 2 jours ouvrés) ne changent pas.

import {
  construireDonneesAutofacture,
  datePrestationAutofacture,
  encaissementIntegral,
  jourAcquisition,
  type ApporteurPourAutofacture,
  type CommissionPourAutofacture,
} from "../autofacture-donnees";

const organisme = { raisonSociale: "Axion IA" } as never;
const apporteur: ApporteurPourAutofacture = {
  nom: "Jeanne Martin",
  denomination: null,
  siren: "123456789",
  adresse: "1 rue des Lilas, 69000 Lyon",
  regimeTva: "franchise_293b",
  numeroTva: null,
  email: null,
};
const emission = new Date("2026-10-20T10:00:00Z"); // mardi

function ligne(
  id: string,
  encaisseeAt: Date | null,
  prestationRealiseeAt: Date | null,
  extra: Partial<CommissionPourAutofacture> = {},
): CommissionPourAutofacture {
  return {
    id,
    activite: "audit",
    palier: null,
    parrainage: false,
    montantCents: 30_000,
    factureHtCents: 100_000,
    encaisseeAt,
    prestationRealiseeAt,
    ...extra,
  };
}

function construire(commissions: CommissionPourAutofacture[]) {
  return construireDonneesAutofacture({
    numero: "AXI-APP-2026-0042",
    periodeLibelle: "commissions exigibles au 20 octobre 2026",
    dateEmission: emission,
    apporteur,
    commissions,
    organisme,
    totalAttenduCents: commissions.reduce((s, c) => s + (c.montantCents ?? 0), 0),
  });
}

describe("jour d'acquisition (art. 4.0)", () => {
  it("encaissement AVANT la réalisation : le jour de la réalisation", () => {
    const j = jourAcquisition({
      encaisseeAt: new Date("2026-10-02T09:00:00Z"),
      prestationRealiseeAt: new Date("2026-10-08T15:00:00Z"),
    });
    expect(j?.toISOString()).toBe("2026-10-08T15:00:00.000Z");
  });

  it("encaissement APRÈS la réalisation : le jour de l'encaissement", () => {
    const j = jourAcquisition({
      encaisseeAt: new Date("2026-10-12T09:00:00Z"),
      prestationRealiseeAt: new Date("2026-10-08T15:00:00Z"),
    });
    expect(j?.toISOString()).toBe("2026-10-12T09:00:00.000Z");
  });

  it("même jour (heure de Paris) : ce jour-là", () => {
    const r = construire([
      ligne("a", new Date("2026-10-09T06:00:00Z"), new Date("2026-10-09T20:00:00Z")),
    ]);
    expect(r.ok && r.data.datePrestation).toBe("9 octobre 2026");
  });

  it("jours de PARIS : 23 h 30 UTC le 8 est déjà le 9 à Paris", () => {
    const j = jourAcquisition({
      encaisseeAt: new Date("2026-10-08T23:30:00Z"),
      prestationRealiseeAt: new Date("2026-10-09T08:00:00Z"),
    });
    const r = construire([ligne("a", j, j)]);
    expect(r.ok && r.data.datePrestation).toBe("9 octobre 2026");
  });

  it("une date manque : aucune date devinée", () => {
    expect(jourAcquisition({ encaisseeAt: null, prestationRealiseeAt: new Date() })).toBeNull();
    expect(jourAcquisition({ encaisseeAt: new Date(), prestationRealiseeAt: null })).toBeNull();
  });
});

describe("encaissement intégral d'une commande", () => {
  it("le DERNIER paiement de ses factures (acompte puis solde)", () => {
    expect(
      encaissementIntegral([
        { statut: "payee", avoirDeId: null, paidAt: new Date("2026-09-01T10:00:00Z") },
        { statut: "payee", avoirDeId: null, paidAt: new Date("2026-10-05T10:00:00Z") },
        { statut: "annulee", avoirDeId: null, paidAt: null },
        { statut: "payee", avoirDeId: "x", paidAt: new Date("2026-12-01T10:00:00Z") },
      ])?.toISOString(),
    ).toBe("2026-10-05T10:00:00.000Z");
  });

  it("une facture sans date de paiement : non datable", () => {
    expect(
      encaissementIntegral([
        { statut: "payee", avoirDeId: null, paidAt: new Date("2026-09-01T10:00:00Z") },
        { statut: "payee", avoirDeId: null, paidAt: null },
      ]),
    ).toBeNull();
  });
});

describe("date de la prestation sur l'autofacture (art. 4.7 et 5.1)", () => {
  it("le jour d'acquisition, pas le jour d'émission ; échéances inchangées", () => {
    const r = construire([
      ligne("a", new Date("2026-10-02T09:00:00Z"), new Date("2026-10-08T15:00:00Z")),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.datePrestation).toBe("8 octobre 2026");
    expect(r.data.dateEmission).toBe("20 octobre 2026");
    expect(r.data.dateEcheance).toBe("19 novembre 2026");
    expect(r.datesManquantes).toEqual([]);
    expect(r.data.lignes[0]!.designation).toContain("— acquise le 8 octobre 2026");
  });

  it("plusieurs jours d'acquisition : « du … au … », et chaque ligne porte le sien", () => {
    const r = construire([
      ligne("a", new Date("2026-10-12T09:00:00Z"), new Date("2026-10-08T15:00:00Z")),
      ligne("b", new Date("2026-10-02T09:00:00Z"), new Date("2026-10-06T15:00:00Z")),
    ]);
    expect(r.ok && r.data.datePrestation).toBe("du 6 octobre 2026 au 12 octobre 2026");
    expect(r.ok && r.data.lignes.map((l) => l.designation.split(" — acquise le ")[1])).toEqual([
      "12 octobre 2026",
      "6 octobre 2026",
    ]);
  });

  it("donnée manquante : la date d'avant (jour d'émission ouvré), et la ligne est signalée", () => {
    const r = construire([
      ligne("a", new Date("2026-10-02T09:00:00Z"), new Date("2026-10-08T15:00:00Z")),
      ligne("b", null, new Date("2026-10-08T15:00:00Z")),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.datePrestation).toBe("20 octobre 2026");
    expect(r.datesManquantes).toEqual(["b"]);
  });

  it("la ligne de parrainage compte pour la date mais ne dit rien de la commande du filleul", () => {
    const r = construire([
      ligne("p", new Date("2026-10-02T09:00:00Z"), new Date("2026-10-08T15:00:00Z"), {
        parrainage: true,
      }),
    ]);
    expect(r.ok && r.data.datePrestation).toBe("8 octobre 2026");
    expect(r.ok && r.data.lignes[0]!.designation).toBe("Parrainage (art. 4.6)");
  });

  it("sans aucune date (lignes d'avant) : rendu identique à l'ancien", () => {
    const d = datePrestationAutofacture(
      [ligne("a", null, null)],
      new Date("2026-10-10T10:00:00Z"), // samedi → lundi 12
    );
    expect(d.libelle).toBe("12 octobre 2026");
    expect(d.manquantes).toEqual(["a"]);
  });
});
