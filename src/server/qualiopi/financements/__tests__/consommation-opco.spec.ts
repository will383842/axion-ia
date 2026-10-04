// @vitest-environment node
/**
 * Lot OPCO A7d — ce que l'OPCO a déjà pris en charge pour un client, par année
 * civile (manque n°4).
 *
 * Témoins : année civile de la SESSION (décembre vs janvier, fuseau de Paris),
 * à défaut celle de l'accord ; accordés et en cours rendus SÉPARÉMENT ; autre
 * OPCO, dossier CPF ou refusé ignorés ; montants en centimes entiers.
 */

import { describe, expect, it, vi } from "vitest";

import {
  agregerConsommation,
  anneeDuDossier,
  consommationOpcoAnnee,
  consommationOpcoParAnnee,
  opcoDuDossier,
  type DossierConsommation,
} from "../consommation-opco";

function dossier(p: Partial<DossierConsommation>): DossierConsommation {
  return {
    type: "opco",
    statut: "accord_recu",
    financeurNom: "Atlas",
    montantAccordeCents: 100_000,
    montantDemandeCents: 120_000,
    accordAt: null,
    accordEcritLe: null,
    envoyeAt: null,
    depotFaitLe: null,
    createdAt: new Date("2026-03-01T10:00:00Z"),
    sessionDateDebut: null,
    ...p,
  };
}

describe("anneeDuDossier — année civile de Paris", () => {
  it("session du 31 décembre au soir (UTC) → année suivante à Paris", () => {
    // 31/12/2026 23:30 UTC = 1er janvier 2027, 00:30 à Paris.
    expect(anneeDuDossier(dossier({ sessionDateDebut: new Date("2026-12-31T23:30:00Z") }))).toBe(
      2027,
    );
  });
  it("session de décembre → année de décembre, même si l'accord est de janvier", () => {
    expect(
      anneeDuDossier(
        dossier({
          sessionDateDebut: new Date("2026-12-08T08:00:00Z"),
          accordAt: new Date("2027-01-05T08:00:00Z"),
        }),
      ),
    ).toBe(2026);
  });
  it("sans session → année de l'accord écrit, puis du clic d'accord", () => {
    expect(anneeDuDossier(dossier({ accordEcritLe: new Date("2027-01-04T00:00:00Z") }))).toBe(2027);
    expect(anneeDuDossier(dossier({ accordAt: new Date("2025-11-04T09:00:00Z") }))).toBe(2025);
  });
  it("dossier envoyé sans session → année du dépôt, puis de l'envoi", () => {
    expect(
      anneeDuDossier(dossier({ statut: "envoye", depotFaitLe: new Date("2026-02-01T00:00:00Z") })),
    ).toBe(2026);
  });
});

describe("opcoDuDossier", () => {
  it("le nom du financeur prime quand il désigne un OPCO", () => {
    expect(opcoDuDossier("OPCO Atlas", "akto")).toBe("atlas");
    expect(opcoDuDossier("Akto", null)).toBe("akto");
  });
  it("sans nom reconnu → l'OPCO du client", () => {
    expect(opcoDuDossier(null, "atlas")).toBe("atlas");
    expect(opcoDuDossier("Financeur inconnu", "atlas")).toBe("atlas");
  });
});

describe("agregerConsommation", () => {
  const dec = new Date("2026-12-08T08:00:00Z");
  const jan = new Date("2027-01-12T08:00:00Z");
  const dossiers: DossierConsommation[] = [
    dossier({ sessionDateDebut: dec, montantAccordeCents: 150_000 }),
    dossier({ sessionDateDebut: jan, statut: "facture", montantAccordeCents: 80_000 }),
    dossier({ sessionDateDebut: jan, statut: "paiement_recu", montantAccordeCents: 20_000 }),
    dossier({ sessionDateDebut: jan, statut: "clos", montantAccordeCents: 5_000 }),
    dossier({ sessionDateDebut: jan, statut: "envoye", montantDemandeCents: 60_000 }),
    // ignorés :
    dossier({ sessionDateDebut: jan, statut: "refuse", montantAccordeCents: 99_999 }),
    dossier({ sessionDateDebut: jan, statut: "a_monter", montantDemandeCents: 99_999 }),
    dossier({ sessionDateDebut: jan, type: "cpf", montantAccordeCents: 99_999 }),
    dossier({ sessionDateDebut: jan, financeurNom: "Akto", montantAccordeCents: 99_999 }),
  ];

  it("décembre et janvier tombent dans deux années différentes", () => {
    expect(agregerConsommation(dossiers, "atlas", 2026, null)).toEqual({
      annee: 2026,
      accordeCents: 150_000,
      enCoursCents: 0,
    });
    expect(agregerConsommation(dossiers, "atlas", 2027, null)).toEqual({
      annee: 2027,
      accordeCents: 105_000,
      enCoursCents: 60_000,
    });
  });

  it("un dossier mixte compte pour l'OPCO", () => {
    expect(
      agregerConsommation([dossier({ type: "mixte", sessionDateDebut: jan })], "atlas", 2027, null)
        .accordeCents,
    ).toBe(100_000);
  });

  it("accordé sans montant d'accord saisi → le montant demandé, par prudence", () => {
    expect(
      agregerConsommation(
        [dossier({ sessionDateDebut: jan, montantAccordeCents: null, montantDemandeCents: 42_00 })],
        "atlas",
        2027,
        null,
      ).accordeCents,
    ).toBe(4200);
  });

  it("montants toujours en centimes entiers", () => {
    const r = agregerConsommation(dossiers, "atlas", 2027, null);
    expect(Number.isInteger(r.accordeCents)).toBe(true);
    expect(Number.isInteger(r.enCoursCents)).toBe(true);
  });
});

describe("consommationOpcoAnnee — lecture", () => {
  it("lit les dossiers du client et agrège l'année demandée", async () => {
    const findMany = vi.fn(async (_args: unknown) => [
      {
        type: "opco",
        statut: "accord_recu",
        financeurNom: "Atlas",
        montantAccordeCents: 30_000,
        montantDemandeCents: 30_000,
        accordAt: null,
        accordEcritLe: null,
        envoyeAt: null,
        depotFaitLe: null,
        createdAt: new Date("2027-01-01T10:00:00Z"),
        trainingSession: { dateDebut: new Date("2027-02-01T08:00:00Z") },
        client: { opco: "atlas", opcoIdentifie: null },
      },
    ]);
    const db = { dossierFinancement: { findMany } };
    expect(await consommationOpcoAnnee("c1", "atlas", 2027, db as never)).toEqual({
      annee: 2027,
      accordeCents: 30_000,
      enCoursCents: 0,
    });
    const args = findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(args.where["clientId"]).toBe("c1");
  });

  it("lecture en échec (base absente) → null, jamais d'exception", async () => {
    const db = {
      dossierFinancement: {
        findMany: async () => {
          throw new Error("stub");
        },
      },
    };
    expect(await consommationOpcoAnnee("c1", "atlas", 2027, db as never)).toBeNull();
    expect(await consommationOpcoParAnnee("c1", "atlas", [2026, 2027], db as never)).toBeNull();
  });
});
