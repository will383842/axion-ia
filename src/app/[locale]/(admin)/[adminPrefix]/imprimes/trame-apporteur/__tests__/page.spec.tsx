import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import { renderToStaticMarkup } from "react-dom/server";

import Page, { metadata } from "../page";

const props = {
  params: Promise.resolve({ locale: "fr", adminPrefix: "admin-x" }),
  searchParams: Promise.resolve({ prenom: "<script>" }),
};

describe("page /imprimes/trame-apporteur", () => {
  beforeEach(() => auth.mockReset());

  it("renvoie vers la connexion sans session", async () => {
    auth.mockResolvedValue(null);
    await expect(Page(props)).rejects.toThrow("REDIRECT:/fr/admin-x/login");
  });

  it("répond 404 à une session sans le droit de voir les appels", async () => {
    auth.mockResolvedValue({ user: { role: "inconnu" } });
    await expect(Page(props)).rejects.toThrow("NOT_FOUND");
  });

  it("affiche la trame pour un admin, prénom échappé ou écarté", async () => {
    auth.mockResolvedValue({ user: { role: "admin" } });
    const mauvais = renderToStaticMarkup(await Page(props));
    expect(mauvais).not.toContain("<script>");
    expect(mauvais).toContain("[prénom]");
    const bon = renderToStaticMarkup(
      await Page({ ...props, searchParams: Promise.resolve({ prenom: "Léa" }) }),
    );
    expect(bon).toContain("Merci Léa.");
    expect(bon).toContain("Imprimer");
  });

  it("n'est pas indexée", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
