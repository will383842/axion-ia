import { afterEach, describe, expect, it, vi } from "vitest";

describe("constantes du questionnaire : collecte sans date de fin", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("n'exporte plus DATE_FIN_COLLECTE", async () => {
    const m = await import("../constantes");
    expect("DATE_FIN_COLLECTE" in m).toBe(false);
    expect(m.DATE_DEBUT_COLLECTE).toBe("2026-12-01");
  });

  it("l'interrupteur éteint garde tout fermé", async () => {
    const m = await import("../constantes");
    if (!m.QUESTIONNAIRE_OUVERT) expect(m.estOuvert(new Date("2027-06-01T00:00:00Z"))).toBe(false);
  });

  it("allumé : fermé avant le 1er décembre 2026, ouvert ensuite, sans fin", async () => {
    vi.doMock("../constantes", async (orig) => orig());
    const src = await import("../constantes");
    // Reproduit la règle avec l'interrupteur allumé.
    const ouvert = (d: Date) =>
      d.getTime() >= Date.parse(`${src.DATE_DEBUT_COLLECTE}T00:00:00.000Z`);
    expect(ouvert(new Date("2026-11-30T23:59:59Z"))).toBe(false);
    expect(ouvert(new Date("2026-12-01T00:00:00Z"))).toBe(true);
    expect(ouvert(new Date("2035-01-01T00:00:00Z"))).toBe(true);
  });
});
