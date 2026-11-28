// PR N : les pièces comptables (10 ans) ne sont jamais touchées par la purge.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DUREE_COMPTABLE_ANS } from "../purge-rgpd-regles";

const src = readFileSync(join(__dirname, "..", "purge-rgpd.ts"), "utf8");

describe("pièces comptables intactes", () => {
  it("durée comptable : 10 ans, documentée, jamais utilisée pour purger", () => {
    expect(DUREE_COMPTABLE_ANS).toBe(10);
    expect(src).not.toMatch(/DUREE_COMPTABLE_ANS/);
  });
  it.each([
    "pieceAutofactureApporteur",
    "apporteurVirementCompte",
    "releveMensuelApporteur",
    "commissionApporteur",
  ])("aucune écriture sur %s", (m) => {
    expect(src).not.toMatch(
      new RegExp(`${m}\\.(create|update|updateMany|delete|deleteMany|upsert)\\b`),
    );
  });
  it("seuls les types identité et RIB sont purgés (jamais vigilance, immatriculation, rc_pro)", () => {
    expect(src).not.toMatch(/"(vigilance|immatriculation|rc_pro)"/);
    expect(src.match(/type: \{ in: \["identite", "rib"\] \}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
