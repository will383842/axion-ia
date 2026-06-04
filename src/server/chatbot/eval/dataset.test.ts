// T-24 — Harnais de scoring de l'éval (routage d'intention + anti-hallucination).
//
// Rejouable en CI (déterministe, sans LLM ni DB). Échoue si la précision
// d'aiguillage passe sous le seuil (régression) ou si un prix/URL inventé n'est
// pas bloqué.

import { describe, it, expect } from "vitest";
import { extractSlots } from "@/server/chatbot/catalog/slot-filling";
import { verifyOutput } from "@/server/chatbot/security/output-guard";
import { INTENT_EVAL, GUARD_EVAL, INTENT_ACCURACY_THRESHOLD } from "@/server/chatbot/eval/dataset";

describe("Éval — routage d'intention (T-24)", () => {
  it(`précision d'aiguillage ≥ ${INTENT_ACCURACY_THRESHOLD * 100}%`, () => {
    const misses: string[] = [];
    for (const item of INTENT_EVAL) {
      const { intent } = extractSlots(item.question);
      if (intent !== item.expected) {
        misses.push(`${item.id}: "${item.question}" → ${intent} (attendu ${item.expected})`);
      }
    }
    const accuracy = (INTENT_EVAL.length - misses.length) / INTENT_EVAL.length;
    if (misses.length > 0) {
      console.warn(`[eval] misses (${misses.length}/${INTENT_EVAL.length}):\n` + misses.join("\n"));
    }
    expect(accuracy).toBeGreaterThanOrEqual(INTENT_ACCURACY_THRESHOLD);
  });
});

describe("Éval — anti-hallucination output-guard (T-24)", () => {
  for (const item of GUARD_EVAL) {
    it(`${item.id} : ${item.mustBlock ? "bloque" : "laisse passer"}`, () => {
      const { ok } = verifyOutput(item.text);
      // mustBlock=true → ok doit être false (sortie refusée).
      expect(ok).toBe(!item.mustBlock);
    });
  }
});
