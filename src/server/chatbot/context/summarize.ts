// Résumé de contexte long (T-31, REQ-019) — au-delà de N messages, on condense
// la conversation en un résumé court (modèle léger) stocké dans
// chat_conversations.resume, réinjecté au system-prompt pour garder le fil sans
// envoyer tout l'historique au LLM (coût + latence).
//
// Pur (LLM injecté) → testable sans réseau.

import type { GenerateAnswerFn } from "@/server/chatbot/generation/generate-stream";
import type { LlmTier } from "@/server/chatbot/constants";

/** Déclenche un résumé au-delà de ce nombre de messages dans la conversation. */
export const SUMMARIZE_AFTER_MESSAGES = 12;
/** Ne recalcule le résumé que tous les N messages (borne le coût LLM). */
export const SUMMARIZE_EVERY_MESSAGES = 6;

export interface ConversationMessage {
  readonly role: string;
  readonly contenu: string;
}

/** true si la conversation mérite un (re)résumé à ce nombre de messages. */
export function shouldSummarize(messageCount: number): boolean {
  return messageCount >= SUMMARIZE_AFTER_MESSAGES && messageCount % SUMMARIZE_EVERY_MESSAGES === 0;
}

const SYSTEM = [
  "Tu condenses une conversation entre un visiteur et l'assistant d'Axion-IA.",
  "Produis un RÉSUMÉ FACTUEL en français, en 4 à 6 puces courtes, qui capture :",
  "le besoin exprimé, le profil (structure/secteur/maturité) s'il est connu, les",
  "offres/sujets déjà évoqués, et les prochaines étapes. N'invente rien, ne cite",
  "aucun prix. Réponds UNIQUEMENT par le résumé, sans préambule.",
].join(" ");

/**
 * Résume une conversation via le LLM (palier léger injecté). Retourne le texte
 * du résumé, ou null en cas d'échec LLM (best-effort — ne casse jamais le tour).
 */
export async function summarizeConversation(
  messages: ReadonlyArray<ConversationMessage>,
  generate: GenerateAnswerFn,
  tier: LlmTier,
): Promise<string | null> {
  if (messages.length === 0) return null;
  const transcript = messages
    .map((m) => `${m.role === "assistant" ? "Assistant" : "Visiteur"} : ${m.contenu}`)
    .join("\n");
  try {
    const res = await generate({
      systemPrompt: SYSTEM,
      userPrompt: `Conversation à résumer :\n\n${transcript}`,
      tier,
      maxTokens: 300,
    });
    const text = res.text.trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    console.warn("[chatbot:summarize] résumé indisponible:", err);
    return null;
  }
}
