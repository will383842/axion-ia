/**
 * Routes du tunnel Facebook — la seule liste que lisent `MetaPixel`, la
 * bannière et la page merci. Deux invariants :
 *   1. `/facebook` et `/facebook/merci` en font partie, dans les deux locales ;
 *   2. elles ne sont PAS des routes « sans scripts tiers » — sinon la bannière
 *      disparaîtrait pendant que le pixel se charge.
 */
import { describe, it, expect } from "vitest";
import { isRouteTunnelFacebook } from "../tunnel-facebook-routes";
import { isRouteSansScriptsTiers } from "../ad-landing-routes";

describe("isRouteTunnelFacebook", () => {
  it("reconnaît la landing et la page merci, avec préfixe de langue", () => {
    for (const p of ["/fr/facebook", "/fr/facebook/merci", "/en/facebook", "/facebook"]) {
      expect(isRouteTunnelFacebook(p), p).toBe(true);
    }
  });

  it("ne reconnaît rien d'autre — ni un préfixe partiel, ni le reste du site", () => {
    for (const p of [
      "/fr",
      "/fr/facebook-ads",
      "/fr/leboncoin",
      "/fr/appel",
      null,
      undefined,
      "",
    ]) {
      expect(isRouteTunnelFacebook(p), String(p)).toBe(false);
    }
  });

  it("le tunnel n'est PAS une route sans scripts tiers : le pixel s'y charge, la bannière y reste", () => {
    expect(isRouteSansScriptsTiers("/fr/facebook")).toBe(false);
    expect(isRouteSansScriptsTiers("/fr/facebook/merci")).toBe(false);
  });
});
