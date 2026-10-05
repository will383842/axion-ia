/**
 * LE LIEN DU DOSSIER EN LIGNE RESTE JOIGNABLE, PRIVÉ ET HORS DE SENTRY (2026-10-05).
 *
 * Même méthode que le questionnaire : on EXTRAIT le motif réel du `matcher` du proxy
 * et on le fait tourner. Sans l'exclusion, la règle 0bis 301 le lien vers
 * `/fr/apporteur/dossier/…` (404). Contre-témoins : les pages normales et une route
 * voisine (`/fr/apporteurs`) restent couvertes. Angle mort assumé : on lit des sources,
 * pas une réponse HTTP.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { estRouteARequeteSecrete } from "@/lib/observability/sentry-pii-scrub";

const RACINE = process.cwd();
const LIEN = "/apporteur/dossier/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd";

function matcherRegex(): RegExp {
  const source = readFileSync(join(RACINE, "src/proxy.ts"), "utf8");
  const ligne = source.split("\n").find((l) => l.trim().startsWith('"/((?!'));
  if (!ligne) throw new Error("Motif du matcher introuvable dans src/proxy.ts");
  const pattern = ligne.trim().replace(/^"/, "").replace(/",?$/, "").replace(/\\\\/g, "\\");
  return new RegExp(`^${pattern}$`);
}

describe("le dossier en ligne de l'apporteur reste joignable", () => {
  const matcher = matcherRegex();

  it("le proxy ne capte ni la page ni le PDF (pas de 301 vers /fr)", () => {
    expect(matcher.test(LIEN)).toBe(false);
    expect(matcher.test(`${LIEN}/contrat`)).toBe(false);
  });

  it("contre-témoin : les pages normales et la route voisine restent couvertes", () => {
    expect(matcher.test("/a-propos")).toBe(true);
    expect(matcher.test("/fr/apporteurs")).toBe(true);
    expect(matcher.test("/apporteur")).toBe(true);
  });

  it("next.config.ts pose CSP, same-origin et noindex sur la route", () => {
    const conf = readFileSync(join(RACINE, "next.config.ts"), "utf8");
    const i = conf.indexOf('source: "/apporteur/dossier/:path*"');
    expect(i).toBeGreaterThan(-1);
    const bloc = conf.slice(i, i + 1200);
    expect(bloc).toContain("same-origin");
    expect(bloc).toContain("noindex");
    expect(bloc).toContain("Content-Security-Policy");
  });

  it("Sentry supprime la requête entière (IBAN, téléphone, pièces)", () => {
    expect(estRouteARequeteSecrete(LIEN)).toBe(true);
    expect(estRouteARequeteSecrete(`POST https://axion-ia.com${LIEN}`)).toBe(true);
    expect(estRouteARequeteSecrete("/fr/apporteurs")).toBe(false);
  });
});
