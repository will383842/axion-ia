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

function fausseBase() {
  const updateMany = vi.fn(
    async (a: { where: { id: string; clientId: string }; data?: object }) => ({
      count: a.where.id === PERSONNE && a.where.clientId === CLIENT ? 1 : 0,
    }),
  );
  const base = {
    clientContact: {
      updateMany,
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return { base: base as never, updateMany, mocks: base.clientContact };
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
      where: { id: PERSONNE, clientId: CLIENT },
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
    const { base, updateMany } = fausseBase();
    await annulerDepart(base, { contactId: PERSONNE, clientId: CLIENT, acteur });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: PERSONNE, clientId: CLIENT },
      data: { statut: "actif", partiLe: null },
    });
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({ action: "dossier_client.depart_annule" }),
    );
  });

  it("refuse une personne d'un autre client", async () => {
    const { base } = fausseBase();
    await expect(
      annulerDepart(base, { contactId: PERSONNE, clientId: AUTRE, acteur }),
    ).rejects.toBeInstanceOf(ErreurDepart);
  });
});
