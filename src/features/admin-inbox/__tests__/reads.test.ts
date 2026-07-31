// Accusés de lecture de la boîte de réception (ADR 0036, 2026-07-29).
//
// Deux propriétés valent d'être verrouillées :
//   • le marquage est IDEMPOTENT et ne rafraîchit pas la date de première
//     lecture — sinon « lu il y a 3 jours » redeviendrait « lu à l'instant »
//     à chaque affichage de la fiche, et l'information perdrait tout sens ;
//   • un échec ne remonte JAMAIS : la fiche d'une demande client doit
//     s'afficher même si l'accusé de lecture ne peut pas être écrit.

import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn();
const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminInboxRead: {
      upsert: (...a: unknown[]) => upsertMock(...a),
      findMany: (...a: unknown[]) => findManyMock(...a),
    },
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { markInboxRead, fetchReadIds, ENTITY_BY_CHANNEL } from "../reads";

beforeEach(() => {
  vi.clearAllMocks();
  upsertMock.mockResolvedValue({});
  findManyMock.mockResolvedValue([]);
});

describe("markInboxRead", () => {
  it("upsert idempotent, sans écraser la date de première lecture", async () => {
    expect(await markInboxRead("admin-1", "submission", "sub-9")).toBe(true);
    const arg = upsertMock.mock.calls[0]?.[0] as {
      where: unknown;
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    };
    expect(arg.where).toEqual({
      adminUserId_entityType_entityId: {
        adminUserId: "admin-1",
        entityType: "submission",
        entityId: "sub-9",
      },
    });
    // `update` vide = on garde `readAt` d'origine.
    expect(arg.update).toEqual({});
    expect(arg.create).toEqual({
      adminUserId: "admin-1",
      entityType: "submission",
      entityId: "sub-9",
    });
  });

  it("sans admin identifié : n'écrit rien plutôt que d'inventer un propriétaire", async () => {
    expect(await markInboxRead(null, "submission", "sub-9")).toBe(false);
    expect(await markInboxRead(undefined, "submission", "sub-9")).toBe(false);
    expect(await markInboxRead("admin-1", "submission", "")).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("un échec base ne remonte pas — la fiche doit s'afficher", async () => {
    upsertMock.mockRejectedValueOnce(new Error("db down"));
    await expect(markInboxRead("admin-1", "calendly_event", "cal-1")).resolves.toBe(false);
  });
});

describe("fetchReadIds", () => {
  it("regroupe les ids lus par type d'entité", async () => {
    findManyMock.mockResolvedValueOnce([
      { entityType: "submission", entityId: "s1" },
      { entityType: "submission", entityId: "s2" },
      { entityType: "calendly_event", entityId: "c1" },
    ]);
    const read = await fetchReadIds("admin-1");
    expect([...read.submission]).toEqual(["s1", "s2"]);
    expect([...read.calendly_event]).toEqual(["c1"]);
    expect(read.job_application.size).toBe(0);
  });

  it("une seule requête pour les 4 canaux", async () => {
    await fetchReadIds("admin-1");
    expect(findManyMock).toHaveBeenCalledOnce();
  });

  // Choix délibéré : en cas de panne, tout apparaît NON LU. Mieux vaut attirer
  // l'œil à tort que masquer une demande en attente.
  it("échec de lecture → tout non lu, jamais d'exception", async () => {
    findManyMock.mockRejectedValueOnce(new Error("db down"));
    const read = await fetchReadIds("admin-1");
    expect(read.submission.size).toBe(0);
  });

  it("sans admin : aucune requête", async () => {
    await fetchReadIds(null);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

// La table d'enum et les canaux d'affichage doivent rester alignés : un canal
// sans correspondance ferait planter la résolution du non-lu à l'exécution.
describe("ENTITY_BY_CHANNEL", () => {
  it("couvre les 4 canaux, sans doublon", () => {
    const values = Object.values(ENTITY_BY_CHANNEL);
    expect(Object.keys(ENTITY_BY_CHANNEL).sort()).toEqual([
      "appel",
      "candidature",
      "message",
      "podcast",
    ]);
    expect(new Set(values).size).toBe(4);
  });
});
