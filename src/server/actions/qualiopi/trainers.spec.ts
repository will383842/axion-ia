/**
 * Tests — Server Actions formateurs (R9 audit E2E 2026-06-06).
 * Mock @/lib/prisma + @/server/actions/qualiopi/_guards.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockTrainerFindUnique = vi.fn();
const mockSessionFindUnique = vi.fn();
const mockSessionUpdate = vi.fn();
const mockSessionFormateurDeleteMany = vi.fn();
const mockSessionFormateurUpsert = vi.fn();
const mockHabilitationDeleteMany = vi.fn();
const mockHabilitationCreateMany = vi.fn();

vi.mock("@/lib/prisma", () => {
  const sessionFormateur = {
    deleteMany: (...args: unknown[]) => mockSessionFormateurDeleteMany(...args),
    upsert: (...args: unknown[]) => mockSessionFormateurUpsert(...args),
  };
  const trainerHabilitation = {
    deleteMany: (...args: unknown[]) => mockHabilitationDeleteMany(...args),
    createMany: (...args: unknown[]) => mockHabilitationCreateMany(...args),
  };
  const tx = {
    trainer: { update: (...args: unknown[]) => mockUpdate(...args) },
    trainingSession: { update: (...args: unknown[]) => mockSessionUpdate(...args) },
    sessionFormateur,
    trainerHabilitation,
  };
  return {
    prisma: {
      trainer: {
        create: (...args: unknown[]) => mockCreate(...args),
        update: (...args: unknown[]) => mockUpdate(...args),
        findUnique: (...args: unknown[]) => mockTrainerFindUnique(...args),
      },
      trainingSession: {
        findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
        update: (...args: unknown[]) => mockSessionUpdate(...args),
      },
      sessionFormateur,
      trainerHabilitation,
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

const mockGetTrainerConformite = vi.fn();
vi.mock("@/server/qualiopi/trainers/documents", () => ({
  getTrainerConformite: (...a: unknown[]) => mockGetTrainerConformite(...a),
}));

import {
  createTrainerAction,
  setTrainerHabilitationsAction,
  verifyTrainerSousTraitantAction,
  setTrainerActifAction,
  assignTrainerToSessionAction,
} from "./trainers";

const FORMATION_ID = "11111111-1111-1111-1111-111111111111";
const TRAINER_ID = "22222222-2222-2222-2222-222222222222";
const SESSION_ID = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockTrainerFindUnique.mockReset();
  mockSessionFindUnique.mockReset();
  mockSessionUpdate.mockReset();
  mockSessionFormateurDeleteMany.mockReset();
  mockSessionFormateurUpsert.mockReset();
});

describe("createTrainerAction", () => {
  it("crée un formateur valide", async () => {
    mockCreate.mockResolvedValue({ id: TRAINER_ID });
    const r = await createTrainerAction({
      nom: "Dupont",
      prenom: "Marie",
      email: "marie@example.com",
      statut: "salarie",
    });
    expect(r).toEqual({ data: { id: TRAINER_ID } });
  });

  it("refuse des données invalides (email)", async () => {
    const r = await createTrainerAction({
      nom: "X",
      prenom: "Y",
      email: "pas-un-email",
      statut: "salarie",
    } as never);
    expect("error" in r).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("renvoie une erreur claire si email déjà pris (P2002)", async () => {
    mockCreate.mockRejectedValue({ code: "P2002" });
    const r = await createTrainerAction({
      nom: "Dupont",
      prenom: "Marie",
      email: "marie@example.com",
      statut: "salarie",
    });
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("email");
  });
});

describe("setTrainerHabilitationsAction", () => {
  beforeEach(() => {
    mockHabilitationDeleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockHabilitationCreateMany.mockReset().mockResolvedValue({ count: 1 });
  });

  it("remplace la liste des formations habilitées", async () => {
    mockUpdate.mockResolvedValue({ id: TRAINER_ID });
    const r = await setTrainerHabilitationsAction({
      id: TRAINER_ID,
      formationsHabilitees: [FORMATION_ID],
    });
    expect(r).toEqual({ data: { id: TRAINER_ID } });
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: { formationsHabilitees: string[] } };
    expect(arg.data.formationsHabilitees).toEqual([FORMATION_ID]);
  });

  it("DUAL-WRITE : le tableau legacy ET la table normalisée sont écrits", async () => {
    // Si la table divergeait du tableau, la garde d'habilitation deviendrait
    // incohérente selon le lecteur : les deux écritures sont dans UNE transaction.
    mockUpdate.mockResolvedValue({ id: TRAINER_ID });
    await setTrainerHabilitationsAction({ id: TRAINER_ID, formationsHabilitees: [FORMATION_ID] });

    expect(mockUpdate).toHaveBeenCalled();
    const createArg = mockHabilitationCreateMany.mock.calls[0]?.[0] as {
      data: { trainerId: string; formationId: string; habiliteById: string }[];
      skipDuplicates: boolean;
    };
    expect(createArg.data).toEqual([
      { trainerId: TRAINER_ID, formationId: FORMATION_ID, habiliteById: "admin-uuid" },
    ]);
    // Réhabiliter ne doit pas réécrire `habiliteAt` : la traçabilité Qualiopi
    // date de la PREMIÈRE habilitation, pas du dernier envoi du formulaire.
    expect(createArg.skipDuplicates).toBe(true);
  });

  it("retire de la table les habilitations qui ne sont plus dans la liste", async () => {
    mockUpdate.mockResolvedValue({ id: TRAINER_ID });
    await setTrainerHabilitationsAction({ id: TRAINER_ID, formationsHabilitees: [FORMATION_ID] });
    const delArg = mockHabilitationDeleteMany.mock.calls[0]?.[0] as {
      where: { trainerId: string; formationId: { notIn: string[] } };
    };
    expect(delArg.where.trainerId).toBe(TRAINER_ID);
    expect(delArg.where.formationId.notIn).toEqual([FORMATION_ID]);
  });

  it("une liste VIDE efface la table sans tenter d'insérer", async () => {
    mockUpdate.mockResolvedValue({ id: TRAINER_ID });
    await setTrainerHabilitationsAction({ id: TRAINER_ID, formationsHabilitees: [] });
    expect(mockHabilitationDeleteMany).toHaveBeenCalled();
    expect(mockHabilitationCreateMany).not.toHaveBeenCalled();
  });
});

describe("verifyTrainerSousTraitantAction", () => {
  it("pose sousTraitantVerifieAt + NDA", async () => {
    mockUpdate.mockResolvedValue({ id: TRAINER_ID });
    const r = await verifyTrainerSousTraitantAction({
      id: TRAINER_ID,
      sousTraitantNda: "12345678",
    });
    expect(r).toEqual({ data: { id: TRAINER_ID } });
    const arg = mockUpdate.mock.calls[0]?.[0] as {
      data: { sousTraitantNda: string; sousTraitantVerifieAt: Date };
    };
    expect(arg.data.sousTraitantNda).toBe("12345678");
    expect(arg.data.sousTraitantVerifieAt).toBeInstanceOf(Date);
  });
});

describe("setTrainerActifAction", () => {
  it("désactive un formateur", async () => {
    mockUpdate.mockResolvedValue({ id: TRAINER_ID });
    const r = await setTrainerActifAction({ id: TRAINER_ID, actif: false });
    expect(r).toEqual({ data: { id: TRAINER_ID } });
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: { actif: boolean } };
    expect(arg.data.actif).toBe(false);
  });
});

describe("assignTrainerToSessionAction (blocage habilitation)", () => {
  it("assigne un formateur habilité", async () => {
    mockSessionFindUnique.mockResolvedValue({ formationId: FORMATION_ID });
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "salarie",
      formationsHabilitees: [FORMATION_ID],
      sousTraitantVerifieAt: null,
    });
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toEqual({ data: { sessionId: SESSION_ID, avertissements: [] } });
    const arg = mockSessionUpdate.mock.calls[0]?.[0] as { data: { formateurPrincipalId: string } };
    expect(arg.data.formateurPrincipalId).toBe(TRAINER_ID);
  });

  it("dual-write : upsert la ligne SessionFormateur principal + snapshot tarif", async () => {
    mockSessionFindUnique.mockResolvedValue({ formationId: FORMATION_ID });
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "salarie",
      formationsHabilitees: [FORMATION_ID],
      sousTraitantVerifieAt: null,
      tarifJourneeHtCents: 90000,
    });
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
    await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    const upsertArg = mockSessionFormateurUpsert.mock.calls[0]?.[0] as {
      where: { sessionId_trainerId: { sessionId: string; trainerId: string } };
      create: { role: string; tarifHtCents: number | null };
    };
    expect(upsertArg.where.sessionId_trainerId).toEqual({
      sessionId: SESSION_ID,
      trainerId: TRAINER_ID,
    });
    expect(upsertArg.create.role).toBe("principal");
    expect(upsertArg.create.tarifHtCents).toBe(90000);
    // L'ancien principal (autre formateur) est retiré avant de poser le nouveau.
    expect(mockSessionFormateurDeleteMany).toHaveBeenCalled();
  });

  it("dual-write : le retrait (trainerId null) supprime le principal sans upsert", async () => {
    mockSessionFindUnique.mockResolvedValue({ formationId: FORMATION_ID });
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
    await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: null });
    expect(mockSessionFormateurDeleteMany).toHaveBeenCalled();
    expect(mockSessionFormateurUpsert).not.toHaveBeenCalled();
  });

  it("REFUSE un formateur non habilité sur la formation", async () => {
    mockSessionFindUnique.mockResolvedValue({ formationId: FORMATION_ID });
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "salarie",
      formationsHabilitees: [], // pas habilité
      sousTraitantVerifieAt: null,
    });
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("refusée");
    expect(mockSessionUpdate).not.toHaveBeenCalled();
  });

  it("REFUSE un sous-traitant non vérifié", async () => {
    mockSessionFindUnique.mockResolvedValue({ formationId: FORMATION_ID });
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "sous_traitant",
      formationsHabilitees: [FORMATION_ID],
      sousTraitantVerifieAt: null,
    });
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect("error" in r).toBe(true);
    expect(mockSessionUpdate).not.toHaveBeenCalled();
  });

  it("autorise le retrait (trainerId = null) sans contrôle", async () => {
    mockSessionFindUnique.mockResolvedValue({ formationId: FORMATION_ID });
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: null });
    expect(r).toEqual({ data: { sessionId: SESSION_ID, avertissements: [] } });
    expect(mockTrainerFindUnique).not.toHaveBeenCalled();
  });
});

describe("assignTrainerToSessionAction — conformité : avertit, ne bloque JAMAIS", () => {
  beforeEach(() => {
    // Ce fichier n'a pas de `clearAllMocks` global : sans ce reset, les appels
    // des tests précédents feraient échouer `not.toHaveBeenCalled()`.
    mockGetTrainerConformite.mockReset();
    mockSessionFindUnique.mockResolvedValue({ formationId: FORMATION_ID });
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "sous_traitant",
      formationsHabilitees: [FORMATION_ID],
      sousTraitantVerifieAt: new Date(),
      tarifJourneeHtCents: 90_000,
    });
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
  });

  it("INVARIANT : un formateur non conforme est quand même assigné", async () => {
    // Le seuil URSSAF n'est pas tranché juridiquement : bloquer sur ce fondement
    // empêcherait de travailler à tort. On assigne, et on dit ce qui manque.
    mockGetTrainerConformite.mockResolvedValue({
      conforme: false,
      manquements: [
        { code: "nda", gravite: "bloquant", type: "nda_sous_traitant", message: "NDA manquant" },
        { code: "rc", gravite: "alerte", type: "assurance_rc_pro", message: "RC pro expirée" },
      ],
    });

    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });

    expect("data" in r).toBe(true);
    expect(mockSessionUpdate).toHaveBeenCalled(); // l'affectation est bien écrite
    // Seuls les BLOQUANTS remontent : une alerte n'a pas à alarmer l'opérateur ici.
    expect("data" in r && r.data.avertissements).toEqual(["NDA manquant"]);
  });

  it("un formateur conforme n'émet aucun avertissement", async () => {
    mockGetTrainerConformite.mockResolvedValue({ conforme: true, manquements: [] });
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect("data" in r && r.data.avertissements).toEqual([]);
  });

  it("une conformité illisible (null) n'invente aucun avertissement", async () => {
    mockGetTrainerConformite.mockResolvedValue(null);
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect("data" in r && r.data.avertissements).toEqual([]);
  });

  it("une conformité qui EXPLOSE ne fait pas échouer une affectation déjà écrite", async () => {
    mockGetTrainerConformite.mockRejectedValue(new Error("db down"));
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect("data" in r).toBe(true);
    expect("data" in r && r.data.avertissements).toEqual([]);
  });

  it("le retrait d'un formateur n'interroge pas la conformité", async () => {
    await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: null });
    expect(mockGetTrainerConformite).not.toHaveBeenCalled();
  });
});
