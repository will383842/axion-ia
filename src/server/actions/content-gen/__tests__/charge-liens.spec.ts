import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn<() => Promise<unknown>>(),
  etat: { courant: null as unknown },
  ecrire: vi.fn(async (..._a: unknown[]) => undefined),
  lister: vi.fn(async () => [] as unknown[]),
}));

vi.mock("@/auth", () => ({ auth: () => m.auth() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/content-gen/equipe/charge-de-liens-donnees", () => ({
  modifierOccasions: async (id: string, f: (c: unknown) => unknown) => {
    const suivant = f(m.etat.courant);
    await m.ecrire(id, suivant);
  },
  listerArticlesAvecOccasions: () => m.lister(),
}));

import { ecarterOccasionLien, listerOccasionsLiens, validerOccasionLien } from "../charge-liens";
import { roleAutoriseChargeLiens } from "@/server/content-gen/equipe/charge-de-liens";

const session = (role: string) =>
  m.auth.mockResolvedValue({ user: { id: "u1", email: "a@b.c", role } });
const OCC = {
  version: 1,
  coutUsd: 0,
  occasions: [
    {
      id: "c1",
      type: "media-region",
      cible: "M",
      url: "https://m.fr/",
      message: "Bonjour",
      etat: "proposee",
      creeLe: "2026-11-27T00:00:00.000Z",
    },
  ],
};

describe("actions chargé de liens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CONTENT_EQUIPE_EDITORIALE", "true");
    m.etat.courant = OCC;
  });

  it.each(["reader", "editor"])("rôle %s refusé, rien n'est écrit", async (role) => {
    session(role);
    await expect(listerOccasionsLiens()).rejects.toThrow("forbidden");
    await expect(validerOccasionLien({ jobId: "j", occasionId: "c1" })).rejects.toThrow(
      "forbidden",
    );
    await expect(ecarterOccasionLien({ jobId: "j", occasionId: "c1" })).rejects.toThrow(
      "forbidden",
    );
    expect(m.ecrire).not.toHaveBeenCalled();
  });

  it("sans session : refusé", async () => {
    m.auth.mockResolvedValue(null);
    await expect(listerOccasionsLiens()).rejects.toThrow("unauthorized");
  });

  it("la page n'est ouverte qu'à l'administration", () => {
    expect(roleAutoriseChargeLiens("admin")).toBe(true);
    expect(roleAutoriseChargeLiens("super_admin")).toBe(true);
    expect(roleAutoriseChargeLiens("editor")).toBe(false);
    expect(roleAutoriseChargeLiens(null)).toBe(false);
  });

  it("admin : valider marque l'occasion et rend le message, sans envoi", async () => {
    session("admin");
    const r = await validerOccasionLien({ jobId: "j", occasionId: "c1" });
    expect(r).toEqual({ ok: true, message: "Bonjour" });
    const ecrit = m.ecrire.mock.calls[0]![1] as typeof OCC;
    expect(ecrit.occasions[0]).toMatchObject({ etat: "validee", decidePar: "u1" });
  });

  it("admin : écarter, puis seconde décision refusée", async () => {
    session("admin");
    expect((await ecarterOccasionLien({ jobId: "j", occasionId: "c1" })).ok).toBe(true);
    m.etat.courant = { ...OCC, occasions: [{ ...OCC.occasions[0]!, etat: "ecartee" }] };
    expect((await validerOccasionLien({ jobId: "j", occasionId: "c1" })).ok).toBe(false);
  });

  it("entrée invalide refusée", async () => {
    session("admin");
    expect((await validerOccasionLien({ jobId: "j", extra: 1 })).ok).toBe(false);
  });

  it("interrupteur éteint : liste vide, décision refusée, rien écrit", async () => {
    vi.stubEnv("CONTENT_EQUIPE_EDITORIALE", "");
    session("admin");
    expect(await listerOccasionsLiens()).toEqual([]);
    expect((await validerOccasionLien({ jobId: "j", occasionId: "c1" })).ok).toBe(false);
    expect(m.ecrire).not.toHaveBeenCalled();
    expect(m.lister).not.toHaveBeenCalled();
  });
});
