// Helper IndexNow centralisé — utilisable depuis toute server action de publication.
//
// Pourquoi un helper plutôt qu'un fetch vers /api/indexnow :
//   - Évite un round-trip HTTP interne (Node → Node) coûteux et fragile en cold-start
//   - Évite le risque de mismatch payload (`urls` vs `urlList` — bug réel 2026-05-13)
//   - Un seul point de logging Sentry / console.error pour tout le pipeline IndexNow
//   - Compatible Edge runtime ET Node runtime (uses fetch natif uniquement)
//
// Spec : https://www.indexnow.org/documentation
// Notifie en cascade Bing + Yandex + Seznam + Naver via api.indexnow.org.

const ENDPOINT = "https://api.indexnow.org/indexnow";

function siteHost(): string {
  return (process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(
    /^https?:\/\//,
    "",
  );
}

/**
 * Notifie IndexNow d'un set d'URLs nouvelles ou mises à jour.
 *
 * Comportement fire-and-forget — n'attend pas la réponse upstream pour
 * débloquer l'admin. Log Sentry/console en cas d'échec, jamais throw.
 *
 * No-op (warn) si INDEXNOW_KEY non défini → safe en dev et en preview.
 *
 * @param urls Liste d'URLs absolues (https://axion-ia.com/...)
 * @param context Label optionnel pour les logs (ex: "blog", "case-study:abc123")
 */
export function pingIndexNow(urls: ReadonlyArray<string>, context?: string): void {
  if (urls.length === 0) return;

  const key = process.env["INDEXNOW_KEY"];
  const host = siteHost();
  const label = context ?? "indexnow";

  if (!key) {
    if (process.env["NODE_ENV"] !== "production") {
      console.warn(`[${label}] INDEXNOW_KEY missing — would notify ${urls.length} url(s)`);
    }
    return;
  }

  // Validation : toutes les URLs doivent matcher l'host configuré
  // (IndexNow refuse le batch entier sinon, code 422).
  const valid = urls.filter((u) => {
    try {
      return new URL(u).host === host;
    } catch {
      return false;
    }
  });
  if (valid.length === 0) {
    console.error(`[${label}] no valid URLs for host=${host}, ignored ${urls.length} input(s)`);
    return;
  }

  // P1-11 (audit re-run 2026-05-15 AGENT 4) — keyLocation canonique `/{key}.txt`.
  // Avant : `/api/indexnow/key` faisait IndexNow.org renvoyer 422 (la spec
  // exige une URL terminant par `.txt`). Aligné avec `app/api/indexnow/route.ts:51`
  // qui pointe déjà vers `/{key}.txt` (exposé via /public depuis 2026-05-13,
  // matcher proxy.ts exclut `.*\\.txt$` du i18n redirect).
  //
  // Fire-and-forget : on n'await pas. Mais on attache un catch pour logger
  // les erreurs réseau dans Sentry/console (sans bloquer l'admin).
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList: valid,
    }),
  })
    .then((res) => {
      if (!res.ok) {
        console.error(
          `[${label}] indexnow HTTP ${res.status} for ${valid.length} url(s): ${valid.join(", ")}`,
        );
      }
    })
    .catch((err: unknown) => {
      const cause = err instanceof Error ? err.message : String(err);
      console.error(`[${label}] indexnow ping failed: ${cause}`);
    });
}
