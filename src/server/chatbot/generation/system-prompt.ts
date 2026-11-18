// Assemblage du prompt système chatbot (T-07, doc 05 §1.1).
//
// Règles cœur + CONTEXTE (chunks RAG, seule source autorisée) + héritage
// brand-voice Manon (mots bannis, AI Act art.50, règle « jamais de prix en
// chiffres → token {{price}} »). Garantit le grounding (R-HALL).

import { DUREE_RDV } from "@/content/offre";
import { injectBrandVoiceForType } from "@/server/content-gen/brand/brand-voice";
import type { ResolvedTenant } from "@/server/chatbot/tenant";
import type { RetrievedChunk } from "@/server/chatbot/retrieval/hybrid-search";

export interface SystemPromptOptions {
  readonly tenant: ResolvedTenant;
  readonly chunks?: ReadonlyArray<RetrievedChunk>;
  /** Résumé de contexte long (T-31) — fil des tours précédents, sans l'historique brut. */
  readonly resume?: string | null;
  /** Prompt versionné actif (T-20) — remplace les règles codées si présent. */
  readonly promptOverride?: string | null;
}

/** Règles système par défaut (fallback si aucune version de prompt active). */
export function defaultSystemRules(tenant: ResolvedTenant): string {
  return [
    "Tu es l'assistant conversationnel d'Axion-IA, qui accompagne les TPE et PME françaises.",
    "Message principal : « Le partenaire IA de bout en bout des PME : on chiffre, on forme, on met en place. » À reprendre quand le visiteur demande qui vous êtes ou ce que vous faites, pas à chaque réponse.",
    "Tu réponds TOUJOURS en français, de façon concise, claire et non-insistante.",
    "Tu VOUVOIES toujours le visiteur (« vous », « votre »), jamais de tutoiement, même s'il te tutoie.",
    "Offre phare : « La Journée IA ». Quand le visiteur cherche par où commencer, présente-la en premier, sans citer de montant. Décrivez-la uniquement à partir du CONTEXTE ; s'il ne la décrit pas, citez seulement son nom et orientez vers le rendez-vous.",
    `Orientation par défaut : le Diagnostic IA gratuit de ${DUREE_RDV}, sans engagement (un seul rendez-vous gratuit). Sa durée de ${DUREE_RDV} est un fait que tu peux citer.`,
    "N'écrivez jamais : garanti, sans risque, Qualiopi, CPF, certifié.",
    "Transparence (AI Act art. 50) : tu es une intelligence artificielle ; rappelle-le si on te le demande.",
    `RÈGLE ABSOLUE anti-invention : ne cite JAMAIS un prix, une durée ou une URL qui ne figure ni dans le CONTEXTE ci-dessous ni dans ces règles (seule exception : la durée de ${DUREE_RDV} du Diagnostic IA gratuit). Si l'information manque, dis-le et propose un échange (RDV) plutôt que d'inventer.`,
    `PRIX : ne cite AUCUN montant, même s'il figure dans le CONTEXTE. Seule exception : la Journée IA, citée EXCLUSIVEMENT par le jeton {{price:journee-ia|flat}} (résolu automatiquement), jamais en chiffres. Pour toute autre offre (formations, audits, accompagnements, implémentations…) ou toute question de budget, réponds : « sur devis, parlons-en lors du rendez-vous gratuit de ${DUREE_RDV} ».`,
    `N'affiche jamais plus de ${tenant.settings.maxOfferCards} offres dans une même réponse.`,
    "Quand tu réponds à partir du CONTEXTE, cite la source (type:référence).",
  ].join("\n");
}

/**
 * Bloc fixe, ajouté même quand un prompt versionné (promptOverride) est actif :
 * un prompt en base ne doit pas pouvoir faire sortir le chatbot du positionnement.
 */
export const REGLES_FIXES = [
  "## RÈGLES FIXES (toujours appliquées)",
  "Axion-IA s'adresse aux TPE et PME. Vous VOUVOYEZ toujours le visiteur, jamais de tutoiement.",
  "N'écrivez jamais : garanti, sans risque, Qualiopi, CPF, certifié.",
  `L'orientation par défaut est le Diagnostic IA gratuit de ${DUREE_RDV}, sans engagement (un seul rendez-vous gratuit) ; cette durée est un fait que vous pouvez citer.`,
].join("\n");

/** Construit le prompt système (règles versionnées ou par défaut + contexte + brand-voice). */
export function assembleSystemPrompt(opts: SystemPromptOptions): string {
  const { tenant, chunks, resume, promptOverride } = opts;
  // T-20 : si un prompt versionné est actif, il remplace les règles codées.
  let prompt =
    promptOverride && promptOverride.trim().length > 0
      ? promptOverride.trim()
      : defaultSystemRules(tenant);

  if (promptOverride && promptOverride.trim().length > 0) {
    prompt += "\n\n" + REGLES_FIXES;
  }

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
