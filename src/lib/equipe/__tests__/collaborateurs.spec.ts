import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { teamMember, authorProfile } = vi.hoisted(() => ({
  teamMember: { findFirst: vi.fn(), findMany: vi.fn() },
  authorProfile: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { teamMember, authorProfile, $queryRaw: vi.fn() },
}));

import {
  getPublishedMember,
  listMapPoints,
  listPublishedMembers,
  resoudreFicheEquipe,
} from "../collaborateurs";

const URL_AVANT = process.env["DATABASE_URL"];
beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
});
afterEach(() => {
  process.env["DATABASE_URL"] = URL_AVANT;
});

const membre = { slug: "camille", firstName: "Camille", status: "publie" };

describe("lecteurs stub-aware", () => {
  it("base stub : null / [] sans appeler Prisma", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await getPublishedMember("camille")).toBeNull();
    expect(await listPublishedMembers()).toEqual([]);
    expect(await listMapPoints()).toEqual([]);
    expect(teamMember.findFirst).not.toHaveBeenCalled();
    expect(teamMember.findMany).not.toHaveBeenCalled();
  });

  it("P2021 (table absente) : vide, sans lever", async () => {
    const p2021 = Object.assign(new Error("table absente"), { code: "P2021" });
    teamMember.findFirst.mockRejectedValue(p2021);
    teamMember.findMany.mockRejectedValue(p2021);
    expect(await getPublishedMember("camille")).toBeNull();
    expect(await listPublishedMembers()).toEqual([]);
    expect(await listMapPoints()).toEqual([]);
  });

  it("une autre erreur remonte", async () => {
    teamMember.findFirst.mockRejectedValue(new Error("panne"));
    await expect(getPublishedMember("camille")).rejects.toThrow("panne");
  });

  it("ne lit que le statut « publie », hors demande d'effacement, et jamais un champ privé", async () => {
    teamMember.findFirst.mockResolvedValue(membre);
    await getPublishedMember("camille");
    const arg = teamMember.findFirst.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
    };
    expect(arg.where).toMatchObject({
      slug: "camille",
      status: "publie",
      erasureRequestedAt: null,
    });
    for (const prive of [
      "contactEmailEnc",
      "contactEmailHash",
      "withdrawTokenHash",
      "consentNote",
      "photoStoragePath",
      "organizationName_",
    ]) {
      expect(arg.select[prive]).toBeUndefined();
    }
    expect(arg.select["firstName"]).toBe(true);
  });

  it("la liste et la carte filtrent « publie » ; la carte exige showOnMap", async () => {
    teamMember.findMany.mockResolvedValue([]);
    await listPublishedMembers();
    await listMapPoints();
    expect(teamMember.findMany.mock.calls[0]?.[0].where).toMatchObject({ status: "publie" });
    expect(teamMember.findMany.mock.calls[1]?.[0].where).toMatchObject({
      status: "publie",
      showOnMap: true,
    });
  });
});

describe("ordre de résolution de /equipe/[slug]", () => {
  it("(1) williams : statique, la base n'est jamais lue", async () => {
    expect(await resoudreFicheEquipe("williams")).toEqual({ type: "williams" });
    expect(teamMember.findFirst).not.toHaveBeenCalled();
    expect(authorProfile.findUnique).not.toHaveBeenCalled();
  });

  it("(1 bis) williams est rendu même base stub", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await resoudreFicheEquipe("williams")).toEqual({ type: "williams" });
  });

  it("(2) un TeamMember publié passe avant un AuthorProfile", async () => {
    teamMember.findFirst.mockResolvedValue(membre);
    authorProfile.findUnique.mockResolvedValue({ slug: "camille", isActive: true });
    const r = await resoudreFicheEquipe("camille");
    expect(r?.type).toBe("membre");
    expect(authorProfile.findUnique).not.toHaveBeenCalled();
  });

  it("(3) sinon l'AuthorProfile actif (Manon)", async () => {
    teamMember.findFirst.mockResolvedValue(null);
    authorProfile.findUnique.mockResolvedValue({ slug: "manon", isActive: true });
    expect((await resoudreFicheEquipe("manon"))?.type).toBe("auteur");
  });

  it("sinon null : AuthorProfile inactif ou absent", async () => {
    teamMember.findFirst.mockResolvedValue(null);
    authorProfile.findUnique.mockResolvedValue({ slug: "x", isActive: false });
    expect(await resoudreFicheEquipe("x")).toBeNull();
    authorProfile.findUnique.mockResolvedValue(null);
    expect(await resoudreFicheEquipe("y")).toBeNull();
  });
});
