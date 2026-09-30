/**
 * Interrupteur de secours du verrou (2026-09-30, « ne rien casser ») :
 * `QUALIOPI_VERROU_DOSSIER=off` coupe le BLOCAGE sans toucher à l'état calculé.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { dossierFige, verrouDossierActif, type EtatVerrouDossier } from "../verrou-dossier";

const CLOS: EtatVerrouDossier = { etat: "clos", depuis: new Date("2026-09-10T16:00:00Z") };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("interrupteur de secours du verrou", () => {
  it("sans variable, le verrou est actif et un dossier clos est figé", () => {
    vi.stubEnv("QUALIOPI_VERROU_DOSSIER", "");
    expect(verrouDossierActif()).toBe(true);
    expect(dossierFige(CLOS)).toBe(true);
  });

  it("« off » (casse et espaces indifférents) coupe le blocage", () => {
    vi.stubEnv("QUALIOPI_VERROU_DOSSIER", " OFF ");
    expect(verrouDossierActif()).toBe(false);
    expect(dossierFige(CLOS)).toBe(false);
  });

  it("toute autre valeur laisse le verrou actif", () => {
    vi.stubEnv("QUALIOPI_VERROU_DOSSIER", "on");
    expect(dossierFige(CLOS)).toBe(true);
  });
});
