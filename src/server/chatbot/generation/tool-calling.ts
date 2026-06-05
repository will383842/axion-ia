// Tool-calling LLM (MVP2, T-12/T-13) — boucle function-calling OpenAI qui câble
// RÉELLEMENT les tools d'enrichissement du registry dans la conversation :
//   - `qualifier_prospect` → met à jour chat_conversations.prospect_profile ;
//   - `chercher_ressource` → propose un article/cas client PUBLIÉ (jamais inventé).
//
// Les tools déterministes (rechercher_offres, proposer_rdv, capturer_lead,
// escalader_question) restent gérés par l'orchestrateur / les routes — on n'expose
// au LLM QUE les 2 tools d'enrichissement passifs (pas de double-traitement).
//
// Provider : OpenAI chat/completions via fetch (pas de SDK requis), gpt-4o-mini par
// défaut. Garde-fou : max 3 tours d'outils, puis réponse finale. L'output-guard
// (appelé par l'orchestrateur) re-vérifie la sortie (prix/URL) quoi qu'il arrive.

import { chatbotTools, type ToolContext } from "@/server/chatbot/tools/registry";
import type { LlmTier } from "@/server/chatbot/constants";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4o": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
};
const MODEL_BY_TIER: Record<LlmTier, string> = { sonnet: "gpt-4o", haiku: "gpt-4o-mini" };

/** Schémas JSON (OpenAI tools) des 2 tools d'enrichissement exposés au LLM. */
const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "qualifier_prospect",
      description:
        "Enregistre, sans interrogatoire, ce que le visiteur révèle sur son profil " +
        "(type de structure, secteur, besoin, maturité IA, urgence). Tous les champs " +
        "sont optionnels et cumulés. À appeler dès qu'un élément de profil est exprimé.",
      parameters: {
        type: "object",
        properties: {
          type_structure: {
            type: "string",
            enum: ["tpe", "pme", "eti", "ecole", "association", "autre"],
          },
          secteur: { type: "string" },
          besoin: { type: "string" },
          maturite_ia: { type: "string", enum: ["debutant", "intermediaire", "avance"] },
          urgence: { type: "string", enum: ["faible", "moyenne", "forte"] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "chercher_ressource",
      description:
        "Cherche un article de blog ou un cas client PUBLIÉ pertinent sur un sujet et " +
        "renvoie titre + lien FR + extrait. Renvoie null si rien — ne jamais inventer.",
      parameters: {
        type: "object",
        properties: {
          sujet: { type: "string" },
          type: { type: "string", enum: ["article", "cas_client"] },
        },
        required: ["sujet", "type"],
        additionalProperties: false,
      },
    },
  },
];

const EXPOSED_TOOLS = new Set(["qualifier_prospect", "chercher_ressource"]);

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface ToolCallingResult {
  readonly text: string;
  readonly model: string;
  readonly costUsd: number;
  /** Ressource publiée trouvée via chercher_ressource (titre/url/extrait), si any. */
  readonly resource: { titre: string; url: string; extrait: string | null; type: string } | null;
  /** true si qualifier_prospect a mis à jour le profil prospect. */
  readonly prospectUpdated: boolean;
  /** Noms des tools réellement invoqués (observabilité). */
  readonly toolsInvoked: string[];
}

export interface GenerateWithToolsOptions {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly tier: LlmTier;
  readonly tenantId: string;
  readonly conversationId: string;
  readonly onChunk?: (chunk: string) => void;
  /**
   * Force l'appel d'un tool précis au PREMIER tour (tool_choice ciblé). Sert aux
   * tests déterministes et à un futur usage produit (ex. forcer qualifier_prospect
   * sur un tour à fort signal de profil). Défaut : décision auto du modèle.
   */
  readonly forceToolFirstRound?: string;
}

async function callOpenAi(
  apiKey: string,
  model: string,
  messages: OpenAiMessage[],
  withTools: boolean,
  forceTool?: string,
): Promise<{ message: OpenAiMessage; tokensIn: number; tokensOut: number }> {
  const toolChoice = forceTool
    ? { type: "function" as const, function: { name: forceTool } }
    : "auto";
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      // Température basse pour fiabiliser la DÉCISION d'appel d'outil (gpt-4o-mini
      // est inconstant à 0.4) ; la réponse finale reste naturelle.
      temperature: withTools ? 0.1 : 0.4,
      max_tokens: 800,
      ...(withTools ? { tools: TOOL_SCHEMAS, tool_choice: toolChoice } : {}),
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`[chatbot:tool-calling] OpenAI HTTP ${res.status} ${detail}`.trim());
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: OpenAiMessage }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const message = json.choices?.[0]?.message;
  if (!message) throw new Error("[chatbot:tool-calling] réponse OpenAI sans message");
  return {
    message,
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
  };
}

/**
 * Génère une réponse en autorisant le LLM à appeler les tools d'enrichissement.
 * Exécute réellement les tools (effets DB) via le registry, puis produit la
 * réponse finale. `onChunk` reçoit le texte final (best-effort streaming).
 */
export async function generateAnswerWithTools(
  opts: GenerateWithToolsOptions,
): Promise<ToolCallingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("[chatbot:tool-calling] OPENAI_API_KEY absente");
  const model = MODEL_BY_TIER[opts.tier];
  const ctx: ToolContext = { tenantId: opts.tenantId, conversationId: opts.conversationId };

  // Directive d'usage des tools : gpt-4o-mini n'invoque pas spontanément des tools
  // passifs sans instruction explicite.
  const toolDirective =
    "\n\n## OUTILS — RÈGLES IMPÉRATIVES (appel AVANT de répondre)\n" +
    "1. Si le message contient le MOINDRE élément de profil du visiteur — type de " +
    "structure (TPE/PME/ETI/école/association), secteur d'activité, besoin exprimé, " +
    "niveau de maturité IA, ou urgence — tu DOIS appeler `qualifier_prospect` avec " +
    "UNIQUEMENT les champs réellement exprimés (jamais inventés). Exemple : « je dirige " +
    'une PME industrielle » → qualifier_prospect({type_structure:"pme", secteur:"industrie"}).\n' +
    "2. Si le visiteur demande un article, un cas client, un retour d'expérience, un " +
    "exemple concret ou une ressource sur un sujet, tu DOIS appeler `chercher_ressource` " +
    "(type `article` ou `cas_client`). Ne cite une ressource QUE si l'outil en renvoie " +
    "une (jamais d'URL inventée) ; n'en mentionne aucune si l'outil renvoie null.\n" +
    "Appelle les outils utiles AVANT de rédiger ta réponse finale.";

  const messages: OpenAiMessage[] = [
    { role: "system", content: opts.systemPrompt + toolDirective },
    { role: "user", content: opts.userPrompt },
  ];

  let costUsd = 0;
  let resource: ToolCallingResult["resource"] = null;
  let prospectUpdated = false;
  const toolsInvoked: string[] = [];
  const rate = PRICING[model] ?? PRICING["gpt-4o-mini"]!;

  // Jusqu'à 3 tours d'outils, puis réponse finale obligatoire.
  for (let round = 0; round < 4; round++) {
    const withTools = round < 3;
    // Le forçage ne s'applique qu'au tout premier tour (ensuite : auto, pour
    // laisser le modèle rédiger la réponse finale ou enchaîner d'autres tools).
    const force = round === 0 ? opts.forceToolFirstRound : undefined;
    const { message, tokensIn, tokensOut } = await callOpenAi(
      apiKey,
      model,
      messages,
      withTools,
      force,
    );
    costUsd += tokensIn * rate.input + tokensOut * rate.output;

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      // Réponse finale.
      const text = message.content ?? "";
      if (opts.onChunk && text) opts.onChunk(text);
      return { text, model, costUsd, resource, prospectUpdated, toolsInvoked };
    }

    // On rejoue le message assistant (avec tool_calls) puis les résultats.
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      const name = call.function.name;
      let resultPayload: unknown = null;
      if (EXPOSED_TOOLS.has(name)) {
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          resultPayload = await chatbotTools.dispatch(name, args, ctx);
          toolsInvoked.push(name);
          if (name === "qualifier_prospect") prospectUpdated = true;
          if (name === "chercher_ressource" && resultPayload) {
            resource = resultPayload as ToolCallingResult["resource"];
          }
        } catch (err) {
          resultPayload = { error: err instanceof Error ? err.message : "tool_error" };
        }
      } else {
        resultPayload = { error: "tool non disponible dans ce contexte" };
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(resultPayload ?? null),
      });
    }
  }

  // Garde-fou : si on n'a pas convergé, dernière réponse sans outils.
  const final = await callOpenAi(apiKey, model, messages, false);
  costUsd += final.tokensIn * rate.input + final.tokensOut * rate.output;
  const text = final.message.content ?? "";
  if (opts.onChunk && text) opts.onChunk(text);
  return { text, model, costUsd, resource, prospectUpdated, toolsInvoked };
}
