// Documents du projet (ADR 0063) — ce qu'une requête de ces routes ne doit
// JAMAIS laisser partir chez Sentry.
//
// `@sentry/node-core` capture par défaut le CORPS des requêtes entrantes et
// leurs en-têtes, malgré `sendDefaultPii: false`. Deux familles de requêtes
// portent ici un secret ou un contenu :
//   · le lien public `/document/<id>/<jeton>` : le jeton est dans le chemin
//     (masqué par `SEGMENTS_SECRETS`), mais aussi dans `Next-Router-State-Tree`
//     et dans un `Referer` ;
//   · la page d'un projet (`…/qualiopi/clients/<id>/projets/<id>`), où partent
//     les actions d'envoi de fichier : le corps multipart est le FICHIER du
//     client, avec le titre et le lien saisis par Will.
// Pour elles, on retire le corps, la chaîne de requête et les en-têtes qui
// recopient l'état du routeur, l'action ou la page d'origine. Le reste du
// nettoyage (`sentry-pii-scrub.ts`) s'applique ensuite comme partout.
//
// Module pur (Edge-compatible), appelé par les deux crochets de
// `sentry-pii-scrub.ts`. Test : `sentry-pii-scrub.document.spec.ts`.

const CHEMINS_DES_DOCUMENTS: ReadonlyArray<RegExp> = [
  /\/document\/[0-9a-fA-F-]{36}(?:[/?#]|$)/,
  /\/qualiopi\/clients\/[0-9a-fA-F-]{36}\/projets\/[0-9a-fA-F-]{36}(?:[/?#]|$)/,
];

const ENTETES_RETIRES = new Set(["next-router-state-tree", "next-action", "next-url", "referer"]);

interface RequeteSentry {
  url?: string | undefined;
  data?: unknown;
  query_string?: unknown;
  headers?: Record<string, string> | undefined;
}

/** Vide, sur place, ce qu'une requête des documents du projet ne doit pas envoyer. */
export function viderRequeteDesDocuments(requete: RequeteSentry | undefined): void {
  if (!requete || typeof requete.url !== "string") return;
  const url = requete.url;
  if (!CHEMINS_DES_DOCUMENTS.some((re) => re.test(url))) return;
  delete requete.data;
  delete requete.query_string;
  if (requete.headers) {
    for (const cle of Object.keys(requete.headers)) {
      if (ENTETES_RETIRES.has(cle.toLowerCase())) delete requete.headers[cle];
    }
  }
}
