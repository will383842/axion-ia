// Classifieur d'intention LLM léger (T-18, REQ-013) — RAFFINEMENT du déterministe.
//
// Le classifieur déterministe (classifyIntent, T-37) couvre l'aiguillage du
// parcours (rdv/lead/recherche/comparaison/explication) ; mais il range les
// questions business GÉNÉRALES sans marqueur (« Que propose Axion-IA ? ») en
// hors_sujet (recadrage). T-18 ajoute, UNIQUEMENT dans ce cas, un appel LLM léger
// (Haiku) qui décide si le message est en réalité DANS le périmètre → on le
// promeut en `explication` (chemin RAG). Le coût ne porte donc que sur les
// messages que le déterministe jugeait hors-sujet (pas sur le chemin nominal).
//
// Gated CHATBOT_LLM_CLASSIFIER (env) : off = comportement inchangé, 0 coût.
// Fail-soft : toute erreur LLM → on garde hors_sujet (pas de promotion).

import type { GenerateAnswerFn } from "@/server/chatbot/generation/generate-stream";
import type { LlmTier } from "@/server/chatbot/constants";

const SYSTEM = [
  "Tu détermines si un message visiteur relève du périmètre d'Axion-IA :",
  "conseil, audit, formation, accompagnement, implémentation et sites web — tout",
  "ce qui touche à l'intelligence artificielle pour les entreprises (TPE/PME/ETI).",
  "Réponds par EXACTEMENT un mot, sans ponctuation : SUJET (dans le périmètre) ou",
  "HORS_SUJET (météo, blagues, culture générale, autre domaine).",
].join(" ");

/**
 * true si le message est jugé DANS le périmètre par le LLM léger. Fail-soft →
 * false (on conserve le hors_sujet déterministe).
 */
export async function isOnTopicViaLlm(
  message: string,
  generate: GenerateAnswerFn,
  tier: LlmTier,
): Promise<boolean> {
  try {
    const res = await generate({
      systemPrompt: SYSTEM,
      userPrompt: message,
      tier,
      maxTokens: 4,
    });
    const out = res.text.toUpperCase();
    return out.includes("SUJET") && !out.includes("HORS");
  } catch {
    return false;
  }
}
