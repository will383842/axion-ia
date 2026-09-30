/**
 * ⛔ LES RÉPONSES NE SONT JAMAIS STOCKÉES CHEZ OPENAI (ADR 0055 §1.3 ; `store: false`).
 *
 * Le seul endroit où les paramètres d'un appel Responses sont construits est
 * `parametresResponses` (client.ts) : il pose `store: false`, aucun outil,
 * aucune `temperature`. Et le client réel l'utilise pour CHAQUE appel.
 *
 * Mutation qui rougit : retirer `store: false` de `parametresResponses`, ou
 * faire construire les paramètres ailleurs dans `client.ts`. Contre-témoin :
 * les autres réglages (effort, plafond de sortie) viennent bien de la
 * demande. Angle mort : la politique de conservation d'OpenAI elle-même (30 j
 * de journaux d'abus) n'est pas mesurable d'ici.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { formatDeSortie, parametresResponses } from "../client";

describe("les réponses ne sont jamais stockées chez OpenAI", () => {
  const p = parametresResponses({
    modele: "gpt-6-sol",
    instructions: "i",
    entree: "e",
    format: formatDeSortie(z.object({ a: z.string() }), "t"),
    effort: "high",
    maxSortie: 32_000,
  });

  it("store: false, aucun outil, aucune température", () => {
    expect(p.store).toBe(false);
    expect(p).not.toHaveProperty("tools");
    expect(p).not.toHaveProperty("temperature");
  });

  it("contre-témoin : les réglages viennent de la demande", () => {
    expect(p).toMatchObject({
      reasoning: { effort: "high" },
      max_output_tokens: 32_000,
      model: "gpt-6-sol",
    });
    expect(p.text.format).toMatchObject({ type: "json_schema", strict: true });
  });

  it("le client réel passe par `parametresResponses` pour chaque appel", () => {
    const code = readFileSync(path.resolve(__dirname, "../client.ts"), "utf8");
    const appels = code.match(/responses\.(create|parse)\(/g) ?? [];
    expect(appels).toHaveLength(1);
    expect(code).toMatch(/responses\.create\(\s*parametresResponses\(d\)/);
    expect(code).not.toMatch(/store:\s*true/);
  });
});
