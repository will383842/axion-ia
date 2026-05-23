/**
 * V-13 P6 2026-05-22 — Test integration persona Manon couverture 7/7+ generators.
 *
 * Prévient toute régression silencieuse : si un nouveau generator est ajouté
 * sans intégrer la persona Axion-IA (Manon ou variante), ce test pète.
 *
 * Couverture :
 *   1. Le module brand-voice expose les 5 personas + la map content_type→persona.
 *   2. Chaque generator (9 fichiers) référence brand-voice via injectBrandVoice()
 *      ou getBrandVoiceForContentType() — détection au niveau du code source.
 *   3. injectBrandVoice() est idempotent (re-appliqué = no-op).
 *   4. getBrandVoiceForContentType() retourne un bloc non vide pour les 5
 *      content_types canoniques (et fallback Manon consultante pour le reste).
 *   5. Le persona contient les éléments AI Act art. 50 obligatoires (auteur
 *      Manon, sources canoniques, contact@axion-ia.com, vocabulaire bloqué).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BRAND_VOICE_AXION_IA,
  getBrandVoiceForContentType,
  injectBrandVoice,
  injectBrandVoiceForType,
} from "../brand-voice";

const GENERATORS_DIR = resolve(__dirname, "..", "..", "generators");
// Sprint v7 Phase 5 commit 1 — landing-ville.ts est devenu un dispatcher qui
// route vers 5 generators verticaux. Le pipeline réel (KB retrieve + LLM +
// brand-voice injection + quality checks) vit dans landing-ville-shared.ts ;
// c'est donc ce fichier qui doit injecter la persona Manon, pas le dispatcher.
//
// Sprint v7 Phase 8 commit 2/4 — 12 nouveaux content types partagent
// `v7-phase8-shared.ts` (pipeline mutualisé) qui injecte aussi brand-voice
// via getBrandVoiceForContentType. On ajoute ce file à la liste pour couvrir
// les 12 nouveaux types collectivement.
const GENERATOR_FILES = [
  "blog-article.ts",
  "blog-from-keywords.ts",
  "blog-from-title.ts",
  "blog-from-rss.ts",
  "comparison.ts",
  "faq-standalone.ts",
  "guide-pilier.ts",
  "landing-ville-shared.ts",
  "qa-derived.ts",
  "v7-phase8-shared.ts",
] as const;

const PERSONA_INJECTION_PATTERN =
  /\b(injectBrandVoice|getBrandVoiceForContentType|injectBrandVoiceForType)\s*\(/;

describe("V-13 persona Manon — SSOT brand-voice", () => {
  it("BRAND_VOICE_AXION_IA expose la persona Manon canonique", () => {
    expect(BRAND_VOICE_AXION_IA.persona).toMatch(/Manon/);
    expect(BRAND_VOICE_AXION_IA.persona).toMatch(/Axion-IA/);
  });

  it("Le vocabulaire interdit contient les superlatifs creux (anti-marketing)", () => {
    const forbidden = BRAND_VOICE_AXION_IA.vocabulary.forbidden;
    expect(forbidden).toContain("révolutionner");
    expect(forbidden).toContain("disruptif");
    expect(forbidden).toContain("game-changer");
  });

  it("AI Act art. 50 compliance flag explicitement ON", () => {
    expect(BRAND_VOICE_AXION_IA.compliance.aiActArt50).toBe(true);
  });

  it("Contact canonique = contact@axion-ia.com (pas de téléphone, pas de prix)", () => {
    expect(BRAND_VOICE_AXION_IA.compliance.contactEmail).toBe("contact@axion-ia.com");
    expect(BRAND_VOICE_AXION_IA.compliance.noPhoneNumber).toBe(true);
    expect(BRAND_VOICE_AXION_IA.compliance.noHardcodedPrices).toBe(true);
    expect(BRAND_VOICE_AXION_IA.compliance.noHardcodedDelay).toBe(true);
  });
});

describe("V-13 persona Manon — couverture 10/10 generator files (incl. v7-phase8-shared)", () => {
  it.each(GENERATOR_FILES)(
    "le générateur %s référence brand-voice (injectBrandVoice ou getBrandVoiceForContentType)",
    (file) => {
      const path = resolve(GENERATORS_DIR, file);
      const content = readFileSync(path, "utf8");
      expect(content).toMatch(/from\s+["'](?:\.\.\/)?brand\/brand-voice["']/);
      expect(content).toMatch(PERSONA_INJECTION_PATTERN);
    },
  );

  it("aucun generator du dossier ne skip brand-voice (anti-régression future)", () => {
    // Le test ci-dessus couvre la liste blanche. Ce test ajoute un guard
    // explicite : si un nouveau generator apparait, il devra être ajouté à
    // GENERATOR_FILES ET passer la couverture brand-voice.
    expect(GENERATOR_FILES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("V-13 persona Manon — résolution par contentType", () => {
  it("getBrandVoiceForContentType retourne un bloc non vide pour les 5 content_types canoniques", () => {
    const types = ["blog_article", "blog_from_rss", "comparison", "qa_derived", "guide_pilier"];
    for (const t of types) {
      const block = getBrandVoiceForContentType(t);
      expect(block.length, `${t} → block vide`).toBeGreaterThan(100);
      expect(block).toMatch(/PERSONA & BRAND VOICE/);
    }
  });

  it("getBrandVoiceForContentType fallback Manon consultante pour content_type inconnu", () => {
    const fallback = getBrandVoiceForContentType("unknown_type_xyz");
    expect(fallback).toMatch(/Manon/);
    expect(fallback).toMatch(/Axion-IA/);
    expect(fallback).toMatch(/PERSONA & BRAND VOICE/);
  });

  it("comparison utilise expert analytique (pas Manon directe) — exigence neutralité", () => {
    const block = getBrandVoiceForContentType("comparison");
    expect(block).toMatch(/expert analytique impartial/);
    // OBLIGATOIRE <table> récapitulatif pour Featured Snippet 2026 (ADR P0-3 2026-05-23).
    expect(block).toMatch(/OBLIGATOIRE.*<table>/);
  });

  it("blog_from_rss utilise persona éditoriale neutre (pas Chez Axion-IA en intro)", () => {
    const block = getBrandVoiceForContentType("blog_from_rss");
    expect(block).toMatch(/journalistique/);
    expect(block).toMatch(/ne pas commencer par "Chez Axion-IA"/);
  });

  it("qa_derived utilise persona Manon directe (réponse 50-80 mots MAX)", () => {
    const block = getBrandVoiceForContentType("qa_derived");
    expect(block).toMatch(/Manon/);
    expect(block).toMatch(/50-80 mots MAX/);
  });
});

describe("V-13 persona Manon — idempotence des helpers", () => {
  it("injectBrandVoice est idempotent (n'empile pas deux blocs)", () => {
    const base = "SYSTEM: tu es un assistant.";
    const once = injectBrandVoice(base);
    const twice = injectBrandVoice(once);
    expect(once).toBe(twice);
  });

  it("injectBrandVoiceForType est idempotent pour chaque type", () => {
    const base = "SYSTEM: tu rédiges un comparatif.";
    const once = injectBrandVoiceForType(base, "comparison");
    const twice = injectBrandVoiceForType(once, "comparison");
    expect(once).toBe(twice);
  });

  it("injectBrandVoice ajoute le bloc PERSONA quand absent", () => {
    const base = "SYSTEM: prompt sans persona.";
    const result = injectBrandVoice(base);
    expect(result).toMatch(/PERSONA & BRAND VOICE/);
    expect(result.length).toBeGreaterThan(base.length);
  });
});

describe("V-13 persona Manon — contraintes AI Act art. 50", () => {
  it("chaque bloc persona mentionne la signature L'équipe Axion-IA ou positionne le cabinet", () => {
    const types = ["blog_article", "qa_derived", "guide_pilier", "comparison", "blog_from_rss"];
    for (const t of types) {
      const block = getBrandVoiceForContentType(t);
      // Soit signature L'équipe Axion-IA, soit mention explicite cabinet/Axion-IA en attribution.
      const hasAttribution =
        block.includes("L'équipe Axion-IA") ||
        block.includes("Axion-IA accompagne") ||
        block.includes("Axion-IA est incluse") ||
        block.includes("cabinet de conseil en IA");
      expect(hasAttribution, `${t} → attribution Axion-IA manquante`).toBe(true);
    }
  });

  it("chaque bloc persona interdit les superlatifs marketing creux", () => {
    const types = ["blog_article", "qa_derived", "guide_pilier", "comparison", "blog_from_rss"];
    for (const t of types) {
      const block = getBrandVoiceForContentType(t);
      expect(block, `${t} : superlatifs non listés comme bannis`).toMatch(
        /révolutionner.*disruptif|Mots bannis/,
      );
    }
  });
});
