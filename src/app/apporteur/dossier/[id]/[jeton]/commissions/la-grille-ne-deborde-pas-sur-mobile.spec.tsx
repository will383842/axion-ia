// Mobile 390 px (E2E par l'interface, 2026-11-26) : un tableau large dans un élément de grille
// sans `min-w-0` élargit la page de 112 px au lieu de défiler dans son cadre `overflow-x-auto`.
// Chaque section de la grille doit donc porter `min-w-0`.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: vi.fn(async () => ({
    id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    prenom: "Ana",
    restreint: false,
  })),
}));

import Page from "./page";

describe("grille de référence : pas de débordement horizontal", () => {
  it("chaque section de tableau porte min-w-0", async () => {
    const html = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({
          id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
          jeton: "jeton-valide",
        }),
      }),
    );
    const sections = html.match(/<section\b[^>]*>/g) ?? [];
    expect(sections.length).toBeGreaterThanOrEqual(2);
    for (const s of sections) expect(s).toContain("min-w-0");
  });
});
