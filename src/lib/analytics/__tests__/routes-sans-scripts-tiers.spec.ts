// @vitest-environment node

/**
 * Verrou — les écrans de fin du parcours d'appel ne chargent aucun script
 * tiers, et les trois composants qui décident (Clarity, LinkedIn, bannière)
 * lisent la MÊME fonction.
 *
 * Mesuré sur iPhone 375 px le 2026-09-02 : la bannière de consentement
 * recouvrait les deux phrases clés de « nous vérifions votre réservation ».
 * La bonne réponse n'est pas de la masquer mais de supprimer sa cause : sur
 * ces pages nominatives, atteintes depuis un e-mail, aucun script tiers ne se
 * charge — donc aucun consentement n'est à demander.
 *
 * 🔴 Le second bloc est la partie qui compte : si un composant consultait
 * `isAdLandingRoute` seul, il se chargerait sur `/appel/annuler` pendant que
 * la bannière s'y tairait — des cookies tiers sans consentement.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isAdLandingRoute,
  isFinDeParcoursAppel,
  isRouteSansScriptsTiers,
} from "../ad-landing-routes";

describe("isFinDeParcoursAppel", () => {
  it.each([
    "/fr/appel/confirme",
    "/fr/appel/annuler",
    "/fr/appel/reporter",
    "/en/appel/confirme",
    "/appel/annuler",
    "/fr/appel/reporter/",
  ])("%s est un écran de fin", (p) => {
    expect(isFinDeParcoursAppel(p)).toBe(true);
  });

  it.each([
    "/fr/appel",
    "/fr/appel/reserver",
    "/fr",
    "/fr/contact",
    "/fr/appeler",
    null,
    undefined,
    "",
  ])("%s n'en est pas un — l'entrée de l'entonnoir garde sa carte de chaleur", (p) => {
    expect(isFinDeParcoursAppel(p)).toBe(false);
  });
});

describe("isRouteSansScriptsTiers réunit les deux familles", () => {
  it("atterrissage publicitaire ET fin de parcours", () => {
    expect(isRouteSansScriptsTiers("/fr/diagnostic")).toBe(true);
    expect(isAdLandingRoute("/fr/diagnostic")).toBe(true);
    expect(isRouteSansScriptsTiers("/fr/appel/annuler")).toBe(true);
    expect(isAdLandingRoute("/fr/appel/annuler")).toBe(false);
    expect(isRouteSansScriptsTiers("/fr/appel")).toBe(false);
  });
});

describe("🔴 les trois composants lisent la MÊME fonction", () => {
  const COMPOSANTS = [
    "src/components/analytics/Clarity.tsx",
    "src/components/analytics/LinkedInInsight.tsx",
    "src/components/analytics/CookieConsent.tsx",
  ];
  const sansCommentaires = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

  it.each(COMPOSANTS)("%s consulte isRouteSansScriptsTiers, jamais isAdLandingRoute seul", (f) => {
    const code = sansCommentaires(readFileSync(join(process.cwd(), f), "utf8"));
    expect(code, "contre-témoin : la source est lue").toContain("usePathname");
    expect(code).toMatch(/if \(isRouteSansScriptsTiers\(pathname\)\) return null;/);
    expect(code).not.toMatch(/\bisAdLandingRoute\(/);
  });
});
