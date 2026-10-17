/**
 * Chantier QNC, L05 — l'interrupteur `qualiopi.convocation_v2.actif`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const settingFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { setting: { findUnique: (a: unknown) => settingFindUnique(a) } },
}));

import { cibleEssaiConvocation, convocationV2Applique, etatConvocationV2 } from "./interrupteur";
import { cleInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
});

describe("etatConvocationV2", () => {
  it("clé absente : éteint", async () => {
    settingFindUnique.mockResolvedValue(null);
    expect(await etatConvocationV2()).toBe("eteint");
  });

  it("lit la clé qualiopi.convocation_v2.actif", async () => {
    settingFindUnique.mockResolvedValue({ value: { etat: "essai" } });
    expect(await etatConvocationV2()).toBe("essai");
    const lecture = settingFindUnique.mock.calls[0]![0] as { where: Record<string, string> };
    expect(Object.values(lecture.where)).toEqual(["qualiopi.convocation_v2.actif"]);
    expect(cleInterrupteurQualiopi("convocation_v2")).toBe("qualiopi.convocation_v2.actif");
  });

  it("valeur inconnue ou base injoignable : éteint", async () => {
    settingFindUnique.mockResolvedValue({ value: { etat: "peut-etre" } });
    expect(await etatConvocationV2()).toBe("eteint");
    settingFindUnique.mockRejectedValue(new Error("down"));
    expect(await etatConvocationV2()).toBe("eteint");
  });

  it("build stub.invalid : éteint, sans lire la base", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await etatConvocationV2()).toBe("eteint");
    expect(settingFindUnique).not.toHaveBeenCalled();
  });
});

describe("convocationV2Applique", () => {
  it("éteint : jamais ; actif : toujours ; essai : le banc d'essai seulement", () => {
    expect(convocationV2Applique("eteint", { estTestInterne: true })).toBe(false);
    expect(convocationV2Applique("actif", { estTestInterne: false })).toBe(true);
    expect(convocationV2Applique("essai", { estTestInterne: true })).toBe(true);
    expect(convocationV2Applique("essai", { estTestInterne: false })).toBe(false);
  });

  it("la cible d'essai est celle de l'inscription OU de sa session", () => {
    expect(
      cibleEssaiConvocation({ estTestInterne: false }, { estTestInterne: true }).estTestInterne,
    ).toBe(true);
    expect(
      cibleEssaiConvocation({ estTestInterne: false }, { estTestInterne: false }).estTestInterne,
    ).toBe(false);
  });
});
