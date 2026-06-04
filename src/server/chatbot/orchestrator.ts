// Orchestrateur conversationnel (T-07, doc 05 §1.1) — canal-agnostique.
//
// Pipeline d'un tour : extraire les slots + classer l'intention → router vers
// l'outil catalogue (déterministe) OU le RAG (explication) → appliquer la
// machine à états confirmation-avant-lien (D-CONFIRM) + l'output-guard
// (zéro-hallucination) → produire un TurnResult que l'adaptateur de canal
// (route SSE T-07, futurs canaux ADR-CB-10) rend.
//
// LLM injecté (generateAnswer) → testable sans appel réseau. Les intentions
// déterministes (recherche_offre, rdv, hors_sujet, lead) ne consomment PAS de LLM.

import {
  extractSlots,
  type ChatIntent,
  type SearchSlots,
} from "@/server/chatbot/catalog/slot-filling";
import {
  detectLinkSignal,
  onSearchResults,
  onUserSignal,
  INITIAL_FLOW,
  type LinkFlowState,
} from "@/server/chatbot/catalog/link-flow";
import { rechercherOffres, type OfferResult } from "@/server/chatbot/tools/rechercher-offres";
import { hybridSearch, type RetrievedChunk } from "@/server/chatbot/retrieval/hybrid-search";
import { rerankChunks } from "@/server/chatbot/retrieval/rerank";
import { assessConfidence } from "@/server/chatbot/retrieval/confidence";
import { verifyOutput, type OutputGuardResult } from "@/server/chatbot/security/output-guard";
import { assembleSystemPrompt } from "@/server/chatbot/generation/system-prompt";
import { generateAnswer, type GenerateAnswerFn } from "@/server/chatbot/generation/generate-stream";
import { lookupSemanticCache, writeSemanticCache } from "@/server/chatbot/semantic-cache/cache";
import { TokenBucket } from "@/server/chatbot/resilience/token-bucket";

// T-28 — robinet de débit des appels LLM (par instance ; MVP mono-instance,
// ADR-CB-06). Capacité = rafale tolérée, refill = débit soutenu. Bucket vide →
// backpressure (réponse « forte affluence » + RDV), jamais de 429 brut.
const llmBucket = new TokenBucket({ capacity: 20, refillPerSec: 5 });
import { RERANK_TOP_N, RETRIEVAL_TOP_K } from "@/server/chatbot/constants";
import type { ResolvedTenant } from "@/server/chatbot/tenant";

/** Lien RDV découverte (route FR connue). */
const RDV_URL = "/fr/appel";

export interface TurnContext {
  readonly tenant: ResolvedTenant;
  readonly conversationId?: string;
  /** Slots accumulés des tours précédents (multi-tours). */
  readonly previousSlots?: SearchSlots;
  /** État de la machine à liens du tour précédent. */
  readonly linkFlow?: LinkFlowState;
  /** Résumé de contexte long (T-31) injecté au system-prompt. */
  readonly resume?: string | null;
  /** Prompt versionné actif (T-20) — remplace les règles codées si présent. */
  readonly promptOverride?: string | null;
}

export interface TurnResult {
  readonly intent: ChatIntent;
  /** Prose à afficher (peut être vide si réponse = cartes seules). */
  readonly text: string;
  /** Cartes d'offre (libellé + prix SSOT + urlFR). */
  readonly cards: ReadonlyArray<OfferResult>;
  /** true → les liens des cartes sont à AFFICHER (confirmés/raccourci). */
  readonly sendLinks: boolean;
  /** Sources citées (RAG). */
  readonly sources: ReadonlyArray<{ sourceType: string; sourceRef: string }>;
  /** Lien RDV proposé, si pertinent. */
  readonly rdvUrl?: string;
  readonly slots: SearchSlots;
  readonly linkFlow: LinkFlowState;
  readonly escalate: boolean;
  readonly guard: OutputGuardResult;
  /** true si la réponse provient du cache sémantique (T-26, 0 appel LLM). */
  readonly servedFromCache?: boolean;
  /** Modèle LLM utilisé (observabilité — persisté sur chat_messages). */
  readonly model?: string;
  /** Coût estimé USD de l'appel LLM (observabilité / cost-cap). */
  readonly costUsd?: number;
}

export interface OrchestratorDeps {
  readonly generateAnswer?: GenerateAnswerFn;
  readonly retrieve?: typeof hybridSearch;
  readonly rerank?: typeof rerankChunks;
  readonly cacheLookup?: typeof lookupSemanticCache;
  readonly cacheWrite?: typeof writeSemanticCache;
  /** T-28 — acquisition d'un créneau LLM (false = forte affluence). Injectable (tests). */
  readonly acquireLlmSlot?: () => boolean;
}

const OK_GUARD: OutputGuardResult = { ok: true, violations: [] };

/** Traite un tour de conversation et retourne un plan de réponse. */
export async function handleTurn(
  message: string,
  ctx: TurnContext,
  deps: OrchestratorDeps = {},
): Promise<TurnResult> {
  const llm = deps.generateAnswer ?? generateAnswer;
  const retrieve = deps.retrieve ?? hybridSearch;
  const rerank = deps.rerank ?? rerankChunks;
  const cacheLookup = deps.cacheLookup ?? lookupSemanticCache;
  const cacheWrite = deps.cacheWrite ?? writeSemanticCache;
  const acquireLlmSlot = deps.acquireLlmSlot ?? (() => llmBucket.tryAcquire());
  const max = ctx.tenant.settings.maxOfferCards;
  const tenantId = ctx.tenant.id;

  const { slots, intent } = extractSlots(message, ctx.previousSlots);
  const signal = detectLinkSignal(message);
  const incoming = ctx.linkFlow ?? INITIAL_FLOW;

  const base = {
    slots,
    sources: [] as Array<{ sourceType: string; sourceRef: string }>,
    guard: OK_GUARD,
  };

  // — Confirmation d'un envoi de liens en attente —
  if (incoming.linkState === "proposed" && (signal === "confirm" || signal === "shortcut_direct")) {
    const flow = onUserSignal(incoming, signal);
    const res = await rechercherOffres(ctx.previousSlots ?? slots, { tenantId });
    const cards = res.offres.slice(0, max);
    return {
      ...base,
      intent: "recherche_offre",
      text: "Voici les liens 👇",
      cards,
      sendLinks: true,
      linkFlow: flow.state,
      escalate: false,
    };
  }
  if (incoming.linkState === "proposed" && signal === "decline") {
    return {
      ...base,
      intent: "recherche_offre",
      text: "Pas de souci. Dites-moi ce que vous cherchez (sujet, budget, nombre de personnes…).",
      cards: [],
      sendLinks: false,
      linkFlow: INITIAL_FLOW,
      escalate: false,
    };
  }

  switch (intent) {
    case "recherche_offre":
    case "comparaison": {
      const res = await rechercherOffres(slots, { tenantId });
      const cards = res.offres.slice(0, max);
      const direct = signal === "shortcut_direct";
      const flow = onSearchResults(
        cards.map((c) => c.id),
        { directShortcut: direct },
      );
      const sent = flow.state.linkState === "sent";
      const text = res.replied
        ? "Je n'ai pas d'offre exactement dans ces critères, mais voici ce qui s'en rapproche :"
        : sent
          ? `Voici ${cards.length} offre${cards.length > 1 ? "s" : ""} qui correspondent :`
          : `J'ai ${cards.length} offre${cards.length > 1 ? "s" : ""} qui correspondent. Souhaitez-vous les liens ?`;
      return {
        ...base,
        intent,
        text,
        cards,
        sendLinks: sent,
        linkFlow: flow.state,
        escalate: false,
        ...(res.proposeRdv ? { rdvUrl: RDV_URL } : {}),
      };
    }

    case "rdv":
      return {
        ...base,
        intent,
        text: "Avec plaisir — vous pouvez réserver un échange découverte ici :",
        cards: [],
        sendLinks: false,
        rdvUrl: RDV_URL,
        linkFlow: INITIAL_FLOW,
        escalate: false,
      };

    case "lead":
      return {
        ...base,
        intent,
        text: "Pour être recontacté, laissez-nous vos coordonnées (avec votre consentement) ou réservez un échange.",
        cards: [],
        sendLinks: false,
        rdvUrl: RDV_URL,
        linkFlow: INITIAL_FLOW,
        escalate: false,
      };

    case "hors_sujet":
      return {
        ...base,
        intent,
        text: "Je suis l'assistant d'Axion-IA, spécialisé dans l'IA pour les entreprises : audits, formations, accompagnements et développement. Comment puis-je vous aider sur l'un de ces sujets ?",
        cards: [],
        sendLinks: false,
        linkFlow: INITIAL_FLOW,
        escalate: false,
      };

    case "explication":
    default: {
      // T-26 cache sémantique : question proche déjà répondue → 0 retrieval, 0 LLM.
      const cached = await cacheLookup(tenantId, message, ctx.tenant.settings);
      if (cached) {
        return {
          intent: "explication",
          text: cached.reponse,
          cards: [],
          sendLinks: false,
          slots,
          sources: cached.sources,
          linkFlow: INITIAL_FLOW,
          escalate: false,
          guard: OK_GUARD,
          servedFromCache: true,
        };
      }

      // T-06 récupère RETRIEVAL_TOP_K candidats (RRF) ; T-10 les re-classe via
      // Voyage rerank → top-N injecté au prompt (repli RRF si Voyage down).
      const candidates: RetrievedChunk[] = await retrieve(tenantId, message, {
        topK: RETRIEVAL_TOP_K,
      });
      const chunks: RetrievedChunk[] = await rerank(message, candidates, { topN: RERANK_TOP_N });
      // T-11 : seuil de confiance → escalade SANS appel LLM si retrieval faible.
      const confidence = assessConfidence(chunks, ctx.tenant.settings.confidenceThreshold);
      if (!confidence.confident) {
        return {
          ...base,
          intent: "explication",
          text: "Je n'ai pas cette information sous la main. Souhaitez-vous en discuter lors d'un court échange ?",
          cards: [],
          sendLinks: false,
          rdvUrl: RDV_URL,
          linkFlow: INITIAL_FLOW,
          escalate: true,
        };
      }
      const systemPrompt = assembleSystemPrompt({
        tenant: ctx.tenant,
        chunks,
        ...(ctx.resume ? { resume: ctx.resume } : {}),
        ...(ctx.promptOverride ? { promptOverride: ctx.promptOverride } : {}),
      });
      const sources = chunks.map((c) => ({ sourceType: c.sourceType, sourceRef: c.sourceRef }));

      // T-28 — backpressure : sous forte affluence (token-bucket LLM vide), on ne
      // lance PAS l'appel LLM et on propose un échange, plutôt qu'un 429 brut. La
      // saisie n'est pas perdue côté widget.
      if (!acquireLlmSlot()) {
        return {
          intent: "explication",
          text: "Nous avons un afflux de questions en ce moment. Pour ne pas vous faire attendre, prenons un court échange :",
          cards: [],
          sendLinks: false,
          rdvUrl: RDV_URL,
          slots,
          sources,
          linkFlow: INITIAL_FLOW,
          escalate: true,
          guard: OK_GUARD,
        };
      }

      // T-16 — mode dégradé : panne LLM (Anthropic down / rate-limit / circuit
      // ouvert) ⇒ JAMAIS d'erreur brute. On bascule sur une réponse de repli +
      // RDV + escalade (la saisie n'est pas perdue côté widget).
      let answer: Awaited<ReturnType<typeof llm>>;
      try {
        answer = await llm({
          systemPrompt,
          userPrompt: message,
          tier: ctx.tenant.settings.llmTier.faqSimple,
        });
      } catch (err) {
        console.warn("[chatbot:orchestrator] LLM indisponible, mode dégradé:", err);
        return {
          intent: "explication",
          text: "Je rencontre un souci technique momentané pour répondre en détail. Pour ne pas vous faire attendre, prenons un court échange :",
          cards: [],
          sendLinks: false,
          rdvUrl: RDV_URL,
          slots,
          sources,
          linkFlow: INITIAL_FLOW,
          escalate: true,
          guard: OK_GUARD,
        };
      }

      const guard = verifyOutput(answer.text);
      if (!guard.ok) {
        // Garde-fou : on n'émet pas une sortie qui invente prix/URL.
        return {
          intent: "explication",
          text: "Je préfère ne pas avancer une information incertaine. Voici un échange pour en parler précisément :",
          cards: [],
          sendLinks: false,
          rdvUrl: RDV_URL,
          slots,
          sources,
          linkFlow: INITIAL_FLOW,
          escalate: true,
          guard,
        };
      }
      // T-26 : mémorise la réponse validée pour les questions proches futures
      // (best-effort, no-op si cache off / embedding indisponible).
      await cacheWrite(tenantId, message, { reponse: answer.text, sources }, ctx.tenant.settings);

      return {
        intent: "explication",
        text: answer.text,
        cards: [],
        sendLinks: false,
        slots,
        sources,
        linkFlow: INITIAL_FLOW,
        escalate: false,
        guard,
        model: answer.model,
        costUsd: answer.costUsd,
      };
    }
  }
}
