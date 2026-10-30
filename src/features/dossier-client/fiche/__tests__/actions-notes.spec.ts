// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  exiger: vi.fn(),
  ajouter: vi.fn(async () => ({ id: "n" })),
  basculer: vi.fn(async () => ({ epinglee: true })),
  lectureAdmin: vi.fn(async () => ({ name: "Will Dupont" })),
}));
vi.mock("@/features/dossier-client/acces", () => ({ exigerAccesEchanges: h.exiger }));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  messageAffichable: (e: unknown) => (e instanceof Error ? e.message : "?"),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { adminUser: { findUnique: h.lectureAdmin } } }));
vi.mock("../notes", async (orig) => ({
  ...(await orig<typeof import("../notes")>()),
  ajouterNote: h.ajouter,
  basculerEpingle: h.basculer,
}));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw Object.assign(new Error("REDIRECT"), { url: u });
  },
}));

import { ajouterNoteFormAction, basculerEpingleFormAction } from "../actions-notes";

const ID = "11111111-1111-4111-8111-111111111111";
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const url = (p: Promise<void>): Promise<string> =>
  p.then(
    () => "",
    (e: { url?: string }) => e.url ?? "",
  );

beforeEach(() => {
  h.exiger.mockReset();
  h.exiger.mockResolvedValue({ userId: "u1", role: "admin" });
  h.ajouter.mockClear();
  h.basculer.mockClear();
  h.lectureAdmin.mockClear();
});

describe("actions des notes", () => {
  it("rôle refusé : aucune lecture ni écriture avant le refus", async () => {
    h.exiger.mockRejectedValue(new Error("Accès refusé"));
    const u = await url(ajouterNoteFormAction(form({ clientId: ID, texte: "secret" })));
    expect(h.lectureAdmin).not.toHaveBeenCalled();
    expect(h.ajouter).not.toHaveBeenCalled();
    expect(u).toContain("erreur=");
    expect(decodeURIComponent(u)).not.toContain("secret");
    await url(basculerEpingleFormAction(form({ clientId: ID, noteId: ID })));
    expect(h.basculer).not.toHaveBeenCalled();
  });

  it("ajoute avec le prénom de l'auteur, sans mettre le texte dans l'adresse", async () => {
    const u = await url(ajouterNoteFormAction(form({ clientId: ID, texte: "confidentiel" })));
    expect(h.ajouter).toHaveBeenCalledTimes(1);
    const arg = (
      h.ajouter.mock.calls[0] as unknown as [unknown, { acteur: { auteurLabel: string } }]
    )[1];
    expect(arg.acteur.auteurLabel).toBe("Will");
    expect(decodeURIComponent(u)).not.toContain("confidentiel");
    expect(u).toContain("message=");
  });

  it("refuse une prestation mal formée sans rien écrire", async () => {
    const u = await url(
      ajouterNoteFormAction(form({ clientId: ID, texte: "x", projetId: "pas-un-uuid" })),
    );
    expect(h.ajouter).not.toHaveBeenCalled();
    expect(u).toContain("erreur=");
  });

  it("épingle une note", async () => {
    const u = await url(basculerEpingleFormAction(form({ clientId: ID, noteId: ID })));
    expect(h.basculer).toHaveBeenCalledTimes(1);
    expect(u).toContain("message=");
  });
});
