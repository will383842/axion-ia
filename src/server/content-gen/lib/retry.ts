/**
 * Content Generator — Retry exponentiel backoff (§ 0.4 master prompt).
 *
 * 3 tentatives avec délais 10s / 30s / 60s + jitter ±20% pour éviter
 * le thundering herd sur retries simultanés. Échec définitif → throw.
 * Respecte la flag `retryable` de ProviderError (auth_failed → no retry).
 */

import { ProviderError } from "../providers/IProvider";

export interface RetryOptions {
  /** Tentatives totales (1ʳᵉ + retries). Default 3. */
  readonly maxAttempts?: number;
  /** Délais entre retries en ms. Default [10_000, 30_000, 60_000]. */
  readonly delaysMs?: ReadonlyArray<number>;
  /** Callback observabilité (chaque retry). */
  readonly onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

const DEFAULT_DELAYS_MS: ReadonlyArray<number> = [10_000, 30_000, 60_000];

/**
 * Applique un jitter multiplicatif aléatoire dans [0.8, 1.2] au délai fourni,
 * cappé à 60 000ms. Évite le thundering herd sur des retries simultanés.
 *
 * P1-1 — Retry exponentiel avec jitter (audit content-gen PERFECTION 2026).
 */
export function applyJitter(delayMs: number): number {
  const factor = 0.8 + Math.random() * 0.4; // [0.8, 1.2]
  return Math.min(Math.round(delayMs * factor), 60_000);
}

/**
 * Exécute `fn` avec retry exponentiel sur erreur retryable.
 * Une `ProviderError` avec `retryable === false` est levée immédiatement.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const delays = opts.delaysMs ?? DEFAULT_DELAYS_MS;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (err instanceof ProviderError && !err.retryable) {
        throw err; // auth_failed, cost_cap_reached, content_filter → no retry
      }
      if (attempt >= maxAttempts) {
        break;
      }
      const baseDelayMs = delays[attempt - 1] ?? delays[delays.length - 1] ?? 60_000;
      const delayMs = applyJitter(baseDelayMs);
      if (opts.onRetry) opts.onRetry(attempt, lastError, delayMs);
      await sleep(delayMs);
    }
  }
  throw lastError ?? new Error("Retry exhausted without error");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
