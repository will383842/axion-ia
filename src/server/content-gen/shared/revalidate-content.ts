/**
 * Content Generator — Revalidate helper for workers BG (Fix P1-16 audit
 * opérationnel 2026-05-14).
 *
 * `next/cache.revalidatePath` ne fonctionne pas dans un worker BullMQ
 * background (no request context, silent no-op). Ce helper fait un POST
 * HTTP interne sur `/api/internal/revalidate` qui exécute revalidatePath
 * dans un handler côté Next 16 (avec request context valide).
 *
 * Fail-soft : une revalidation ratée ne doit jamais faire échouer un worker
 * (la fonction ne throw JAMAIS). MAIS elle n'est plus muette :
 *
 * Fix 2026-08-15 (D1 audit e2e) — avant ce patch, tous les logs étaient gatés
 * par `NODE_ENV !== "production"` et la fonction retournait `void`. En prod,
 * un REVALIDATE_SECRET absent/faux, un 401/429/500 de la route interne ou un
 * timeout produisaient un no-op TOTALEMENT silencieux : la revalidation ISR
 * pouvait être cassée pendant des semaines sans aucun signal, pendant que les
 * workers logguaient « succès ». Désormais :
 *   - la fonction retourne `{ ok, reason }` pour que l'appelant journalise la
 *     VÉRITÉ (logStep succès vs logStepError échec, cf. content-publish-worker) ;
 *   - l'échec est loggué en `console.error` EN PRODUCTION AUSSI (JSON structuré,
 *     visible dans les logs conteneur Coolify).
 * NB : pas de capture Sentry ICI — le seul helper worker-safe du dépôt est
 * `captureWorkerError` (sentry-worker.ts), qui exige un WorkerName ; c'est donc
 * l'appelant (le worker) qui escalade vers Sentry avec sa propre identité.
 */

export interface RevalidateInput {
  readonly paths?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
}

/**
 * Résultat exploitable par les workers appelants (Fix 2026-08-15 D1).
 * `ok=false` + `reason` machine-readable : `missing_env`, `http_<status>`,
 * `fetch_error:<message>` (inclut les timeouts AbortError à 10 s).
 */
export interface RevalidateResult {
  readonly ok: boolean;
  readonly reason?: string;
}

/** Log d'échec structuré, émis dans TOUS les environnements (Fix 2026-08-15 D1). */
function logRevalidateFailure(reason: string, input: RevalidateInput): void {
  console.error(
    JSON.stringify({
      event: "revalidate_content_failed",
      reason,
      paths_count: input.paths?.length ?? 0,
      tags_count: input.tags?.length ?? 0,
      paths_sample: (input.paths ?? []).slice(0, 5),
    }),
  );
}

/**
 * Déclenche une revalidation cache via route API interne. Ne throw JAMAIS —
 * l'appelant lit le résultat retourné pour journaliser succès ou échec.
 */
export async function revalidateContent(input: RevalidateInput): Promise<RevalidateResult> {
  const secret = process.env.REVALIDATE_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!secret || !siteUrl) {
    // Fix 2026-08-15 (D1) — secret/URL absents en prod = revalidation ISR morte
    // pour TOUTES les publications : ça doit hurler, pas se taire.
    const reason = `missing_env:${!secret ? "REVALIDATE_SECRET" : ""}${!secret && !siteUrl ? "+" : ""}${!siteUrl ? "NEXT_PUBLIC_SITE_URL" : ""}`;
    logRevalidateFailure(reason, input);
    return { ok: false, reason };
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
    if (!res.ok) {
      // Fix 2026-08-15 (D1) — un 401 (secret désynchronisé), 429 ou 500 de la
      // route interne était invisible en prod. Loggué + remonté à l'appelant.
      const reason = `http_${res.status}`;
      logRevalidateFailure(reason, input);
      return { ok: false, reason };
    }
    return { ok: true };
  } catch (err) {
    // Fix 2026-08-15 (D1) — timeout (AbortError 10 s) ou erreur réseau : même
    // traitement, loggué en prod + remonté à l'appelant. Toujours pas de throw.
    const reason = `fetch_error:${err instanceof Error ? err.message : String(err)}`;
    logRevalidateFailure(reason, input);
    return { ok: false, reason };
  } finally {
    clearTimeout(timeout);
  }
}
