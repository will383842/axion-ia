/**
 * CLIQUET — `upgrade-insecure-requests` ne doit sauter QUE sur le bouclage.
 *
 * 🔴 2026-08-22 — TROIS ROUTES ROUGES EN CI, MÉCANISME ÉLUCIDÉ PAR L'INSTRUMENT.
 *
 * Le harnais rendait, sur `/fr/espace-ressources`, `/fr/mes-ressources` et la
 * page de connexion de l'espace ressources :
 *
 *     https://localhost:3000/fr/espace-ressources/connexion
 *       — net::ERR_SSL_PROTOCOL_ERROR
 *       (type=fetch, redirigée depuis http://localhost:3000/fr/espace-ressources?_rsc=…)
 *
 * Le `?_rsc=` signe un PREFETCH de `next/link`. La page de connexion porte un
 * lien vers `/fr/espace-ressources`, préfixe gardé par la garde Edge : le
 * prefetch reçoit une redirection, et Chromium **upgrade la CIBLE de cette
 * redirection** — schéma réécrit, port conservé.
 *
 * 🔑 POURQUOI DEUX REPRODUCTIONS LOCALES ONT CONCLU « RIEN À SIGNALER ».
 * Chromium n'upgrade PAS une requête DIRECTE vers `http://localhost` (origine
 * réputée sûre), et le prefetch de `next/link` est éteint sous `next dev`. Il
 * fallait un build de PRODUCTION servi en HTTP nu — la CI, et rien d'autre.
 * Ce n'est pas le raisonnement qui a tranché : c'est le message d'échec, une
 * fois qu'il a porté le TYPE de requête et sa chaîne de redirection.
 *
 * ⚠️ LE CRITÈRE EST L'HÔTE, JAMAIS LE SCHÉMA. Derrière Coolify puis Cloudflare,
 * le dernier saut interne est en clair : gater sur le schéma perçu par le
 * serveur retirerait silencieusement la directive EN PRODUCTION. C'est le
 * contre-témoin le plus important de ce fichier.
 */

import { describe, expect, it } from "vitest";
import { buildCspHeader, estHoteDeBouclage } from "../csp";

const NONCE = "test-nonce";

describe("estHoteDeBouclage", () => {
  it("reconnaît les trois formes de bouclage, avec ou sans port", () => {
    for (const h of ["localhost", "localhost:3000", "127.0.0.1", "127.0.0.1:3000", "[::1]"]) {
      expect(estHoteDeBouclage(h), h).toBe(true);
    }
  });

  it("refuse tout le reste — le défaut sûr est de GARDER la directive", () => {
    for (const h of [
      "axion-ia.com",
      "www.axion-ia.com",
      "localhost.evil.com",
      "notlocalhost",
      "",
      null,
      undefined,
    ]) {
      expect(estHoteDeBouclage(h), String(h)).toBe(false);
    }
  });
});

describe("buildCspHeader — upgrade-insecure-requests", () => {
  it("la porte par défaut", () => {
    expect(buildCspHeader({ nonce: NONCE, strict: false })).toContain("upgrade-insecure-requests");
  });

  it("la porte sur un hôte de production", () => {
    // Contre-témoin CENTRAL : c'est la production qui a besoin de cette
    // directive. Si ce test venait à rougir, le correctif serait une régression
    // de sécurité, pas une correction de test.
    expect(
      buildCspHeader({
        nonce: NONCE,
        strict: false,
        origineBouclage: estHoteDeBouclage("axion-ia.com"),
      }),
    ).toContain("upgrade-insecure-requests");
  });

  it("l'omet sur une origine de bouclage", () => {
    expect(
      buildCspHeader({
        nonce: NONCE,
        strict: false,
        origineBouclage: estHoteDeBouclage("localhost:3000"),
      }),
    ).not.toContain("upgrade-insecure-requests");
  });

  it("n'omet rien d'autre au passage", () => {
    // La directive retirée ne doit pas emporter ses voisines, ni laisser un
    // point-virgule orphelin qui invaliderait toute la politique.
    const csp = buildCspHeader({ nonce: NONCE, strict: false, origineBouclage: true });
    for (const attendu of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp, attendu).toContain(attendu);
    }
    expect(csp, "point-virgule orphelin ou directive vide").not.toMatch(/;\s*;|;\s*$/);
  });
});
