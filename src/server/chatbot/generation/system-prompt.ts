// Assemblage du prompt système chatbot (T-07, doc 05 §1.1).
//
// Règles cœur + CONTEXTE (chunks RAG, seule source autorisée) + héritage
// brand-voice Manon (mots bannis, AI Act art.50, règle « jamais de prix en
// chiffres → token {{price}} »). Garantit le grounding (R-HALL).

import { injectBrandVoiceForType } from "@/server/content-gen/brand/brand-voice";
import type { ResolvedTenant } from "@/server/chatbot/tenant";
import type { RetrievedChunk } from "@/server/chatbot/retrieval/hybrid-search";

export interface SystemPromptOptions {
  readonly tenant: ResolvedTenant;
  readonly chunks?: ReadonlyArray<RetrievedChunk>;
  /** Résumé de contexte long (T-31) — fil des tours précédents, sans l'historique brut. */
  readonly resume?: string | null;
}

/** Construit le prompt système (règles + contexte + brand-voice). */
export function assembleSystemPrompt(opts: SystemPromptOptions): string {
  const { tenant, chunks, resume } = opts;
  const rules = [
    "Tu es l'assistant conversationnel d'Axion-IA, cabinet de conseil en IA pour les TPE/PME/ETI françaises.",
    "Tu réponds TOUJOURS en français, de façon concise, claire et non-insistante.",
    "Transparence (AI Act art. 50) : tu es une intelligence artificielle ; rappelle-le si on te le demande.",
    "RÈGLE ABSOLUE anti-invention : ne cite JAMAIS un prix, une durée ou une URL qui ne figure pas dans le CONTEXTE ci-dessous. Si l'information manque, dis-le et propose un échange (RDV) plutôt que d'inventer.",
    "Pour citer un tarif, utilise EXCLUSIVEMENT un token {{price:<id>}} (résolu automatiquement) — jamais un montant en chiffres.",
    `N'affiche jamais plus de ${tenant.settings.maxOfferCards} offres dans une même réponse.`,
    "Quand tu réponds à partir du CONTEXTE, cite la source (type:référence).",
  ];
  let prompt = rules.join("\n");

  if (resume && resume.trim().length > 0) {
    prompt += "\n\n## RÉSUMÉ DE LA CONVERSATION (contexte des tours précédents)\n" + resume.trim();
  }

  if (chunks && chunks.length > 0) {
    prompt +=
      "\n\n## CONTEXTE (seule source autorisée pour répondre)\n" +
      chunks.map((c, i) => `[${i + 1}] (${c.sourceType}:${c.sourceRef}) ${c.contenu}`).join("\n\n");
  } else {
    prompt +=
      "\n\n## CONTEXTE\n(Aucun extrait pertinent trouvé — ne réponds pas de mémoire ; oriente vers un échange.)";
  }

  // Hérite de la persona Manon (mots bannis, ton, règle prix-token, AI Act).
  return injectBrandVoiceForType(prompt, "qa_derived");
}
