// Invalidation à deux étages : cache Next (origine) + cache Cloudflare (edge).
//
// 🔴 POURQUOI CE FICHIER EXISTE — GEO-120 (audit GEO/AEO du 2026-08-14, lot 19)
//
// Mesuré : **aucune mutation de contenu ne purgeait l'edge**. `revalidatePath()`
// n'invalide que le cache de l'origine ; Cloudflare, lui, continue de servir sa
// copie jusqu'à expiration du `s-maxage` (3 600 s sur les hubs, 86 400 s sur les
// pages éditoriales). Autrement dit : publier un article le rendait visible à
// l'origine, mais **le public et les crawlers voyaient l'ancienne version pendant
// une heure à un jour**.
//
// Le dépôt savait déjà purger — une seule fois, dans
// `observatoire-snapshot-worker.ts`, pour deux URLs codées en dur. Ce module
// généralise ce code éprouvé au lieu d'en écrire un second.
//
// ⚠️ PLAFOND DÉLIBÉRÉ. Le plan Cloudflare Free limite les purges par URL. On
// borne donc à `MAX_URLS_PAR_PURGE` par appel, et **on journalise ce qui est
// écarté** : une troncature silencieuse se lit comme « tout a été purgé » alors
// que la fin de la liste ne l'a pas été. Si un jour une publication dépasse ce
// plafond, c'est le signe qu'il faut purger par tag ou par préfixe, pas relever
// la borne en aveugle.

/** Plafond d'URLs par appel de purge (quota Cloudflare Free). */
export const MAX_URLS_PAR_PURGE = 30;

const CF_API = "https://api.cloudflare.com/client/v4";
const SITE_PAR_DEFAUT = "https://axion-ia.com";

export interface ResultatInvalidation {
  /** Chemins effectivement passés à `revalidatePath()`. */
  readonly cheminsRevalides: string[];
  /** URLs effectivement envoyées à Cloudflare. */
  readonly urlsPurgees: string[];
  /**
   * `false` quand les secrets Cloudflare sont absents.
   *
   * 🔑 Ce n'est PAS un échec : en local et dans les tests, il n'y a pas d'edge à
   * purger. Confondre « non configuré » et « en panne » envoie chercher un
   * problème réseau là où il manque une variable d'environnement.
   */
  readonly edgeConfigure: boolean;
  /** Nombre d'URLs écartées par le plafond — journalisé, jamais silencieux. */
  readonly urlsEcartees: number;
}

/** `true` si les deux secrets Cloudflare sont présents. */
export function edgePurgeDisponible(): boolean {
  return Boolean(process.env["CLOUDFLARE_API_TOKEN"] && process.env["CLOUDFLARE_ZONE_ID"]);
}

function siteBase(): string {
  return process.env["NEXT_PUBLIC_SITE_URL"] ?? SITE_PAR_DEFAUT;
}

/**
 * Transforme des chemins en URLs absolues dédupliquées, dans l'ordre d'arrivée.
 *
 * L'ordre compte : quand le plafond tronque, ce sont les DERNIERS chemins qui
 * sautent. Les appelants passent donc le plus important d'abord (la page
 * publiée), les pages de liste ensuite.
 */
function versUrlsAbsolues(chemins: ReadonlyArray<string>): string[] {
  const base = siteBase().replace(/\/$/, "");
  const vues = new Set<string>();
  const sorties: string[] = [];
  for (const chemin of chemins) {
    if (typeof chemin !== "string" || !chemin.startsWith("/")) continue;
    const url = `${base}${chemin}`;
    if (vues.has(url)) continue;
    vues.add(url);
    sorties.push(url);
  }
  return sorties;
}

/**
 * Purge une liste d'URLs du cache Cloudflare.
 *
 * Fail-soft : ne throw jamais. Une purge ratée ne doit pas faire échouer la
 * publication qui l'a déclenchée — le contenu est déjà en base, et le
 * `s-maxage` finira par expirer de lui-même.
 */
export async function purgerEdge(
  urls: ReadonlyArray<string>,
  contexte = "publication",
): Promise<{ purgees: string[]; ecartees: number; configure: boolean }> {
  const token = process.env["CLOUDFLARE_API_TOKEN"];
  const zone = process.env["CLOUDFLARE_ZONE_ID"];
  if (!token || !zone) {
    return { purgees: [], ecartees: 0, configure: false };
  }
  if (urls.length === 0) {
    return { purgees: [], ecartees: 0, configure: true };
  }

  const retenues = urls.slice(0, MAX_URLS_PAR_PURGE);
  const ecartees = urls.length - retenues.length;
  if (ecartees > 0) {
    console.warn(
      `[cache] ${contexte} — ${ecartees} URL(s) au-dela du plafond de ${MAX_URLS_PAR_PURGE} ` +
        `NE SONT PAS purgees : ${urls.slice(MAX_URLS_PAR_PURGE).join(", ")}`,
    );
  }

  try {
    const res = await fetch(`${CF_API}/zones/${zone}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ files: retenues }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const corps = await res.text().catch(() => "");
      console.warn(
        `[cache] ${contexte} — purge CF HTTP ${res.status} sur ${retenues.length} URLs : ${corps.slice(0, 200)}`,
      );
      return { purgees: [], ecartees, configure: true };
    }
    return { purgees: retenues, ecartees, configure: true };
  } catch (err) {
    console.warn(`[cache] ${contexte} — purge CF injoignable (non bloquant) :`, err);
    return { purgees: [], ecartees, configure: true };
  }
}

/**
 * Invalide les deux étages pour une liste de chemins.
 *
 * 🔑 L'ordre est imposé : **origine d'abord, edge ensuite**. Purger l'edge avant
 * d'avoir invalidé l'origine ferait recharger à Cloudflare... exactement la page
 * périmée qu'on cherchait à chasser, et la referait vivre pour un `s-maxage`
 * entier. C'est le genre d'inversion qui rend une purge non seulement inutile
 * mais contre-productive.
 *
 * @param revalider Injecté par l'appelant (`revalidatePath` de `next/cache`).
 *   `revalidatePath` exige un contexte de requête : il ne peut pas être appelé
 *   depuis un worker BullMQ, d'où la route interne qui sert de relais. Le passer
 *   en paramètre garde ce module testable sans monter un contexte Next.
 */
export async function revalidateAndPurge(
  chemins: ReadonlyArray<string>,
  revalider: (chemin: string) => void,
  contexte = "publication",
  /**
   * Purger la copie d'edge Cloudflare après avoir invalidé l'origine.
   *
   * Vrai par défaut, et c'est le bon défaut : invalider l'origine sans purger
   * l'edge laisse la page périmée pour le public et pour les robots (GEO-120).
   *
   * 🔴 À passer à FAUX quand le chemin n'a PAS de copie d'edge — une page qui
   * répond `no-store` sort en `cf-cache-status: BYPASS`. Purger l'edge y est
   * sans effet, et consomme le quota. Ajouté le 2026-08-27 : brancher
   * l'invalidation des créneaux de `/fr/appel` sur un cron de 2 min aurait
   * émis 720 purges par jour pour rien.
   */
  purgerLEdge = true,
): Promise<ResultatInvalidation> {
  const cheminsRevalides: string[] = [];
  for (const chemin of chemins) {
    if (typeof chemin !== "string" || !chemin.startsWith("/")) continue;
    try {
      revalider(chemin);
      cheminsRevalides.push(chemin);
    } catch (err) {
      console.warn(`[cache] ${contexte} — revalidatePath a echoue sur ${chemin} :`, err);
    }
  }

  if (!purgerLEdge) {
    // `edgeConfigure: false` dit ici « pas d'edge à purger pour CES chemins »,
    // et non « secrets Cloudflare absents ». L'appelant qui passe `false` sait
    // déjà pourquoi ; ce qui compte est qu'aucune URL ne soit comptée comme
    // purgée ni comme écartée.
    return { cheminsRevalides, urlsPurgees: [], edgeConfigure: false, urlsEcartees: 0 };
  }

  const urls = versUrlsAbsolues(cheminsRevalides);
  const { purgees, ecartees, configure } = await purgerEdge(urls, contexte);

  return {
    cheminsRevalides,
    urlsPurgees: purgees,
    edgeConfigure: configure,
    urlsEcartees: ecartees,
  };
}
