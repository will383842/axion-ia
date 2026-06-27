/**
 * Garde-fou Option B (décision Will 2026-06-27).
 *
 * Contexte : un incident prod (clé ANTHROPIC_API_KEY absente du worker) a fait
 * échouer des jobs villes (Claude primaire) ET désactivé le filet de secours
 * Claude pour les hoquets réseau OpenAI. Décision « Option B » :
 *
 *   1. Les sous-générateurs de pages villes utilisent OpenAI en PRIMAIRE
 *      (plus de `preferredProvider: "anthropic"`).
 *   2. Claude reste le FALLBACK automatique pour tout le contenu texte
 *      (chaîne role:"text" = [openai, anthropic] dans le provider-router).
 *
 * Ce test verrouille les DEUX invariants pour éviter une régression silencieuse
 * (retour à Claude-primaire, OU suppression du filet Claude = SPOF OpenAI).
 *
 * Hors scope volontaire : `benefit-judge-llm.ts` reste sur Claude (un juge sur un
 * modèle distinct du générateur évite le biais d'auto-évaluation).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GENERATORS_DIR = join(__dirname, "..", "..", "generators");
const ROUTER_PATH = join(__dirname, "..", "provider-router.ts");

/** Sous-générateurs de pages villes basculés OpenAI-primaire par l'Option B. */
const VILLE_TEXT_GENERATORS = [
  "landing-ville-secteurs.ts",
  "landing-ville-cas-usage.ts",
  "landing-ville-ecosystem.ts",
  "landing-ville-faq-extended.ts",
];

describe("Option B — routage providers content-gen (2026-06-27)", () => {
  it.each(VILLE_TEXT_GENERATORS)(
    "%s ne force PLUS Claude en primaire (OpenAI primaire)",
    (file) => {
      const src = readFileSync(join(GENERATORS_DIR, file), "utf8");
      expect(src).not.toContain('preferredProvider: "anthropic"');
      expect(src).toContain('preferredProvider: "openai"');
    },
  );

  it("le provider-router conserve Claude en FALLBACK du rôle text (filet anti-SPOF OpenAI)", () => {
    const router = readFileSync(ROUTER_PATH, "utf8");
    // La chaîne text doit rester [openaiProvider, anthropicProvider] : OpenAI
    // primaire + Claude fallback. Retirer anthropicProvider = SPOF OpenAI.
    expect(router).toMatch(/text:\s*\[\s*openaiProvider\s*,\s*anthropicProvider\s*\]/);
  });
});
