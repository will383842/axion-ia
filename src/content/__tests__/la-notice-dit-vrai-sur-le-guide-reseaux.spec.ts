// @vitest-environment node

/**
 * Verrou — la politique de confidentialité contient la rubrique « Demande d'un
 * guide via les réseaux sociaux » (FR + EN), avec ses éléments essentiels et
 * sans affirmation non vérifiée (pas de pays, pas de garantie de transfert).
 * Garde de forme, pas de rédaction.
 */

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../legal";

function section(locale: "fr" | "en", titre: RegExp) {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  const s = page?.[locale].sections.find((x) => titre.test(x.title));
  expect(s, `section ${titre} introuvable (${locale})`).toBeTruthy();
  return s!;
}

describe("la politique dit la demande de guide par les réseaux sociaux", () => {
  it("FR : données, finalité, consentement séparé, destinataires, conservation, STOP, droits", () => {
    const s = section("fr", /^Demande d'un guide via les réseaux sociaux/);
    expect(s.anchor).toBe("guide-reseaux-sociaux");
    for (const m of [
      "commentez un mot-clé",
      "message privé",
      "prénom et l'adresse e-mail",
      "« Recevoir le guide »",
      "consentement distinct",
      "pas obligatoire pour recevoir le guide",
      "Zernio",
      "pas supprimées automatiquement",
      "« STOP »",
      "strict minimum",
      "portabilité",
      "11 novembre 2026",
    ]) {
      expect(s.body, m).toContain(m);
    }
  });

  it("EN : la structure bilingue est maintenue", () => {
    const s = section("en", /^Requesting a guide through social networks/);
    expect(s.anchor).toBe("guide-social-networks");
    for (const m of [
      "private message",
      "Zernio",
      '"STOP"',
      "not deleted automatically",
      "portability",
    ]) {
      expect(s.body, m).toContain(m);
    }
  });

  it("⛔ aucune affirmation non vérifiée, aucun mot interdit", () => {
    for (const loc of ["fr", "en"] as const) {
      const s = section(loc, loc === "fr" ? /^Demande d'un guide/ : /^Requesting a guide/);
      expect(s.body).not.toMatch(/Grenoble|Aucun gain garanti/i);
      expect(s.body).not.toMatch(
        /États-Unis|United States|\bUSA\b|Standard Contractual|clauses contractuelles types|adequacy|adéquation/i,
      );
    }
  });
});
