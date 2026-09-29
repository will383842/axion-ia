// @vitest-environment node

/**
 * Verrou — tant que `PREAVIS_SOUS_TRAITANTS` vaut `null` (préavis pas encore
 * envoyé), TOUS les clients actifs sont refusés, quelle que soit la date
 * (décision de Will du 29/09, LOTS-EXECUTION §0).
 */

import { describe, expect, it } from "vitest";

import { CODE_REFUS_PREAVIS, PREAVIS_SOUS_TRAITANTS, refusPourPreavis } from "../visio-annonce";

describe("sans date de préavis, tout client actif est refusé", () => {
  it("🔴 préavis null : refus, même dans dix ans", () => {
    const r = refusPourPreavis({ valide: true, actif: true }, new Date("2036-01-01"), null);
    expect(r).toMatchObject({ refuse: true, code: CODE_REFUS_PREAVIS });
  });

  it("🔴 la valeur par défaut est celle de la source unique", () => {
    const r = refusPourPreavis({ valide: true, actif: true }, new Date("2036-01-01"));
    expect(r.refuse).toBe(PREAVIS_SOUS_TRAITANTS === null);
  });
});
