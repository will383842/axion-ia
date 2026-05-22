/**
 * Tests structurels KB facts — Verticales sectorielles (V-15 expansion 2026-05-22).
 *
 * Vérifie pour les 5 verticales :
 *   - Compte attendu (audits 60, autres ≥ 60)
 *   - Unicité des IDs
 *   - Champs obligatoires non vides
 *   - Source URLs HTTPS plausibles
 *   - Confidence dans [0, 1]
 *   - VerifiedAt ISO date format
 *
 * Pure module — pas de DB, pas de Prisma, pas de Server Action.
 */

import { describe, it, expect } from "vitest";
import { KB_AUDITS } from "./audits";
import { KB_INTERVENTIONS_FORMATIONS } from "./interventions-formations";
import { KB_UN_A_UN } from "./un-a-un";
import { KB_IMPLEMENTATIONS } from "./implementations";
import { KB_SITES_WEB_AUGMENTES } from "./sites-web-augmentes";
import type { KbFact } from "./audits";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS_URL_RE = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i;

function assertFactsArray(facts: readonly KbFact[], minCount: number, verticaleHint: string): void {
  expect(facts.length, `${verticaleHint} : expected ≥ ${minCount} facts`).toBeGreaterThanOrEqual(
    minCount,
  );

  const ids = new Set<string>();
  for (const fact of facts) {
    expect(fact.id, `${verticaleHint} : id manquant`).toBeTruthy();
    expect(ids.has(fact.id), `${verticaleHint} : id dupliqué ${fact.id}`).toBe(false);
    ids.add(fact.id);

    expect(fact.text.length, `${verticaleHint} ${fact.id} : texte trop court`).toBeGreaterThan(30);
    expect(fact.source.length, `${verticaleHint} ${fact.id} : source manquante`).toBeGreaterThan(3);
    expect(fact.sourceUrl, `${verticaleHint} ${fact.id} : sourceUrl invalide`).toMatch(
      HTTPS_URL_RE,
    );
    expect(fact.verifiedAt, `${verticaleHint} ${fact.id} : verifiedAt ISO date attendue`).toMatch(
      ISO_DATE_RE,
    );
    expect(fact.verticales.length, `${verticaleHint} ${fact.id} : verticales vide`).toBeGreaterThan(
      0,
    );
    expect(
      fact.confidence,
      `${verticaleHint} ${fact.id} : confidence hors [0,1]`,
    ).toBeGreaterThanOrEqual(0);
    expect(fact.confidence).toBeLessThanOrEqual(1);
  }
}

describe("KB facts — verticales sectorielles", () => {
  it("KB_AUDITS contient 60 facts (V-15 expansion 2026-05-22)", () => {
    expect(KB_AUDITS).toHaveLength(60);
  });

  it("KB_AUDITS structure complète et IDs uniques", () => {
    assertFactsArray(KB_AUDITS, 60, "audits");
  });

  it("KB_INTERVENTIONS_FORMATIONS ≥ 60 facts + structure", () => {
    assertFactsArray(KB_INTERVENTIONS_FORMATIONS, 60, "interventions_formations");
  });

  it("KB_UN_A_UN ≥ 28 facts + structure", () => {
    assertFactsArray(KB_UN_A_UN, 28, "un_a_un");
  });

  it("KB_IMPLEMENTATIONS ≥ 60 facts + structure", () => {
    assertFactsArray(KB_IMPLEMENTATIONS, 60, "implementations");
  });

  it("KB_SITES_WEB_AUGMENTES ≥ 28 facts + structure", () => {
    assertFactsArray(KB_SITES_WEB_AUGMENTES, 28, "sites_web_augmentes");
  });

  it("Total cumulé ≥ 240 facts vérifiés (5 verticales)", () => {
    const total =
      KB_AUDITS.length +
      KB_INTERVENTIONS_FORMATIONS.length +
      KB_UN_A_UN.length +
      KB_IMPLEMENTATIONS.length +
      KB_SITES_WEB_AUGMENTES.length;
    expect(total).toBeGreaterThanOrEqual(240);
  });

  it("KB_AUDITS — tous les facts taggés verticale 'audits'", () => {
    for (const fact of KB_AUDITS) {
      expect(fact.verticales).toContain("audits");
    }
  });

  it("Toutes les sources URLs sont en HTTPS (zero HTTP plain)", () => {
    const all = [
      ...KB_AUDITS,
      ...KB_INTERVENTIONS_FORMATIONS,
      ...KB_UN_A_UN,
      ...KB_IMPLEMENTATIONS,
      ...KB_SITES_WEB_AUGMENTES,
    ];
    for (const fact of all) {
      expect(fact.sourceUrl.startsWith("https://"), `${fact.id} URL non HTTPS`).toBe(true);
    }
  });
});
