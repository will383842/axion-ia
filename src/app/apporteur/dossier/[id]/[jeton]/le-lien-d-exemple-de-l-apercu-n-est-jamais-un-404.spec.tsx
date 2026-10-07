// Le lien d'EXEMPLE de l'aperçu de « Retenu » (2026-10-07).
//
// Constat : Will, en relisant l'aperçu de l'e-mail « Bienvenue parmi les apporteurs »,
// a cliqué « Compléter mon dossier » et est tombé sur « Ce lien ne fonctionne plus » :
// avant l'envoi, l'aperçu n'ouvre aucun dossier et met un lien d'exemple. La page le
// reconnaît désormais et dit ce qu'il est — sans lire la base, jamais un 404.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { lire, notFound } = vi.hoisted(() => ({
  lire: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: lire,
  vigilanceDemandeeA: vi.fn(),
}));

import { urlDossierExemple } from "@/features/apporteurs-reseau/jeton";
import Page from "./page";
import { TEXTES } from "./textes";

describe("le lien d'exemple de l'aperçu", () => {
  it("ouvre un écran « lien d'exemple », sans lire la base ni répondre 404", async () => {
    const [, id, jeton] = /dossier\/([^/]+)\/([^/]+)$/.exec(urlDossierExemple())!;
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ id: id!, jeton: jeton! }) }),
    );
    expect(html.replace(/&#x27;/g, "'")).toContain(TEXTES.exempleTitre);
    expect(notFound).not.toHaveBeenCalled();
    expect(lire).not.toHaveBeenCalled();
  });

  it("un vrai lien faux reste un 404", async () => {
    lire.mockResolvedValue(null);
    await expect(
      Page({
        params: Promise.resolve({
          id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
          jeton: "y".repeat(43),
        }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
