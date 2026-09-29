// @vitest-environment node

/**
 * Verrou — un client ACTIF (règle B3) n'est pas enregistré tant que son préavis
 * de 30 jours court (décision de Will du 29/09, LOTS-EXECUTION §0, ligne
 * « Préavis »). La règle vit dans `visio-annonce.ts` (D2) ; les routes
 * `/api/enregistreur/sessions` et `accord` (PR 5) la branchent et portent leur
 * propre test de mutation (contrôle retiré → rouge).
 */

import { describe, expect, it } from "vitest";

import { CODE_REFUS_PREAVIS, refusPourPreavis } from "../visio-annonce";

const PREAVIS = { envoyeLe: "2026-09-30T08:00:00.000Z", finLe: "2026-10-30T08:00:00.000Z" };
const ACTIF = { valide: true, actif: true };

describe("un client actif n'est pas enregistré avant la fin du préavis", () => {
  it("🔴 veille de la fin : refus, code 409 et date lisible pour Will", () => {
    const r = refusPourPreavis(ACTIF, new Date("2026-10-30T07:59:59.000Z"), PREAVIS);
    expect(r).toEqual({
      refuse: true,
      code: CODE_REFUS_PREAVIS,
      message: "Pas d'enregistrement pour ce client avant le 30/10/2026 : notes à la main.",
    });
  });

  it("🔴 une date de fin illisible refuse (jamais d'ouverture par défaut)", () => {
    const r = refusPourPreavis(ACTIF, new Date("2027-01-01"), { ...PREAVIS, finLe: "n'importe" });
    expect(r.refuse).toBe(true);
  });

  it("🔑 CONTRE-TÉMOIN : préavis échu, le client actif est enregistrable", () => {
    expect(refusPourPreavis(ACTIF, new Date("2026-10-30T08:00:00.000Z"), PREAVIS)).toEqual({
      refuse: false,
    });
  });

  it("🔑 CONTRE-TÉMOIN : un client validé mais inactif n'attend pas le préavis", () => {
    expect(
      refusPourPreavis({ valide: true, actif: false }, new Date("2026-10-01"), PREAVIS).refuse,
    ).toBe(false);
  });
});
