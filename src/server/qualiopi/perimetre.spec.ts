/**
 * Tests — périmètre Qualiopi (refonte console phase 3, 2026-08-01).
 *
 * La table est un choix MÉTIER : chaque test verrouille UNE classification.
 * Si l'un d'eux casse, c'est qu'on vient de changer le périmètre de la
 * certification — c'est peut-être voulu (décision de Will), mais jamais un
 * accident silencieux.
 *
 * Le test qui compte vraiment : « inconnu → hors périmètre ». Afficher
 * « Qualiopi » sur une prestation non couverte est un engagement d'audit
 * qu'on ne tient pas.
 */

import { describe, it, expect } from "vitest";

import { estDansPerimetreQualiopi, libellerPerimetre, PERIMETRE_LABELS } from "./perimetre";

describe("estDansPerimetreQualiopi — la table de vérité", () => {
  it("formation (collective) → ✅ Qualiopi (L.6313-1 1°)", () => {
    expect(estDansPerimetreQualiopi("formation")).toBe(true);
  });

  it("un_a_un (coaching 1-to-1 / AFEST) → ✅ Qualiopi (D.6313-3-1)", () => {
    expect(estDansPerimetreQualiopi("un_a_un")).toBe(true);
  });

  it("audit → ❌ hors périmètre (prestation de conseil)", () => {
    expect(estDansPerimetreQualiopi("audit")).toBe(false);
  });

  it("implementation → ❌ hors périmètre (prestation technique)", () => {
    expect(estDansPerimetreQualiopi("implementation")).toBe(false);
  });

  it("site_web → ❌ hors périmètre (prestation technique)", () => {
    expect(estDansPerimetreQualiopi("site_web")).toBe(false);
  });
});

describe("estDansPerimetreQualiopi — défaut prudent", () => {
  it("activité inconnue → ❌ hors périmètre (jamais Qualiopi par accident)", () => {
    expect(estDansPerimetreQualiopi("bilan_competences")).toBe(false);
    // Faute de frappe plausible sur une clé COUVERTE : doit retomber sur false,
    // pas matcher « formation » par à-peu-près.
    expect(estDansPerimetreQualiopi("formations")).toBe(false);
  });

  it("null / undefined / vide (Devis.activite est nullable) → ❌ hors périmètre", () => {
    expect(estDansPerimetreQualiopi(null)).toBe(false);
    expect(estDansPerimetreQualiopi(undefined)).toBe(false);
    expect(estDansPerimetreQualiopi("")).toBe(false);
  });

  it("clé héritée d'Object.prototype (« constructor ») → ❌ — l'opérateur `in` ne doit pas nous piéger", () => {
    // `"constructor" in objet` est true via la chaîne de prototypes : la
    // fonction doit quand même répondre false (la valeur lue n'est pas `true`).
    expect(estDansPerimetreQualiopi("constructor")).toBe(false);
  });
});

describe("libellerPerimetre", () => {
  it("true → badge Qualiopi, false → badge hors périmètre", () => {
    expect(libellerPerimetre(true)).toBe(PERIMETRE_LABELS.qualiopi);
    expect(libellerPerimetre(false)).toBe(PERIMETRE_LABELS.hors);
  });
});
