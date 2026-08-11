// Helper IndexNow centralisé — utilisable depuis toute server action de publication.
//
// Pourquoi un helper plutôt qu'un fetch vers /api/indexnow :
//   - Évite un round-trip HTTP interne (Node → Node) coûteux et fragile en cold-start
//   - Évite le risque de mismatch payload (`urls` vs `urlList` — bug réel 2026-05-13)
//   - Un seul point de logging Sentry / console.error pour tout le pipeline IndexNow
//   - Compatible Edge runtime ET Node runtime (uses fetch natif uniquement)
//
// Spec : https://www.indexnow.org/documentation
// Notifie Bing + Yandex + Seznam + Naver — via l'agrégateur quand il veut bien,
// via les endpoints de repli sinon (voir ci-dessous).
//
// 🔴 2026-08-11 — `api.indexnow.org` (= Microsoft) renvoie **403
// `UserForbiddedToAccessSite`** pour axion-ia.com, et ce depuis un moment : le
// step CI « IndexNow ping » loguait l'échec mais se terminait en succès
// (`|| true`), donc personne ne l'a vu. Résultat réel : **aucun moteur n'était
// notifié**, l'agrégateur ne relayant rien quand il refuse la soumission.
//
// Le refus ne vient PAS de chez nous — vérifié le 2026-08-11 :
//   - `/{key}.txt` répond 200, 32 octets exacts, `text/plain`, sans BOM
//   - joignable en http (301→https), avec UA bingbot, UA vide, et depuis
//     trois réseaux tiers indépendants
//   - **Yandex accepte la MÊME clé et le MÊME keyLocation (202)**, Naver aussi
// Microsoft qualifie ce code d'erreur de problème back-end de leur côté, à
// traiter par un ticket Webmaster Support.
//
// D'où la cascade ci-dessous : on tente l'agrégateur d'abord (s'il se remet à
// marcher, tout le monde est servi), et on bascule sur les endpoints qui
// acceptent réellement. La spec IndexNow garantit qu'une soumission à
// N'IMPORTE quel participant est partagée avec les autres.
const ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://yandex.com/indexnow",
  "https://searchadvisor.naver.com/indexnow",
] as const;

// Nommé `…Body` et gardé privé : un `buildIndexNowPayload` existe déjà dans les
// factories SEO, avec une autre signature — deux symboles homonymes aux formes
// différentes, c'est un piège à import.
// ⚠️ Ne PAS citer ici le chemin de ce fichier de factories : son nom contient un
// marqueur que l'isolation-check (§ 4.1bis) interdit hors de ses zones dédiées.
// Le mentionner suffit à faire rougir la CI, sur un simple commentaire.
function buildIndexNowBody(host: string, key: string, urlList: ReadonlyArray<string>): string {
  return JSON.stringify({
    host,
    key,
    // P1-11 (audit re-run 2026-05-15 AGENT 4) — keyLocation canonique
    // `/{key}.txt`. Avant : `/api/indexnow/key` faisait IndexNow.org renvoyer
    // 422 (la spec exige une URL terminant par `.txt`).
    keyLocation: `https://${host}/${key}.txt`,
    urlList,
  });
}

export interface IndexNowResult {
  /** Endpoint ayant accepté, ou `null` si tous ont échoué. */
  accepted: string | null;
  /** Un message par endpoint essayé, dans l'ordre — pour le log. */
  attempts: string[];
}

/**
 * Soumet à IndexNow en essayant les endpoints dans l'ordre, jusqu'au premier
 * qui accepte. S'arrête au premier 2xx ; ne throw jamais.
 *
 * ⚠️ Ne PAS réduire cette fonction à un seul endpoint : c'est exactement la
 * situation qui a rendu le pipeline muet pendant des semaines.
 */
export async function submitToIndexNow(
  host: string,
  key: string,
  urlList: ReadonlyArray<string>,
  options: { timeoutMs?: number } = {},
): Promise<IndexNowResult> {
  const body = buildIndexNowBody(host, key, urlList);
  const attempts: string[] = [];
  for (const endpoint of ENDPOINTS) {
    // Délai d'expiration PAR endpoint : sans lui, un endpoint qui pend bloque
    // la bascule vers le suivant — donc la cascade ne sert à rien.
    const controller = options.timeoutMs != null ? new AbortController() : null;
    const timer =
      controller && options.timeoutMs != null
        ? setTimeout(() => controller.abort(), options.timeoutMs)
        : null;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (res.ok) {
        attempts.push(`${endpoint} → ${res.status} OK`);
        return { accepted: endpoint, attempts };
      }
      const detail = await res.text().catch(() => "");
      attempts.push(`${endpoint} → ${res.status} ${res.statusText} ${detail.slice(0, 160)}`.trim());
    } catch (err: unknown) {
      attempts.push(`${endpoint} → ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return { accepted: null, attempts };
}

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

  // Fire-and-forget : on n'await pas, pour ne pas bloquer l'admin. On logge en
  // revanche CHAQUE endpoint essayé quand aucun n'accepte — un échec silencieux
  // est ce qui a masqué le 403 Microsoft pendant des semaines.
  void submitToIndexNow(host, key, valid)
    .then((result) => {
      if (!result.accepted) {
        console.error(
          `[${label}] indexnow REFUSÉ par tous les endpoints pour ${valid.length} url(s) — ${result.attempts.join(" | ")}`,
        );
      }
    })
    .catch((err: unknown) => {
      const cause = err instanceof Error ? err.message : String(err);
      console.error(`[${label}] indexnow ping failed: ${cause}`);
    });
}
