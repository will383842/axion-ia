import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  statut: "signe",
  version: 1,
  logs: [] as Array<Record<string, unknown>>,
  resiliations: [] as Array<Record<string, unknown>>,
  maj: [] as Array<Record<string, unknown>>,
  envoi: "envoye" as string,
  envois: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../jeton", () => ({ urlDossier: (id: string, v: number) => `https://x.test/${id}/${v}` }));
vi.mock("../retrait", () => ({ argentEnJeu: vi.fn(async () => true) }));
vi.mock("../reservation-presentation", () => ({
  lireReservations: vi.fn(async () => new Map()),
  tableAbsente: () => false,
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    d.envois.push(e);
    return d.envoi;
  }),
}));
vi.mock("../verification", () => ({
  preparerLien: vi.fn(async (id: string) =>
    d.statut === "resilie"
      ? { ok: false, message: "Ce dossier est fermé." }
      : {
          ok: true,
          envoi: {
            gabarit: "apporteur-lien-espace",
            destinataire: "a@b.fr",
            payload: { lien: `https://x.test/${id}/${d.version}` },
            entityType: "ApporteurReseau",
            entityId: id,
          },
        },
  ),
}));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    apporteurReseau: {
      findUnique: vi.fn(async () => ({
        prenom: "A",
        email: "a@b.fr",
        versionLien: d.version,
      })),
      updateMany: vi.fn(async (a: { where: { statut: { notIn: string[] } } }) => {
        if (a.where.statut.notIn.includes(d.statut)) return { count: 0 };
        d.version += 1;
        return { count: 1 };
      }),
    },
    apporteurResiliation: {
      findMany: vi.fn(async () => d.resiliations),
      updateMany: vi.fn(async (a: { data: Record<string, unknown> }) => {
        d.maj.push(a.data);
        return { count: 1 };
      }),
    },
    activityLog: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => void d.logs.push(a.data)),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return { prisma };
});

import { revoquerEtRenvoyerLien } from "../revocation-lien";
import { renvoyerEmailsEffetManques } from "../resiliation";

const MAINT = new Date("2026-12-01T08:00:00Z");

beforeEach(() => {
  d.statut = "signe";
  d.version = 1;
  d.logs.length = 0;
  d.resiliations.length = 0;
  d.maj.length = 0;
  d.envois.length = 0;
  d.envoi = "envoye";
});

describe("point 21 : révoquer et renvoyer le lien", () => {
  it("incrémente versionLien, journalise, renvoie le lien neuf par l'e-mail d'espace", async () => {
    const r = await revoquerEtRenvoyerLien("APP1", "11111111-1111-4111-8111-111111111111");
    expect(r.ok).toBe(true);
    expect(d.version).toBe(2);
    expect(d.logs[0]).toMatchObject({
      action: "apporteur.lien_revoque",
      targetId: "APP1",
      adminUserId: "11111111-1111-4111-8111-111111111111",
    });
    expect(d.envois[0]).toMatchObject({
      gabarit: "apporteur-lien-espace",
      jobId: "lien-revoque-APP1-2",
    });
  });
  it("dossier fermé : rien n'est révoqué ni envoyé", async () => {
    d.statut = "resilie";
    const r = await revoquerEtRenvoyerLien("APP1", "");
    expect(r.ok).toBe(false);
    expect(d.version).toBe(1);
    expect(d.envois).toHaveLength(0);
  });
  it("e-mail non parti : lien révoqué, message clair", async () => {
    d.envoi = "indisponible";
    const r = await revoquerEtRenvoyerLien("APP1", "");
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/n'est pas parti/);
  });
});

describe("point 9 : e-mail de prise d'effet renvoyé", () => {
  it("renvoie avec la clé de journal d'origine et pose emailEffetEnvoyeAt", async () => {
    d.resiliations.push({ apporteurId: "APP1", effetLe: new Date("2026-11-30T00:00:00Z") });
    expect(await renvoyerEmailsEffetManques(MAINT)).toBe(1);
    expect(d.envois[0]).toMatchObject({
      gabarit: "apporteur-resiliation-effective",
      jobId: "resiliation-effet-APP1",
    });
    expect(d.maj[0]).toEqual({ emailEffetEnvoyeAt: MAINT });
  });
  it("envoi qui échoue encore : horodatage non posé, repris le lendemain ; rien à faire : silence", async () => {
    d.resiliations.push({ apporteurId: "APP1", effetLe: MAINT });
    d.envoi = "indisponible";
    expect(await renvoyerEmailsEffetManques(MAINT)).toBe(0);
    expect(d.maj).toHaveLength(0);
    d.resiliations.length = 0;
    d.envois.length = 0;
    expect(await renvoyerEmailsEffetManques(MAINT)).toBe(0);
    expect(d.envois).toHaveLength(0);
  });
});
