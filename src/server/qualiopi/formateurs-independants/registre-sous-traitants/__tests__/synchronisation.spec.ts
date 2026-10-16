// @vitest-environment node

/**
 * Qualiopi ind. 27 — la synchronisation du registre (accès en base simulés).
 *
 *   · interrupteur coupé : seul le réglage est lu, rien n'est écrit ;
 *   · la ligne visible du registre est écrite par le SERVICE EXISTANT du registre
 *     (`creerSousTraitant`, `updateSousTraitant`, `verifierDataGouv`) ;
 *   · rejouée, la synchronisation ne crée aucun doublon ;
 *   · une sortie est un statut daté et motivé : aucune suppression ;
 *   · l'aperçu ne lit que, même coupé ; il n'écrit jamais ;
 *   · le journal ne porte que des identifiants et des statuts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const T1 = "11111111-1111-4111-8111-111111111111";
const R1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "66666666-6666-4666-8666-666666666666";
const MAINTENANT = new Date("2026-10-16T10:00:00Z");

const m = vi.hoisted(() => ({
  allume: vi.fn(),
  creerSousTraitant: vi.fn(),
  updateSousTraitant: vi.fn(),
  verifierDataGouv: vi.fn(),
  journaliser: vi.fn(),
  db: {
    trainer: { findMany: vi.fn() },
    registreSousTraitantIndependant: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: m.journaliser }));
vi.mock("../../interrupteur-allume", () => ({ interrupteurAllume: m.allume }));
vi.mock("@/server/qualiopi/registres/sous-traitants-service", () => ({
  creerSousTraitant: m.creerSousTraitant,
  updateSousTraitant: m.updateSousTraitant,
  verifierDataGouv: m.verifierDataGouv,
}));

import { apercuSynchronisation, synchroniserRegistre } from "../synchronisation";

function ficheLue(p: Record<string, unknown> = {}) {
  return {
    id: T1,
    prenom: "Anne",
    nom: "Martin",
    statut: "sous_traitant",
    actif: true,
    estTestInterne: false,
    siret: "12345678900011",
    sousTraitantNda: "84691234569",
    sousTraitantContratSigneAt: new Date("2026-09-01T00:00:00Z"),
    activationValideeAt: null,
    finCollaborationAt: null,
    finCollaborationEffetAt: null,
    finCollaborationMotif: null,
    ndaVerifieListeAt: null,
    habilitations: [{ formation: { titre: "Prompt engineering" } }],
    ...p,
  };
}

function ligneLue(p: Record<string, unknown> = {}) {
  return {
    id: R1,
    trainerId: T1,
    sousTraitantId: S1,
    statut: "actif",
    statutDepuis: new Date("2026-09-01T00:00:00Z"),
    dateSortie: null,
    motifSortie: null,
    sousTraitant: {
      nom: "Anne Martin",
      siret: "12345678900011",
      nda: "84691234569",
      objetPrestation:
        "Animation de formations (formateur indépendant) — habilité sur : Prompt engineering",
      contratSigneAt: new Date("2026-09-01T00:00:00Z"),
      actif: true,
      verifieDataGouvAt: null,
    },
    ...p,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.allume.mockResolvedValue(true);
  m.db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(m.db));
  m.db.$queryRaw.mockResolvedValue([{ verrou: true }]);
  m.db.trainer.findMany.mockResolvedValue([ficheLue()]);
  m.db.registreSousTraitantIndependant.findMany.mockResolvedValue([]);
  m.creerSousTraitant.mockResolvedValue({ id: S1 });
  m.db.registreSousTraitantIndependant.create.mockResolvedValue({ id: R1 });
});

describe("interrupteur coupé", () => {
  it("rien n'est lu au-delà du réglage, rien n'est écrit", async () => {
    m.allume.mockResolvedValue(false);
    const r = await synchroniserRegistre({ maintenant: MAINTENANT, parId: ADMIN });
    expect(r.etat).toBe("coupe");
    expect(m.allume).toHaveBeenCalledWith("registre_sous_traitants");
    expect(m.db.trainer.findMany).not.toHaveBeenCalled();
    expect(m.creerSousTraitant).not.toHaveBeenCalled();
    expect(m.db.registreSousTraitantIndependant.create).not.toHaveBeenCalled();
  });
});

describe("synchronisation", () => {
  it("inscrit un nouvel entrant par le service du registre, puis sa place", async () => {
    const r = await synchroniserRegistre({ maintenant: MAINTENANT, parId: null });
    expect(r).toMatchObject({ etat: "fait", crees: 1, misAJour: 0, inchanges: 0 });
    expect(m.creerSousTraitant).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: "Anne Martin",
        siret: "12345678900011",
        nda: "84691234569",
        contratSigneAt: new Date("2026-09-01T00:00:00Z"),
        actif: true,
      }),
    );
    expect(m.db.registreSousTraitantIndependant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trainerId: T1,
        sousTraitantId: S1,
        statut: "actif",
        dateEntree: new Date("2026-09-01T00:00:00Z"),
      }),
      select: { id: true },
    });
  });

  it("🔑 rejouée, ne crée aucun doublon", async () => {
    m.db.registreSousTraitantIndependant.findMany.mockResolvedValue([ligneLue()]);
    const r = await synchroniserRegistre({ maintenant: MAINTENANT, parId: null });
    expect(r).toMatchObject({ crees: 0, misAJour: 0, inchanges: 1 });
    expect(m.creerSousTraitant).not.toHaveBeenCalled();
    expect(m.updateSousTraitant).not.toHaveBeenCalled();
    expect(m.db.registreSousTraitantIndependant.create).not.toHaveBeenCalled();
  });

  it("une fin de collaboration : la ligne sort (statut, date, motif), rien n'est supprimé", async () => {
    m.db.trainer.findMany.mockResolvedValue([
      ficheLue({
        actif: false,
        finCollaborationAt: new Date("2026-10-10T00:00:00Z"),
        finCollaborationMotif: "initiative_axion",
      }),
    ]);
    m.db.registreSousTraitantIndependant.findMany.mockResolvedValue([ligneLue()]);
    const r = await synchroniserRegistre({ maintenant: MAINTENANT, parId: null });
    expect(r).toMatchObject({ misAJour: 1, sorties: 1 });
    expect(m.updateSousTraitant).toHaveBeenCalledWith(S1, { actif: false });
    expect(m.db.registreSousTraitantIndependant.update).toHaveBeenCalledWith({
      where: { id: R1 },
      data: expect.objectContaining({
        statut: "sorti",
        statutDepuis: MAINTENANT,
        dateSortie: new Date("2026-10-10T00:00:00Z"),
        motifSortie: expect.stringContaining("Fin de collaboration"),
      }),
    });
    expect(m.db.registreSousTraitantIndependant.delete).not.toHaveBeenCalled();
    expect(m.db.registreSousTraitantIndependant.deleteMany).not.toHaveBeenCalled();
  });

  it("une vérification de la liste publique plus récente passe par `verifierDataGouv`", async () => {
    m.db.trainer.findMany.mockResolvedValue([
      ficheLue({ ndaVerifieListeAt: new Date("2026-10-01T00:00:00Z") }),
    ]);
    m.db.registreSousTraitantIndependant.findMany.mockResolvedValue([ligneLue()]);
    await synchroniserRegistre({ maintenant: MAINTENANT, parId: null });
    expect(m.verifierDataGouv).toHaveBeenCalledWith(S1, new Date("2026-10-01T00:00:00Z"));
  });

  it("une synchronisation déjà en cours ne se double pas", async () => {
    m.db.$queryRaw.mockResolvedValue([{ verrou: false }]);
    const r = await synchroniserRegistre({ maintenant: MAINTENANT, parId: null });
    expect(r.etat).toBe("deja_en_cours");
    expect(m.creerSousTraitant).not.toHaveBeenCalled();
  });

  it("journal : identifiants et compteurs seulement, aucun nom ni SIRET", async () => {
    await synchroniserRegistre({ maintenant: MAINTENANT, parId: ADMIN });
    expect(m.journaliser).toHaveBeenCalled();
    for (const [, entree] of m.journaliser.mock.calls) {
      const texte = JSON.stringify(entree);
      expect(texte).not.toContain("Martin");
      expect(texte).not.toContain("12345678900011");
      expect(texte).not.toContain("84691234569");
    }
    expect(m.journaliser).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({
        action: "qualiopi.registre_sous_traitants.synchronise",
        session: { userId: ADMIN },
      }),
    );
  });

  it("un échec sur une fiche n'arrête pas les autres", async () => {
    const T2 = "22222222-2222-4222-8222-222222222222";
    m.db.trainer.findMany.mockResolvedValue([ficheLue(), ficheLue({ id: T2, nom: "Durand" })]);
    m.creerSousTraitant.mockRejectedValueOnce(new Error("panne")).mockResolvedValueOnce({ id: S1 });
    const r = await synchroniserRegistre({ maintenant: MAINTENANT, parId: null });
    expect(r).toMatchObject({ crees: 1, erreurs: 1 });
  });
});

describe("aperçu", () => {
  it("lit même coupé, n'écrit jamais", async () => {
    m.allume.mockResolvedValue(false);
    const a = await apercuSynchronisation(MAINTENANT);
    expect(a.allume).toBe(false);
    expect(a.lignes).toEqual([
      expect.objectContaining({ trainerId: T1, sorte: "creer", libelle: "Anne Martin" }),
    ]);
    expect(m.creerSousTraitant).not.toHaveBeenCalled();
    expect(m.db.registreSousTraitantIndependant.create).not.toHaveBeenCalled();
    expect(m.journaliser).not.toHaveBeenCalled();
  });
});
