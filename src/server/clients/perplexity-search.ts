/**
 * Perplexity Search — Wrapper batch-friendly pour Sprint External Links 2026.
 *
 * Différences vs `src/server/content-gen/providers/perplexity.ts` :
 * - Supporte `search_domain_filter` (whitelist domaines, ex : ['gouv.fr', 'fr'])
 * - Return shape simplifié : { content, citations[], urls[] }
 * - Pas de cost-cap pre-check (CLI one-shot)
 * - Limiteur de concurrence intégré (pas de dépendance externe)
 *
 * Cf. _AUDIT/EXTERNAL-LINKS-2026-05-22/PHASE-0-RACCORDEMENT.md
 */

// Server-side only — appelé depuis scripts/* + workers/*. Pas d'import "server-only"
// car ce module est aussi consommé par des scripts CLI (Node.js direct, hors bundler).

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_CONCURRENCY = 10;

export interface PerplexitySearchOptions {
  readonly query: string;
  /** Default 'sonar' (cheapest, $1/$1/1M + $5/1K searches) */
  readonly model?: "sonar-pro" | "sonar" | "sonar-medium";
  /** Whitelist domaines pour scope sources (ex : ['gouv.fr', 'fr', 'edu']) */
  readonly searchDomainFilter?: ReadonlyArray<string>;
  /** Default 1500 (suffisant pour 10 URLs) */
  readonly maxTokens?: number;
  /** Default 60_000 ms */
  readonly timeoutMs?: number;
  /** Default 'month' (Perplexity admet : month, year) */
  readonly searchRecencyFilter?: "month" | "year";
}

export interface PerplexitySearchResult {
  readonly content: string;
  /** URLs brutes extraites de citations[] ou search_results[] de l'API */
  readonly citations: ReadonlyArray<{ url: string; title?: string; publishedAt?: string }>;
  /** Liste dédupliquée d'URLs extraites du content + citations (regex). */
  readonly urls: ReadonlyArray<string>;
  readonly model: string;
  readonly tokensInput: number;
  readonly tokensOutput: number;
}

interface PerplexityResponse {
  readonly id: string;
  readonly model: string;
  readonly choices: ReadonlyArray<{
    readonly message: { readonly role: string; readonly content: string };
  }>;
  readonly usage: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
  readonly citations?: ReadonlyArray<string>;
  readonly search_results?: ReadonlyArray<{ url: string; title: string; date?: string }>;
}

export class PerplexitySearchError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "PerplexitySearchError";
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Extrait les URLs HTTP(S) d'un texte (regex large).
 */
export function extractUrlsFromText(text: string): string[] {
  const re = /https?:\/\/[^\s\)\]"',<>]+/gi;
  const seen = new Set<string>();
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    let url = match[0];
    // strip trailing ponctuation
    url = url.replace(/[.,;:!?]+$/, "");
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

/**
 * Appel unitaire Perplexity Search.
 * Sans retry (l'orchestrateur batch gère les retries).
 */
export async function perplexitySearch(
  opts: PerplexitySearchOptions,
): Promise<PerplexitySearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new PerplexitySearchError("PERPLEXITY_API_KEY not set", 401, false);
  }
  if (apiKey.includes("stub.invalid")) {
    throw new PerplexitySearchError("PERPLEXITY_API_KEY is build-stub", 503, false);
  }

  const model = opts.model ?? "sonar";
  const recency = opts.searchRecencyFilter ?? "year";

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: opts.query }],
    max_tokens: opts.maxTokens ?? 1500,
    search_recency_filter: recency,
    return_citations: true,
  };
  if (opts.searchDomainFilter && opts.searchDomainFilter.length > 0) {
    body.search_domain_filter = opts.searchDomainFilter;
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text();
      const retryable = res.status === 429 || res.status >= 500;
      throw new PerplexitySearchError(
        `Perplexity ${res.status}: ${txt.slice(0, 200)}`,
        res.status,
        retryable,
      );
    }

    const data = (await res.json()) as PerplexityResponse;
    const content = data.choices[0]?.message?.content ?? "";

    const citations = data.search_results
      ? data.search_results.map((sr) => ({
          url: sr.url,
          title: sr.title,
          ...(sr.date ? { publishedAt: sr.date } : {}),
        }))
      : (data.citations ?? []).map((url) => ({ url }));

    // Merge URLs from citations + content text
    const urlSet = new Set<string>();
    for (const c of citations) urlSet.add(c.url);
    for (const u of extractUrlsFromText(content)) urlSet.add(u);

    return {
      content,
      citations,
      urls: Array.from(urlSet),
      model: data.model,
      tokensInput: data.usage.prompt_tokens,
      tokensOutput: data.usage.completion_tokens,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Limiteur de concurrence sans dépendance (équivalent p-limit minimal).
 */
export function createConcurrencyLimiter(maxConcurrent: number = DEFAULT_CONCURRENCY) {
  const queue: Array<() => void> = [];
  let active = 0;

  const next = () => {
    if (active >= maxConcurrent) return;
    const job = queue.shift();
    if (job) {
      active += 1;
      job();
    }
  };

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const job = () => {
        fn()
          .then((v) => {
            active -= 1;
            resolve(v);
            next();
          })
          .catch((e) => {
            active -= 1;
            reject(e);
            next();
          });
      };
      queue.push(job);
      next();
    });
  };
}

/**
 * Calcul du coût USD d'une query Perplexity.
 */
export function computePerplexityCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
): number {
  const pricing: Record<string, { input: number; output: number; searchPerCall: number }> = {
    "sonar-pro": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000, searchPerCall: 0.005 },
    "sonar-medium": { input: 1.0 / 1_000_000, output: 5.0 / 1_000_000, searchPerCall: 0.005 },
    sonar: { input: 1.0 / 1_000_000, output: 1.0 / 1_000_000, searchPerCall: 0.005 },
  };
  const rates = pricing[model] ?? pricing.sonar;
  return tokensInput * rates!.input + tokensOutput * rates!.output + rates!.searchPerCall;
}
