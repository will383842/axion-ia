/**
 * « Le client demande un délai » : mocks calqués sur `devis-prolonger-validite.spec.ts`.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  ecriture: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  findManyJournal: vi.fn(),
  logCreate: vi.fn(),
  journal: vi.fn(),
  txAlerteUpdateMany: vi.fn(),
  txLogCreate: vi.fn(),
  txRejet: null as Error | null,
  autres: vi.fn(),
  ordre: [] as string[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: {
      findUnique: (...a: unknown[]) => h.findUnique(...a),
      count: (...a: unknown[]) => h.count(...a),
      update: (...a: unknown[]) => h.autres("devis.update", ...a),
      updateMany: (...a: unknown[]) => h.autres("devis.updateMany", ...a),
    },
    activityLog: {
      findMany: (...a: unknown[]) => h.findManyJournal(...a),
      create: (...a: unknown[]) => h.logCreate(...a),
    },
    $transaction: async (f: (t: unknown) => unknown) => {
      if (h.txRejet) throw h.txRejet;
      const tx = {
        alerteSysteme: {
          updateMany: (...a: unknown[]) => {
            h.ordre.push("alertes");
            return h.txAlerteUpdateMany(...a);
          },
        },
        activityLog: {
          create: (...a: unknown[]) => {
            h.ordre.push("journal");
            return h.txLogCreate(...a);
          },
        },
        devis: {
          update: (...a: unknown[]) => h.autres("tx.devis.update", ...a),
          updateMany: (...a: unknown[]) => h.autres("tx.devis.updateMany", ...a),
        },
        relanceProposee: {
          updateMany: (...a: unknown[]) => h.autres("tx.relanceProposee", ...a),
          create: (...a: unknown[]) => h.autres("tx.relanceProposee", ...a),
        },
        emailOutbox: {
          create: (...a: unknown[]) => h.autres("tx.emailOutbox", ...a),
        },
      };
      return f(tx);
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: (...a: unknown[]) => h.ecriture(...a),
  donneesJournalQualiopi: (...a: unknown[]) => h.journal(...a),
}));

import { demanderDelaiClientAction, leverDelaiClientAction } from "./devis-delai-client";

const ID = "11111111-1111-4111-8111-111111111111";
const SESSION = { userId: "adm-1", role: "editor" };

const devisLu = (over: Record<string, unknown> = {}) => ({
  statut: "envoye",
  numero: "AXI-DEV-2026-001",
  dateValidite: new Date("2026-12-31T22:59:59Z"),
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-10T10:00:00Z"));
  vi.resetAllMocks();
  h.ordre.length = 0;
  h.txRejet = null;
  h.ecriture.mockResolvedValue(SESSION);
  h.findUnique.mockResolvedValue(devisLu());
  h.count.mockResolvedValue(1);
  h.txAlerteUpdateMany.mockResolvedValue({ count: 2 });
  h.txLogCreate.mockResolvedValue({});
  h.logCreate.mockResolvedValue({});
  h.journal.mockImplementation(async (x: unknown) => ({ ...(x as object), data: "journal" }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("demanderDelaiClientAction", () => {
  it("droits refusés : message et aucune écriture", async () => {
    h.ecriture.mockRejectedValue(new Error("non"));
    const r = await demanderDelaiClientAction({ devisId: ID, jour: "2026-07-17" });
    expect(r).toEqual({ error: "Vos droits ne permettent pas d'enregistrer un délai." });
    expect(h.txLogCreate).not.toHaveBeenCalled();
    expect(h.findUnique).not.toHaveBeenCalled();
  });

  it("date invalide", async () => {
    expect(await demanderDelaiClientAction({ devisId: ID, jour: "2026-02-30" })).toEqual({
      error: "Date invalide.",
    });
    expect(await demanderDelaiClientAction({ devisId: "x", jour: "2026-07-17" })).toEqual({
      error: "Date invalide.",
    });
    expect(await demanderDelaiClientAction({ devisId: ID, jour: "17/07/2026" })).toEqual({
      error: "Date invalide.",
    });
  });

  it("date hors bornes : message avec les deux dates", async () => {
    const r = await demanderDelaiClientAction({ devisId: ID, jour: "2026-07-10" });
    expect(r).toEqual({ error: "Choisissez une date entre le 11/07/2026 et le 08/10/2026." });
  });

  it("date après la validité : message qui cite la validité", async () => {
    h.findUnique.mockResolvedValue(devisLu({ dateValidite: new Date("2026-07-20T21:59:59Z") }));
    const r = await demanderDelaiClientAction({ devisId: ID, jour: "2026-07-25" });
    expect(r).toEqual({
      error:
        "Choisissez une date entre le 11/07/2026 et le 20/07/2026 (la validité du devis s'arrête le 20/07/2026).",
    });
  });

  it("validité qui se termine aujourd'hui : prolonger d'abord", async () => {
    h.findUnique.mockResolvedValue(devisLu({ dateValidite: new Date("2026-07-10T21:59:59Z") }));
    const r = await demanderDelaiClientAction({ devisId: ID, jour: "2026-07-11" });
    expect(r).toEqual({
      error:
        "La validité de ce devis se termine aujourd'hui : prolongez-la d'abord pour accorder un délai.",
    });
  });

  it("devis introuvable", async () => {
    h.findUnique.mockResolvedValue(null);
    expect(await demanderDelaiClientAction({ devisId: ID, jour: "2026-07-17" })).toEqual({
      error: "Ce devis est introuvable.",
    });
  });

  it("devis non envoyé refusé", async () => {
    h.findUnique.mockResolvedValue(devisLu({ statut: "expire" }));
    expect(await demanderDelaiClientAction({ devisId: ID, jour: "2026-07-17" })).toEqual({
      error: "Seul un devis envoyé et encore valable peut recevoir un délai.",
    });
  });

  it("validité dépassée refusée", async () => {
    h.findUnique.mockResolvedValue(devisLu({ dateValidite: new Date("2026-07-09T21:59:59Z") }));
    expect(await demanderDelaiClientAction({ devisId: ID, jour: "2026-07-17" })).toEqual({
      error: "Seul un devis envoyé et encore valable peut recevoir un délai.",
    });
  });

  it("devis signé par le client refusé", async () => {
    h.count.mockResolvedValue(0);
    expect(await demanderDelaiClientAction({ devisId: ID, jour: "2026-07-17" })).toEqual({
      error:
        "Le client a déjà signé ce devis : il reste à le contresigner, aucun délai n'est utile.",
    });
    expect(h.txLogCreate).not.toHaveBeenCalled();
  });

  it("succès : alertes refermées PUIS journal, aucune autre écriture", async () => {
    const r = await demanderDelaiClientAction({ devisId: ID, jour: "2026-07-17" });
    expect(r).toEqual({ data: { jourLisible: "17/07/2026" } });
    expect(h.ordre).toEqual(["alertes", "journal"]);
    expect(h.txAlerteUpdateMany).toHaveBeenCalledWith({
      where: {
        code: { in: ["devis_sans_reponse", "devis_expire_j7"] },
        cibleId: ID,
        resolue: false,
      },
      data: { resolue: true, resolueAt: new Date("2026-07-10T10:00:00Z") },
    });
    const arg = h.journal.mock.calls[0]?.[0] as {
      action: string;
      targetType: string;
      targetId: string;
      changes: Record<string, unknown>;
      session: unknown;
    };
    expect(arg.action).toBe("qualiopi.devis.delai_client.demande");
    expect(arg.targetType).toBe("Devis");
    expect(arg.targetId).toBe(ID);
    expect(arg.changes["finDelai"]).toBe("2026-07-16T22:00:00.000Z");
    expect(arg.changes["alertesRefermees"]).toBe(2);
    expect(arg.session).toBe(SESSION);
    expect(h.txLogCreate).toHaveBeenCalledTimes(1);
    expect(h.logCreate).not.toHaveBeenCalled();
    expect(h.autres).not.toHaveBeenCalled();
  });

  it("échec du journal : message « réessayez », rien d'autre", async () => {
    h.txRejet = new Error("base indisponible");
    const r = await demanderDelaiClientAction({ devisId: ID, jour: "2026-07-17" });
    expect(r).toEqual({ error: "Le délai n'a pas pu être enregistré. Réessayez." });
    expect(h.autres).not.toHaveBeenCalled();
  });

  it("aucun module e-mail ni file, ni journal « au mieux »", () => {
    const src = readFileSync("src/server/actions/qualiopi/devis-delai-client.ts", "utf8");
    expect(src).not.toContain("@/server/email");
    expect(src).not.toContain("@/lib/email");
    expect(src).not.toContain("@/server/queue");
    expect(src).not.toContain("logQualiopiActivity");
  });
});

describe("leverDelaiClientAction", () => {
  it("droits refusés", async () => {
    h.ecriture.mockRejectedValue(new Error("non"));
    expect(await leverDelaiClientAction({ devisId: ID })).toEqual({
      error: "Vos droits ne permettent pas de lever un délai.",
    });
  });

  it("sans délai actif : refusé", async () => {
    h.findManyJournal.mockResolvedValue([]);
    expect(await leverDelaiClientAction({ devisId: ID })).toEqual({
      error: "Aucun délai en cours pour ce devis.",
    });
    expect(h.logCreate).not.toHaveBeenCalled();
  });

  it("avec un délai : écrit l'entrée « levée »", async () => {
    h.findManyJournal.mockResolvedValue([
      {
        targetId: ID,
        action: "qualiopi.devis.delai_client.demande",
        changes: { finDelai: "2026-07-16T22:00:00.000Z" },
        createdAt: new Date("2026-07-09T10:00:00Z"),
        id: "a",
      },
    ]);
    expect(await leverDelaiClientAction({ devisId: ID })).toEqual({ data: { leve: true } });
    const arg = h.journal.mock.calls[0]?.[0] as { action: string; changes: unknown };
    expect(arg.action).toBe("qualiopi.devis.delai_client.leve");
    expect(arg.changes).toEqual({ finDelaiAvant: "2026-07-16T22:00:00.000Z" });
    expect(h.logCreate).toHaveBeenCalledTimes(1);
  });
});
