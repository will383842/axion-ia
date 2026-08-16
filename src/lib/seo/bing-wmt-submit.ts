// Soumission d'URLs à Bing Webmaster Tools — GEO-105 / GEO-106.
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Mesuré par l'audit GEO/AEO du 2026-08-14 : quand le site publie, **seul
// Yandex est réellement prévenu**. La cascade `@/lib/indexnow` vise trois
// endpoints, mais celui de Microsoft (`api.indexnow.org`) répond **403 depuis le
// 2026-08-11** — cause racine côté Microsoft, ticket ouvert, décision actée : on
// ne re-diagnostique pas.
//
// Or Bing alimente Copilot et le grounding de ChatGPT Search. Ne pas l'avertir,
// c'est laisser hors du circuit le moteur qui nourrit deux des moteurs de
// réponse qu'on cherche à atteindre.
//
// Un client Bing WMT existait déjà — avec ses fonctions de LECTURE, sans aucun
// appelant, et **sans fonction de soumission** : elle n'avait jamais été écrite.
// C'est ce trou que ce fichier comble, par une voie indépendante d'IndexNow.
//
// ⚠️ POURQUOI ICI ET PAS À CÔTÉ DU CLIENT EXISTANT
//
// Le client de lecture vit dans une zone dédiée au générateur de contenu, que
// `content-gen:isolation-check` (§ 4.1bis) interdit d'importer depuis `src/lib`.
// L'importer ferait rougir la CI sur une règle d'architecture parfaitement
// légitime. Ce module est donc autonome : il ne dépend d'aucun code de cette
// zone, et duplique volontairement les quelques lignes d'appel HTTP plutôt que
// de percer la frontière.

const BING_WMT_API = "https://ssl.bing.com/webmaster/api.svc/json";
const DEFAULT_SITE_URL = "https://axion-ia.com";

/**
 * Plafond par appel imposé par l'API `SubmitUrlBatch` de Bing.
 * Au-delà, l'appel entier est rejeté — on découpe donc en lots.
 */
const MAX_URLS_PAR_LOT = 500;

export interface BingSubmitResult {
  /** `false` quand la clé est absente : ce n'est PAS un échec, c'est une absence de configuration. */
  readonly configured: boolean;
  readonly submitted: number;
  readonly failed: number;
}

/** True si `BING_WMT_API_KEY` est renseignée. */
export function isBingSubmitReady(): boolean {
  return Boolean(process.env["BING_WMT_API_KEY"]?.trim());
}

/**
 * Soumet une liste d'URLs à Bing Webmaster Tools.
 *
 * Fail-soft, comme le reste de la chaîne de notification aux moteurs : ne throw
 * jamais. Une soumission ratée ne doit pas faire échouer une publication.
 *
 * 🔑 L'absence de clé est distinguée d'un échec d'envoi. Les confondre enverrait
 * chercher une panne réseau là où il manque une variable d'environnement —
 * exactement le temps perdu qu'on veut éviter à la prochaine personne.
 *
 * ⚠️ Bing partage un MÊME quota entre IndexNow et l'API de soumission. Si la
 * cascade IndexNow se remet un jour à fonctionner côté Microsoft, les deux
 * puiseront dans le même pool : surveiller `GetUrlSubmissionQuota` avant
 * d'augmenter la cadence.
 */
export async function submitUrlsToBing(
  urls: ReadonlyArray<string>,
  context = "publication",
): Promise<BingSubmitResult> {
  const apiKey = process.env["BING_WMT_API_KEY"]?.trim();
  if (!apiKey) {
    return { configured: false, submitted: 0, failed: 0 };
  }
  if (urls.length === 0) {
    return { configured: true, submitted: 0, failed: 0 };
  }

  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? DEFAULT_SITE_URL;
  let submitted = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i += MAX_URLS_PAR_LOT) {
    const lot = urls.slice(i, i + MAX_URLS_PAR_LOT);
    const endpoint = `${BING_WMT_API}/SubmitUrlBatch?apikey=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl, urlList: [...lot] }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        submitted += lot.length;
      } else {
        failed += lot.length;
        // Le corps de Bing porte souvent la cause exacte (quota, site non
        // vérifié, clé invalide) : le journaliser evite un aller-retour.
        const corps = await res.text().catch(() => "");
        console.warn(
          `[bing-submit] ${context} — HTTP ${res.status} sur ${lot.length} URLs : ${corps.slice(0, 200)}`,
        );
      }
    } catch (err) {
      failed += lot.length;
      console.warn(`[bing-submit] ${context} — echec reseau sur ${lot.length} URLs :`, err);
    }
  }

  return { configured: true, submitted, failed };
}
