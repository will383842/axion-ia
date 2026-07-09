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
import type { ToolCallingResult } from "@/server/chatbot/generation/tool-calling";
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

/**
 * Détecte une question de financement (CPF, OPCO, subvention…). Axion-IA ne gère
 * AUCUN dispositif de financement (§0.7 — le chatbot ne promet aucun financement) :
 * on répond honnêtement plutôt que de router vers les offres (« vos formations
 * finançables » contient « formation » → partirait sinon en recherche d'offre).
 */
function isFinancingQuestion(message: string): boolean {
  return /\bcpf\b|\bopco\b|financ(ement|able|er|ée?s?|ables?)|prise en charge|subvention|cr[ée]dit d['’]?imp[ôo]t|op[ée]rateur de comp[ée]tences|p[ôo]le emploi|france travail|fonds de formation/i.test(
    message,
  );
}

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
  /** Mode éco (T-30) : cap coût atteint → pas d'appel LLM (catalogue + cache only). */
  readonly ecoMode?: boolean;
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
  /** T-18 — raffine un hors_sujet déterministe : true = en réalité dans le périmètre. */
  readonly refineHorsSujet?: (message: string) => Promise<boolean>;
  /** T-12/T-13 — génération avec tool-calling (injectée par la route si activée). */
  readonly generateWithTools?: (opts: {
    systemPrompt: string;
    userPrompt: string;
    tier: import("@/server/chatbot/constants").LlmTier;
    tenantId: string;
    conversationId: string;
  }) => Promise<ToolCallingResult>;
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

  const extraction = extractSlots(message, ctx.previousSlots);
  const slots = extraction.slots;
  let intent = extraction.intent;
  // T-18 — raffinement LLM léger : un hors_sujet déterministe qui est en réalité
  // une question business générale est promu en explication (chemin RAG).
  if (intent === "hors_sujet" && deps.refineHorsSujet) {
    try {
      if (await deps.refineHorsSujet(message)) intent = "explication";
    } catch {
      /* fail-soft : on garde hors_sujet */
    }
  }
  const signal = detectLinkSignal(message);
  const incoming = ctx.linkFlow ?? INITIAL_FLOW;

  // Un message qui apporte un NOUVEAU critère de recherche (« plutôt en
  // présentiel », « pour 6 personnes ») est un RAFFINEMENT, pas une réponse
  // oui/non à la proposition de liens — même s'il commence par un mot ambigu
  // capté par detectLinkSignal (« plutôt »). On re-cherche au lieu de décliner.
  const refinesSearch = Object.keys(extractSlots(message).slots).length > 0;

  const base = {
    slots,
    sources: [] as Array<{ sourceType: string; sourceRef: string }>,
    guard: OK_GUARD,
  };

  // — Financement (CPF/OPCO/subvention) : réponse HONNÊTE sans promesse (§0.7),
  //   AVANT le routage vertical (sinon « vos formations finançables » → offres). —
  if (isFinancingQuestion(message)) {
    return {
      ...base,
      intent: "explication",
      text: "Nous ne gérons pas de dispositif de financement (CPF, OPCO, subvention…) : nos prestations — formations, audits, implémentation — sont facturées en direct. Je peux vous présenter nos offres et leurs tarifs, ou organiser un court échange pour cadrer votre besoin :",
      cards: [],
      sendLinks: false,
      rdvUrl: RDV_URL,
      linkFlow: INITIAL_FLOW,
      escalate: false,
    };
  }

  // — Confirmation d'un envoi de liens en attente —
  if (
    incoming.linkState === "proposed" &&
    !refinesSearch &&
    (signal === "confirm" || signal === "shortcut_direct")
  ) {
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
  if (incoming.linkState === "proposed" && signal === "decline" && !refinesSearch) {
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
      // (b) Repli SUR MESURE (effectif hors catalogue, ou périmètre sans offre) :
      // pas de carte sous-calibrée → on oriente vers un échange pour cadrer.
      if (res.replied && cards.length === 0) {
        return {
          ...base,
          intent,
          text: "Pour une structure de cette taille, un accompagnement sur mesure s'impose. Organisons un court échange pour le cadrer précisément :",
          cards: [],
          sendLinks: false,
          rdvUrl: RDV_URL,
          linkFlow: INITIAL_FLOW,
          escalate: false,
        };
      }
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

      // T-30 — mode éco (cap coût atteint) : on n'engage PAS d'appel LLM. Le
      // cache (ci-dessus) et les chemins déterministes restent servis ; les
      // questions ouvertes basculent vers un échange (RDV) + escalade.
      if (ctx.ecoMode) {
        return {
          intent: "explication",
          text: "Pour vous répondre au mieux sur ce point, je vous propose un court échange avec un conseiller :",
          cards: [],
          sendLinks: false,
          rdvUrl: RDV_URL,
          slots,
          sources: [],
          linkFlow: INITIAL_FLOW,
          escalate: true,
          guard: OK_GUARD,
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
          text: "Je n'ai pas la réponse précise sous la main — je transmets votre question à un expert Axion-IA, qui vous répondra sous 48 h. Laissez-moi vos coordonnées (bouton ci-dessous), ou réservez un échange dès maintenant :",
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

      // T-16 — mode dégradé : panne LLM (provider down / rate-limit / circuit
      // ouvert) ⇒ JAMAIS d'erreur brute. On bascule sur une réponse de repli +
      // RDV + escalade (la saisie n'est pas perdue côté widget).
      // T-12/T-13 — si la route injecte `generateWithTools` (flag CHATBOT_TOOL_CALLING),
      // le LLM peut appeler les tools d'enrichissement (qualifier_prospect →
      // prospect_profile ; chercher_ressource → ressource publiée).
      let answer: { text: string; model?: string; costUsd?: number };
      let resource: { titre: string; url: string; extrait: string | null; type: string } | null =
        null;
      try {
        if (deps.generateWithTools && ctx.conversationId) {
          const r = await deps.generateWithTools({
            systemPrompt,
            userPrompt: message,
            tier: ctx.tenant.settings.llmTier.faqSimple,
            tenantId,
            conversationId: ctx.conversationId,
          });
          answer = { text: r.text, model: r.model, costUsd: r.costUsd };
          resource = r.resource;
        } else {
          answer = await llm({
            systemPrompt,
            userPrompt: message,
            tier: ctx.tenant.settings.llmTier.faqSimple,
          });
        }
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

      // L'URL d'une ressource publiée (chercher_ressource, DB-vérifiée) est
      // autorisée explicitement : sinon l'output-guard la prendrait pour une URL
      // inventée (chemin de contenu dynamique hors routes statiques).
      const guard = verifyOutput(answer.text, resource ? { extraKnownUrls: [resource.url] } : {});
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
      // T-13 — une ressource publiée trouvée (chercher_ressource) est ajoutée aux
      // sources citées (URL ∈ routes connues, déjà validée par l'output-guard via
      // le texte qui la mentionne).
      const outSources = resource
        ? [...sources, { sourceType: "ressource", sourceRef: resource.url }]
        : sources;

      // T-26 : mémorise la réponse validée pour les questions proches futures
      // (best-effort, no-op si cache off / embedding indisponible).
      await cacheWrite(
        tenantId,
        message,
        { reponse: answer.text, sources: outSources },
        ctx.tenant.settings,
      );

      return {
        intent: "explication",
        text: answer.text,
        cards: [],
        sendLinks: false,
        slots,
        sources: outSources,
        linkFlow: INITIAL_FLOW,
        escalate: false,
        guard,
        ...(answer.model ? { model: answer.model } : {}),
        ...(answer.costUsd !== undefined ? { costUsd: answer.costUsd } : {}),
      };
    }
  }
}
