/**
 * Garde-fou routage providers content-gen.
 *
 * Historique « Option B » (Will 2026-06-27) : OpenAI primaire pour les villes,
 * Claude conservé en FALLBACK anti-SPOF sur le rôle text.
 *
 * ── RÉVISION Will 2026-07-09 : content-gen = OpenAI UNIQUEMENT ──
 * Le fallback Claude drainait le crédit Anthropic à l'insu du propriétaire
 * (dès qu'OpenAI renvoyait un 429 quota/rate-limit → bascule claude-sonnet-4-6,
 * 754 appels = 51,75 $ au cost_ledger). Décision : RETIRER le fallback Claude.
 * Conséquence assumée : une panne/quota OpenAI fait échouer le job (retry BullMQ)
 * au lieu de dépenser sur Anthropic. `benefit-judge-llm.ts` bascule aussi sur
 * OpenAI (plus de juge Claude).
 *
 * Ce test verrouille les invariants ACTUELS pour éviter une régression
 * silencieuse (retour de Claude en primaire OU en fallback du rôle text).
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

  it("le provider-router route le rôle text vers OpenAI UNIQUEMENT (zéro fallback Claude — Will 2026-07-09)", () => {
    const router = readFileSync(ROUTER_PATH, "utf8");
    // La chaîne text ne doit contenir QUE openaiProvider : pas de fallback
    // Claude (décision 2026-07-09 — anti-drain crédit Anthropic).
    expect(router).toMatch(/text:\s*\[\s*openaiProvider\s*\]/);
    expect(router).not.toMatch(/text:\s*\[[^\]]*anthropicProvider[^\]]*\]/);
  });
});
