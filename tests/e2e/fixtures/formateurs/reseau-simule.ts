// Banc @formateurs — le RÉSEAU du processus est remplacé, et rien ne sort.
//
// Une route de réponse par service simulé ; toute autre adresse est REFUSÉE
// (exactement comme une coupure réseau : `TypeError`) et notée au journal.
// Le code serveur traite déjà la coupure comme un cas nominal (« best-effort »)
// partout où il appelle l'extérieur — Telegram, Plausible, Google Agenda,
// Meta — donc refuser ne change pas le chemin testé, et garantit qu'aucun
// test du banc n'atteint un vrai service.
//
// 🔑 Ce module ne s'utilise QUE dans le processus `tsx` côté serveur
// (`serveur/executer.ts`), jamais dans le serveur Next : aucune horloge ni
// réseau truqué n'existe dans l'application elle-même.

export type ReponseSimulee = Response | Promise<Response>;

/** Une route : rend une réponse si elle reconnaît l'adresse, `null` sinon. */
export type RouteSimulee = (url: URL, init: RequestInit | undefined) => ReponseSimulee | null;

export interface AppelReseau {
  readonly methode: string;
  readonly url: string;
  readonly servi: boolean;
}

export interface ReseauSimule {
  /** Tous les appels vus, servis ou refusés, dans l'ordre. */
  readonly journal: AppelReseau[];
  /** Remet le `fetch` d'origine. */
  restaurer(): void;
}

/** JSON en réponse HTTP — le seul format que les services simulés rendent. */
export function json(corps: unknown, statut = 200, entetes: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "content-type": "application/json", ...entetes },
  });
}

/** Remplace `globalThis.fetch` par un routeur sur les services simulés. */
export function installerReseauSimule(routes: readonly RouteSimulee[]): ReseauSimule {
  const origine = globalThis.fetch;
  const journal: AppelReseau[] = [];

  globalThis.fetch = (async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const brute =
      typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    const methode = (
      init?.method ?? (entree instanceof Request ? entree.method : "GET")
    ).toUpperCase();
    const url = new URL(brute);
    for (const route of routes) {
      const reponse = route(url, init);
      if (reponse !== null) {
        journal.push({ methode, url: url.href, servi: true });
        return reponse;
      }
    }
    journal.push({ methode, url: url.href, servi: false });
    throw new TypeError(`banc @formateurs : réseau coupé vers ${url.host}`);
  }) as typeof fetch;

  return {
    journal,
    restaurer() {
      globalThis.fetch = origine;
    },
  };
}
