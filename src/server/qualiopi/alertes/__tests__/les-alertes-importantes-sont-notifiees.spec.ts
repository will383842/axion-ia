/**
 * Les alertes de niveau « important » (dont le besoin d'adaptation) partaient
 * dans le vide : la sélection de `notifierAlertesGroupees` ne retenait que
 * `critique` et deux codes de déblocage, donc `notified_at` restait vide pour
 * toujours.
 *
 * Ce test joue contre un MAGASIN EN MÉMOIRE qui applique réellement les filtres
 * `where` (niveau, résolue, notifiedAt, code) : un mock qui rendrait la liste
 * qu'on lui a donnée ne verrait pas la sélection, qui est le sujet.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Ligne {
  id: string;
  code: string;
  niveau: "info" | "important" | "critique";
  titre: string;
  message: string;
  cibleType: string | null;
  cibleId: string | null;
  resolue: boolean;
  notifiedAt: Date | null;
  createdAt: Date;
}

const store: Ligne[] = [];

type Cond = Record<string, unknown>;
function correspond(l: Ligne, w: Cond): boolean {
  for (const [k, v] of Object.entries(w)) {
    if (k === "OR") {
      if (!(v as Cond[]).some((c) => correspond(l, c))) return false;
      continue;
    }
    const val = (l as unknown as Record<string, unknown>)[k];
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const o = v as { in?: unknown[]; notIn?: unknown[] };
      if (o.in && !o.in.includes(val)) return false;
      if (o.notIn && o.notIn.includes(val)) return false;
    } else if (v instanceof Date ? val?.toString() !== v.toString() : val !== v) return false;
  }
  return true;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alerteSysteme: {
      findMany: vi.fn(async ({ where }: { where: Cond }) =>
        store.filter((l) => correspond(l, where)),
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Cond; data: Partial<Ligne> }) => {
        const touchees = store.filter((l) => correspond(l, where));
        for (const l of touchees) Object.assign(l, data);
        return { count: touchees.length };
      }),
    },
    adminUser: {
      findMany: vi.fn(async () => [{ email: "direction@axion-ia.com", role: "admin" }]),
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(async () => ({ enqueued: true })),
}));

import { notifierAlertesGroupees } from "../envoi-groupe";

const MAINTENANT = new Date("2026-10-16T07:00:00.000Z");

function alerte(id: string, p: Partial<Ligne>): Ligne {
  return {
    id,
    code: "besoin_adaptation_declare",
    niveau: "important",
    titre: "t",
    message: "m",
    cibleType: null,
    cibleId: null,
    resolue: false,
    notifiedAt: null,
    createdAt: new Date("2026-10-10T00:00:00.000Z"),
    ...p,
  };
}

beforeEach(() => {
  store.length = 0;
  delete process.env["DATABASE_URL"];
  process.env["QUALIOPI_ALERTE_EMAIL"] = "secours@axion-ia.com";
});

describe("alertes « important »", () => {
  it("une alerte ouverte de niveau important est notifiée : notified_at est rempli", async () => {
    const a = alerte("a1", {});
    store.push(a);

    const r = await notifierAlertesGroupees(MAINTENANT);

    expect(r.alertes).toBe(1);
    expect(a.notifiedAt).toEqual(MAINTENANT);
  });

  it("une alerte DÉJÀ RÉSOLUE n'est jamais notifiée après coup (aucune avalanche)", async () => {
    const resolue = alerte("r1", { resolue: true });
    const ancienne = alerte("r2", { resolue: true, createdAt: new Date("2026-01-01T00:00:00Z") });
    store.push(resolue, ancienne);

    const r = await notifierAlertesGroupees(MAINTENANT);

    expect(r.alertes).toBe(0);
    expect(resolue.notifiedAt).toBeNull();
    expect(ancienne.notifiedAt).toBeNull();
  });

  it("une alerte info reste muette, et une alerte déjà notifiée n'est pas renvoyée", async () => {
    const info = alerte("i1", { niveau: "info" });
    const deja = alerte("d1", { notifiedAt: new Date("2026-10-11T07:00:00Z") });
    store.push(info, deja);

    const r = await notifierAlertesGroupees(MAINTENANT);

    expect(r.alertes).toBe(0);
    expect(info.notifiedAt).toBeNull();
    expect(deja.notifiedAt).toEqual(new Date("2026-10-11T07:00:00Z"));
  });
});
