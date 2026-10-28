/**
 * Le compteur de villes de la landing : rien sous le seuil, « Lyon : 3 demandes sur 5 » au seuil.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lireCompteursPublics = vi.hoisted(() => vi.fn());
vi.mock("@/features/tour-de-france/lectures", () => ({ lireCompteursPublics }));

import TourDeFranceIaPage, * as module from "../page";

afterEach(cleanup);
beforeEach(() => {
  lireCompteursPublics.mockReset();
});

describe("le compteur de villes", () => {
  it("la landing se relit toutes les 5 minutes", () => {
    expect(module.revalidate).toBe(300);
  });

  it("aucune ville au seuil : rien n'est affiché", async () => {
    lireCompteursPublics.mockResolvedValue([
      { villeCle: "lyon", villeNom: "Lyon", total: 2 },
      { villeCle: "?annecy", villeNom: null, total: 4 },
    ]);
    const { container } = render(await TourDeFranceIaPage());
    expect(container.querySelector("[data-tdf-compteur]")).toBeNull();
    expect(container.textContent).not.toMatch(/demandes sur/);
  });

  it("base indisponible : la landing part quand même, sans compteur", async () => {
    lireCompteursPublics.mockImplementation(async () => {
      throw new Error("stub.invalid");
    });
    const { container } = render(await TourDeFranceIaPage());
    expect(container.querySelector("h1")).not.toBeNull();
    expect(container.querySelector("[data-tdf-compteur]")).toBeNull();
  });

  it("une ville à 3 demandes : « Lyon : 3 demandes sur 5 »", async () => {
    lireCompteursPublics.mockResolvedValue([{ villeCle: "lyon", villeNom: "Lyon", total: 3 }]);
    const { container } = render(await TourDeFranceIaPage());
    expect(container.querySelector("[data-tdf-compteur]")?.textContent).toBe(
      "Lyon : 3 demandes sur 5",
    );
  });
});
