// @vitest-environment node
/**
 * Interblocage Postgres (40P01) dans le questionnaire : la transaction annulée par Postgres est
 * REJOUÉE (réponse, brouillon, fiche complétée), jamais renvoyée en 500 ni avalée. Toute autre
 * erreur remonte telle quelle.
 */

import { describe, expect, it, vi } from "vitest";

import { estInterblocage, reessayerSiInterblocage } from "../interblocage";

const sansAttente = async () => {};
const interblocage = () =>
  Object.assign(new Error("deadlock detected"), { code: "P2034", meta: { code: "40P01" } });

describe("estInterblocage", () => {
  it("reconnaît 40P01, 40001 et P2034, sous toutes leurs formes", () => {
    expect(estInterblocage({ code: "40P01" })).toBe(true);
    expect(estInterblocage({ code: "P2034" })).toBe(true);
    expect(estInterblocage({ meta: { code: "40001" } })).toBe(true);
    expect(estInterblocage(new Error("ERROR: deadlock detected"))).toBe(true);
  });
  it("ne prend pas une autre panne pour un interblocage", () => {
    expect(estInterblocage(new Error("connection refused"))).toBe(false);
    expect(estInterblocage({ code: "P2002" })).toBe(false);
    expect(estInterblocage(null)).toBe(false);
    expect(estInterblocage("40P01")).toBe(false);
  });
});

describe("reessayerSiInterblocage", () => {
  it("rejoue après un interblocage puis rend le résultat", async () => {
    const f = vi.fn().mockRejectedValueOnce(interblocage()).mockResolvedValue("ok");
    await expect(reessayerSiInterblocage(f, { attendre: sansAttente })).resolves.toBe("ok");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("s'arrête au nombre d'essais et remonte la dernière erreur", async () => {
    const f = vi.fn().mockRejectedValue(interblocage());
    await expect(reessayerSiInterblocage(f, { essais: 3, attendre: sansAttente })).rejects.toThrow(
      /deadlock/,
    );
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("ne rejoue JAMAIS une autre erreur", async () => {
    const f = vi.fn().mockRejectedValue(new Error("violation de contrainte"));
    await expect(reessayerSiInterblocage(f, { attendre: sansAttente })).rejects.toThrow(
      /contrainte/,
    );
    expect(f).toHaveBeenCalledTimes(1);
  });
});
