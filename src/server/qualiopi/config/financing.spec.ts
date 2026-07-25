/**
 * Tests — SSOT financement public (OPCO + France Travail).
 *
 * Vérifie : gating Phase A/B, variété déterministe (SSG-stable), et surtout les
 * INVARIANTS LÉGAUX du corpus de formulations (jamais de CPF, jamais de numéro,
 * jamais de sur-promesse « 100 % / automatique / gratuit »).
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  CPF_ELIGIBLE,
  FINANCING_BLURBS,
  FINANCING_MICRO,
  pickFinancingBlurb,
  getPublicFinancingBlurb,
  getPublicFinancingMicro,
  getFinancingPromptFact,
} from "./financing";

const ORIGINAL = process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
const ORIGINAL_CERT = process.env.QUALIOPI_CERTIFICATION_OBTENUE;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
  else process.env.OF_PUBLIC_DISCLOSURE_ENABLED = ORIGINAL;
  if (ORIGINAL_CERT === undefined) delete process.env.QUALIOPI_CERTIFICATION_OBTENUE;
  else process.env.QUALIOPI_CERTIFICATION_OBTENUE = ORIGINAL_CERT;
});

const ALL_TEXT = [...FINANCING_BLURBS, ...FINANCING_MICRO].join("\n").toLowerCase();

describe("SSOT financing — invariants légaux du corpus", () => {
  it("le CPF n'est PAS éligible (verrou)", () => {
    expect(CPF_ELIGIBLE).toBe(false);
  });

  it("aucune formulation ne cite le CPF / Mon Compte Formation", () => {
    expect(ALL_TEXT).not.toMatch(/\bcpf\b|mon compte formation|compte personnel de formation/);
  });

  it("aucune sur-promesse « 100 % / automatique / gratuit / intégralement »", () => {
    expect(ALL_TEXT).not.toMatch(/100\s*%|automatique|gratuit|intégralement|entièrement financ/);
  });

  it("aucun numéro (NDA 11 chiffres / certificat) dans le corpus", () => {
    expect(ALL_TEXT).not.toMatch(/\b\d{9,}\b/);
  });

  it("chaque formulation référence un canal de financement légitime (OPCO/FT)", () => {
    // chaque blurb nomme le mécanisme/canal réel (jamais un dispositif interdit)
    for (const b of FINANCING_BLURBS) {
      expect(b.toLowerCase()).toMatch(
        /opco|france travail|opérateur de compétences|fonds|financ|prise en charge/,
      );
    }
  });
});

describe("SSOT financing — variété déterministe (SSG-stable)", () => {
  it("même seed → même formulation (rendu SSG reproductible)", () => {
    expect(pickFinancingBlurb("btp-formations")).toBe(pickFinancingBlurb("btp-formations"));
  });

  it("des seeds différents couvrent plusieurs formulations (variété)", () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `page-${i}`);
    const distinct = new Set(seeds.map(pickFinancingBlurb));
    // on ne garantit pas l'unicité parfaite, mais une vraie dispersion.
    expect(distinct.size).toBeGreaterThan(5);
  });
});

describe("SSOT financing — gating Phase A/B", () => {
  it("Phase A (flag absent) → null / prompt vide", () => {
    delete process.env.OF_PUBLIC_DISCLOSURE_ENABLED;
    expect(getPublicFinancingBlurb("x")).toBeNull();
    expect(getPublicFinancingMicro("x")).toBeNull();
    expect(getFinancingPromptFact()).toBe("");
  });

  it("🚨 Phase B sans certification → aucune mention de financement (F13)", () => {
    // Le financement mutualisé (OPCO / France Travail) suppose la certification.
    // L'annoncer avant de l'avoir, c'est promettre une éligibilité inexistante.
    process.env.OF_PUBLIC_DISCLOSURE_ENABLED = "true";
    delete process.env.QUALIOPI_CERTIFICATION_OBTENUE;
    expect(getPublicFinancingBlurb("x")).toBeNull();
  });

  it("Phase B + certification obtenue → formulation + fait prompt (sans CPF)", () => {
    process.env.OF_PUBLIC_DISCLOSURE_ENABLED = "true";
    process.env.QUALIOPI_CERTIFICATION_OBTENUE = "true";
    expect(getPublicFinancingBlurb("x")).toBeTruthy();
    const fact = getFinancingPromptFact();
    expect(fact).toContain("OPCO");
    expect(fact).toContain("France Travail");
    expect(fact.toLowerCase()).toContain("interdit"); // garde-fous transmis au LLM
    expect(fact).toMatch(/CPF/); // le fait NOMME le CPF pour l'INTERDIRE explicitement
  });
});
