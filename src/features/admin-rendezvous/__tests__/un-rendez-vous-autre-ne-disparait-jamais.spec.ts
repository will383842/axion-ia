/**
 * Relecture L3, défaut (d) — l'onglet « Autre » des rendez-vous est visible
 * dès qu'il en existe un, comme sur « Appels réservés » (chantier « Types de
 * rendez-vous », L5b). L'agenda : `components/admin/agenda/__tests__`.
 */
import { describe, expect, it } from "vitest";

import { ongletAutreVisible } from "../type-rdv";

describe("onglet « Autre » des rendez-vous", () => {
  it("visible dès qu'un rendez-vous « autre » existe, même sans filtre", () => {
    expect(ongletAutreVisible(undefined, ["diagnostic", "autre"])).toBe(true);
  });
  it("caché sans rendez-vous « autre », sauf s'il est le filtre actif", () => {
    expect(ongletAutreVisible(undefined, ["diagnostic"])).toBe(false);
    expect(ongletAutreVisible("autre", [])).toBe(true);
  });
});
