// Les trois actions (retirer, remettre, supprimer) sont gardées CÔTÉ SERVEUR : un rôle
// autre qu'administrateur n'atteint jamais le métier (2026-10-07).
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  retirer: vi.fn(),
  remettre: vi.fn(),
  supprimer: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("../retrait", () => ({
  retirerDuReseau: (...a: unknown[]) => h.retirer(...a),
  remettreDansLeReseau: (...a: unknown[]) => h.remettre(...a),
  supprimerDefinitivement: (...a: unknown[]) => h.supprimer(...a),
}));

import {
  supprimerDefinitivementFormAction,
  remettreDansLeReseauAction,
  retirerDuReseauAction,
  supprimerDefinitivementAction,
} from "../actions-retrait";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const gestes = [
  () => retirerDuReseauAction({ apporteurId: ID }),
  () => remettreDansLeReseauAction({ apporteurId: ID }),
  () => supprimerDefinitivementAction({ apporteurId: ID, nomTape: "Claire Durand" }),
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const f of [h.retirer, h.remettre, h.supprimer])
    f.mockResolvedValue({ ok: true, message: "ok" });
});

describe("garde serveur", () => {
  it.each([
    ["sans session", null],
    ["rôle éditeur", { user: { id: "u", role: "editor" } }],
  ])("%s : refusé, le métier n'est jamais appelé", async (_c, session) => {
    h.session = session;
    for (const g of gestes) expect((await g()).ok).toBe(false);
    expect(h.retirer).not.toHaveBeenCalled();
    expect(h.remettre).not.toHaveBeenCalled();
    expect(h.supprimer).not.toHaveBeenCalled();
  });

  it("administrateur : le métier reçoit l'identifiant et l'auteur", async () => {
    h.session = { user: { id: "adm-1", role: "admin" } };
    for (const g of gestes) expect((await g()).ok).toBe(true);
    expect(h.retirer).toHaveBeenCalledWith(ID, "adm-1");
    expect(h.supprimer).toHaveBeenCalledWith(ID, "adm-1", "Claire Durand");
  });

  it("identifiant invalide : refusé", async () => {
    h.session = { user: { id: "adm-1", role: "admin" } };
    expect((await retirerDuReseauAction({ apporteurId: "pas-un-uuid" })).ok).toBe(false);
    expect(h.retirer).not.toHaveBeenCalled();
  });
});

describe("versions formulaire (sans JavaScript)", () => {
  const formulaire = (champs: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(champs)) fd.set(k, v);
    return fd;
  };

  it("suppression sans la case « définitif » : refusée côté serveur, le métier n'est pas appelé", async () => {
    h.session = { user: { id: "adm-1", role: "admin" } };
    await expect(
      supprimerDefinitivementFormAction(formulaire({ apporteurId: ID, nomTape: "Claire Durand" })),
    ).rejects.toThrow(/REDIRECT:.*retraitErreur=/);
    expect(h.supprimer).not.toHaveBeenCalled();
  });

  it("suppression réussie : retour à la LISTE (la fiche n'existe plus) avec le message", async () => {
    h.session = { user: { id: "adm-1", role: "admin" } };
    await expect(
      supprimerDefinitivementFormAction(
        formulaire({ apporteurId: ID, nomTape: "Claire Durand", compris: "oui" }),
      ),
    ).rejects.toThrow(/REDIRECT:\/fr\/adm\/apporteurs\?retrait=/);
    expect(h.supprimer).toHaveBeenCalledWith(ID, "adm-1", "Claire Durand");
  });

  it("rôle non administrateur : refusé même par le formulaire", async () => {
    h.session = { user: { id: "u", role: "editor" } };
    await expect(
      supprimerDefinitivementFormAction(
        formulaire({ apporteurId: ID, nomTape: "Claire Durand", compris: "oui" }),
      ),
    ).rejects.toThrow(/retraitErreur=/);
    expect(h.supprimer).not.toHaveBeenCalled();
  });
});
