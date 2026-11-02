/**
 * Identifiant BullMQ d'un rapport : une reprise est STABLE dans une tranche de 10 minutes (un
 * balayage qui repasse n'ajoute pas un second job en attente), et change d'une tranche à l'autre.
 */
import { describe, expect, it } from "vitest";

import { jobIdRapport, TRANCHE_REPRISE_MS } from "../identifiant-job";

const ID = "00000000-0000-4000-8000-000000000001";
const T0 = new Date("2026-11-02T10:00:00Z");
const plus = (ms: number) => new Date(T0.getTime() + ms);

describe("jobIdRapport", () => {
  it("premier passage : identifiant fixe, sans tranche", () => {
    expect(jobIdRapport(ID, false, T0)).toBe(`rapport-avant-audit-${ID}`);
    expect(jobIdRapport(ID, false, plus(3 * TRANCHE_REPRISE_MS))).toBe(`rapport-avant-audit-${ID}`);
  });

  it("reprise : même identifiant dans la même tranche (démarrage + balayage rapprochés)", () => {
    const a = jobIdRapport(ID, true, T0);
    expect(jobIdRapport(ID, true, plus(TRANCHE_REPRISE_MS - 1))).toBe(a);
    expect(a).not.toBe(jobIdRapport(ID, false, T0));
    expect(a.startsWith(`rapport-avant-audit-${ID}-reprise-`)).toBe(true);
  });

  it("reprise : identifiant neuf à la tranche suivante, et propre à chaque rapport", () => {
    const a = jobIdRapport(ID, true, T0);
    expect(jobIdRapport(ID, true, plus(TRANCHE_REPRISE_MS))).not.toBe(a);
    expect(jobIdRapport(ID.replace(/1$/, "2"), true, T0)).not.toBe(a);
  });

  it("la tranche vaut la période du balayage du worker (10 minutes)", () => {
    expect(TRANCHE_REPRISE_MS).toBe(10 * 60_000);
  });
});
