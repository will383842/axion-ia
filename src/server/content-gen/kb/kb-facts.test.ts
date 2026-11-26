/**
 * Tests structurels KB facts — Verticales sectorielles (V-15 expansion 2026-05-22).
 *
 * Vérifie pour les 5 verticales et villes-facts :
 *   - Aucun nombre minimal de faits (un compte à atteindre pousse à remplir, pas à vérifier)
 *   - Tout fait chiffré d'un organisme tiers a une adresse profonde (audit 26/11/2026)
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
import { KB_VILLES_ALL } from "./villes-facts";
import type { KbFact } from "./audits";
import {
  aAdresseProfonde,
  estFaitTiersChiffreSansAdresseProfonde,
  estRetourTerrainChiffre,
} from "./kb-verifiabilite";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOUS_LES_FAITS: readonly KbFact[] = [
  ...KB_AUDITS,
  ...KB_INTERVENTIONS_FORMATIONS,
  ...KB_UN_A_UN,
  ...KB_IMPLEMENTATIONS,
  ...KB_SITES_WEB_AUGMENTES,
  ...KB_VILLES_ALL,
];

const HTTPS_URL_RE = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i;

function assertFactsArray(facts: readonly KbFact[], verticaleHint: string): void {
  expect(facts.length, `${verticaleHint} : au moins un fait`).toBeGreaterThan(0);

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
  it("KB_AUDITS structure complète et IDs uniques", () => {
    assertFactsArray(KB_AUDITS, "audits");
  });

  it("KB_INTERVENTIONS_FORMATIONS structure complète", () => {
    assertFactsArray(KB_INTERVENTIONS_FORMATIONS, "interventions_formations");
  });

  it("KB_UN_A_UN structure complète", () => {
    assertFactsArray(KB_UN_A_UN, "un_a_un");
  });

  it("KB_IMPLEMENTATIONS structure complète", () => {
    assertFactsArray(KB_IMPLEMENTATIONS, "implementations");
  });

  it("KB_SITES_WEB_AUGMENTES structure complète", () => {
    assertFactsArray(KB_SITES_WEB_AUGMENTES, "sites_web_augmentes");
  });

  it("tout fait chiffré d'un organisme tiers a une adresse profonde (pas une page d'accueil)", () => {
    const fautifs = TOUS_LES_FAITS.filter(estFaitTiersChiffreSansAdresseProfonde).map(
      (f) => `${f.id} (${f.sourceUrl})`,
    );
    expect(fautifs, "faits tiers chiffrés sans adresse profonde").toEqual([]);
  });

  it("aucun chiffre présenté comme « retours terrain » d'Axion-IA", () => {
    const fautifs = TOUS_LES_FAITS.filter(estRetourTerrainChiffre).map((f) => f.id);
    expect(fautifs).toEqual([]);
  });

  it("les faits retirés le 26/11/2026 ne reviennent pas (Forrester 73 %, BPI 15 000 à 80 000 €, McKinsey)", () => {
    const ids = new Set(TOUS_LES_FAITS.map((f) => f.id));
    for (const id of ["impl-047", "impl-042", "audit-055"]) {
      expect(ids.has(id), `${id} doit rester en quarantaine`).toBe(false);
    }
    const texte = JSON.stringify(TOUS_LES_FAITS);
    expect(texte).not.toMatch(/Forrester[^"]{0,200}73\s?%/);
    expect(texte).not.toMatch(/15\s?000[^"]{0,20}80\s?000/);
  });

  it("aAdresseProfonde distingue accueil, rubrique et page précise", () => {
    expect(aAdresseProfonde("https://www.bpifrance.fr")).toBe(false);
    expect(aAdresseProfonde("https://www.cnil.fr/fr/intelligence-artificielle")).toBe(false);
    expect(aAdresseProfonde("https://www.iso.org/standard/81230.html")).toBe(true);
    expect(
      aAdresseProfonde("https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689"),
    ).toBe(true);
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
