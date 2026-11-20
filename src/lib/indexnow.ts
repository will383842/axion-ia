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
import {
  isBingSubmitReady,
  submitUrlsToBingDetaille,
  type BingSubmitDetail,
} from "@/lib/seo/bing-wmt-submit";
import {
  alerterEchecSignalement,
  classerErreur,
  type TypeErreurSignalement,
} from "@/lib/seo/signalement-moteurs";

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

/** Un endpoint IndexNow en échec — pour le journal et l'alerte (V1-07). */
export interface EchecEndpoint {
  readonly endpoint: string;
  /** Code HTTP, `null` pour un timeout ou une panne réseau. */
  readonly statut: number | null;
  readonly type: TypeErreurSignalement;
}

export interface IndexNowResult {
  /** Détail structuré des endpoints en échec, dans l'ordre d'essai. */
  echecs?: EchecEndpoint[];
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
  const echecs: EchecEndpoint[] = [];
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
        return { accepted: endpoint, attempts, echecs };
      }
      echecs.push({ endpoint, statut: res.status, type: classerErreur(res.status) });
      const detail = await res.text().catch(() => "");
      attempts.push(`${endpoint} → ${res.status} ${res.statusText} ${detail.slice(0, 160)}`.trim());
    } catch (err: unknown) {
      echecs.push({ endpoint, statut: null, type: classerErreur(null, err) });
      attempts.push(`${endpoint} → ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return { accepted: null, attempts, echecs };
}

export interface RapportSignalement {
  /** `null` : clé absente, IndexNow non tenté. */
  readonly indexnow: IndexNowResult | null;
  /** `null` : Bing non tenté (mode « repli » et IndexNow a accepté). */
  readonly bing: BingSubmitDetail | null;
}

const DELAI_INDEXNOW_PAR_DEFAUT_MS = 15_000;

/**
 * GEO V1-07 — signale des URLs aux deux portes (IndexNow, API Bing) et NE LAISSE
 * PLUS un refus passer inaperçu : journal structuré + alerte (anti-bruit : une
 * par heure et par type), et repli sur l'autre porte.
 *
 * - `bing: "toujours"` (défaut, publication par action serveur) : les deux
 *   portes partent en parallèle, chacune est le repli de l'autre.
 * - `bing: "repli"` (worker `content-indexnow`) : Bing n'est appelé que si
 *   IndexNow n'a été accepté par aucun endpoint (ménage du quota partagé).
 *
 * Alerte IndexNow : seulement quand AUCUN endpoint n'accepte. Le 403 permanent
 * de Microsoft, rattrapé par Yandex, reste au journal (sinon : une alerte par
 * heure et par publication, à vie).
 * Ne throw jamais.
 */
export async function signalerAuxMoteurs(
  host: string,
  key: string | undefined,
  urls: ReadonlyArray<string>,
  label: string,
  options: { bing?: "toujours" | "repli"; timeoutMs?: number } = {},
): Promise<RapportSignalement> {
  const mode = options.bing ?? "toujours";
  const timeoutMs = options.timeoutMs ?? DELAI_INDEXNOW_PAR_DEFAUT_MS;
  const versBing = (): Promise<BingSubmitDetail | null> =>
    submitUrlsToBingDetaille([...urls], label).catch((err: unknown) => {
      console.error(`[${label}] bing : echec inattendu —`, err);
      return null;
    });
  const versIndexNow = (): Promise<IndexNowResult | null> =>
    key
      ? submitToIndexNow(host, key, urls, { timeoutMs }).catch((err: unknown) => ({
          accepted: null,
          attempts: [err instanceof Error ? err.message : String(err)],
          echecs: [{ endpoint: "indexnow", statut: null, type: classerErreur(null, err) }],
        }))
      : Promise.resolve(null);

  let indexnow: IndexNowResult | null;
  let bing: BingSubmitDetail | null;
  if (mode === "toujours") {
    [indexnow, bing] = await Promise.all([versIndexNow(), versBing()]);
  } else {
    indexnow = await versIndexNow();
    bing = indexnow?.accepted ? null : await versBing();
  }

  const bingOk = bing != null && bing.configured && bing.failed === 0 && bing.submitted > 0;
  try {
    if (indexnow && !indexnow.accepted) {
      const premier = indexnow.echecs?.[0];
      await alerterEchecSignalement({
        moteur: "indexnow",
        type: premier?.type ?? "reseau",
        statut: premier?.statut ?? null,
        detail: indexnow.attempts.join(" | "),
        nbUrls: urls.length,
        contexte: label,
        repli: bingOk
          ? "API Bing a pris le relais (soumission acceptée)"
          : bing?.configured
            ? "API Bing tentée mais en échec aussi"
            : "aucun repli configuré (BING_WMT_API_KEY absente)",
      });
    }
    if (bing && bing.configured && bing.failed > 0) {
      const premier = bing.echecs[0];
      await alerterEchecSignalement({
        moteur: "bing",
        type: classerErreur(premier?.statut ?? null, premier?.erreur),
        statut: premier?.statut ?? null,
        detail: premier?.detail || `${bing.failed} url(s) refusée(s)`,
        nbUrls: bing.failed,
        contexte: label,
        repli: !key
          ? "aucun repli configuré (INDEXNOW_KEY absente)"
          : indexnow?.accepted
            ? `IndexNow a pris le relais (${indexnow.accepted})`
            : "IndexNow tenté mais en échec aussi",
      });
    }
  } catch {
    // jamais d'échec de publication à cause d'une alerte
  }
  return { indexnow, bing };
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

  // Validation REMONTEE avant le controle de cle (GEO-105) : elle ne depend
  // d'aucune cle, et Bing doit pouvoir etre notifie meme si `INDEXNOW_KEY` est
  // absente. Les deux mecanismes sont independants — les enchainer ferait
  // dependre l'un de la configuration de l'autre.
  //
  // Toutes les URLs doivent matcher l'host configure (IndexNow refuse le batch
  // entier sinon, code 422).
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

  // 🔴 GEO-105 / GEO-106 / V1-07 — BING ET INDEXNOW, EN PARALLELE, CHACUN
  // REPLI DE L'AUTRE. Mesure de l'audit : l'endpoint Microsoft de la cascade
  // repond 403 depuis le 2026-08-11 (cause cote Microsoft, ticket ouvert, on ne
  // re-diagnostique pas) ; la voie directe Bing (`SubmitUrlBatch`) n'est pas
  // concernee. Un echec, d'un cote ou de l'autre, est journalise et alerte par
  // `signalerAuxMoteurs`. Fire-and-forget : une soumission ratee ne doit jamais
  // faire echouer une publication. L'absence de cle est distinguee d'une panne.
  if (!key && !isBingSubmitReady() && process.env["NODE_ENV"] !== "production") {
    console.warn(
      `[${label}] INDEXNOW_KEY et BING_WMT_API_KEY absentes — ${valid.length} url(s) non soumises`,
    );
  }
  void signalerAuxMoteurs(host, key, valid, label).catch((err: unknown) => {
    console.error(`[${label}] signalement aux moteurs : echec inattendu —`, err);
  });
}
