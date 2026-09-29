// @vitest-environment node

/**
 * Verrou — une rencontre dont le client n'est pas encore validé (prospect « à
 * classer ») n'attend pas le préavis (décision de Will du 29/09) : il ne
 * protège que les clients actifs validés. Même quand le préavis n'est pas parti.
 */

import { describe, expect, it } from "vitest";

import { refusPourPreavis } from "../visio-annonce";

describe("un prospect est enregistrable sans attendre le préavis", () => {
  it("🔴 prospect non validé, préavis pas encore parti : enregistrable", () => {
    expect(refusPourPreavis({ valide: false, actif: false }, new Date(), null)).toEqual({
      refuse: false,
    });
  });

  it("🔴 fiche non validée même si elle ressemble à un client actif : enregistrable", () => {
    expect(refusPourPreavis({ valide: false, actif: true }, new Date(), null).refuse).toBe(false);
  });
});
