/**
 * Routes du tunnel apporteurs — la seule liste que lisent `MetaPixel`, la
 * bannière et la page merci. Trois invariants :
 *   1. `/apporteur-affaires` et `/apporteur-affaires/merci` en font partie,
 *      dans les deux locales ;
 *   2. l'ANCIENNE URL `/facebook` n'en fait PLUS partie — elle est redirigée
 *      (301) et ne rend aucune page, donc rien n'a à s'y charger. Ce cas est
 *      testé explicitement : c'est celui qu'un renommage oublie ;
 *   3. elles ne sont PAS des routes « sans scripts tiers » — sinon la bannière
 *      disparaîtrait pendant que le pixel se charge.
 */
import { describe, it, expect } from "vitest";
import { isRouteTunnelFacebook } from "../tunnel-facebook-routes";
import { isRouteSansScriptsTiers } from "../ad-landing-routes";
import {
  TUNNEL_FACEBOOK_PATH,
  TUNNEL_FACEBOOK_MERCI_PATH,
} from "@/lib/commercial-application/lead-apporteur";

describe("isRouteTunnelFacebook", () => {
  it("reconnaît la landing et la page merci, avec préfixe de langue", () => {
    for (const p of [
      "/fr/apporteur-affaires",
      "/fr/apporteur-affaires/merci",
      "/en/apporteur-affaires",
      "/apporteur-affaires",
    ]) {
      expect(isRouteTunnelFacebook(p), p).toBe(true);
    }
  });

  it("suit les constantes de chemin — le gating ne peut pas diverger du tunnel", () => {
    // Si quelqu'un renomme l'URL sans toucher au gating, le pixel devient muet
    // (ou pire, se charge sur une route qui n'est plus la landing). Ce test lie
    // les deux fichiers : il rougit AVANT la mise en ligne.
    expect(isRouteTunnelFacebook(`/fr${TUNNEL_FACEBOOK_PATH}`)).toBe(true);
    expect(isRouteTunnelFacebook(`/fr${TUNNEL_FACEBOOK_MERCI_PATH}`)).toBe(true);
  });

  it("ne reconnaît PLUS l'ancienne URL /facebook — elle est redirigée, pas rendue", () => {
    for (const p of ["/fr/facebook", "/fr/facebook/merci", "/en/facebook", "/facebook"]) {
      expect(isRouteTunnelFacebook(p), p).toBe(false);
    }
  });

  it("ne reconnaît rien d'autre — ni un préfixe partiel, ni le reste du site", () => {
    for (const p of [
      "/fr",
      "/fr/apporteur-affaires-independant-formation-ia-entreprise",
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
    expect(isRouteSansScriptsTiers("/fr/apporteur-affaires")).toBe(false);
    expect(isRouteSansScriptsTiers("/fr/apporteur-affaires/merci")).toBe(false);
  });
});
