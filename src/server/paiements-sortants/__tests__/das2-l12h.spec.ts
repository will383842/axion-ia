// @vitest-environment node

/**
 * L12h — l'export DAS 2 COMMUN des honoraires (sur FAC-9).
 *
 *   · un relevé tenu PAR UN ORGANISME (décision 88) est déclaré au nom de
 *     l'organisme (sa raison sociale, son SIRET), jamais au nom de l'intervenant ;
 *   · une fiche du banc d'essai (`estTestInterne`) n'entre jamais dans la DAS 2 ;
 *   · la présentation de la méthode payée (L12i) entre dans le total ;
 *   · un avoir payé vient en déduction ;
 *   · l'export « à déclarer » liste la fiche au-dessus du seuil, pas celle en dessous.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findMany: vi.fn(), lignesDas2Apporteurs: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { trainerStatement: { findMany: m.findMany } } }));
vi.mock("@/features/apporteurs-reseau/commissions", () => ({
  lignesDas2Apporteurs: m.lignesDas2Apporteurs,
}));

import { construireDas2Commune, exportDas2Commune } from "../das2";

interface Fiche {
  prenom: string;
  nom: string;
  siret: string | null;
  adresseProfessionnelle: string | null;
}

const ADA: Fiche = {
  prenom: "Ada",
  nom: "L",
  siret: "12345678900011",
  adresseProfessionnelle: "1 rue A",
};
const BOB: Fiche = {
  prenom: "Bob",
  nom: "M",
  siret: "22233344400019",
  adresseProfessionnelle: null,
};

function releve(
  trainerId: string,
  trainer: Fiche,
  totalTtcCents: number,
  organisme: { id: string; nom: string; siret: string | null } | null = null,
) {
  return {
    trainerId,
    totalTtcCents,
    montantFactureTtcCents: null,
    organismeSousTraitantId: organisme?.id ?? null,
    organismeSousTraitant: organisme ? { nom: organisme.nom, siret: organisme.siret } : null,
    trainer,
  };
}

const lignes = (csv: string) => csv.replace("﻿", "").trim().split("\r\n").slice(1);

beforeEach(() => {
  vi.clearAllMocks();
  m.lignesDas2Apporteurs.mockResolvedValue([]);
});

describe("L12h — DAS 2 commune, formateurs et organismes", () => {
  it("un SIREN écrit avec des espaces cumule avec le même SIREN écrit d'un bloc", () => {
    const base = { denomination: null, siret: null, adresse: null, pieces: 1 } as const;
    const csv = construireDas2Commune(2027, [
      { ...base, flux: "apporteur", beneficiaire: "A", siren: "123 456 789", totalCents: 70_000 },
      { ...base, flux: "formateur", beneficiaire: "B", siren: "123456789", totalCents: 60_000 },
    ]);
    expect(lignes(csv).map((l) => l.split(";").pop())).toEqual(["oui", "oui"]);
  });

  it("la requête écarte les fiches du banc d'essai et ne lit que les relevés payés de l'année", async () => {
    m.findMany.mockResolvedValue([]);
    await exportDas2Commune(2027);
    const where = m.findMany.mock.calls[0]![0].where;
    expect(where.statut).toBe("paye");
    expect(where.trainer).toEqual({ NOT: { estTestInterne: true } });
    expect(where.payeAt.gte.toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(where.payeAt.lt.toISOString()).toBe("2027-12-31T23:00:00.000Z");
  });

  it("un relevé d'organisme est déclaré au nom de l'organisme ; présentation et avoir comptés", async () => {
    const org = { id: "o1", nom: "Org Formation SAS", siret: "987 654 321 00012" };
    m.findMany.mockResolvedValue([
      // Ada : deux missions 700 + 350, présentation 175, avoir payé -175 → 1 050 €.
      releve("t1", ADA, 70_000),
      releve("t1", ADA, 35_000),
      releve("t1", ADA, 17_500),
      releve("t1", ADA, -17_500),
      // Bob : un relevé à lui (500 €) et un relevé tenu par l'organisme (1 400 €).
      releve("t2", BOB, 50_000),
      releve("t2", BOB, 140_000, org),
    ]);
    const csv = await exportDas2Commune(2027);
    expect(lignes(csv)).toEqual([
      "2027;formateur;Ada L;;123456789;12345678900011;1 rue A;1050,00;4;non",
      "2027;formateur;Bob M;;222333444;22233344400019;;500,00;1;non",
      "2027;organisme;Org Formation SAS;Org Formation SAS;987654321;98765432100012;;1400,00;1;oui",
    ]);
  });

  it("export « à déclarer » : la fiche au-dessus du seuil y est, celle en dessous non (seuil strict)", () => {
    const base = { denomination: null, siret: null, adresse: null, pieces: 1 } as const;
    const csv = construireDas2Commune(
      2027,
      [
        {
          ...base,
          flux: "formateur",
          beneficiaire: "Au-dessus",
          siren: "111111111",
          totalCents: 120_001,
        },
        {
          ...base,
          flux: "formateur",
          beneficiaire: "Au seuil",
          siren: "222222222",
          totalCents: 120_000,
        },
        { ...base, flux: "formateur", beneficiaire: "En dessous", siren: null, totalCents: 50_000 },
      ],
      undefined,
      { seulementADeclarer: true },
    );
    expect(lignes(csv)).toEqual(["2027;formateur;Au-dessus;;111111111;;;1200,01;1;oui"]);
  });

  it("le seuil s'apprécie sur le cumul du SIREN : formateur 700 € + organisme 600 € du même SIREN → déclarés", async () => {
    const org = { id: "o2", nom: "Ada Conseil", siret: "12345678900029" };
    m.findMany.mockResolvedValue([releve("t1", ADA, 70_000), releve("t3", BOB, 60_000, org)]);
    const csv = await exportDas2Commune(2027, { seulementADeclarer: true });
    expect(lignes(csv)).toEqual([
      "2027;formateur;Ada L;;123456789;12345678900011;1 rue A;700,00;1;oui",
      "2027;organisme;Ada Conseil;Ada Conseil;123456789;12345678900029;;600,00;1;oui",
    ]);
  });
});
