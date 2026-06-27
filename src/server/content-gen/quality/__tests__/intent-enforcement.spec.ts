/**
 * Tests — Intent enforcement déterministe (2026-06-27).
 *
 * Garantit que le plancher sources/CTA fait passer la validation d'intent
 * (`validateIntentAlignment`) sans dépendre du LLM.
 */

import { describe, expect, it } from "vitest";
import {
  enforceIntentRequirements,
  hasRecognizedCta,
  countExternalLinks,
  RECOGNIZED_CTA_RE,
} from "../intent-enforcement";
import { validateIntentAlignment } from "../search-intent-validator";

const BODY_NO_LINKS =
  "<h1>Qu'est-ce que l'audit IA</h1><p>Un audit structuré aide les PME.</p><p>Voici les étapes.</p>";

describe("countExternalLinks", () => {
  it("compte les liens externes et exclut axion-ia.com", () => {
    const html =
      '<a href="https://www.insee.fr/x">INSEE</a>' +
      '<a href="https://axion-ia.com/blog">interne</a>' +
      '<a href="https://dares.travail-emploi.gouv.fr/y">DARES</a>' +
      '<a href="/fr/relatif">relatif</a>';
    expect(countExternalLinks(html)).toBe(2);
  });
});

describe("hasRecognizedCta", () => {
  it("reconnaît les vraies pages de conversion Axion-IA", () => {
    expect(hasRecognizedCta('<a href="/reserver">Réserver</a>')).toBe(true);
    expect(hasRecognizedCta('<a href="/audit">Demander un audit</a>')).toBe(true);
    expect(hasRecognizedCta('<a href="/formations">Réserver une formation</a>')).toBe(true);
    expect(hasRecognizedCta('<a href="/interventions/essentielle">Faire faire</a>')).toBe(true);
    expect(hasRecognizedCta('<a href="mailto:contact@axion-ia.com">Écrire</a>')).toBe(true);
    expect(hasRecognizedCta("<button>Réserver</button>")).toBe(true);
    expect(hasRecognizedCta('<p class="cta-primary"><a href="/x">y</a></p>')).toBe(true);
  });

  it("ne confond pas un simple texte « contactez » avec un CTA", () => {
    expect(hasRecognizedCta("<p>N'hésitez pas à nous contacter par téléphone.</p>")).toBe(false);
  });

  it("RECOGNIZED_CTA_RE est exporté pour réutilisation", () => {
    expect(RECOGNIZED_CTA_RE.test('href="/devis"')).toBe(true);
  });
});

describe("enforceIntentRequirements — sources (informational)", () => {
  it("injecte ≥3 sources quand le body n'en a aucune + rend l'intent aligné", () => {
    const r = enforceIntentRequirements({
      intent: "informational",
      bodyHtml: BODY_NO_LINKS,
      citations: [],
    });
    expect(r.changed).toBe(true);
    expect(r.sourcesInjected).toBeGreaterThanOrEqual(3);
    expect(countExternalLinks(r.bodyHtml)).toBeGreaterThanOrEqual(3);
    expect(r.bodyHtml).toContain('id="sources-axion"');
    expect(r.citations.length).toBeGreaterThanOrEqual(3);

    // La validation d'intent passe désormais (citationCount = liens injectés).
    const intent = validateIntentAlignment({
      intent: "informational",
      slug: "audit-ia",
      title: "Comment réussir son audit IA",
      metaDescription: "Un guide pour structurer son audit IA en PME.",
      bodyHtml: r.bodyHtml,
      citationCount: countExternalLinks(r.bodyHtml),
    });
    expect(intent.aligned).toBe(true);
  });

  it("ne touche à rien si déjà ≥3 liens externes (idempotent)", () => {
    const body =
      BODY_NO_LINKS +
      '<a href="https://www.insee.fr/a">A</a>' +
      '<a href="https://dares.travail-emploi.gouv.fr/b">B</a>' +
      '<a href="https://eur-lex.europa.eu/c">C</a>';
    const r = enforceIntentRequirements({ intent: "informational", bodyHtml: body, citations: [] });
    expect(r.changed).toBe(false);
    expect(r.bodyHtml).toBe(body);
  });

  it("COMPLÈTE une section sources-axion existante sous-remplie", () => {
    const body =
      BODY_NO_LINKS +
      '<section id="sources-axion"><h2>Sources</h2><ul>' +
      '<li><a href="https://www.insee.fr/only" target="_blank" rel="noopener noreferrer">INSEE</a></li>' +
      "</ul></section>";
    expect(countExternalLinks(body)).toBe(1);
    const r = enforceIntentRequirements({ intent: "informational", bodyHtml: body, citations: [] });
    expect(r.changed).toBe(true);
    expect(countExternalLinks(r.bodyHtml)).toBeGreaterThanOrEqual(3);
    // Une seule section sources-axion (pas de doublon).
    expect(r.bodyHtml.match(/id="sources-axion"/g)?.length).toBe(1);
  });
});

describe("enforceIntentRequirements — CTA (transactional)", () => {
  it("injecte un CTA reconnu quand il n'y en a pas", () => {
    const r = enforceIntentRequirements({
      intent: "transactional",
      bodyHtml: BODY_NO_LINKS,
      citations: [],
    });
    expect(r.ctaInjected).toBe(true);
    expect(hasRecognizedCta(r.bodyHtml)).toBe(true);

    const intent = validateIntentAlignment({
      intent: "transactional",
      slug: "reserver-audit-ia",
      title: "Réservez votre audit IA",
      metaDescription: "Réservez un audit IA opérationnel.",
      bodyHtml: r.bodyHtml,
      hasPrimaryCta: hasRecognizedCta(r.bodyHtml),
    });
    expect(intent.aligned).toBe(true);
  });

  it("n'injecte pas de CTA si un CTA /audit est déjà présent", () => {
    const body = BODY_NO_LINKS + '<a href="/audit">Demander un audit IA</a>';
    const r = enforceIntentRequirements({ intent: "transactional", bodyHtml: body, citations: [] });
    expect(r.ctaInjected).toBe(false);
    expect(r.bodyHtml).toBe(body);
  });
});

describe("enforceIntentRequirements — intents hors scope", () => {
  it("ne modifie pas un intent local", () => {
    const r = enforceIntentRequirements({
      intent: "local",
      bodyHtml: BODY_NO_LINKS,
      citations: [],
    });
    expect(r.changed).toBe(false);
    expect(r.bodyHtml).toBe(BODY_NO_LINKS);
  });
});
