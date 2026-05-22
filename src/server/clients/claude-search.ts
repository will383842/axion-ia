/**
 * Claude Search — Wrapper léger Anthropic API pour le seed external links.
 *
 * Alternative à src/server/clients/perplexity-search.ts quand
 * PERPLEXITY_API_KEY n'est pas disponible.
 *
 * Différences vs Perplexity :
 * - Pas de recherche web réelle (Claude knowledge-only, cutoff janvier 2026)
 * - Instructions strictes anti-hallucination dans le system prompt
 * - Score validité attendu : ~70-80 % (vs ~95 % Perplexity) → HEAD verify post-seed
 * - Coût : ~$4-5 pour 270 queries Sonnet 4.6 (vs $1.62 Perplexity)
 *
 * Sprint External Links Database 2026-05-22 — fallback Claude.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 60_000;

export interface ClaudeSearchOptions {
  readonly query: string;
  readonly systemPrompt?: string;
  readonly model?: "claude-sonnet-4-6" | "claude-haiku-4-5-20251001" | "claude-opus-4-7";
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly timeoutMs?: number;
  /** Active le tool `web_search` natif Anthropic (server-side). */
  readonly enableWebSearch?: boolean;
  /** Max appels web_search par query (default 3). */
  readonly maxWebSearchUses?: number;
  /** Whitelist domaines (ex : ['gouv.fr', 'fr']). */
  readonly allowedDomains?: ReadonlyArray<string>;
}

export interface ClaudeSearchResult {
  readonly content: string;
  readonly urls: ReadonlyArray<string>;
  readonly model: string;
  readonly tokensInput: number;
  readonly tokensOutput: number;
}

interface AnthropicResponse {
  readonly id: string;
  readonly model: string;
  readonly content: ReadonlyArray<{ type: string; text: string }>;
  readonly usage: { input_tokens: number; output_tokens: number };
  readonly stop_reason: string;
}

export class ClaudeSearchError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "ClaudeSearchError";
    this.status = status;
    this.retryable = retryable;
  }
}

const ANTI_HALLUCINATION_SYSTEM_PROMPT = `Tu es un assistant de recherche spécialisé dans le catalogage de sources d'autorité françaises et internationales sur l'intelligence artificielle.

RÈGLES ABSOLUES :
1. Ne retourne QUE des URLs dont tu es HAUTEMENT CONFIANT qu'elles existent et sont accessibles.
2. PRIVILÉGIE les pages racines stables (homepage d'organismes officiels) plutôt que des sub-pages spécifiques qui peuvent avoir changé.
3. Format strict : pour chaque source, "N. [Nom de l'organisme] - https://url.exacte/"
4. Si tu n'es PAS sûr d'une URL spécifique, donne UNIQUEMENT la homepage du domaine racine.
5. PAS D'URLS INVENTÉES. Si une question demande 10 publications mais tu n'es certain que de 3, retourne 3.
6. Domaines fiables connus :
   - *.gouv.fr (INSEE, CNIL, ANSSI, BPI, France Num, France Compétences, DARES, ARCEP, AFNOR, Légifrance, data.gouv, etc.)
   - *.europa.eu (EUR-Lex AI Act, EU Commission, EDPB, etc.)
   - *.edu (Stanford, MIT, etc.)
   - iso.org, nist.gov, oecd.org, unesco.org, weforum.org, owasp.org, w3.org, schema.org
   - Mairies FR : www.{ville}.fr ou metropole.{ville}.fr
   - CCI : www.cci.fr et CCI régionales sur *.cci.fr
7. JAMAIS de domaines concurrents directs : axionai.fr, kpmg.fr, cegos.fr, openclassrooms.com, lewagon.com, simplon.co, datacamp.com, dust.tt.
   Exception OK : capgemini-research-institute.com, research.kpmg.com.
8. JAMAIS de paywalls connus (HBR, MIT Sloan, FT) sauf instruction contraire.`;

/**
 * Extrait les URLs HTTP(S) d'un texte (regex large).
 */
export function extractUrlsFromText(text: string): string[] {
  const re = /https?:\/\/[^\s\)\]"',<>]+/gi;
  const seen = new Set<string>();
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    let url = match[0].replace(/[.,;:!?]+$/, "");
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

/**
 * Appel unitaire Claude. Sans retry (orchestrateur batch gère).
 */
export async function claudeSearch(opts: ClaudeSearchOptions): Promise<ClaudeSearchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeSearchError("ANTHROPIC_API_KEY not set", 401, false);
  }
  if (apiKey.includes("stub.invalid")) {
    throw new ClaudeSearchError("ANTHROPIC_API_KEY is build-stub", 503, false);
  }

  const model = opts.model ?? "claude-sonnet-4-6";
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.systemPrompt ?? ANTI_HALLUCINATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: opts.query }],
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  // Tool web_search natif Anthropic (server-side, 2025-03-05 version).
  // Coût supplémentaire : $10 / 1000 utilisations du tool.
  if (opts.enableWebSearch) {
    body.tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: opts.maxWebSearchUses ?? 3,
        ...(opts.allowedDomains && opts.allowedDomains.length > 0
          ? { allowed_domains: opts.allowedDomains }
          : {}),
      },
    ];
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text();
      const retryable = res.status === 429 || res.status >= 500;
      throw new ClaudeSearchError(
        `Claude ${res.status}: ${txt.slice(0, 200)}`,
        res.status,
        retryable,
      );
    }

    const data = (await res.json()) as AnthropicResponse;
    const content = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    const urls = extractUrlsFromText(content);

    return {
      content,
      urls,
      model: data.model,
      tokensInput: data.usage.input_tokens,
      tokensOutput: data.usage.output_tokens,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Coût USD d'une query Claude (Sonnet 4.6 / Haiku 4.5).
 */
export function computeClaudeCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-opus-4-7": { input: 15 / 1_000_000, output: 75 / 1_000_000 },
    "claude-sonnet-4-6": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
    "claude-haiku-4-5-20251001": { input: 1 / 1_000_000, output: 5 / 1_000_000 },
  };
  const rates = pricing[model] ?? pricing["claude-sonnet-4-6"];
  return tokensInput * rates!.input + tokensOutput * rates!.output;
}
