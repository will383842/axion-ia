/**
 * Tests — saveSessionJoursAction.
 *
 * Cette action fait un `deleteMany` puis un `createMany`. C'est le seul endroit
 * du chantier qui SUPPRIME des lignes, et l'audit a relevé qu'il n'était pas
 * couvert. Ce qui compte ici :
 *
 *  · la suppression ne porte QUE sur `session_jours`, jamais sur les créneaux
 *    ni sur les signatures — en base, une absence émargée et un créneau vierge
 *    sont indiscernables, et « nettoyer ce qui ne correspond plus » détruirait
 *    des feuilles signées ;
 *  · les deux opérations vivent dans la MÊME transaction, sinon une session
 *    passe par un état sans aucune journée déclarée, où la génération des
 *    créneaux retombe silencieusement sur le repli ;
 *  · enregistrer CONFIRME les horaires — c'est ce qui distingue une proposition
 *    générée à la création d'un horaire assumé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: vi.fn() },
    // 🔴 `findMany` ajouté avec la GARDE DE REQUALIFICATION (2026-08-17) :
    // l'action lit désormais l'état AVANT pour savoir si les journées changent
    // réellement, et ce qui s'appuie déjà dessus.
    sessionJour: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
    documentGenere: { count: vi.fn() },
    enrollment: { count: vi.fn() },
    presenceCreneau: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-test-id" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { saveSessionJoursAction } from "@/server/actions/qualiopi/session-jours";

const mockPrisma = prisma as unknown as {
  trainingSession: { findUnique: ReturnType<typeof vi.fn> };
  sessionJour: {
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  documentGenere: { count: ReturnType<typeof vi.fn> };
  enrollment: { count: ReturnType<typeof vi.fn> };
  presenceCreneau: { count: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockGuard = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLog = logQualiopiActivity as ReturnType<typeof vi.fn>;

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const JOUR = (date: string, heureDebut = "09:00", heureFin = "17:00") => ({
  date,
  heureDebut,
  heureFin,
});

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, pas les valeurs de retour.
  mockGuard.mockResolvedValue({ userId: "admin-test-id" });
  mockLog.mockResolvedValue(undefined);
  mockPrisma.trainingSession.findUnique.mockResolvedValue({ id: SESSION_ID });
  mockPrisma.sessionJour.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.sessionJour.createMany.mockResolvedValue({ count: 0 });
  // Par défaut : aucune journée déclarée, aucune preuve. C'est l'état d'une
  // session vierge — celui où la correction doit rester libre.
  mockPrisma.sessionJour.findMany.mockResolvedValue([]);
  mockPrisma.documentGenere.count.mockResolvedValue(0);
  mockPrisma.enrollment.count.mockResolvedValue(0);
  mockPrisma.presenceCreneau.count.mockResolvedValue(0);
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
});

describe("saveSessionJoursAction", () => {
  it("enregistre les journées et retourne leur nombre", async () => {
    const res = await saveSessionJoursAction({
      sessionId: SESSION_ID,
      jours: [JOUR("2026-06-10"), JOUR("2026-06-11")],
    });
    expect(res).toEqual({ data: { nbJours: 2 } });
  });

  it("ne supprime QUE des journées, jamais un créneau ni une signature", async () => {
    await saveSessionJoursAction({ sessionId: SESSION_ID, jours: [JOUR("2026-06-10")] });

    // L'invariant qui compte : `sessionJour` est le seul modèle touché en
    // suppression. Le client mocké n'expose même pas `presenceCreneau`, donc
    // toute tentative ferait échouer le test — c'est voulu.
    expect(mockPrisma.sessionJour.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: SESSION_ID },
    });
  });

  it("supprime et recrée dans la MÊME transaction", async () => {
    await saveSessionJoursAction({ sessionId: SESSION_ID, jours: [JOUR("2026-06-10")] });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("marque les horaires comme CONFIRMÉS — c'est le geste de validation", async () => {
    await saveSessionJoursAction({ sessionId: SESSION_ID, jours: [JOUR("2026-06-10")] });
    const arg = mockPrisma.sessionJour.createMany.mock.calls[0]?.[0] as {
      data: Array<{ horairesConfirmes: boolean }>;
    };
    expect(arg.data.every((d) => d.horairesConfirmes === true)).toBe(true);
  });

  it("écrit la date à MINUIT UTC, comme `PresenceCreneau.date`", async () => {
    // Une colonne `@db.Date` relue à minuit UTC : écrire autre chose ferait
    // diverger la date d'un jour selon le fuseau de la session PostgreSQL.
    await saveSessionJoursAction({ sessionId: SESSION_ID, jours: [JOUR("2026-06-10")] });
    const arg = mockPrisma.sessionJour.createMany.mock.calls[0]?.[0] as {
      data: Array<{ date: Date }>;
    };
    expect(arg.data[0]?.date.toISOString()).toBe("2026-06-10T00:00:00.000Z");
  });

  it("accepte une liste VIDE — c'est le retour explicite au repli", async () => {
    const res = await saveSessionJoursAction({ sessionId: SESSION_ID, jours: [] });
    expect(res).toEqual({ data: { nbJours: 0 } });
    expect(mockPrisma.sessionJour.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.sessionJour.createMany).not.toHaveBeenCalled();
  });

  it("refuse une date en double avec un message lisible", async () => {
    // `session_jour_unique` la rejetterait avec une erreur Prisma brute.
    const res = await saveSessionJoursAction({
      sessionId: SESSION_ID,
      jours: [JOUR("2026-06-10"), JOUR("2026-06-10", "14:00", "18:00")],
    });
    expect("error" in res).toBe(true);
    if (!("error" in res)) return;
    expect(res.error).toContain("2026-06-10");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse une session inexistante avant toute écriture", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);
    const res = await saveSessionJoursAction({
      sessionId: SESSION_ID,
      jours: [JOUR("2026-06-10")],
    });
    expect("error" in res).toBe(true);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["une heure hors bornes", JOUR("2026-06-10", "25:30", "26:00")],
    ["une fin avant le début", JOUR("2026-06-10", "17:00", "09:00")],
    ["une fin égale au début", JOUR("2026-06-10", "09:00", "09:00")],
    ["une date mal formée", JOUR("10/06/2026")],
  ])("refuse %s", async (_, jour) => {
    const res = await saveSessionJoursAction({ sessionId: SESSION_ID, jours: [jour] });
    expect("error" in res).toBe(true);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse un identifiant de session qui n'est pas un UUID", async () => {
    const res = await saveSessionJoursAction({ sessionId: "pas-un-uuid", jours: [] });
    expect("error" in res).toBe(true);
  });

  it("journalise l'opération", async () => {
    await saveSessionJoursAction({ sessionId: SESSION_ID, jours: [JOUR("2026-06-10")] });
    expect(mockLog).toHaveBeenCalledTimes(1);
    const arg = mockLog.mock.calls[0]?.[0] as { action: string; targetId: string };
    expect(arg.action).toBe("qualiopi.session.jours.save");
    expect(arg.targetId).toBe(SESSION_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 GARDE DE REQUALIFICATION — trouvée le 2026-08-17 en auditant le Lot 3.
//
// L'action faisait `deleteMany` + `createMany` SANS regarder ce qui s'appuie
// déjà sur ces journées. Or la FEUILLE D'ÉMARGEMENT les imprime, et elle est
// opposable : réécrire après émission faisait diverger la pièce et le dossier,
// en silence.
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 saveSessionJoursAction — requalification quand des preuves existent", () => {
  const AVANT = [
    { date: new Date("2026-06-10T00:00:00.000Z"), heureDebut: "09:00", heureFin: "17:00" },
  ];

  it("REFUSE de réécrire quand une feuille d'émargement est émise, sans motif", async () => {
    mockPrisma.sessionJour.findMany.mockResolvedValue(AVANT);
    mockPrisma.documentGenere.count.mockResolvedValue(1);

    const res = await saveSessionJoursAction({
      sessionId: SESSION_ID,
      jours: [JOUR("2026-06-12")],
    });

    expect("error" in res).toBe(true);
    const message = (res as { error: string }).error;
    expect(message).toContain("opposable");
    expect(message).toContain("motif de la requalification");
    // 🔴 Et surtout : RIEN n'a été écrit. Un refus qui écrit quand même serait
    // pire que pas de refus du tout.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.sessionJour.deleteMany).not.toHaveBeenCalled();
  });

  it("ACCEPTE avec un motif, et le verse au JOURNAL", async () => {
    mockPrisma.sessionJour.findMany.mockResolvedValue(AVANT);
    mockPrisma.documentGenere.count.mockResolvedValue(1);

    const res = await saveSessionJoursAction({
      sessionId: SESSION_ID,
      jours: [JOUR("2026-06-12")],
      motifRequalification: "Report du 10 au 12 juin à la demande du client, convenu par courriel.",
    });

    expect("data" in res).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    // Le motif ne doit pas rester à l'écran : c'est au journal que l'auditeur
    // ira chercher pourquoi la pièce et le dossier ont divergé.
    const journal = mockLog.mock.calls.at(-1)![0] as {
      changes: { requalification?: { motif?: string; enJeu?: string[] } };
    };
    expect(journal.changes.requalification?.motif).toContain("Report du 10 au 12 juin");
    expect(journal.changes.requalification?.enJeu?.join(" ")).toContain("feuille");
  });

  it("une session VIERGE se corrige sans motif — le défaut D4 n'est pas recréé", async () => {
    // Interdire ici reproduirait le défaut que le plan dénonce : devoir créer
    // une nouvelle session pour une faute de frappe.
    mockPrisma.sessionJour.findMany.mockResolvedValue(AVANT);
    const res = await saveSessionJoursAction({
      sessionId: SESSION_ID,
      jours: [JOUR("2026-06-12")],
    });
    expect("data" in res).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("réenregistrer À L'IDENTIQUE ne demande rien, même avec des preuves", async () => {
    // 🔴 Exiger un motif sur un clic sans effet apprendrait à en inventer un —
    // et un motif inventé au registre est pire qu'un motif absent.
    mockPrisma.sessionJour.findMany.mockResolvedValue(AVANT);
    mockPrisma.documentGenere.count.mockResolvedValue(3);
    mockPrisma.enrollment.count.mockResolvedValue(2);

    const res = await saveSessionJoursAction({
      sessionId: SESSION_ID,
      jours: [JOUR("2026-06-10")],
    });
    expect("data" in res).toBe(true);
  });

  it("un émargement SIGNÉ suffit à exiger le motif, même sans feuille émise", async () => {
    mockPrisma.sessionJour.findMany.mockResolvedValue(AVANT);
    mockPrisma.enrollment.count.mockResolvedValue(2);

    const res = await saveSessionJoursAction({
      sessionId: SESSION_ID,
      jours: [JOUR("2026-06-12")],
    });
    expect("error" in res).toBe(true);
    expect((res as { error: string }).error).toContain("signé");
  });
});
