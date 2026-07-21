/**
 * Tests — la garde qui empêche un jeton d'émargement de partir chez un tiers.
 *
 * Le jeton vit DANS le chemin et reste rejouable jusqu'à la fin de session
 * + 48 h. Une garde trop étroite le laisse fuir ; une garde trop large éteint
 * la mesure d'audience du site. Les deux cas sont testés.
 */

import { describe, it, expect } from "vitest";
import { urlPorteUnSecret } from "./routes-privees";

describe("urlPorteUnSecret", () => {
  it.each([
    "/fr/portail/emarger/eyJhbGciOi.c2lnbmF0dXJl",
    "/en/portail/emarger/abc.def",
    "/fr/portail",
    "/fr/portail/",
    "/portail/emarger/abc.def",
  ])("protège %s", (p) => {
    expect(urlPorteUnSecret(p)).toBe(true);
  });

  it.each([
    "/fr",
    "/fr/formations",
    "/fr/blog/ia-et-pme",
    "/fr/espace-formateur/sessions/abc",
    "/fr/contact",
  ])("laisse mesurer %s", (p) => {
    expect(urlPorteUnSecret(p)).toBe(false);
  });

  it("🔴 ne se laisse pas contourner par un segment qui COMMENCE par « portail »", () => {
    // `portailleurs` n'est pas le portail : sans la frontière `(?:\/|$)`, la
    // garde s'étendrait à des pages publiques et éteindrait leur mesure.
    expect(urlPorteUnSecret("/fr/portailleurs")).toBe(false);
  });

  it("🔴 protège AVANT comme APRÈS la résolution de locale", () => {
    // La garde s'exécute côté client, où le chemin peut porter ou non le
    // préfixe de langue selon le moment du rendu.
    expect(urlPorteUnSecret("/portail/emarger/x.y")).toBe(true);
    expect(urlPorteUnSecret("/fr/portail/emarger/x.y")).toBe(true);
  });

  it("ne casse pas sur une valeur absente", () => {
    // `usePathname()` peut rendre `null` au tout premier rendu.
    expect(urlPorteUnSecret(null)).toBe(false);
    expect(urlPorteUnSecret(undefined)).toBe(false);
    expect(urlPorteUnSecret("")).toBe(false);
  });
});
