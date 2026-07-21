/**
 * Tests — session-membership.ts (ownership collectif formateur).
 *
 * Enjeu : dès que l'espace formateur exposera des données de stagiaires tiers,
 * une résolution d'appartenance trop laxiste devient une fuite de données
 * personnelles. Chaque cas correspond à une porte d'entrée réelle.
 */

import { describe, it, expect } from "vitest";
import { resoudreAppartenance } from "./session-membership";

describe("resoudreAppartenance", () => {
  it("principal par la FK → membre, rôle principal, peut clôturer", () => {
    const r = resoudreAppartenance({ estPrincipalFk: true, roleSessionFormateur: null });
    expect(r).toEqual({ estMembre: true, role: "principal", peutCloturerEmargement: true });
  });

  it("la FK principal PRIME sur un rôle SessionFormateur contradictoire", () => {
    // Source légale du nom sur les documents : la FK gagne.
    const r = resoudreAppartenance({ estPrincipalFk: true, roleSessionFormateur: "assistant" });
    expect(r.role).toBe("principal");
    expect(r.peutCloturerEmargement).toBe(true);
  });

  it("co_formateur → membre, mais NE peut PAS clôturer (D4 : principal seul)", () => {
    const r = resoudreAppartenance({ estPrincipalFk: false, roleSessionFormateur: "co_formateur" });
    expect(r.estMembre).toBe(true);
    expect(r.role).toBe("co_formateur");
    expect(r.peutCloturerEmargement).toBe(false);
  });

  it("assistant → membre, ne clôture pas", () => {
    const r = resoudreAppartenance({ estPrincipalFk: false, roleSessionFormateur: "assistant" });
    expect(r.estMembre).toBe(true);
    expect(r.peutCloturerEmargement).toBe(false);
  });

  it("tuteur_afest → membre, ne clôture pas", () => {
    const r = resoudreAppartenance({ estPrincipalFk: false, roleSessionFormateur: "tuteur_afest" });
    expect(r.estMembre).toBe(true);
    expect(r.peutCloturerEmargement).toBe(false);
  });

  it("principal porté par une ligne SessionFormateur (sans FK) → peut clôturer", () => {
    const r = resoudreAppartenance({ estPrincipalFk: false, roleSessionFormateur: "principal" });
    expect(r.role).toBe("principal");
    expect(r.peutCloturerEmargement).toBe(true);
  });

  it("🔴 ni FK ni ligne → NON membre, aucun accès", () => {
    const r = resoudreAppartenance({ estPrincipalFk: false, roleSessionFormateur: null });
    expect(r).toEqual({ estMembre: false, role: null, peutCloturerEmargement: false });
  });
});
