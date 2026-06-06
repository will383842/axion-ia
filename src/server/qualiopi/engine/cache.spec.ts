/**
 * Tests — cache.ts
 *
 * Vérifie buildCacheKey (module pur, ne touche pas la DB) :
 * - Déterministe : même entrée → même clé
 * - Change si prompt change
 * - Change si promptVersion change
 * - Change si langue change
 * - Retourne une chaîne hex de 64 chars (SHA-256)
 */

import { describe, it, expect } from "vitest";
import { buildCacheKey } from "./cache";

describe("buildCacheKey", () => {
  it("retourne une chaîne hex de 64 caractères", () => {
    const key = buildCacheKey("un prompt test", 1, "fr");
    expect(typeof key).toBe("string");
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("est déterministe (même entrée → même clé)", () => {
    const prompt = "Évalue ce plan de formation pédagogique.";
    const k1 = buildCacheKey(prompt, 1, "fr");
    const k2 = buildCacheKey(prompt, 1, "fr");
    expect(k1).toBe(k2);
  });

  it("change si le prompt change", () => {
    const k1 = buildCacheKey("prompt A", 1, "fr");
    const k2 = buildCacheKey("prompt B", 1, "fr");
    expect(k1).not.toBe(k2);
  });

  it("change si promptVersion change", () => {
    const prompt = "un même prompt";
    const k1 = buildCacheKey(prompt, 1, "fr");
    const k2 = buildCacheKey(prompt, 2, "fr");
    expect(k1).not.toBe(k2);
  });

  it("change si langue change", () => {
    const prompt = "un même prompt";
    const k1 = buildCacheKey(prompt, 1, "fr");
    const k2 = buildCacheKey(prompt, 1, "en");
    expect(k1).not.toBe(k2);
  });

  it("différencie prompt vide / prompt non vide", () => {
    const k1 = buildCacheKey("", 1, "fr");
    const k2 = buildCacheKey("x", 1, "fr");
    expect(k1).not.toBe(k2);
  });

  it("différencie promptVersion 0 / langue '0' (séparateur | évite ambiguïté)", () => {
    // prompt="a|1", version=0, langue="fr" vs prompt="a", version=1, langue="0|fr"
    const k1 = buildCacheKey("a|1", 0, "fr");
    const k2 = buildCacheKey("a", 1, "0|fr");
    // Ces deux entrées ne doivent PAS collisionner
    expect(k1).not.toBe(k2);
  });
});
