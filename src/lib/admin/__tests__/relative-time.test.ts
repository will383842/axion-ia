import { describe, it, expect } from "vitest";
import { depuisMaintenant, joursEcoules } from "../relative-time";

// Horloge fixe : 15 juin 2026, 12 h 00 UTC.
const T0 = new Date("2026-06-15T12:00:00Z").getTime();
const ilYA = (ms: number) => new Date(T0 - ms);

const MIN = 60_000;
const H = 60 * MIN;
const J = 24 * H;

describe("depuisMaintenant", () => {
  it("échelonne minutes, heures et jours", () => {
    expect(depuisMaintenant(ilYA(30_000), T0)).toBe("à l'instant");
    expect(depuisMaintenant(ilYA(12 * MIN), T0)).toBe("il y a 12 min");
    expect(depuisMaintenant(ilYA(3 * H), T0)).toBe("il y a 3 h");
    expect(depuisMaintenant(ilYA(5 * J), T0)).toBe("il y a 5 j");
  });

  // Un arrondi produisait « il y a 1 min » à 30 secondes, et « il y a 24 h »
  // à 23 h 40 — une unité qu'on n'affiche jamais.
  it("tronque au lieu d'arrondir, aux bornes des unités", () => {
    expect(depuisMaintenant(ilYA(59_000), T0)).toBe("à l'instant");
    expect(depuisMaintenant(ilYA(MIN), T0)).toBe("il y a 1 min");
    expect(depuisMaintenant(ilYA(59 * MIN + 59_000), T0)).toBe("il y a 59 min");
    expect(depuisMaintenant(ilYA(23 * H + 40 * MIN), T0)).toBe("il y a 23 h");
    expect(depuisMaintenant(ilYA(J), T0)).toBe("il y a 1 j");
  });

  it("bascule sur une date absolue au-delà d'un mois", () => {
    // « il y a 137 j » ne dit plus rien d'utile.
    expect(depuisMaintenant(ilYA(60 * J), T0)).toMatch(/2026/);
  });

  // Horloge de la machine décalée, ou date saisie dans le futur : sans garde,
  // on afficherait « il y a -3 j ».
  it("n'affiche jamais une durée négative", () => {
    const futur = new Date(T0 + 3 * J);
    expect(depuisMaintenant(futur, T0)).not.toContain("-");
    expect(depuisMaintenant(futur, T0)).toMatch(/2026/);
  });

  it("tolère l'absence de date", () => {
    expect(depuisMaintenant(null, T0)).toBe("—");
    expect(depuisMaintenant(undefined, T0)).toBe("—");
  });
});

describe("joursEcoules", () => {
  it("compte les jours entiers, jamais de valeur négative", () => {
    expect(joursEcoules(ilYA(0), T0)).toBe(0);
    expect(joursEcoules(ilYA(23 * H), T0)).toBe(0);
    expect(joursEcoules(ilYA(25 * H), T0)).toBe(1);
    expect(joursEcoules(ilYA(14 * J), T0)).toBe(14);
    expect(joursEcoules(new Date(T0 + 5 * J), T0)).toBe(0);
    expect(joursEcoules(null, T0)).toBe(0);
  });
});
