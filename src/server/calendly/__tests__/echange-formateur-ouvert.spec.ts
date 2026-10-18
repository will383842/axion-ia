// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { setting: { findUnique } } }));

import { echangeFormateurOuvert } from "../echange-formateur-ouvert";

describe("echangeFormateurOuvert — fail-closed", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("allumé → ouvert", async () => {
    findUnique.mockResolvedValue({ value: { actif: true } });
    expect(await echangeFormateurOuvert()).toBe(true);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "formateurs.echange_ouvert" } }),
    );
  });
  it("éteint → fermé", async () => {
    findUnique.mockResolvedValue({ value: { actif: false } });
    expect(await echangeFormateurOuvert()).toBe(false);
  });
  it("ligne absente → fermé", async () => {
    findUnique.mockResolvedValue(null);
    expect(await echangeFormateurOuvert()).toBe(false);
  });
  it("valeur illisible → fermé", async () => {
    findUnique.mockResolvedValue({ value: "oui" });
    expect(await echangeFormateurOuvert()).toBe(false);
  });
  it("base en erreur → fermé, sans lever", async () => {
    findUnique.mockImplementation(async () => {
      throw new Error("db down");
    });
    expect(await echangeFormateurOuvert()).toBe(false);
  });
});
