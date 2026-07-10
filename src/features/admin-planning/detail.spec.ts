/**
 * Tests — detail.ts (fiche 360° d'une prestation).
 *
 * La fiche est le point d'arrivée du clic depuis le calendrier : elle doit
 * exposer entreprise/contact, lieu, formateur, financement + justificatifs et
 * factures — et rester robuste (introuvable, stub Prisma au build).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrainingFindUnique = vi.fn();
const mockCoachingFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: (...a: unknown[]) => mockTrainingFindUnique(...a) },
    coachingSession: { findUnique: (...a: unknown[]) => mockCoachingFindUnique(...a) },
  },
}));

import { getPlanningEventDetail, JUSTIFICATIF_TYPES } from "./detail";

const LIEU_VIDE = {
  lieuType: null,
  lieuIntitule: null,
  lieuAdresse: null,
  lieuCodePostal: null,
  lieuVille: null,
  lieuSalle: null,
  lieuVisioUrl: null,
};

const CLIENT = {
  raisonSociale: "Meridian SAS",
  siret: "81234567800011",
  adresse: "11 Av. Paul Verlaine",
  contactNom: "Claire Fontaine",
  contactFonction: "Resp. formation",
  contactEmail: "claire@meridian.fr",
  contactTelephone: "0476000000",
  opcoIdentifie: "Atlas",
};

const TRAINER = {
  id: "t1",
  nom: "Lovelace",
  prenom: "Ada",
  email: "ada@axion-ia.com",
  telephone: "0600000000",
  statut: "sous_traitant",
};

function formationRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "f1",
    titreSession: "Formation IA",
    dateDebut: new Date("2026-07-09T07:00:00Z"),
    dateFin: new Date("2026-07-09T15:00:00Z"),
    statut: "planifiee",
    montantHtCents: 320000,
    nbParticipantsPrevus: 8,
    nbParticipantsReels: null,
    financementType: "opco",
    opcoStatut: "accord_recu",
    numeroDossierOpco: "2026-AT-4471",
    opcoSubrogation: true,
    priseEnChargeMontantCents: 320000,
    priseEnChargeSourceUrl: "https://opco.example/bareme",
    conventionTripartiteSigneeAt: new Date("2026-06-01T10:00:00Z"),
    ...LIEU_VIDE,
    formateurPrincipal: TRAINER,
    client: CLIENT,
    _count: { enrollments: 6 },
    documents: [
      {
        id: "d1",
        type: "kit_opco",
        numero: "AXI-KIT-1",
        pdfUrl: "https://r2/x.pdf",
        createdAt: new Date("2026-06-02T10:00:00Z"),
      },
    ],
    facturesFormation: [
      {
        id: "fa1",
        numero: "AXI-FAC-2026-090",
        statut: "emise",
        destinataire: "opco",
        montantHtCents: 320000,
        emiseAt: new Date("2026-07-20T10:00:00Z"),
      },
    ],
    ...over,
  };
}

function coachingRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "c1",
    interventionSlug: "dirigeant-vision-strategique",
    dateSeance: new Date("2026-07-09T12:00:00Z"),
    dateSeanceFin: null,
    statut: "planifiee",
    beneficiaireNom: "Paul Martin",
    beneficiaireEmail: "paul@meridian.fr",
    ...LIEU_VIDE,
    trainer: TRAINER,
    coachingContract: {
      montantHtCents: 139000,
      financementType: "opco",
      numeroDossierOpco: "2026-AT-9",
      subrogation: false,
      priseEnChargeMontantCents: 100000,
      priseEnChargeSourceUrl: null,
      conventionTripartiteSigneeAt: null,
      client: CLIENT,
    },
    ...over,
  };
}

beforeEach(() => {
  mockTrainingFindUnique.mockReset();
  mockCoachingFindUnique.mockReset();
});

describe("getPlanningEventDetail — formation", () => {
  it("expose entreprise, contact, formateur, financement, justificatifs et factures", async () => {
    mockTrainingFindUnique.mockResolvedValue(formationRow());
    const d = await getPlanningEventDetail("formation", "f1");

    expect(d?.type).toBe("formation");
    expect(d?.client?.contactTelephone).toBe("0476000000");
    expect(d?.client?.opcoIdentifie).toBe("Atlas");
    expect(d?.formateur?.nomComplet).toBe("Ada Lovelace");
    expect(d?.formateur?.statut).toBe("sous_traitant");
    expect(d?.financement?.opcoStatut).toBe("accord_recu");
    expect(d?.financement?.subrogation).toBe(true);
    expect(d?.justificatifs).toHaveLength(1);
    expect(d?.justificatifs[0]?.type).toBe("kit_opco");
    expect(d?.factures[0]?.numero).toBe("AXI-FAC-2026-090");
    expect(d?.participants).toEqual({ inscrits: 6, prevus: 8, reels: null });
    expect(d?.beneficiaire).toBeNull();
  });

  it("ne charge que les documents valant justificatif de financement", async () => {
    mockTrainingFindUnique.mockResolvedValue(formationRow());
    await getPlanningEventDetail("formation", "f1");
    const arg = mockTrainingFindUnique.mock.calls[0]?.[0] as {
      select: { documents: { where: { type: { in: string[] } } } };
    };
    expect(arg.select.documents.where.type.in).toEqual([...JUSTIFICATIF_TYPES]);
  });

  it("formate le lieu quand renseigné", async () => {
    mockTrainingFindUnique.mockResolvedValue(
      formationRow({ lieuType: "sur_site", lieuVille: "Grenoble", lieuSalle: "B2" }),
    );
    const d = await getPlanningEventDetail("formation", "f1");
    expect(d?.lieu).toBe("Sur site — Grenoble · Salle B2");
  });

  it("lieu null quand rien n'est renseigné", async () => {
    mockTrainingFindUnique.mockResolvedValue(formationRow());
    expect((await getPlanningEventDetail("formation", "f1"))?.lieu).toBeNull();
  });

  it("formateur non assigné → null", async () => {
    mockTrainingFindUnique.mockResolvedValue(formationRow({ formateurPrincipal: null }));
    expect((await getPlanningEventDetail("formation", "f1"))?.formateur).toBeNull();
  });

  it("introuvable → null", async () => {
    mockTrainingFindUnique.mockResolvedValue(null);
    expect(await getPlanningEventDetail("formation", "nope")).toBeNull();
  });
});

describe("getPlanningEventDetail — coaching", () => {
  it("tire le financement et le client du contrat de coaching", async () => {
    mockCoachingFindUnique.mockResolvedValue(coachingRow());
    const d = await getPlanningEventDetail("coaching", "c1");

    expect(d?.type).toBe("coaching");
    expect(d?.montantHtCents).toBe(139000);
    expect(d?.client?.raisonSociale).toBe("Meridian SAS");
    expect(d?.financement?.numeroDossierOpco).toBe("2026-AT-9");
    // L'accord OPCO n'est suivi qu'au niveau session collective.
    expect(d?.financement?.opcoStatut).toBeNull();
    expect(d?.beneficiaire).toEqual({ nom: "Paul Martin", email: "paul@meridian.fr" });
    expect(d?.participants).toBeNull();
    expect(d?.justificatifs).toEqual([]);
    expect(d?.factures).toEqual([]);
  });

  it("sans contrat : financement null, montant null, client null", async () => {
    mockCoachingFindUnique.mockResolvedValue(coachingRow({ coachingContract: null }));
    const d = await getPlanningEventDetail("coaching", "c1");
    expect(d?.financement).toBeNull();
    expect(d?.montantHtCents).toBeNull();
    expect(d?.client).toBeNull();
    expect(d?.beneficiaire?.nom).toBe("Paul Martin");
  });

  it("séance sans fin → fin null (journée entière)", async () => {
    mockCoachingFindUnique.mockResolvedValue(coachingRow());
    expect((await getPlanningEventDetail("coaching", "c1"))?.fin).toBeNull();
  });
});

describe("getPlanningEventDetail — robustesse", () => {
  it("build-safety : une erreur Prisma rend null, sans throw", async () => {
    mockTrainingFindUnique.mockRejectedValue(new Error("no db"));
    await expect(getPlanningEventDetail("formation", "f1")).resolves.toBeNull();
  });

  it("n'interroge que la source correspondant au type", async () => {
    mockCoachingFindUnique.mockResolvedValue(coachingRow());
    await getPlanningEventDetail("coaching", "c1");
    expect(mockTrainingFindUnique).not.toHaveBeenCalled();
  });
});
