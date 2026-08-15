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
// 🔴 2026-07-26 — la garde anti-orphelins interroge le catalogue avant d'écrire.
// Par défaut, toute formation demandée est réputée exister : les tests
// historiques décrivent un catalogue sain, et c'est le cas nominal.
const mockFormationFindMany = vi.fn();

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
      formation: {
        findMany: (...args: unknown[]) => mockFormationFindMany(...args),
      },
      sessionFormateur,
      trainerHabilitation,
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  // DEFENSIF, pas obligatoire : ce spec n'exerce pas
  // `deleteTrainerDevelopmentActionAction`, et la transformation SSR de Vite
  // reecrit les imports nommes en acces de propriete PARESSEUX — l'absence de
  // l'entree ne casserait donc rien tant que l'action n'est pas appelee. On la
  // declare pour que le premier test qui l'exercera n'ait pas a debugger une
  // TypeError opaque.
  requireAdminDelete: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

const mockGetTrainerConformite = vi.fn();
const { mockGetTrainerConflicts } = vi.hoisted(() => ({
  mockGetTrainerConflicts: vi.fn(),
}));
vi.mock("@/features/admin-planning/queries", () => ({
  getTrainerConflicts: mockGetTrainerConflicts,
}));

vi.mock("@/server/qualiopi/trainers/documents", () => ({
  getTrainerConformite: (...a: unknown[]) => mockGetTrainerConformite(...a),
}));

import {
  createTrainerAction,
  setTrainerHabilitationsAction,
  verifyTrainerSousTraitantAction,
  setTrainerActifAction,
  assignTrainerToSessionAction,
  updateTrainerSousTraitancePiecesAction,
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
  mockHabilitationDeleteMany.mockReset();
  mockHabilitationCreateMany.mockReset();
  // Catalogue sain par défaut : chaque id demandé existe.
  mockFormationFindMany.mockReset();
  mockFormationFindMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.map((id) => ({ id })),
  );
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

const DEBUT = new Date("2026-09-10T07:00:00Z");
const FIN = new Date("2026-09-10T15:00:00Z");

/** Session mockée AVEC ses dates : le contrôle de conflit en a besoin. */
function sessionMock() {
  return { formationId: FORMATION_ID, dateDebut: DEBUT, dateFin: FIN, statut: "planifiee" };
}

describe("assignTrainerToSessionAction (blocage habilitation)", () => {
  beforeEach(() => {
    // Par défaut : aucun conflit d'agenda. Les tests qui en veulent un le disent.
    mockGetTrainerConflicts.mockResolvedValue([]);
  });

  it("assigne un formateur habilité", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionMock());
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "salarie",
      habilitations: [{ formationId: FORMATION_ID }],
      sousTraitantVerifieAt: null,
    });
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toEqual({ data: { sessionId: SESSION_ID, avertissements: [] } });
    const arg = mockSessionUpdate.mock.calls[0]?.[0] as { data: { formateurPrincipalId: string } };
    expect(arg.data.formateurPrincipalId).toBe(TRAINER_ID);
  });

  it("dual-write : upsert la ligne SessionFormateur principal + snapshot tarif", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionMock());
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "salarie",
      habilitations: [{ formationId: FORMATION_ID }],
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
    mockSessionFindUnique.mockResolvedValue(sessionMock());
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
    await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: null });
    expect(mockSessionFormateurDeleteMany).toHaveBeenCalled();
    expect(mockSessionFormateurUpsert).not.toHaveBeenCalled();
  });

  /**
   * 🔴 LE TEST QUI DÉPLACE LE CONTRÔLE AU BON ENDROIT.
   *
   * `getTrainerConflicts` existait, testé, et son commentaire posait déjà le
   * diagnostic. Mais il n'avait qu'UN appelant : une page de DÉTAIL du planning.
   * Le conflit s'affichait donc APRÈS l'affectation, à qui ouvrait cette page —
   * à un formateur on l'ouvre, à cent personne ne l'ouvre.
   */
  it("🔴 REFUSE un formateur déjà mobilisé sur une prestation qui chevauche", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionMock());
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "salarie",
      habilitations: [{ formationId: FORMATION_ID }],
      sousTraitantVerifieAt: null,
    });
    mockGetTrainerConflicts.mockResolvedValue([
      { key: "formation:autre", titre: "IA pour les équipes", debut: DEBUT, fin: FIN },
    ]);

    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });

    expect("error" in r, "l'affectation a été acceptée malgré un conflit d'agenda").toBe(true);
    expect((r as { error: string }).error).toContain("déjà mobilisé");
    // Le message NOMME la prestation en cause : un refus opaque produit un appel.
    expect((r as { error: string }).error).toContain("IA pour les équipes");
    // Et surtout : RIEN n'a été écrit.
    expect(mockSessionUpdate).not.toHaveBeenCalled();
  });

  it("le contrôle de conflit interroge bien l'agenda DU formateur visé", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionMock());
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "salarie",
      habilitations: [{ formationId: FORMATION_ID }],
      sousTraitantVerifieAt: null,
    });
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });

    await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });

    expect(mockGetTrainerConflicts).toHaveBeenCalledWith(
      TRAINER_ID,
      expect.objectContaining({ debut: DEBUT, fin: FIN, key: `formation:${SESSION_ID}` }),
    );
  });

  it("une lecture d'agenda en panne ne bloque PAS une affectation légitime", async () => {
    // Garde-fou d'ordonnancement, pas acte engageant : il échoue en douceur.
    mockSessionFindUnique.mockResolvedValue(sessionMock());
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "salarie",
      habilitations: [{ formationId: FORMATION_ID }],
      sousTraitantVerifieAt: null,
    });
    mockGetTrainerConflicts.mockRejectedValue(new Error("planning indisponible"));
    mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });

    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });

    expect("data" in r).toBe(true);
    expect(mockSessionUpdate).toHaveBeenCalled();
  });

  it("REFUSE un formateur non habilité sur la formation", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionMock());
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "salarie",
      habilitations: [], // pas habilité
      sousTraitantVerifieAt: null,
    });
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("refusée");
    expect(mockSessionUpdate).not.toHaveBeenCalled();
  });

  it("REFUSE un sous-traitant non vérifié", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionMock());
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "sous_traitant",
      habilitations: [{ formationId: FORMATION_ID }],
      sousTraitantVerifieAt: null,
    });
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect("error" in r).toBe(true);
    expect(mockSessionUpdate).not.toHaveBeenCalled();
  });

  it("autorise le retrait (trainerId = null) sans contrôle", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionMock());
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
    mockSessionFindUnique.mockResolvedValue(sessionMock());
    mockTrainerFindUnique.mockResolvedValue({
      actif: true,
      statut: "sous_traitant",
      habilitations: [{ formationId: FORMATION_ID }],
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

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Blocage constaté EN PRODUCTION le 2026-07-26.
//
// Le tableau legacy `formationsHabilitees` du dirigeant portait 33 ids de
// formations SUPPRIMÉES (génération 1, remplacées à la refonte du catalogue).
// La fiche formateur initialisait le formulaire avec, ne pouvait pas les
// afficher — une formation supprimée n'a pas de case à cocher — et les
// renvoyait quand même. La clé étrangère de `trainer_habilitations` les
// rejetait, la transaction entière était annulée, et le `catch` avalait
// l'erreur : plus AUCUNE habilitation ne pouvait être enregistrée, pour
// personne, sans aucune issue par l'interface.
//
// Conséquence Qualiopi : l'indicateur 21 était structurellement inatteignable.
// ─────────────────────────────────────────────────────────────────────────────

describe("setTrainerHabilitationsAction — ids de formations disparues", () => {
  const VIVANTE = "11111111-1111-4111-8111-111111111111";
  const ORPHELINE = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    mockFormationFindMany.mockReset();
    // Le catalogue ne connaît QUE la formation vivante.
    mockFormationFindMany.mockResolvedValue([{ id: VIVANTE }]);
    mockUpdate.mockResolvedValue({ id: TRAINER_ID });
    mockHabilitationDeleteMany.mockResolvedValue({ count: 0 });
    mockHabilitationCreateMany.mockResolvedValue({ count: 1 });
  });

  it("enregistre malgré la présence d'ids disparus, au lieu de tout annuler", async () => {
    const r = await setTrainerHabilitationsAction({
      id: TRAINER_ID,
      formationsHabilitees: [VIVANTE, ORPHELINE],
    });
    expect(r).toEqual({ data: { id: TRAINER_ID } });
  });

  it("n'insère QUE les formations qui existent — sinon la FK annule tout", async () => {
    await setTrainerHabilitationsAction({
      id: TRAINER_ID,
      formationsHabilitees: [VIVANTE, ORPHELINE],
    });
    const data = mockHabilitationCreateMany.mock.calls[0]![0].data as { formationId: string }[];
    expect(data.map((d) => d.formationId)).toEqual([VIVANTE]);
  });

  it("nettoie aussi le tableau legacy — c'est lui qui portait les orphelins", async () => {
    await setTrainerHabilitationsAction({
      id: TRAINER_ID,
      formationsHabilitees: [VIVANTE, ORPHELINE],
    });
    expect(mockUpdate.mock.calls[0]![0].data).toEqual({ formationsHabilitees: [VIVANTE] });
  });

  it("une liste entièrement orpheline vide les habilitations sans échouer", async () => {
    mockFormationFindMany.mockResolvedValue([]);
    const r = await setTrainerHabilitationsAction({
      id: TRAINER_ID,
      formationsHabilitees: [ORPHELINE],
    });
    expect(r).toEqual({ data: { id: TRAINER_ID } });
    expect(mockHabilitationCreateMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateTrainerSousTraitancePiecesAction — art. 4 et 8 de la procédure
//
// 🔴 Ces colonnes existaient depuis la migration du 2026-08-03 SANS aucun
// écrivain : les alertes les lisaient, la carte de conformité les comptait, et
// un sous-traitant serait resté « contrat-cadre manquant » (critique) à vie.
// Les tests fixent la sémantique des trois états d'un champ, là où se joue la
// perte de données : `undefined` laisse en l'état, `null` retire, une valeur
// enregistre.
// ─────────────────────────────────────────────────────────────────────────────

describe("updateTrainerSousTraitancePiecesAction", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue({ id: TRAINER_ID });
  });

  it("n'écrit QUE les champs fournis", async () => {
    await updateTrainerSousTraitancePiecesAction({
      id: TRAINER_ID,
      rcProAttestationUrl: "https://r2/rc.pdf",
    });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["rcProAttestationUrl"]).toBe("https://r2/rc.pdf");
    // Sans quoi enregistrer la RC pro effacerait la date du contrat-cadre —
    // et ferait retomber le formateur en non-conformité de l'indicateur 27.
    expect("sousTraitantContratSigneAt" in data).toBe(false);
    expect("sousTraitantScreenshotUrl" in data).toBe(false);
  });

  it("date la capture data.gouv au moment de son dépôt", async () => {
    await updateTrainerSousTraitancePiecesAction({
      id: TRAINER_ID,
      sousTraitantScreenshotUrl: "https://r2/capture.png",
    });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    // Une capture sans date ne dirait pas QUAND la vérification a eu lieu —
    // c'est précisément ce que l'auditeur regarde.
    expect(data["sousTraitantScreenshotDate"]).toBeInstanceOf(Date);
  });

  it("efface la date quand la capture est retirée", async () => {
    await updateTrainerSousTraitancePiecesAction({
      id: TRAINER_ID,
      sousTraitantScreenshotUrl: null,
    });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    // Une date sans capture affirmerait qu'une preuve absente a été produite.
    expect(data["sousTraitantScreenshotDate"]).toBeNull();
  });

  it("enregistre le contrat-cadre, pièce BLOQUANTE de l'indicateur 27", async () => {
    const signe = new Date("2026-08-03T00:00:00.000Z");
    await updateTrainerSousTraitancePiecesAction({
      id: TRAINER_ID,
      sousTraitantContratSigneAt: signe,
    });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["sousTraitantContratSigneAt"]).toStrictEqual(signe);
  });

  it("accepte une RC pro absente — elle n'est PAS obligatoire (décision Will)", async () => {
    const result = await updateTrainerSousTraitancePiecesAction({
      id: TRAINER_ID,
      sousTraitantContratSigneAt: new Date("2026-08-03T00:00:00.000Z"),
      rcProAttestationUrl: null,
      rcProEcheanceAt: null,
    });

    // 🔴 Rien ne doit exiger la RC pro : la rendre obligatoire réduirait le
    // vivier de formateurs sans nécessité réglementaire (procédure § 4.2).
    expect("data" in result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it("refuse une URL malformée plutôt que de l'enregistrer", async () => {
    const result = await updateTrainerSousTraitancePiecesAction({
      id: TRAINER_ID,
      rcProAttestationUrl: "pas-une-url",
    });

    expect("error" in result).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
