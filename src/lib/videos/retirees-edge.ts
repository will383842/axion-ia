/**
 * 410 DES VIDÉOS RETIRÉES, côté proxy (lot W2, plan PLAN-W1-W4 §6.6, décision D6).
 *
 * Next 16 n'a pas de `gone()` natif (le « soft-410 » documenté ailleurs dans le dépôt reste le repli) et le proxy est
 * Edge, sans Prisma. On garde donc en mémoire de module la liste des slugs retirés,
 * rafraîchie au plus toutes les 5 minutes par un `fetch` vers l'adresse PUBLIQUE
 * `/api/interne/videos/retirees` (pas vers l'origine interne : on ne s'appuie pas sur le
 * bind de `next start`, cf. l'épisode « bind loopback » d'AGENTS.md).
 *
 * REPLI : liste injoignable → on laisse passer. La page rend alors `notFound()` (404 +
 * noindex), jamais une erreur. Un 410 manqué coûte une désindexation plus lente, pas une
 * panne.
 *
 * Aucun import : ce module tourne en Edge.
 */
export const RE_PAGE_VIDEO = /^\/(?:fr|en)\/videos\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

const TTL_MS = 5 * 60 * 1000;
/** Après un échec, on réessaie plus tôt qu'à l'échéance normale, sans harceler. */
const REESSAI_MS = 30 * 1000;
const DELAI_MS = 2000;

interface Etat {
  /** Instant avant lequel on ne ré-interroge pas. */
  jusqua: number;
  slugs: Set<string>;
}

let etat: Etat = { jusqua: 0, slugs: new Set() };

export function reinitialiserRetirees(): void {
  etat = { jusqua: 0, slugs: new Set() };
}

export interface DepsRetirees {
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  origine?: string;
  maintenant?: () => number;
}

async function rafraichir(deps: Required<DepsRetirees>): Promise<void> {
  const t = deps.maintenant();
  if (t < etat.jusqua) return;
  try {
    const r = await deps.fetchImpl(`${deps.origine}/api/interne/videos/retirees`, {
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!r.ok) throw new Error(`http ${r.status}`);
    const corps = await r.text();
    etat = {
      jusqua: t + TTL_MS,
      slugs: new Set(
        corps
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      ),
    };
  } catch {
    // Dernière liste connue conservée ; nouvel essai bientôt.
    etat = { jusqua: t + REESSAI_MS, slugs: etat.slugs };
  }
}

/** `410 Gone` si l'adresse est celle d'une vidéo retirée, sinon `null` (laisser passer). */
export async function reponseGoneSiRetiree(
  pathname: string,
  deps: DepsRetirees = {},
): Promise<Response | null> {
  const m = RE_PAGE_VIDEO.exec(pathname);
  if (!m) return null;
  await rafraichir({
    fetchImpl: deps.fetchImpl ?? ((url, init) => fetch(url, init)),
    origine: deps.origine ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com",
    maintenant: deps.maintenant ?? (() => Date.now()),
  });
  if (!etat.slugs.has(m[1]!)) return null;
  return new Response("Gone", {
    status: 410,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
