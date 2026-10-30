// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const trace = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class extends Error {},
  messageAffichable: (e: unknown) => (e instanceof Error ? e.message : "?"),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: trace }));

import { annulerDepart, dateDeDepartValide, ErreurDepart, noterDepart } from "../depart-personne";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";
const PERSONNE = "33333333-3333-4333-8333-333333333333";
const MAINTENANT = new Date("2026-10-29T10:00:00Z");
const acteur = { userId: "u1", role: "super_admin" } as const;

/** Base en mémoire : une personne, avec statut et date, et les gardes `statut` du `where`. */
function fausseBase(
  depart: { statut: "actif" | "parti"; partiLe: Date | null } = { statut: "actif", partiLe: null },
) {
  const etat = { ...depart };
  type W = { id: string; clientId: string; statut?: string };
  const ici = (w: W) => w.id === PERSONNE && w.clientId === CLIENT;
  const updateMany = vi.fn(
    async (a: { where: W; data: { statut: "actif" | "parti"; partiLe: Date | null } }) => {
      if (!ici(a.where) || (a.where.statut !== undefined && a.where.statut !== etat.statut)) {
        return { count: 0 };
      }
      Object.assign(etat, a.data);
      return { count: 1 };
    },
  );
  const findFirst = vi.fn(async (a: { where: W }) =>
    ici(a.where) ? { ...etat, estContactFacturation: false } : null,
  );
  const base = {
    clientContact: {
      updateMany,
      findFirst,
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return { base: base as never, updateMany, mocks: base.clientContact, etat };
}

beforeEach(() => trace.mockClear());

describe("noter le départ", () => {
  it("pose le statut parti et la date choisie, trace l'action", async () => {
    const { base, updateMany } = fausseBase();
    await noterDepart(base, {
      contactId: PERSONNE,
      clientId: CLIENT,
      partiLe: "2026-10-15",
      maintenant: MAINTENANT,
      acteur,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: PERSONNE, clientId: CLIENT, statut: "actif" },
      data: { statut: "parti", partiLe: new Date("2026-10-15T00:00:00.000Z") },
    });
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({ action: "dossier_client.depart_note", targetId: PERSONNE }),
    );
  });

  it("refuse une personne d'un autre client, sans trace", async () => {
    const { base } = fausseBase();
    await expect(
      noterDepart(base, {
        contactId: PERSONNE,
        clientId: AUTRE,
        partiLe: "2026-10-15",
        maintenant: MAINTENANT,
        acteur,
      }),
    ).rejects.toBeInstanceOf(ErreurDepart);
    expect(trace).not.toHaveBeenCalled();
  });

  it("deux envois successifs : une seule trace, la date du premier est gardée", async () => {
    const { base, etat } = fausseBase();
    const p = { contactId: PERSONNE, clientId: CLIENT, maintenant: MAINTENANT, acteur };
    const un = await noterDepart(base, { ...p, partiLe: "2026-10-15" });
    const deux = await noterDepart(base, { ...p, partiLe: "2026-10-20" });
    expect(un.issue).toBe("fait");
    expect(deux.issue).toBe("deja");
    expect(trace).toHaveBeenCalledTimes(1);
    expect(etat.partiLe).toEqual(new Date("2026-10-15T00:00:00.000Z"));
  });

  it("la trace ne porte ni nom ni adresse", async () => {
    const { base } = fausseBase();
    await noterDepart(base, {
      contactId: PERSONNE,
      clientId: CLIENT,
      partiLe: "2026-10-15",
      maintenant: MAINTENANT,
      acteur,
    });
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { clientId: CLIENT, partiLe: "2026-10-15" } }),
    );
  });

  it("refuse une date à venir, inexistante ou mal formée", () => {
    expect(dateDeDepartValide("2026-10-30", MAINTENANT)).toBe(false);
    expect(dateDeDepartValide("2026-02-31", MAINTENANT)).toBe(false);
    expect(dateDeDepartValide("15/10/2026", MAINTENANT)).toBe(false);
    expect(dateDeDepartValide("2026-10-29", MAINTENANT)).toBe(true);
  });

  it("n'écrit que statut et parti_le : ni suppression, ni adresses", async () => {
    const { base, updateMany, mocks } = fausseBase();
    await noterDepart(base, {
      contactId: PERSONNE,
      clientId: CLIENT,
      partiLe: "2026-10-15",
      maintenant: MAINTENANT,
      acteur,
    });
    expect(Object.keys(updateMany.mock.calls[0]![0].data as object).sort()).toEqual([
      "partiLe",
      "statut",
    ]);
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});

describe("annuler le départ", () => {
  it("remet actif et efface la seule date", async () => {
    const { base, updateMany } = fausseBase({ statut: "parti", partiLe: new Date("2026-09-01") });
    await annulerDepart(base, { contactId: PERSONNE, clientId: CLIENT, acteur });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: PERSONNE, clientId: CLIENT, statut: "parti" },
      data: { statut: "actif", partiLe: null },
    });
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({ action: "dossier_client.depart_annule" }),
    );
  });

  it("annuler sur une personne active : rien écrit, rien tracé", async () => {
    const { base, updateMany } = fausseBase();
    const r = await annulerDepart(base, { contactId: PERSONNE, clientId: CLIENT, acteur });
    expect(r).toBe("deja");
    expect(updateMany).not.toHaveBeenCalled();
    expect(trace).not.toHaveBeenCalled();
  });

  it("annuler une personne partie : trace la date d'avant, sans nom", async () => {
    const { base } = fausseBase({ statut: "parti", partiLe: new Date("2026-09-01T00:00:00Z") });
    expect(await annulerDepart(base, { contactId: PERSONNE, clientId: CLIENT, acteur })).toBe(
      "fait",
    );
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { clientId: CLIENT, partiLeAvant: "2026-09-01" } }),
    );
  });

  it("refuse une personne d'un autre client", async () => {
    const { base } = fausseBase();
    await expect(
      annulerDepart(base, { contactId: PERSONNE, clientId: AUTRE, acteur }),
    ).rejects.toBeInstanceOf(ErreurDepart);
  });
});
