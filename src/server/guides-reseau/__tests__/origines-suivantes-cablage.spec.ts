// @vitest-environment node
//
// Lot guide réseau 4 (O4) — `noterOrigineAvec` écrit l'origine puis tente les origines suivantes,
// sans jamais lever (la personne attend son guide).
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ordre: [] as string[],
  panne: false,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../origines", async (orig) => ({
  ...(await orig<typeof import("../origines")>()),
  enregistrerOrigine: async () => {
    m.ordre.push("ecrite");
    if (m.panne) throw new Error("panne");
    return { creee: true, archivees: 0 };
  },
}));
vi.mock("../synchro-v3", () => ({
  transmettreOriginesSuivantes: async (a: Record<string, unknown>) => {
    m.ordre.push(`transmise:${String(a.guide)}`);
    return "transmise";
  },
}));

import { noterOrigineAvec } from "../traitement";
import { construireOrigine } from "../origines";

const origine = () =>
  construireOrigine(
    {
      schemaVersion: 1,
      mot: "GUIDE",
      reseau: "instagram",
      guide: "guide-ia",
      cleIdempotence: "k1",
    } as never,
    new Date("2026-11-01T10:00:00Z"),
  );

beforeEach(() => {
  m.ordre.length = 0;
  m.panne = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("noterOrigineAvec", () => {
  it("écrit puis tente la transmission des origines suivantes", async () => {
    await noterOrigineAvec(origine, "p@exemple.test", "cle-1");
    expect(m.ordre).toEqual(["ecrite", "transmise:guide-ia"]);
  });

  it("une écriture en panne ne lève pas et ne transmet rien", async () => {
    m.panne = true;
    await expect(noterOrigineAvec(origine, "p@exemple.test", "cle-1")).resolves.toBeUndefined();
    expect(m.ordre).toEqual(["ecrite"]);
  });

  it("une demande v1 (sans post) produit une origine minimale valide", () => {
    const o = origine();
    expect(o).toMatchObject({
      mot: "GUIDE",
      reseau: "instagram",
      guide: "guide-ia",
      postRef: null,
    });
  });
});
