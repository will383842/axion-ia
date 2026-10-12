import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  allume: true,
  passe: vi.fn(async () => ({ relancees: 1, erreurs: 0, expirees: 0, sansReponse: 2 })),
}));
vi.mock("./interrupteur-allume", () => ({ interrupteurAllume: async () => h.allume }));
vi.mock("@/server/qualiopi/trainers/mission-formateur", () => ({
  relancerEtExpirerMissions: h.passe,
}));

import { passerRelancesPropositionsHoraires } from "./relances-propositions-horaires";

// 10 h à Paris (CEST) ; 22 h à Paris.
const MATIN = new Date("2026-10-12T08:00:00Z");
const NUIT = new Date("2026-10-12T20:00:00Z");

describe("relances et expirations à l'heure (M16)", () => {
  beforeEach(() => {
    h.allume = true;
    h.passe.mockClear();
  });
  it("interrupteur allumé, dans la fenêtre : le service tourne", async () => {
    const b = await passerRelancesPropositionsHoraires(MATIN);
    expect(h.passe).toHaveBeenCalledWith(MATIN);
    expect(b.sansReponse).toBe(2);
  });
  it("interrupteur éteint : rien", async () => {
    h.allume = false;
    await passerRelancesPropositionsHoraires(MATIN);
    expect(h.passe).not.toHaveBeenCalled();
  });
  it("hors de 8 h - 19 h (Paris) : rien", async () => {
    await passerRelancesPropositionsHoraires(NUIT);
    expect(h.passe).not.toHaveBeenCalled();
  });
});
