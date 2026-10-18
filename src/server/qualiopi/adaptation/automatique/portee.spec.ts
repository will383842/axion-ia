/**
 * Chantier QNC, L04 — `portee.ts`, testé directement : l'interrupteur
 * `qualiopi.adaptation.actif` et la cible d'essai (`estTestInterne` de
 * l'inscription OU de sa session).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enrollmentFindUnique = vi.fn();
const lireInterrupteur = vi.fn(async (_lot: string) => "eteint");

vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findUnique: (a: unknown) => enrollmentFindUnique(a) } },
}));
vi.mock("@/server/qualiopi/socle/interrupteurs", async () => ({
  ...(await vi.importActual<object>("@/server/qualiopi/socle/interrupteurs")),
  lireInterrupteurQualiopi: (lot: string) => lireInterrupteur(lot),
}));

import { adaptationAutomatiquePourInscription, cibleEssai, etatAdaptation } from "./portee";

const URL_INITIALE = process.env["DATABASE_URL"];

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
});
afterEach(() => {
  if (URL_INITIALE === undefined) delete process.env["DATABASE_URL"];
  else process.env["DATABASE_URL"] = URL_INITIALE;
});

describe("cibleEssai", () => {
  it("l'inscription OU la session du banc d'essai suffit", () => {
    const f = { estTestInterne: false };
    const v = { estTestInterne: true };
    expect(cibleEssai(f, f)).toEqual({ estTestInterne: false });
    expect(cibleEssai(v, f)).toEqual({ estTestInterne: true });
    expect(cibleEssai(f, v)).toEqual({ estTestInterne: true });
  });
});

describe("etatAdaptation", () => {
  it("lit la clé du lot `adaptation`", async () => {
    lireInterrupteur.mockResolvedValueOnce("essai");
    expect(await etatAdaptation()).toBe("essai");
    expect(lireInterrupteur).toHaveBeenCalledWith("adaptation");
  });

  it("build `stub.invalid` : éteint, sans lecture", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await etatAdaptation()).toBe("eteint");
    expect(lireInterrupteur).not.toHaveBeenCalled();
  });
});

describe("adaptationAutomatiquePourInscription", () => {
  it("éteint : non, et aucune requête sur l'inscription", async () => {
    expect(await adaptationAutomatiquePourInscription("e1")).toBe(false);
    expect(await adaptationAutomatiquePourInscription("e1", "eteint")).toBe(false);
    expect(enrollmentFindUnique).not.toHaveBeenCalled();
  });

  it("actif : oui, sans requête", async () => {
    expect(await adaptationAutomatiquePourInscription("e1", "actif")).toBe(true);
    expect(enrollmentFindUnique).not.toHaveBeenCalled();
  });

  it("essai : oui seulement si l'inscription ou sa session est du banc d'essai", async () => {
    const ligne = (inscription: boolean, session: boolean) => ({
      estTestInterne: inscription,
      session: { estTestInterne: session },
    });
    enrollmentFindUnique.mockResolvedValueOnce(ligne(false, false));
    expect(await adaptationAutomatiquePourInscription("e1", "essai")).toBe(false);
    enrollmentFindUnique.mockResolvedValueOnce(ligne(true, false));
    expect(await adaptationAutomatiquePourInscription("e1", "essai")).toBe(true);
    enrollmentFindUnique.mockResolvedValueOnce(ligne(false, true));
    expect(await adaptationAutomatiquePourInscription("e1", "essai")).toBe(true);
    expect(enrollmentFindUnique).toHaveBeenCalledWith({
      where: { id: "e1" },
      select: { estTestInterne: true, session: { select: { estTestInterne: true } } },
    });
  });

  it("essai, inscription introuvable : non", async () => {
    enrollmentFindUnique.mockResolvedValueOnce(null);
    expect(await adaptationAutomatiquePourInscription("absente", "essai")).toBe(false);
  });

  it("sans état fourni : l'interrupteur est lu", async () => {
    lireInterrupteur.mockResolvedValueOnce("actif");
    expect(await adaptationAutomatiquePourInscription("e1")).toBe(true);
    expect(lireInterrupteur).toHaveBeenCalledWith("adaptation");
  });
});
