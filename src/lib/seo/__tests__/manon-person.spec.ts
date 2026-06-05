import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { authorProfile: { findUnique: findUniqueMock } },
}));

import { getManonPersonJsonLd } from "../manon-person";

const MANON = {
  slug: "manon",
  displayName: "Manon",
  jobTitle: "Plume éditoriale d'Axion-IA",
  photoUrl1024: "/auteurs/manon.png",
  photoAlt: "Manon — portrait IA disclosed",
  knowsAbout: ["Intelligence artificielle opérationnelle"],
  personaDisclaimer: "Manon est une persona éditoriale fictive.",
};

describe("getManonPersonJsonLd (VIS-05)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne un nœud Person quand l'auteur manon existe", async () => {
    findUniqueMock.mockResolvedValue(MANON);
    const node = await getManonPersonJsonLd();
    expect(node).not.toBeNull();
    expect(node?.["@type"]).toBe("Person");
    // L'@id doit matcher celui posé en author par les factories (résolution).
    expect(String(node?.["@id"])).toContain("/equipe/manon#person");
  });

  it("retourne null si l'auteur est absent (stub-safe build)", async () => {
    findUniqueMock.mockResolvedValue(null);
    expect(await getManonPersonJsonLd()).toBeNull();
  });

  it("retourne null si la DB throw (catch → null)", async () => {
    findUniqueMock.mockRejectedValue(new Error("DB down"));
    expect(await getManonPersonJsonLd()).toBeNull();
  });
});
