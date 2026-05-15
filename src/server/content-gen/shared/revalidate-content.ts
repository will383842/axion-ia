/**
 * Content Generator — Revalidate helper for workers BG (Fix P1-16 audit
 * opérationnel 2026-05-14).
 *
 * `next/cache.revalidatePath` ne fonctionne pas dans un worker BullMQ
 * background (no request context, silent no-op). Ce helper fait un POST
 * HTTP interne sur `/api/internal/revalidate` qui exécute revalidatePath
 * dans un handler côté Next 16 (avec request context valide).
 *
 * Fail-soft : si REVALIDATE_SECRET ou NEXT_PUBLIC_SITE_URL absent → no-op
 * (logs warning en dev). Une revalidation ratée ne doit jamais faire
 * échouer un worker.
 */

export interface RevalidateInput {
  readonly paths?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
}

/**
 * Déclenche une revalidation cache via route API interne. Fire-and-forget
 * sauf si vous attendez le résultat (await retour Promise<void>).
 */
export async function revalidateContent(input: RevalidateInput): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!secret || !siteUrl) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[revalidate-content] REVALIDATE_SECRET or NEXT_PUBLIC_SITE_URL missing — skipping",
      );
    }
    return;
  }
  const url = `${siteUrl}/api/internal/revalidate`;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Revalidate-Secret": secret,
      },
      body: JSON.stringify({
        paths: input.paths ?? [],
        tags: input.tags ?? [],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok && process.env.NODE_ENV !== "production") {
      console.warn(`[revalidate-content] HTTP ${res.status} from ${url}`);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[revalidate-content] fetch error:",
        err instanceof Error ? err.message : String(err),
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}
