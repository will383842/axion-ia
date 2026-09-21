/**
 * `/contacts/messages/[id]` d'un apporteur renvoie vers `/contacts/commercial/[id]`.
 *
 * Deux adresses menaient à la même fiche, et seule la seconde ramenait à la
 * liste des apporteurs et portait le résultat de l'invitation. Un lien ancien —
 * un favori, une notification, la boîte de réception d'avant ce lot — ouvrait
 * donc l'apporteur « comme un message », avec un retour vers Messages.
 *
 * La redirection est SERVEUR (`redirect()` dans la page) : un lien ancien reste
 * valide, il atterrit simplement au bon endroit. Un message qui n'est pas un
 * apporteur, lui, ne bouge pas — c'est le témoin sans lequel « tout rediriger »
 * passerait au vert.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const markInboxRead = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
vi.mock("@/auth", () => ({ auth: () => Promise.resolve({ user: { id: "admin-1" } }) }));
vi.mock("@/server/auth/garde-page", () => ({ gardePage: () => Promise.resolve({ ok: true }) }));
vi.mock("@/features/admin-inbox/reads", () => ({
  markInboxRead: (...a: unknown[]) => markInboxRead(...a),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
vi.mock("../../../../submissions/_v2/SubmissionDetailContent", () => ({
  SubmissionDetailContent: () => null,
}));

import Page from "../page";

const params = Promise.resolve({ adminPrefix: "p", id: "sub-1" });

beforeEach(() => {
  findUnique.mockReset();
  markInboxRead.mockReset();
});

describe("messages/[id] — un apporteur s'ouvre sur sa fiche", () => {
  it("redirige un apporteur vers contacts/commercial/[id]", async () => {
    findUnique.mockResolvedValue({
      details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
    });

    await expect(Page({ params })).rejects.toThrow("NEXT_REDIRECT /fr/p/contacts/commercial/sub-1");
    // La lecture sera marquée par la fiche d'arrivée : pas deux fois.
    expect(markInboxRead).not.toHaveBeenCalled();
  });

  it("laisse un message ordinaire sur sa fiche, et le marque lu", async () => {
    findUnique.mockResolvedValue({ details: { unifiedType: "recrutement" } });

    const el = await Page({ params });

    expect(el).toBeTruthy();
    expect(markInboxRead).toHaveBeenCalledWith("admin-1", "submission", "sub-1");
  });

  it("un id inconnu n'est pas redirigé : la fiche rend elle-même son 404", async () => {
    findUnique.mockResolvedValue(null);
    await expect(Page({ params })).resolves.toBeTruthy();
  });
});
