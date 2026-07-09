/**
 * Tests — documents.ts (lecture des pièces + conformité d'un formateur).
 *
 * Le point sensible : le cumul annuel qui décide si l'obligation de vigilance
 * URSSAF s'applique. Il doit exclure les prestations annulées/reportées et être
 * stub-safe au build.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrainerFindUnique = vi.fn();
const mockDocumentFindMany = vi.fn();
const mockSessionFormateurFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findUnique: (...a: unknown[]) => mockTrainerFindUnique(...a) },
    trainerDocument: { findMany: (...a: unknown[]) => mockDocumentFindMany(...a) },
    sessionFormateur: { findMany: (...a: unknown[]) => mockSessionFormateurFindMany(...a) },
  },
}));

import { cumulAnnuelFormateurCents, getTrainerConformite, listTrainerDocuments } from "./documents";

const NOW = new Date("2026-07-09T12:00:00Z");

function doc(type: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type,
    statutValidation: "valide",
    dateEmission: new Date("2026-06-01T00:00:00Z"),
    dateExpiration: null,
    ...over,
  };
}

beforeEach(() => {
  mockTrainerFindUnique.mockReset();
  mockDocumentFindMany.mockReset();
  mockSessionFormateurFindMany.mockReset();
  mockDocumentFindMany.mockResolvedValue([]);
  mockSessionFormateurFindMany.mockResolvedValue([]);
});

describe("listTrainerDocuments", () => {
  it("stub-safe : une erreur Prisma rend [] sans throw", async () => {
    mockDocumentFindMany.mockRejectedValue(new Error("no db"));
    await expect(listTrainerDocuments("t1")).resolves.toEqual([]);
  });

  it("scope sur le formateur", async () => {
    await listTrainerDocuments("t1");
    const arg = mockDocumentFindMany.mock.calls[0]?.[0] as { where: { trainerId: string } };
    expect(arg.where.trainerId).toBe("t1");
  });
});

describe("cumulAnnuelFormateurCents", () => {
  it("somme les tarifs figés des affectations", async () => {
    mockSessionFormateurFindMany.mockResolvedValue([
      { tarifHtCents: 90000 },
      { tarifHtCents: 90000 },
      { tarifHtCents: 45000 },
    ]);
    expect(await cumulAnnuelFormateurCents("t1", 2026)).toBe(225000);
  });

  it("ignore une ligne sans tarif figé", async () => {
    mockSessionFormateurFindMany.mockResolvedValue([
      { tarifHtCents: 90000 },
      { tarifHtCents: null },
    ]);
    expect(await cumulAnnuelFormateurCents("t1", 2026)).toBe(90000);
  });

  it("borne l'année civile et exclut annulée / reportée", async () => {
    await cumulAnnuelFormateurCents("t1", 2026);
    const arg = mockSessionFormateurFindMany.mock.calls[0]?.[0] as {
      where: {
        trainerId: string;
        session: { dateDebut: { gte: Date; lt: Date }; statut: { notIn: string[] } };
      };
    };
    expect(arg.where.trainerId).toBe("t1");
    expect(arg.where.session.dateDebut.gte.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(arg.where.session.dateDebut.lt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(arg.where.session.statut.notIn).toEqual(["annulee", "reportee"]);
  });

  it("stub-safe : une erreur Prisma rend 0", async () => {
    mockSessionFormateurFindMany.mockRejectedValue(new Error("no db"));
    expect(await cumulAnnuelFormateurCents("t1", 2026)).toBe(0);
  });

  it("aucune affectation → 0", async () => {
    expect(await cumulAnnuelFormateurCents("t1", 2026)).toBe(0);
  });
});

describe("getTrainerConformite", () => {
  it("formateur introuvable → null", async () => {
    mockTrainerFindUnique.mockResolvedValue(null);
    expect(await getTrainerConformite("nope", 2026, NOW)).toBeNull();
  });

  it("salarié au dossier complet → conforme", async () => {
    mockTrainerFindUnique.mockResolvedValue({ statut: "salarie" });
    mockDocumentFindMany.mockResolvedValue([doc("contrat_travail"), doc("cv")]);
    const r = await getTrainerConformite("t1", 2026, NOW);
    expect(r?.conforme).toBe(true);
    expect(r?.manquements).toEqual([]);
    expect(r?.annee).toBe(2026);
  });

  it("indépendant sous le seuil : la vigilance n'est pas exigée", async () => {
    mockTrainerFindUnique.mockResolvedValue({ statut: "sous_traitant" });
    mockDocumentFindMany.mockResolvedValue([
      doc("nda_sous_traitant"),
      doc("kbis_avis_sirene"),
      doc("contrat_sous_traitance"),
      doc("assurance_rc_pro"),
      doc("cv"),
    ]);
    mockSessionFormateurFindMany.mockResolvedValue([{ tarifHtCents: 100000 }]); // 1 000 €
    const r = await getTrainerConformite("t1", 2026, NOW);
    expect(r?.montantRetenuCents).toBe(100000);
    expect(r?.manquements.map((m) => m.type)).not.toContain("attestation_vigilance_urssaf");
    expect(r?.conforme).toBe(true);
  });

  it("indépendant AU-DESSUS du seuil sans vigilance → alerte, mais reste conforme", async () => {
    mockTrainerFindUnique.mockResolvedValue({ statut: "sous_traitant" });
    mockDocumentFindMany.mockResolvedValue([
      doc("nda_sous_traitant"),
      doc("kbis_avis_sirene"),
      doc("contrat_sous_traitance"),
      doc("assurance_rc_pro"),
      doc("cv"),
    ]);
    // 6 jours à 900 € = 5 400 € > 5 000 €
    mockSessionFormateurFindMany.mockResolvedValue(
      Array.from({ length: 6 }, () => ({ tarifHtCents: 90000 })),
    );
    const r = await getTrainerConformite("t1", 2026, NOW);
    expect(r?.montantRetenuCents).toBe(540000);
    const m = r?.manquements.find((x) => x.code === "vigilance_urssaf_absente");
    expect(m?.gravite).toBe("alerte");
    expect(r?.conforme).toBe(true); // règle non tranchée → on signale, on ne bloque pas
  });

  it("indépendant sans NDA → BLOQUANT, donc non conforme", async () => {
    mockTrainerFindUnique.mockResolvedValue({ statut: "sous_traitant" });
    mockDocumentFindMany.mockResolvedValue([
      doc("kbis_avis_sirene"),
      doc("contrat_sous_traitance"),
    ]);
    const r = await getTrainerConformite("t1", 2026, NOW);
    expect(r?.conforme).toBe(false);
    expect(r?.manquements.some((m) => m.code === "nda_sous_traitant_absent")).toBe(true);
  });

  it("une config stricte rend la vigilance bloquante", async () => {
    mockTrainerFindUnique.mockResolvedValue({ statut: "sous_traitant" });
    mockDocumentFindMany.mockResolvedValue([
      doc("nda_sous_traitant"),
      doc("kbis_avis_sirene"),
      doc("contrat_sous_traitance"),
      doc("assurance_rc_pro"),
      doc("cv"),
    ]);
    mockSessionFormateurFindMany.mockResolvedValue([{ tarifHtCents: 600000 }]);
    const r = await getTrainerConformite("t1", 2026, NOW, {
      seuilVigilanceCents: 500_000,
      vigilanceValiditeMois: 6,
      cvValiditeMois: 12,
      vigilanceBloquante: true,
      rcProBloquante: false,
    });
    expect(r?.conforme).toBe(false);
  });

  it("stub-safe : erreur sur le formateur → null", async () => {
    mockTrainerFindUnique.mockRejectedValue(new Error("no db"));
    expect(await getTrainerConformite("t1", 2026, NOW)).toBeNull();
  });
});
