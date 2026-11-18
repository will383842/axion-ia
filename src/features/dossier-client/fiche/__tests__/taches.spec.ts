// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ journal: vi.fn(async () => undefined) }));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class extends Error {},
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: h.journal }));

import { creerTache, etatDeLaTache, jourDeParis, marquerFaite, rouvrir } from "../taches";

const C = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";
const T = "33333333-3333-4333-8333-333333333333";
const acteur = { userId: "u", role: "super_admin" as const };

function base(over: { contact?: unknown; projet?: unknown; maj?: number } = {}) {
  return {
    clientTache: {
      create: vi.fn(async () => ({ id: T })),
      updateMany: vi.fn(async () => ({ count: over.maj ?? 1 })),
      findFirst: vi.fn(async () => ({ id: T })),
      findMany: vi.fn(),
    },
    clientContact: { findFirst: vi.fn(async () => over.contact ?? null) },
    projet: { findFirst: vi.fn(async () => over.projet ?? null) },
  };
}
const p = (o: Partial<Parameters<typeof creerTache>[1]> = {}) => ({
  clientId: C,
  intitule: "Rappeler le dirigeant",
  avantLe: "2026-11-05",
  responsable: "",
  contactId: null,
  projetId: null,
  acteur,
  ...o,
});

beforeEach(() => {
  h.journal.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("creerTache", () => {
  it("crée une tâche manuelle, responsable « Will » par défaut, et la trace", async () => {
    const db = base();
    await creerTache(db as never, p());
    const arg = (
      db.clientTache.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0];
    expect(arg.data).toMatchObject({
      clientId: C,
      responsableLabel: "Will",
      origine: "manuelle",
      contactId: null,
      projetId: null,
    });
    expect(h.journal).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.journal.mock.calls)).not.toContain("Rappeler");
  });

  it("refuse une personne d'un autre client, sans rien écrire", async () => {
    const db = base({ contact: null });
    await expect(creerTache(db as never, p({ contactId: AUTRE }))).rejects.toThrow(
      "Cette personne n'est pas sur cette fiche.",
    );
    expect(db.clientContact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: AUTRE, clientId: C, statut: "actif" } }),
    );
    expect(db.clientTache.create).not.toHaveBeenCalled();
  });

  it("refuse une prestation d'un autre client, sans rien écrire", async () => {
    const db = base({ projet: null });
    await expect(creerTache(db as never, p({ projetId: AUTRE }))).rejects.toThrow(
      "Cette prestation n'est pas sur cette fiche.",
    );
    expect(db.clientTache.create).not.toHaveBeenCalled();
  });

  it("accepte une personne et une prestation de la fiche", async () => {
    const db = base({ contact: { id: AUTRE }, projet: { id: AUTRE } });
    await creerTache(db as never, p({ contactId: AUTRE, projetId: AUTRE }));
    expect(db.clientTache.create).toHaveBeenCalledTimes(1);
  });

  it("refuse un intitulé vide ou trop long, une date impossible", async () => {
    const db = base();
    await expect(creerTache(db as never, p({ intitule: "  " }))).rejects.toThrow();
    await expect(creerTache(db as never, p({ intitule: "x".repeat(301) }))).rejects.toThrow();
    await expect(creerTache(db as never, p({ avantLe: "2026-02-31" }))).rejects.toThrow();
    expect(db.clientTache.create).not.toHaveBeenCalled();
  });
});

describe("marquerFaite et rouvrir", () => {
  it("faite puis rouverte : pose puis remet à vide, trace chaque fois", async () => {
    const db = base();
    expect(
      await marquerFaite(db as never, { tacheId: T, clientId: C, maintenant: new Date(), acteur }),
    ).toBe("fait");
    expect(db.clientTache.updateMany).toHaveBeenLastCalledWith({
      where: { id: T, clientId: C, faiteLe: null },
      data: { faiteLe: new Date("2026-10-30T12:00:00Z") },
    });
    expect(await rouvrir(db as never, { tacheId: T, clientId: C, acteur })).toBe("fait");
    expect(db.clientTache.updateMany).toHaveBeenLastCalledWith({
      where: { id: T, clientId: C, faiteLe: { not: null } },
      data: { faiteLe: null },
    });
    expect(h.journal).toHaveBeenCalledTimes(2);
  });

  it("déjà dans cet état : rien écrit, rien tracé", async () => {
    const db = base({ maj: 0 });
    expect(
      await marquerFaite(db as never, { tacheId: T, clientId: C, maintenant: new Date(), acteur }),
    ).toBe("deja");
    expect(h.journal).not.toHaveBeenCalled();
  });

  it("tâche d'une autre fiche : refus explicite", async () => {
    const db = base({ maj: 0 });
    db.clientTache.findFirst.mockResolvedValue(null as never);
    await expect(rouvrir(db as never, { tacheId: T, clientId: C, acteur })).rejects.toThrow(
      "Cette tâche n'est pas sur cette fiche.",
    );
  });

  it("aucun delete n'existe dans le service", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of [
      "src/features/dossier-client/fiche/taches.ts",
      "src/features/dossier-client/fiche/actions-taches.ts",
      "src/components/admin/dossier-client/fiche/ResumeTaches.tsx",
    ]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/\.delete(Many)?\(/);
    }
  });
});

describe("jour de Paris", () => {
  it("à 23 h 30 UTC le 30/10 (hiver proche), Paris est déjà le 31 ; état à minuit Paris", () => {
    expect(jourDeParis(new Date("2026-10-30T23:30:00Z"))).toBe("2026-10-31");
    expect(jourDeParis(new Date("2026-10-30T23:00:00Z"))).toBe("2026-10-31");
    expect(jourDeParis(new Date("2026-10-30T22:59:00Z"))).toBe("2026-10-30");
    expect(etatDeLaTache("2026-10-30", "2026-10-31")).toBe("en_retard");
    expect(etatDeLaTache("2026-10-31", "2026-10-31")).toBe("aujourdhui");
    expect(etatDeLaTache("2026-11-01", "2026-10-31")).toBe("a_venir");
  });
});
